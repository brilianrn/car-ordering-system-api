import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { GeospatialService } from '@/shared/services/geospatial.service';
import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { ICombinedRoute } from '../domain/response';
import { CarpoolAuditService } from './carpool-audit.service';
import { CarpoolConfigService } from './carpool-config.service';

@Injectable()
export class CarpoolMergeEngineService {
  private readonly db = clientDb;

  constructor(
    private readonly configService: CarpoolConfigService,
    private readonly auditService: CarpoolAuditService,
    private readonly geospatialService: GeospatialService,
  ) {}

  /**
   * Validate pre-merge conditions
   */
  async validatePreMerge(carpoolGroupId: number): Promise<{ valid: boolean; reason?: string }> {
    try {
      const carpoolGroup = await this.db.carpoolGroup.findUnique({
        where: { id: carpoolGroupId },
        include: {
          hostBooking: {
            include: {
              segments: {
                where: { deletedAt: null },
                orderBy: { segmentNo: 'asc' },
              },
            },
          },
          invites: {
            where: { deletedAt: null },
            include: {
              joinerBooking: {
                include: {
                  segments: {
                    where: { deletedAt: null },
                    orderBy: { segmentNo: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (!carpoolGroup) {
        return { valid: false, reason: 'Carpool group not found' };
      }

      // 1. Double Consent Check
      const pendingInvites = carpoolGroup.invites.filter((invite) => invite.consentStatus === 'PENDING');
      if (pendingInvites.length > 0) {
        return { valid: false, reason: 'Some invites are still pending approval' };
      }

      const declinedInvites = carpoolGroup.invites.filter((invite) => invite.consentStatus === 'DECLINED');
      if (declinedInvites.length > 0) {
        return { valid: false, reason: 'Some invites have been declined' };
      }

      const expiredInvites = carpoolGroup.invites.filter((invite) => invite.consentStatus === 'EXPIRED');
      if (expiredInvites.length > 0) {
        return { valid: false, reason: 'Some invites have expired' };
      }

      const approvedInvites = carpoolGroup.invites.filter((invite) => invite.consentStatus === 'APPROVED');
      if (approvedInvites.length === 0) {
        return { valid: false, reason: 'No approved invites found' };
      }

      // 2. Detour Limit Check
      const config = await this.configService.getConfig();
      const combinedRoute = await this.calculateCombinedRoute(carpoolGroup);
      if (combinedRoute.detourPercentage > config.maxDetourPercentage) {
        return {
          valid: false,
          reason: `Detour percentage (${combinedRoute.detourPercentage}%) exceeds maximum allowed (${config.maxDetourPercentage}%)`,
        };
      }

      return { valid: true };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error validating pre-merge',
        error instanceof Error ? error.stack : undefined,
        'CarpoolMergeEngineService.validatePreMerge',
      );
      return { valid: false, reason: error instanceof Error ? error.message : 'Validation failed' };
    }
  }

  /**
   * Merge bookings into carpool group
   */
  async mergeCarpool(carpoolGroupId: number, userId: string): Promise<any> {
    try {
      // Validate pre-merge
      const validation = await this.validatePreMerge(carpoolGroupId);
      if (!validation.valid) {
        throw new Error(validation.reason || 'Pre-merge validation failed');
      }

      const carpoolGroup = await this.db.carpoolGroup.findUnique({
        where: { id: carpoolGroupId },
        include: {
          hostBooking: {
            include: {
              segments: {
                where: { deletedAt: null },
                orderBy: { segmentNo: 'asc' },
              },
            },
          },
          invites: {
            where: {
              consentStatus: 'APPROVED',
              deletedAt: null,
            },
            include: {
              joinerBooking: {
                include: {
                  segments: {
                    where: { deletedAt: null },
                    orderBy: { segmentNo: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (!carpoolGroup) {
        throw new Error('Carpool group not found');
      }

      // Calculate pre-merge distance (sum of individual booking distances)
      const preMergeDistance = this.calculatePreMergeDistance(carpoolGroup);

      // Calculate combined route
      const combinedRoute = await this.calculateCombinedRoute(carpoolGroup);

      // Calculate post-merge distance and detour percentage
      const postMergeDistance = combinedRoute.totalDistance;
      const hostOriginalDistance = carpoolGroup.hostBooking.segments[0]?.estKm || 0;
      const detourPercentage =
        hostOriginalDistance > 0 ? ((postMergeDistance - hostOriginalDistance) / hostOriginalDistance) * 100 : 0;

      // Validate detour percentage against config
      const config = await this.configService.getConfig();
      if (detourPercentage > config.maxDetourPercentage) {
        Logger.warn(
          `Detour percentage (${detourPercentage.toFixed(2)}%) exceeds maximum allowed (${config.maxDetourPercentage}%)`,
          'CarpoolMergeEngineService.mergeCarpool',
        );
        // Soft block: allow merge but log warning (GA can override)
      }

      // Use transaction to ensure atomicity
      return await this.db.$transaction(async (tx) => {
        // Update host booking status to MERGED
        await tx.booking.update({
          where: { id: carpoolGroup.hostBookingId },
          data: {
            bookingStatus: BookingStatus.MERGED,
            updatedBy: userId,
          },
        });

        // Update joiner bookings status to MERGED and link to carpool group
        for (const invite of carpoolGroup.invites) {
          await tx.booking.update({
            where: { id: invite.joinerBookingId },
            data: {
              bookingStatus: BookingStatus.MERGED,
              carpoolGroupId: carpoolGroupId,
              updatedBy: userId,
            },
          });
        }

        // Update carpool group with combined route and metrics
        const combinedRouteForDb = {
          ...combinedRoute,
          waypoints: combinedRoute.waypoints.map((waypoint) => ({
            ...waypoint,
            estimatedTime: waypoint.estimatedTime.toISOString(),
          })),
        };

        await tx.carpoolGroup.update({
          where: { id: carpoolGroupId },
          data: {
            combinedRoute: combinedRouteForDb as Prisma.InputJsonValue,
            preMergeDistance,
            postMergeDistance,
            detourPercentage: Math.max(0, detourPercentage),
            status: 'Merged',
            updatedBy: userId,
          },
        });

        // Log merge action with geospatial metrics
        await this.auditService.logAction({
          carpoolGroupId,
          hostBookingId: carpoolGroup.hostBookingId,
          actionType: 'MERGE',
          userId,
          newValue: {
            combinedRoute,
            mergedBookings: carpoolGroup.invites.map((inv) => inv.joinerBookingId),
            preMergeDistance,
            postMergeDistance,
            detourPercentage: Math.max(0, detourPercentage),
          },
        });

        return carpoolGroup;
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error merging carpool',
        error instanceof Error ? error.stack : undefined,
        'CarpoolMergeEngineService.mergeCarpool',
      );
      throw error;
    }
  }

  /**
   * Calculate combined route from carpool group
   * Uses GeospatialService for accurate route calculation
   */
  private async calculateCombinedRoute(carpoolGroup: any): Promise<ICombinedRoute> {
    const waypoints: ICombinedRoute['waypoints'] = [];
    let sequence = 1;

    // Add host booking pickup
    const hostSegment = carpoolGroup.hostBooking.segments[0];
    if (hostSegment) {
      waypoints.push({
        bookingId: carpoolGroup.hostBookingId,
        bookingNumber: carpoolGroup.hostBooking.bookingNumber,
        type: 'PICKUP',
        location: hostSegment.from,
        passengerCount: carpoolGroup.hostBooking.passengerCount,
        sequence: sequence++,
        estimatedTime: carpoolGroup.hostBooking.startAt,
      });
    }

    // Add joiner bookings pickups
    for (const invite of carpoolGroup.invites) {
      const joinerSegment = invite.joinerBooking.segments[0];
      if (joinerSegment) {
        waypoints.push({
          bookingId: invite.joinerBookingId,
          bookingNumber: invite.joinerBooking.bookingNumber,
          type: 'PICKUP',
          location: joinerSegment.from,
          passengerCount: invite.joinerBooking.passengerCount,
          sequence: sequence++,
          estimatedTime: invite.joinerBooking.startAt,
        });
      }
    }

    // Add drop-offs (sorted by estimated time)
    const dropOffs: Array<{
      bookingId: number;
      bookingNumber: string;
      location: string;
      estimatedTime: Date;
    }> = [];

    if (hostSegment) {
      dropOffs.push({
        bookingId: carpoolGroup.hostBookingId,
        bookingNumber: carpoolGroup.hostBooking.bookingNumber,
        location: hostSegment.to,
        estimatedTime: carpoolGroup.hostBooking.endAt,
      });
    }

    for (const invite of carpoolGroup.invites) {
      const joinerSegment = invite.joinerBooking.segments[0];
      if (joinerSegment) {
        dropOffs.push({
          bookingId: invite.joinerBookingId,
          bookingNumber: invite.joinerBooking.bookingNumber,
          location: joinerSegment.to,
          estimatedTime: invite.joinerBooking.endAt,
        });
      }
    }

    // Sort drop-offs by time
    dropOffs.sort((a, b) => a.estimatedTime.getTime() - b.estimatedTime.getTime());

    // Add drop-offs to waypoints
    for (const drop of dropOffs) {
      const booking =
        carpoolGroup.hostBooking.id === drop.bookingId
          ? carpoolGroup.hostBooking
          : carpoolGroup.invites.find((inv: any) => inv.joinerBookingId === drop.bookingId)?.joinerBooking;

      if (booking) {
        waypoints.push({
          bookingId: drop.bookingId,
          bookingNumber: drop.bookingNumber,
          type: 'DROP',
          location: drop.location,
          passengerCount: booking.passengerCount,
          sequence: sequence++,
          estimatedTime: drop.estimatedTime,
        });
      }
    }

    // Calculate total distance and duration using GeospatialService
    const totalDistance = await this.calculateTotalDistance(waypoints);
    const totalDuration = this.estimateTotalDuration(waypoints);

    return {
      waypoints,
      totalDistance,
      totalDuration,
      detourPercentage: 0, // Will be calculated in mergeCarpool method
    };
  }

  /**
   * Calculate total distance using GeospatialService
   * Uses route calculation if coordinates are available, otherwise falls back to estimation
   */
  private async calculateTotalDistance(waypoints: ICombinedRoute['waypoints']): Promise<number> {
    if (waypoints.length < 2) {
      return 0;
    }

    try {
      // Try to calculate route using geospatial service
      // Build waypoints array from locations
      const locations: Array<{ lat: number; lng: number } | string> = [];

      for (const waypoint of waypoints) {
        // Try to get coordinates from segment if available
        // For now, use location string and let geospatial service geocode
        locations.push(waypoint.location);
      }

      // Calculate route from first to last waypoint with intermediate waypoints
      if (locations.length >= 2) {
        const origin = locations[0];
        const destination = locations[locations.length - 1];
        const intermediateWaypoints = locations.slice(1, -1);

        const route = await this.geospatialService.calculateRoute(
          origin,
          destination,
          intermediateWaypoints.length > 0 ? intermediateWaypoints : undefined,
        );

        return route.distance;
      }
    } catch (error) {
      Logger.warn(
        `Failed to calculate route using GeospatialService, falling back to estimation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CarpoolMergeEngineService.calculateTotalDistance',
      );
    }

    // Fallback: estimate based on waypoint count
    return waypoints.length * 10; // Rough estimate: 10km per waypoint
  }

  /**
   * Calculate pre-merge distance (sum of individual booking distances)
   */
  private calculatePreMergeDistance(carpoolGroup: any): number {
    let total = 0;

    // Add host booking distance
    if (carpoolGroup.hostBooking.segments[0]?.estKm) {
      total += carpoolGroup.hostBooking.segments[0].estKm;
    }

    // Add joiner booking distances
    for (const invite of carpoolGroup.invites) {
      if (invite.joinerBooking.segments[0]?.estKm) {
        total += invite.joinerBooking.segments[0].estKm;
      }
    }

    return total;
  }

  /**
   * Estimate total duration (simplified)
   */
  private estimateTotalDuration(waypoints: ICombinedRoute['waypoints']): number {
    if (waypoints.length === 0) return 0;
    const first = waypoints[0].estimatedTime;
    const last = waypoints[waypoints.length - 1].estimatedTime;
    return (last.getTime() - first.getTime()) / (1000 * 60); // minutes
  }
}
