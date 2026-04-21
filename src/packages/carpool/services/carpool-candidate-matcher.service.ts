import { GeospatialService } from '@/shared/services/geospatial.service';
import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { addDays, format } from 'date-fns';
import { ICarpoolBooking, ICarpoolCandidate, ICarpoolCandidateGroupResponse } from '../domain/response';
import { GetCarpoolCandidatesDto } from '../dto';
import { CarpoolConfig, CarpoolConfigService } from './carpool-config.service';

@Injectable()
export class CarpoolCandidateMatcherService {
  private readonly db = clientDb;

  constructor(
    private readonly configService: CarpoolConfigService,
    private readonly geospatialService: GeospatialService,
  ) {}

  /**
   * Find global carpool candidates and group them (FR-REQ-002).
   * Grouping: by destination (to) and date (YYYY-MM-DD). Same to + same date = one group.
   * Similarity: each booking in group is compared to the first booking (anchor).
   * A booking may appear in multiple groups if it matches more than one (to, date) key.
   */
  async findGlobalCandidates(dto: GetCarpoolCandidatesDto, userId: string): Promise<ICarpoolCandidateGroupResponse[]> {
    try {
      // 1. Get user for RLS
      const user = await this.db.employee.findUnique({
        where: { employeeId: userId },
        select: { orgUnitId: true },
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      // 2. Determine date range
      const now = new Date();
      const startDate = dto.start_date ? new Date(dto.start_date) : now;
      const endDate = dto.end_date ? new Date(dto.end_date) : addDays(startDate, 7);

      // 3. Fetch eligible bookings
      const bookings = await this.db.booking.findMany({
        where: {
          bookingStatus: {
            in: [BookingStatus.APPROVED_L1],
          },
          startAt: {
            gte: startDate,
            lte: endDate,
          },
          requester: {
            orgUnitId: user.orgUnitId,
          },
          deletedAt: null,
          carpoolGroupId: null,
        },
        include: {
          segments: {
            where: { deletedAt: null },
            orderBy: { segmentNo: 'asc' },
          },
          requester: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: {
          startAt: 'asc',
        },
      });

      if (bookings.length === 0) {
        return [];
      }

      // 4. Get configuration for threshold
      const config = await this.configService.getConfig();

      // 5. Group by Date ONLY first, to reduce similarity calculation scope
      const dateToBookings = new Map<string, typeof bookings>();
      for (const b of bookings) {
        const dateStr = format(b.startAt, 'yyyy-MM-dd');
        if (!dateToBookings.has(dateStr)) {
          dateToBookings.set(dateStr, []);
        }
        dateToBookings.get(dateStr)!.push(b);
      }

      const result: ICarpoolCandidateGroupResponse[] = [];
      const destDateSequenceMap = new Map<string, number>();

      // 6. Perform similarity clustering for each date
      for (const [, dayBookings] of dateToBookings) {
        if (dayBookings.length === 0) continue;

        // Sort by startAt: earliest will likely be anchor
        dayBookings.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

        const dayClusters: Array<{ anchor: (typeof bookings)[0]; bookings: typeof bookings }> = [];

        for (const booking of dayBookings) {
          const bookingSegment = booking.segments[0];
          if (!bookingSegment) continue;

          let matchedCluster: (typeof dayClusters)[number] | null = null;
          for (const cluster of dayClusters) {
            const anchorSegment = cluster.anchor.segments[0];
            if (!anchorSegment) continue;

            // Use the service's similarity calculation (async)
            const similarity = await this.calculateRouteSimilarity(anchorSegment, bookingSegment);
            if (similarity >= config.routeSimilarityThreshold) {
              matchedCluster = cluster;
              break;
            }
          }

          if (matchedCluster) {
            matchedCluster.bookings.push(booking);
          } else {
            dayClusters.push({ anchor: booking, bookings: [booking] });
          }
        }

        // 7. Map clusters to response format
        for (const cluster of dayClusters) {
          if (cluster.bookings.length < 2) continue; // Only groups of 2+ are candidates

          const anchor = cluster.anchor;
          const anchorSegment = anchor.segments[0];
          if (!anchorSegment) continue;

          const destLabel = anchorSegment.to || 'Unknown Location';
          const shortLocation = this.getShortLocationName(destLabel);
          const dateIdStr = format(anchor.startAt, 'yyyyMMdd');
          const initials = this.getDestinationInitials(destLabel);
          
          const seqKey = `${dateIdStr}-${initials}`;
          const seq = (destDateSequenceMap.get(seqKey) ?? 0) + 1;
          destDateSequenceMap.set(seqKey, seq);
          
          const groupId = `GRP-${dateIdStr}-${initials}${seq.toString().padStart(2, '0')}`;
          const groupColorHex = this.generateRandomColorHex();

          const mappedBookings: ICarpoolBooking[] = await Promise.all(
            cluster.bookings.map(async (m) => {
              const mSegment = m.segments[0];
              const similarityPercent =
                m.id === anchor.id ? 100 : await this.calculateRouteSimilarity(anchorSegment, mSegment);

              return {
                bookingId: m.id,
                requesterName: m.requester.fullName,
                startDatetime: this.formatToJakarta(m.startAt),
                paxCount: m.passengerCount,
                similarity: `${Math.round(similarityPercent)}%`,
                from: mSegment?.from || 'Unknown',
                to: mSegment?.to || 'Unknown',
              };
            }),
          );

          result.push({
            groupId,
            groupName: `Trip to ${shortLocation}`,
            groupColorHex,
            bookings: mappedBookings,
          });
        }
      }

      return result;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findGlobalCandidates',
        error instanceof Error ? error.stack : undefined,
        'CarpoolCandidateMatcherService.findGlobalCandidates',
      );
      throw error;
    }
  }

  private getShortLocationName(to: string, maxChars = 30): string {
    const t = (to || '').trim();
    if (!t) return 'Unknown';
    if (t.length <= maxChars) return t;
    const truncated = t.slice(0, maxChars).trim();
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 20) return truncated.slice(0, lastSpace);
    return truncated;
  }

  private generateRandomColorHex(): string {
    const hex = () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0');
    return `#${hex()}${hex()}${hex()}`;
  }

  private getDestinationInitials(name: string): string {
    return name
      .split(' ')
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  private generateConsistentColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      // Force higher values for lighter colors (better with dark text, or adjust for dark mode)
      // Attempting a pastel-ish generation
      const pastelValue = 127 + (value % 128);
      color += ('00' + pastelValue.toString(16)).substr(-2);
    }
    return color;
  }

