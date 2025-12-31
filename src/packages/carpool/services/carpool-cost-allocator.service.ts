import { Injectable } from '@nestjs/common';
import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Prisma } from '@prisma/client';
import { CarpoolAuditService } from './carpool-audit.service';
import { ISharedCostSummary } from '../domain/response';
import { CostMode } from '../dto/merge-carpool.dto';

@Injectable()
export class CarpoolCostAllocatorService {
  private readonly db = clientDb;

  constructor(private readonly auditService: CarpoolAuditService) {}

  /**
   * Calculate and allocate shared cost for carpool group
   */
  async calculateAndAllocateCost(
    carpoolGroupId: number,
    costMode: CostMode,
    userId: string,
  ): Promise<ISharedCostSummary> {
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
          memberBookings: {
            include: {
              segments: {
                where: { deletedAt: null },
                orderBy: { segmentNo: 'asc' },
              },
            },
          },
        },
      });

      if (!carpoolGroup) {
        throw new Error('Carpool group not found');
      }

      // Recalculate total cost based on combined route
      const totalCost = await this.recalculateTotalCost(carpoolGroup);

      // Allocate cost based on mode
      let costSummary: ISharedCostSummary;
      if (costMode === CostMode.EQUAL) {
        costSummary = this.allocateEqualCost(carpoolGroup, totalCost);
      } else if (costMode === CostMode.PROPORTIONAL_DISTANCE) {
        costSummary = this.allocateProportionalCost(carpoolGroup, totalCost);
      } else {
        throw new Error(`Unknown cost mode: ${costMode}`);
      }

      // Save shared cost summary
      const costSummaryForDb = {
        ...costSummary,
        breakdown: costSummary.breakdown.map((item) => ({
          ...item,
          // Ensure all properties are JSON-serializable
        })),
      };

      await this.db.carpoolGroup.update({
        where: { id: carpoolGroupId },
        data: {
          sharedCost: costSummaryForDb as Prisma.InputJsonValue,
          costMode: costMode,
          updatedBy: userId,
        },
      });

      // Log cost recalculation
      await this.auditService.logAction({
        carpoolGroupId,
        actionType: 'COST_RECALCULATED',
        userId,
        oldValue: carpoolGroup.sharedCost,
        newValue: costSummary,
        metadata: { costMode },
      });

      return costSummary;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error calculating and allocating cost',
        error instanceof Error ? error.stack : undefined,
        'CarpoolCostAllocatorService.calculateAndAllocateCost',
      );
      throw error;
    }
  }

  /**
   * Recalculate total cost based on combined route
   * Uses postMergeDistance from CarpoolGroup if available
   */
  private async recalculateTotalCost(carpoolGroup: any): Promise<number> {
    // Priority 1: Use postMergeDistance from CarpoolGroup (most accurate)
    if (carpoolGroup.postMergeDistance && carpoolGroup.postMergeDistance > 0) {
      const totalDistance = carpoolGroup.postMergeDistance; // km
      const combinedRoute = carpoolGroup.combinedRoute as any;
      const totalDuration = combinedRoute?.totalDuration || 60; // minutes

      return this.calculateCostFromDistance(totalDistance, totalDuration);
    }

    // Priority 2: Use combinedRoute.totalDistance
    const combinedRoute = carpoolGroup.combinedRoute as any;
    if (combinedRoute && combinedRoute.totalDistance) {
      const totalDistance = combinedRoute.totalDistance; // km
      const totalDuration = combinedRoute.totalDuration || 60; // minutes

      return this.calculateCostFromDistance(totalDistance, totalDuration);
    }

    // Fallback: sum individual booking costs
    return this.sumIndividualCosts(carpoolGroup);
  }

  /**
   * Calculate cost from distance and duration
   * In production, this should use CostSet from ParamSet (FR-SET-008)
   */
  private calculateCostFromDistance(totalDistance: number, totalDuration: number): number {
    // Cost calculation (simplified - in production use actual pricing rules from CostSet)
    // Base cost: Rp 5,000 per km
    // Fuel cost: Rp 10,000 per liter (assuming 10 km/liter)
    // Toll cost: Rp 2,000 per km (if applicable)
    // Driver cost: Rp 50,000 per hour

    const baseCost = totalDistance * 5000;
    const fuelCost = (totalDistance / 10) * 10000;
    const tollCost = totalDistance * 2000;
    const driverCost = (totalDuration / 60) * 50000;

    return baseCost + fuelCost + tollCost + driverCost;
  }

  /**
   * Sum individual booking costs (fallback)
   */
  private sumIndividualCosts(carpoolGroup: any): number {
    let total = 0;

    // Estimate host booking cost
    if (carpoolGroup.hostBooking.segments[0]?.estKm) {
      const distance = carpoolGroup.hostBooking.segments[0].estKm;
      total += distance * 5000 + (distance / 10) * 10000 + distance * 2000;
    }

    // Estimate member booking costs
    for (const member of carpoolGroup.memberBookings) {
      if (member.segments[0]?.estKm) {
        const distance = member.segments[0].estKm;
        total += distance * 5000 + (distance / 10) * 10000 + distance * 2000;
      }
    }

    return total;
  }

  /**
   * Allocate cost equally among all participants
   */
  private allocateEqualCost(carpoolGroup: any, totalCost: number): ISharedCostSummary {
    const allBookings = [carpoolGroup.hostBooking, ...carpoolGroup.memberBookings];
    const participantCount = allBookings.length;
    const costPerParticipant = totalCost / participantCount;

    const breakdown = allBookings.map((booking: any) => {
      const segment = booking.segments[0];
      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        requesterId: booking.requesterId,
        distance: segment?.estKm || 0,
        costShare: costPerParticipant,
        percentage: (1 / participantCount) * 100,
      };
    });

    return {
      totalCost,
      costMode: CostMode.EQUAL,
      breakdown,
    };
  }

  /**
   * Allocate cost proportionally based on distance
   */
  private allocateProportionalCost(carpoolGroup: any, totalCost: number): ISharedCostSummary {
    const allBookings = [carpoolGroup.hostBooking, ...carpoolGroup.memberBookings];

    // Calculate total distance
    let totalDistance = 0;
    const bookingDistances = new Map<number, number>();

    for (const booking of allBookings) {
      const segment = booking.segments[0];
      const distance = segment?.estKm || 0;
      bookingDistances.set(booking.id, distance);
      totalDistance += distance;
    }

    // Allocate cost proportionally
    const breakdown = allBookings.map((booking: any) => {
      const distance = bookingDistances.get(booking.id) || 0;
      const percentage = totalDistance > 0 ? (distance / totalDistance) * 100 : 0;
      const costShare = totalDistance > 0 ? (distance / totalDistance) * totalCost : 0;

      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        requesterId: booking.requesterId,
        distance,
        costShare,
        percentage,
      };
    });

    return {
      totalCost,
      costMode: CostMode.PROPORTIONAL_DISTANCE,
      breakdown,
    };
  }
}
