import { Injectable } from '@nestjs/common';
import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { GeospatialService } from '@/shared/services/geospatial.service';
import { BookingStatus, Prisma } from '@prisma/client';
import { CarpoolConfigService, CarpoolConfig } from './carpool-config.service';
import { ICarpoolCandidate } from '../domain/response';

@Injectable()
export class CarpoolCandidateMatcherService {
  private readonly db = clientDb;

  constructor(
    private readonly configService: CarpoolConfigService,
    private readonly geospatialService: GeospatialService,
  ) {}

  /**
   * Find carpool candidates for a host booking
   */
  async findCandidates(hostBookingId: number): Promise<ICarpoolCandidate[]> {
    try {
      // Get host booking with relations
      const hostBooking = await this.db.booking.findUnique({
        where: { id: hostBookingId },
        include: {
          segments: {
            where: { deletedAt: null },
            orderBy: { segmentNo: 'asc' },
          },
          requester: {
            select: {
              employeeId: true,
              fullName: true,
            },
          },
        },
      });

      if (!hostBooking) {
        throw new Error(`Host booking with ID ${hostBookingId} not found`);
      }

      if (hostBooking.bookingStatus === BookingStatus.MERGED) {
        throw new Error('Host booking is already merged');
      }

      // Get configuration
      const config = await this.configService.getConfig();

      // Get host segment (first segment)
      const hostSegment = hostBooking.segments[0];
      if (!hostSegment) {
        throw new Error('Host booking has no segments');
      }

      // Find candidate bookings
      const candidates = await this.findCandidateBookings(hostBooking, config);

      // Filter and score candidates
      const scoredCandidates = await Promise.all(
        candidates.map(async (candidate) => {
          const candidateSegment = candidate.segments[0];
          if (!candidateSegment) return null;

          // Calculate time difference
          const timeDiff = Math.abs((candidate.startAt.getTime() - hostBooking.startAt.getTime()) / (1000 * 60));

          // Calculate route similarity using polyline if available, otherwise fallback to string matching
          const routeSimilarity = await this.calculateRouteSimilarity(hostSegment, candidateSegment);

          // Calculate total passengers
          const totalPassengers = hostBooking.passengerCount + candidate.passengerCount;

          // Check if can fit (assuming max vehicle capacity from config)
          const canFit = totalPassengers <= config.maxVehicleSeatCapacity;

          return {
            bookingId: candidate.id,
            bookingNumber: candidate.bookingNumber,
            requesterId: candidate.requesterId,
            requesterName: candidate.requester.fullName,
            startAt: candidate.startAt,
            endAt: candidate.endAt,
            passengerCount: candidate.passengerCount,
            from: candidateSegment.from,
            to: candidateSegment.to,
            routeSimilarity,
            timeDifference: timeDiff,
            totalPassengers,
            canFit,
          } as ICarpoolCandidate;
        }),
      );

      // Filter valid candidates
      const validCandidates = scoredCandidates.filter(
        (candidate): candidate is ICarpoolCandidate =>
          candidate !== null &&
          candidate.timeDifference <= config.timeWindowMinutes &&
          candidate.routeSimilarity >= config.routeSimilarityThreshold &&
          candidate.canFit,
      );

      // Sort by route similarity (descending), then by time difference (ascending)
      validCandidates.sort((a, b) => {
        if (b.routeSimilarity !== a.routeSimilarity) {
          return b.routeSimilarity - a.routeSimilarity;
        }
        return a.timeDifference - b.timeDifference;
      });

      return validCandidates;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding carpool candidates',
        error instanceof Error ? error.stack : undefined,
        'CarpoolCandidateMatcherService.findCandidates',
      );
      throw error;
    }
  }

  /**
   * Find carpool candidates for a pre-submit booking (temporary booking data)
   */
  async findCandidatesPreSubmit(tempBookingData: {
    startAt: string; // ISO 8601 string
    endAt: string; // ISO 8601 string
    passengerCount: number;
    segment: {
      from: string;
      to: string;
      originLatLong: string;
      destinationLatLong: string;
      originNote?: string;
      destinationNote?: string;
    };
    requesterId?: string;
  }): Promise<ICarpoolCandidate[]> {
    try {
      // Convert ISO strings to Date objects
      const startAt = new Date(tempBookingData.startAt);
      const endAt = new Date(tempBookingData.endAt);

      // Get configuration
      const config = await this.configService.getConfig();

      // Create temporary host booking object for matching
      const tempHostBooking = {
        id: 0, // Temporary ID, will be excluded in query
        startAt,
        endAt,
        passengerCount: tempBookingData.passengerCount,
        segments: [
          {
            from: tempBookingData.segment.from,
            to: tempBookingData.segment.to,
            originLatLong: tempBookingData.segment.originLatLong,
            destinationLatLong: tempBookingData.segment.destinationLatLong,
            routePolyline: null, // Will be calculated if needed
            geocodeValidated: true, // Assume validated from FE
          },
        ],
      };

      // Find candidate bookings
      const candidates = await this.findCandidateBookingsPreSubmit(
        tempHostBooking,
        config,
        tempBookingData.requesterId,
      );

      // Filter and score candidates
      const scoredCandidates = await Promise.all(
        candidates.map(async (candidate) => {
          const candidateSegment = candidate.segments[0];
          if (!candidateSegment) return null;

          // Calculate time difference
          const timeDiff = Math.abs((candidate.startAt.getTime() - startAt.getTime()) / (1000 * 60));

          // Calculate route similarity
          const routeSimilarity = await this.calculateRouteSimilarityPreSubmit(
            tempBookingData.segment,
            candidateSegment,
          );

          // Calculate total passengers
          const totalPassengers = tempBookingData.passengerCount + candidate.passengerCount;

          // Check if can fit
          const canFit = totalPassengers <= config.maxVehicleSeatCapacity;

          return {
            bookingId: candidate.id,
            bookingNumber: candidate.bookingNumber,
            requesterId: candidate.requesterId,
            requesterName: candidate.requester.fullName,
            startAt: candidate.startAt,
            endAt: candidate.endAt,
            passengerCount: candidate.passengerCount,
            from: candidateSegment.from,
            to: candidateSegment.to,
            routeSimilarity,
            timeDifference: timeDiff,
            totalPassengers,
            canFit,
          } as ICarpoolCandidate;
        }),
      );

      // Filter valid candidates
      const validCandidates = scoredCandidates.filter(
        (candidate): candidate is ICarpoolCandidate =>
          candidate !== null &&
          candidate.timeDifference <= config.timeWindowMinutes &&
          candidate.routeSimilarity >= config.routeSimilarityThreshold &&
          candidate.canFit,
      );

      // Sort by route similarity (descending), then by time difference (ascending)
      validCandidates.sort((a, b) => {
        if (b.routeSimilarity !== a.routeSimilarity) {
          return b.routeSimilarity - a.routeSimilarity;
        }
        return a.timeDifference - b.timeDifference;
      });

      return validCandidates;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding pre-submit carpool candidates',
        error instanceof Error ? error.stack : undefined,
        'CarpoolCandidateMatcherService.findCandidatesPreSubmit',
      );
      throw error;
    }
  }

  /**
   * Find candidate bookings from database for pre-submit booking
   */
  private async findCandidateBookingsPreSubmit(
    tempHostBooking: any,
    config: CarpoolConfig,
    excludeRequesterId?: string,
  ) {
    const timeWindowMs = config.timeWindowMinutes * 60 * 1000;
    const startWindow = new Date(tempHostBooking.startAt.getTime() - timeWindowMs);
    const endWindow = new Date(tempHostBooking.startAt.getTime() + timeWindowMs);

    const where: any = {
      bookingStatus: {
        in: [BookingStatus.DRAFT, BookingStatus.SUBMITTED, BookingStatus.APPROVED_L1],
      },
      startAt: {
        gte: startWindow,
        lte: endWindow,
      },
      carpoolGroupId: null, // Not already in a carpool
      deletedAt: null,
    };

    // Exclude bookings from the same requester if provided
    if (excludeRequesterId) {
      where.requesterId = { not: excludeRequesterId };
    }

    return await this.db.booking.findMany({
      where,
      include: {
        segments: {
          where: { deletedAt: null },
          orderBy: { segmentNo: 'asc' },
        },
        requester: {
          select: {
            employeeId: true,
            fullName: true,
          },
        },
      },
    });
  }

  /**
   * Calculate route similarity for pre-submit booking (with temporary segment data)
   */
  private async calculateRouteSimilarityPreSubmit(
    tempSegment: {
      from: string;
      to: string;
      originLatLong: string;
      destinationLatLong: string;
    },
    candidateSegment: any,
  ): Promise<number> {
    // If candidate segment has polyline, try to calculate polyline similarity
    // by first calculating route for temp segment
    if (candidateSegment.routePolyline && candidateSegment.geocodeValidated) {
      try {
        // Calculate route for temp segment to get polyline
        const tempRoute = await this.geospatialService.calculateRouteFromCoordinates(
          tempSegment.originLatLong,
          tempSegment.destinationLatLong,
        );

        if (tempRoute?.polyline) {
          const similarity = await this.geospatialService.calculateRouteSimilarity(
            tempRoute.polyline,
            candidateSegment.routePolyline,
          );
          return similarity;
        }
      } catch (error) {
        Logger.warn(
          `Failed to calculate polyline similarity for pre-submit, falling back to string matching: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'CarpoolCandidateMatcherService.calculateRouteSimilarityPreSubmit',
        );
        // Fall through to string matching
      }
    }

    // Fallback to string-based similarity
    return this.calculateStringRouteSimilarity(
      tempSegment.from,
      tempSegment.to,
      candidateSegment.from,
      candidateSegment.to,
    );
  }

  /**
   * Find candidate bookings from database
   */
  private async findCandidateBookings(hostBooking: any, config: CarpoolConfig) {
    const timeWindowMs = config.timeWindowMinutes * 60 * 1000;
    const startWindow = new Date(hostBooking.startAt.getTime() - timeWindowMs);
    const endWindow = new Date(hostBooking.startAt.getTime() + timeWindowMs);

    return await this.db.booking.findMany({
      where: {
        id: { not: hostBooking.id },
        bookingStatus: {
          in: [BookingStatus.DRAFT, BookingStatus.SUBMITTED, BookingStatus.APPROVED_L1],
        },
        startAt: {
          gte: startWindow,
          lte: endWindow,
        },
        carpoolGroupId: null, // Not already in a carpool
        deletedAt: null,
      },
      include: {
        segments: {
          where: { deletedAt: null },
          orderBy: { segmentNo: 'asc' },
        },
        requester: {
          select: {
            employeeId: true,
            fullName: true,
          },
        },
      },
    });
  }

  /**
   * Calculate route similarity between two routes
   * Uses polyline similarity if available, otherwise falls back to string matching
   */
  private async calculateRouteSimilarity(hostSegment: any, candidateSegment: any): Promise<number> {
    // If both segments have polylines and are validated, use polyline similarity
    if (
      hostSegment.routePolyline &&
      candidateSegment.routePolyline &&
      hostSegment.geocodeValidated &&
      candidateSegment.geocodeValidated
    ) {
      try {
        const similarity = await this.geospatialService.calculateRouteSimilarity(
          hostSegment.routePolyline,
          candidateSegment.routePolyline,
        );
        return similarity;
      } catch (error) {
        Logger.warn(
          `Failed to calculate polyline similarity, falling back to string matching: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'CarpoolCandidateMatcherService.calculateRouteSimilarity',
        );
        // Fall through to string matching
      }
    }

    // Fallback to string-based similarity
    return this.calculateStringRouteSimilarity(
      hostSegment.from,
      hostSegment.to,
      candidateSegment.from,
      candidateSegment.to,
    );
  }

  /**
   * Calculate route similarity using string matching (fallback method)
   */
  private calculateStringRouteSimilarity(
    hostFrom: string,
    hostTo: string,
    candidateFrom: string,
    candidateTo: string,
  ): number {
    // Normalize strings for comparison
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

    const hostFromNorm = normalize(hostFrom);
    const hostToNorm = normalize(hostTo);
    const candidateFromNorm = normalize(candidateFrom);
    const candidateToNorm = normalize(candidateTo);

    // Check exact matches
    if (hostFromNorm === candidateFromNorm && hostToNorm === candidateToNorm) {
      return 100;
    }

    // Check if one route contains the other
    if (
      (hostFromNorm.includes(candidateFromNorm) || candidateFromNorm.includes(hostFromNorm)) &&
      (hostToNorm.includes(candidateToNorm) || candidateToNorm.includes(hostToNorm))
    ) {
      return 85;
    }

    // Check if destinations match (different origins)
    if (hostToNorm === candidateToNorm) {
      return 70;
    }

    // Check if origins match (different destinations)
    if (hostFromNorm === candidateFromNorm) {
      return 60;
    }

    // Check for partial matches using word similarity
    const hostFromWords = hostFromNorm.split(' ');
    const hostToWords = hostToNorm.split(' ');
    const candidateFromWords = candidateFromNorm.split(' ');
    const candidateToWords = candidateToNorm.split(' ');

    let similarity = 0;
    let matches = 0;
    let totalWords = hostFromWords.length + hostToWords.length;

    // Check origin words
    for (const word of hostFromWords) {
      if (candidateFromWords.includes(word) || candidateToWords.includes(word)) {
        matches++;
      }
    }

    // Check destination words
    for (const word of hostToWords) {
      if (candidateToWords.includes(word) || candidateFromWords.includes(word)) {
        matches++;
      }
    }

    similarity = (matches / totalWords) * 100;

    return Math.min(100, Math.max(0, similarity));
  }
}