  private formatToJakarta(date: Date): string {
    // Basic ISO replacement for now as per previous existing method
    const tzOffset = 7 * 60;
    const jakartaTime = new Date(date.getTime() + (tzOffset + date.getTimezoneOffset()) * 60000);
    return jakartaTime.toISOString().replace('Z', '+07:00');
  }

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
          const routeSimilarity = await this.calculateRouteSimilarity(hostSegment, candidateSegment, config);

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
            config,
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
   * Note: This should return the same candidates as findCandidateBookings,
   * but without excluding a specific booking ID (since booking doesn't exist yet)
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
        in: [BookingStatus.APPROVED_L1],
      },
      startAt: {
        gte: startWindow,
        lte: endWindow,
      },
      carpoolGroupId: null, // Not already in a carpool
      deletedAt: null,
    };

    // Exclude bookings from the same requester if provided
    // This is optional - if not provided, will show all candidates including from same requester
    // This matches the behavior of findCandidateBookings which doesn't filter by requesterId
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
    config: CarpoolConfig,
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
            config.pickupToleranceKm,
            config.destinationToleranceKm,
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
          in: [BookingStatus.APPROVED_L1],
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
  private async calculateRouteSimilarity(
    hostSegment: any,
    candidateSegment: any,
    config?: CarpoolConfig,
  ): Promise<number> {
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
          config?.pickupToleranceKm,
          config?.destinationToleranceKm,
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
      return 75; // Increased from 70 to ensure it meets default threshold
    }

    // Check if origins match (different destinations)
    if (hostFromNorm === candidateFromNorm) {
      return 65; // Increased from 60
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
