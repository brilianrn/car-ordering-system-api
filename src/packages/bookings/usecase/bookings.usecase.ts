import { GeospatialService } from '@/shared/services/geospatial.service';
import { clientDb, S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { NotificationService } from '@/shared/utils/notification.service';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, ServiceType } from '@prisma/client';
import { BASE_BOOKING_INCLUDE, IBookingWithRelations } from '../domain/entities';
import { transformBookingWithPresignedUrls } from '../domain/helpers/presigned-url.helper';
import {
  IAvailableVehicle,
  IBooking,
  IBookingListResponse,
  IReceiptItem,
  IReceiptSummary,
  ITripDetail,
} from '../domain/response';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { QueryAvailableVehiclesDto } from '../dto/query-available-vehicles.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';
import { UpdateBookingDto } from '../dto/update-booking.dto';
import { BookingsRepositoryPort } from '../ports/repository.port';
import { BookingsUsecasePort } from '../ports/usecase.port';

@Injectable()
export class BookingsUseCase implements BookingsUsecasePort {
  private readonly db = clientDb;

  constructor(
    @Inject('BookingsRepositoryPort')
    private readonly repository: BookingsRepositoryPort,
    private readonly s3Service: S3Service,
    private readonly notificationService: NotificationService,
    private readonly geospatialService: GeospatialService,
  ) {
    this.repository = repository;
  }

  create = async (
    createDto: CreateBookingDto,
    requesterId: string,
    userId: string,
  ): Promise<IUsecaseResponse<IBooking>> => {
    try {
      // 1. Validate Category exists
      const category = await this.repository.findCategoryById(createDto.categoryId);
      if (!category) {
        return {
          error: {
            message: `Category with ID ${createDto.categoryId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Get requester employee to find supervisor (from approverL1Id field)
      const requester = await this.repository.findEmployeeById(requesterId);
      if (!requester) {
        return {
          error: {
            message: `Employee with ID ${requesterId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // Determine if this is a draft or submit
      const isDraft = createDto.isDraft ?? false;

      // 3. Validate supervisor exists ONLY for submit (not required for draft)
      if (!isDraft) {
        if (!requester.approverL1Id) {
          return {
            error: {
              message: `Supervisor (approverL1Id) not found for employee ${requesterId}. Required for submitting booking.`,
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }

        // 4. Validate supervisor employee exists in database
        const supervisor = await this.repository.findEmployeeByEmployeeId(requester.approverL1Id);
        if (!supervisor) {
          return {
            error: {
              message: `Supervisor with ID ${requester.approverL1Id} not found in Employee table`,
              code: HttpStatus.NOT_FOUND,
            },
          };
        }
      }

      // 5. Validate vehicle availability if vehicleId is provided
      if (createDto.vehicleId) {
        const startDate = new Date(createDto.startAt);
        const endDate = new Date(createDto.endAt);

        // Get available vehicles for the requested date range
        const availableVehicles = await this.repository.findAvailableVehicles({
          startAt: startDate,
          endAt: endDate,
        });

        // Check if the requested vehicle is in the available list
        const isVehicleAvailable = availableVehicles.some((vehicle) => vehicle.id === createDto.vehicleId);

        if (!isVehicleAvailable) {
          return {
            error: {
              message: `Vehicle with ID ${createDto.vehicleId} is not available for the requested date range`,
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 6. Generate unique booking number: BK-YYYYMMDD-RANDOM
      // This must be done before transaction to ensure uniqueness
      const bookingNumber = await this.generateBookingNumber();

      // 7. Calculate SLA due date: currentDate + 24 hours (only for submit)
      const assignedAt = new Date(); // Current date/time
      const slaDueAt = new Date(assignedAt.getTime() + 24 * 60 * 60 * 1000); // Exactly 24 hours from now

      // Handle purpose and additionalNotes
      // If additionalNotes is provided, append it to purpose
      let finalPurpose = createDto.purpose;
      if (createDto.additionalNotes) {
        finalPurpose = `${createDto.purpose}\n\nAdditional Notes: ${createDto.additionalNotes}`;
      }

      // Handle passengerIds and passengerNames
      let passengerIds: string[] | undefined;
      let passengerNames: string[] | undefined;

      if (createDto.passengerIds && createDto.passengerIds.length > 0) {
        // If passengerIds provided, fetch employee names
        passengerIds = createDto.passengerIds;
        try {
          const employees = await this.db.employee.findMany({
            where: {
              employeeId: { in: createDto.passengerIds },
              deletedAt: null,
            },
            select: {
              employeeId: true,
              fullName: true,
            },
          });

          // Validate all passengerIds exist
          const foundIds = employees.map((e) => e.employeeId);
          const missingIds = createDto.passengerIds.filter((id) => !foundIds.includes(id));
          if (missingIds.length > 0) {
            return {
              error: {
                message: `Passenger IDs not found: ${missingIds.join(', ')}`,
                code: HttpStatus.BAD_REQUEST,
              },
            };
          }

          // Auto-populate passengerNames from passengerIds
          passengerNames = employees.map((e) => e.fullName);
        } catch (error) {
          Logger.error(
            error instanceof Error ? error.message : 'Error fetching passenger data',
            error instanceof Error ? error.stack : undefined,
            'BookingsUseCase.create - fetchPassengers',
          );
          return {
            error: {
              message: 'Failed to fetch passenger data',
              code: HttpStatus.INTERNAL_SERVER_ERROR,
            },
          };
        }
      } else if (createDto.passengerNames && createDto.passengerNames.length > 0) {
        // Backward compatibility: if only passengerNames provided, use it
        passengerNames = createDto.passengerNames;
      }

      const bookingData: Prisma.BookingCreateInput = {
        bookingNumber,
        requester: {
          connect: { employeeId: requesterId },
        },
        category: {
          connect: { id: createDto.categoryId },
        },
        serviceType: createDto.serviceType,
        purpose: finalPurpose,
        startAt: new Date(createDto.startAt),
        endAt: new Date(createDto.endAt),
        passengerCount: createDto.passengerCount,
        resourceMode: createDto.resourceMode,
        bookingStatus: isDraft ? BookingStatus.DRAFT : BookingStatus.SUBMITTED, // Set status based on isDraft flag
        createdBy: userId,
        ...(passengerIds && { passengerIds: passengerIds as Prisma.InputJsonValue }),
        ...(passengerNames && { passengerNames: passengerNames as Prisma.InputJsonValue }),
        ...(createDto.vehicleId && {
          vehicle: {
            connect: { id: createDto.vehicleId },
          },
        }),
      };

      // ============================================
      // SEGMENT DATA PREPARATION
      // FE already sends lat/lng, so we just save it
      // ============================================
      const segmentData: Omit<Prisma.BookingSegmentCreateInput, 'booking'> = {
        segmentNo: 1,
        type:
          createDto.serviceType === ServiceType.DROP
            ? 'DROP'
            : createDto.serviceType === ServiceType.PICKUP
              ? 'PICKUP'
              : 'BOTH',
        from: createDto.segment.from,
        to: createDto.segment.to,
        originLatLong: createDto.segment.originLatLong,
        destinationLatLong: createDto.segment.destinationLatLong,
        geocodeValidated: true, // FE already validated coordinates
        createdBy: userId,
      };

      // Calculate route distance and duration using OSRM API
      let distance: number | undefined;
      let travelTime: number | undefined;
      if (createDto.segment.originLatLong && createDto.segment.destinationLatLong) {
        try {
          const route = await this.geospatialService.calculateRouteFromCoordinates(
            createDto.segment.originLatLong,
            createDto.segment.destinationLatLong,
          );
          if (route) {
            // Save to segment for backward compatibility
            segmentData.estKm = route.distance;
            if (route.polyline) {
              segmentData.routePolyline = route.polyline;
            }
            // Save to booking model for driver display
            distance = route.distance;
            travelTime = route.duration;
          }
        } catch (error) {
          // Route calculation failed - not critical, just log warning
          Logger.warn(
            `Route calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'BookingsUseCase.create',
          );
        }
      }

      // Add distance, travelTime, originNote, and destinationNote to booking data
      // Using type assertion because Prisma client may not have these fields yet until prisma generate is run
      const bookingDataWithRoute = bookingData as Prisma.BookingCreateInput & {
        distance?: number;
        travelTime?: number;
        originNote?: string;
        destinationNote?: string;
      };

      if (distance !== undefined) {
        bookingDataWithRoute.distance = distance;
      }
      if (travelTime !== undefined) {
        bookingDataWithRoute.travelTime = travelTime;
      }
      if (createDto.segment.originNote) {
        bookingDataWithRoute.originNote = createDto.segment.originNote;
      }
      if (createDto.segment.destinationNote) {
        bookingDataWithRoute.destinationNote = createDto.segment.destinationNote;
      }

      // Prepare approval header data (only for submit, not for draft)
      // approverL1Id is taken from requester.approverL1Id field
      let approvalHeaderData: Omit<Prisma.ApprovalHeaderCreateInput, 'booking'> | undefined;
      if (!isDraft && requester.approverL1Id) {
        approvalHeaderData = {
          approverL1: {
            connect: { employeeId: requester.approverL1Id }, // From requester's approverL1Id field
          },
          assignedAt, // Current date/time
          slaDueAt, // assignedAt + 24 hours (exactly 24 * 60 * 60 * 1000 milliseconds)
          decisionL1: null, // PENDING status
          createdBy: userId,
        };
      }

      // ============================================
      // TRANSACTION PHASE
      // All validations passed, now execute transaction
      // If any step fails, Prisma will automatically rollback all changes
      // ============================================
      const booking = await this.repository.createWithTransaction({
        booking: bookingDataWithRoute as Prisma.BookingCreateInput,
        segment: segmentData,
        approvalHeader: approvalHeaderData, // undefined for draft bookings
      });

      // ============================================
      // NOTIFICATION PHASE (only for submit)
      // Send email and push notification to approver
      // Notification failure should not block booking creation
      // ============================================
      if (!isDraft && requester.approverL1Id) {
        try {
          const supervisor = await this.repository.findEmployeeByEmployeeId(requester.approverL1Id);
          if (supervisor) {
            await this.notificationService.sendBookingSubmissionNotifications(
              supervisor.email || '',
              supervisor.employeeId,
              bookingNumber,
              requester.fullName,
              createDto.purpose,
            );
          }
        } catch (notificationError) {
          // Log error but don't fail the booking creation
          Logger.error(
            notificationError instanceof Error ? notificationError.message : 'Failed to send notifications',
            notificationError instanceof Error ? notificationError.stack : undefined,
            'BookingsUseCase.create - Notification',
          );
        }
      }

      // Fetch booking with all relations including vehicle
      const bookingWithRelations = (await this.repository.findById(booking.id)) as IBookingWithRelations | null;

      // Transform S3 keys into presigned URLs for vehicle images
      const bookingWithPresignedUrls = await transformBookingWithPresignedUrls(bookingWithRelations, this.s3Service);

      return { data: bookingWithPresignedUrls as IBooking };
    } catch (error) {
      // If transaction fails, Prisma automatically rolls back all changes
      // Log the error for debugging
      Logger.error(
        error instanceof Error ? error.message : 'Error in create booking transaction',
        error instanceof Error ? error.stack : undefined,
        'BookingsUseCase.create',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to create booking',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findAll = async (query: QueryBookingDto, requesterId?: string): Promise<IUsecaseResponse<IBookingListResponse>> => {
    try {
      const { page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.BookingWhereInput = {};

      // 1. Determine effective requester and initial status
      const effectiveRequesterId = requesterId || query.requesterId;
      const isTripsView = query.bookingStatus === BookingStatus.ASSIGNED;

      // 2. Build Status Filter
      if (isTripsView) {
        // "Trips" view includes ASSIGNED and MERGED (hosts)
        where.bookingStatus = {
          in: [BookingStatus.ASSIGNED, BookingStatus.MERGED],
        };
      } else if (query.bookingStatus) {
        where.bookingStatus = query.bookingStatus;
      } else {
        // Default: everything except DRAFT
        where.bookingStatus = {
          not: BookingStatus.DRAFT,
        };
      }

      // 3. User-based Filtering (Requester/Driver/Joiner)
      // IMPORTANT: If status is ASSIGNED (Trips), we only show Host bookings.
      if (effectiveRequesterId) {
        if (isTripsView) {
          // Trips View: Show trips I'm involved in, but only the HOST booking if carpooled.
          where.OR = [
            {
              // Case A: I am the requester AND it's a standalone trip OR I am the host
              AND: [
                { requesterId: effectiveRequesterId },
                {
                  OR: [{ carpoolGroupId: null }, { hostCarpool: { isNot: null } }],
                },
              ],
            },
            {
              assignment: {
                driverChosen: {
                  employeeId: effectiveRequesterId,
                },
              },
            },
            {
              hostCarpool: {
                invites: {
                  some: {
                    joinerBooking: { requesterId: effectiveRequesterId },
                  },
                },
              },
            },
          ];
        } else {
          // Regular "My Bookings" or specific status view: show specifically what I requested
          where.requesterId = effectiveRequesterId;
        }
      } else {
        // GA/Admin view: show all trips matching status.
        // For "Trips" (ASSIGNED), hide joiners (show only Hosts and Standalones).
        if (isTripsView) {
          // Show if:
          // 1. Not in a carpool (Standalone)
          // 2. OR Is a Host of a carpool
          where.OR = [{ carpoolGroupId: null }, { hostCarpool: { isNot: null } }];
        }
      }

      // General search (searches in bookingNumber and purpose)
      // Combine search with existing conditions using AND
      if (query.search) {
        const searchConditions: Prisma.BookingWhereInput = {
          OR: [
            {
              bookingNumber: {
                contains: query.search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              purpose: {
                contains: query.search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
          ],
        };

        // If we already have conditions, combine them with AND
        // Otherwise, just use the search OR conditions
        if (Object.keys(where).length > 0) {
          where.AND = [{ ...where }, searchConditions];
        } else {
          where.OR = searchConditions.OR as Prisma.BookingWhereInput[];
        }
      }

      // Expand filters...
      if (query.serviceType) where.serviceType = query.serviceType;
      if (query.resourceMode) where.resourceMode = query.resourceMode;
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.bookingNumber) {
        where.bookingNumber = { contains: query.bookingNumber, mode: 'insensitive' };
      }
      if (query.startDateFrom || query.startDateTo) {
        where.startAt = {};
        if (query.startDateFrom) where.startAt.gte = new Date(query.startDateFrom);
        if (query.startDateTo) where.startAt.lte = new Date(query.startDateTo);
      }
      if (query.submittedDateFrom || query.submittedDateTo) {
        where.submittedAt = {};
        if (query.submittedDateFrom) where.submittedAt.gte = new Date(query.submittedDateFrom);
        if (query.submittedDateTo) where.submittedAt.lte = new Date(query.submittedDateTo);
      }

      let [data, total] = await Promise.all([
        this.repository.findMany({
          skip,
          take: limit,
          where,
          include: {
            category: true,
            segments: {
              where: { deletedAt: null },
              orderBy: { segmentNo: 'asc' },
              include: {
                execution: {
                  where: { deletedAt: null },
                  include: {
                    verification: {
                      where: { deletedAt: null },
                      include: {
                        receiptItems: true,
                      },
                    },
                  },
                },
              },
            },
            approvalHeader: {
              include: {
                approverL1: {
                  select: {
                    employeeId: true,
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
            requester: {
              select: {
                employeeId: true,
                fullName: true,
                email: true,
              },
            },
            assignment: {
              include: {
                vehicleChosen: {
                  include: {
                    images: {
                      select: {
                        asset: true,
                      },
                    },
                  },
                },
                driverChosen: {
                  include: {
                    photoAsset: true,
                    ktpAsset: true,
                    simAsset: true,
                  },
                },
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.repository.count(where),
      ]);

      // Transform S3 keys into presigned URLs if any vehicle/asset images are involved
      // Also calculate receipt summary for each booking
      const dataWithPresignedUrls = await Promise.all(
        data.map(async (booking) => {
          const bookingWithRelations = booking as IBookingWithRelations;
          const bookingWithUrls = await transformBookingWithPresignedUrls(bookingWithRelations, this.s3Service);

          // Calculate receipt summary and collect receipt items with presigned URLs
          let receiptSummary: IReceiptSummary | null = null;
          let receipts: IReceiptItem[] = [];

          if (bookingWithRelations.segments && bookingWithRelations.segments.length > 0) {
            const allReceiptItems: Array<{ category: string; amountIdr: number }> = [];
            const allReceiptItemsWithDetails: any[] = [];

            for (const segment of bookingWithRelations.segments) {
              // Type assertion karena execution sudah di-include di query
              const segmentWithExecution = segment as any;
              if (segmentWithExecution.execution?.verification?.receiptItems) {
                const receiptItems = segmentWithExecution.execution.verification.receiptItems.filter(
                  (item: any) => !item.deletedAt,
                );
                allReceiptItems.push(
                  ...receiptItems.map((item: any) => ({
                    category: item.category,
                    amountIdr: item.amountIdr,
                  })),
                );
                allReceiptItemsWithDetails.push(...receiptItems);
              }
            }

            if (allReceiptItems.length > 0) {
              const totalAmount = allReceiptItems.reduce((sum, item) => sum + item.amountIdr, 0);
              const categoryMap = new Map<string, { count: number; totalAmount: number }>();

              allReceiptItems.forEach((item) => {
                const existing = categoryMap.get(item.category) || { count: 0, totalAmount: 0 };
                categoryMap.set(item.category, {
                  count: existing.count + 1,
                  totalAmount: existing.totalAmount + item.amountIdr,
                });
              });

              receiptSummary = {
                totalReceipts: allReceiptItems.length,
                totalAmount,
                categories: Array.from(categoryMap.entries()).map(([category, data]) => ({
                  category,
                  count: data.count,
                  totalAmount: data.totalAmount,
                })),
              };

              // Generate presigned URLs for receipt photos (24 hours expiry)
              receipts = await Promise.all(
                allReceiptItemsWithDetails.map(async (item) => {
                  let presignedPhotoUrl = item.photoUrl;
                  try {
                    // Check if photoUrl is already a presigned URL (contains ?X-Amz- or is a full URL)
                    const isPresignedUrl = item.photoUrl.includes('?X-Amz-') || item.photoUrl.startsWith('http');

                    if (isPresignedUrl) {
                      // If already a presigned URL, extract S3 key from it
                      let s3Key = item.photoUrl;

                      // Try to extract S3 key from presigned URL
                      try {
                        // Decode URL multiple times to handle double/triple encoding
                        let decodedUrl = item.photoUrl;
                        let maxDecodes = 5; // Prevent infinite loop
                        while (maxDecodes > 0 && (decodedUrl.includes('%3A') || decodedUrl.includes('%2F'))) {
                          decodedUrl = decodeURIComponent(decodedUrl);
                          maxDecodes--;
                        }

                        // Parse the decoded URL
                        const url = new URL(decodedUrl);
                        // Get the pathname (S3 key is in the pathname)
                        let path = url.pathname;

                        // Remove leading slash
                        path = path.startsWith('/') ? path.substring(1) : path;

                        // If path still contains a full URL (double-encoded case), extract key from inner URL
                        if (path.startsWith('http://') || path.startsWith('https://')) {
                          const innerUrl = new URL(path);
                          path = innerUrl.pathname.startsWith('/') ? innerUrl.pathname.substring(1) : innerUrl.pathname;
                        }

                        s3Key = path;

                        // Generate fresh presigned URL from S3 key
                        presignedPhotoUrl = await this.s3Service.getPresignedUrl(s3Key, 86400);
                      } catch (urlError) {
                        // If URL parsing fails, try to extract S3 key manually using regex
                        // Look for pattern: s3.region.amazonaws.com/key or bucket.s3.region.amazonaws.com/key
                        const s3Pattern = /s3\.[^/]+\.amazonaws\.com\/([^?]+)/;
                        const match = item.photoUrl.match(s3Pattern);

                        if (match && match[1]) {
                          let extractedKey = decodeURIComponent(match[1]);

                          // Handle double/triple encoding - decode until no more encoded characters
                          let maxDecodes = 5;
                          while (maxDecodes > 0 && (extractedKey.includes('%3A') || extractedKey.includes('%2F'))) {
                            extractedKey = decodeURIComponent(extractedKey);
                            maxDecodes--;
                          }

                          // If extracted key still contains a full URL, extract key from inner URL
                          if (extractedKey.startsWith('http://') || extractedKey.startsWith('https://')) {
                            const innerMatch = extractedKey.match(/s3\.[^/]+\.amazonaws\.com\/([^?]+)/);
                            if (innerMatch && innerMatch[1]) {
                              extractedKey = decodeURIComponent(innerMatch[1]);
                            }
                          }

                          presignedPhotoUrl = await this.s3Service.getPresignedUrl(extractedKey, 86400);
                        } else {
                          // If we can't extract S3 key, log warning and use original URL
                          Logger.warn(
                            `Cannot extract S3 key from presigned URL, using original: ${item.photoUrl.substring(0, 100)}...`,
                            'BookingsUseCase.findAll',
                          );
                          presignedPhotoUrl = item.photoUrl;
                        }
                      }
                    } else {
                      // If it's an S3 key (not a presigned URL), generate presigned URL
                      presignedPhotoUrl = await this.s3Service.getPresignedUrl(item.photoUrl, 86400);
                    }
                  } catch (error) {
                    Logger.warn(
                      `Failed to generate presigned URL for receipt photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
                      'BookingsUseCase.findAll',
                    );
                    // Use original photoUrl as fallback
                    presignedPhotoUrl = item.photoUrl;
                  }

                  return {
                    id: item.id,
                    category: item.category,
                    amountIdr: item.amountIdr,
                    receiptDate: item.receiptDate,
                    photoUrl: presignedPhotoUrl,
                    fundingSource: item.fundingSource,
                    gaNote: item.gaNote,
                    createdAt: item.createdAt,
                    createdBy: item.createdBy,
                    status: item.fundingSource ? 'VERIFIED' : 'IN_REVIEW',
                    ocrSnapshot: item.ocrSnapshot,
                  };
                }),
              );
            }
          }

          return {
            ...bookingWithUrls,
            receiptSummary,
            receipts,
          } as IBooking;
        }),
      );

      return {
        data: {
          data: dataWithPresignedUrls,
          meta: {
            page,
            limit,
            total,
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'BookingsUseCase.findAll',
      );
      return { error };
    }
  };

  findAvailableVehicles = async (
    query: QueryAvailableVehiclesDto,
    requesterId?: string,
  ): Promise<IUsecaseResponse<IAvailableVehicle[]>> => {
    try {
      const { startAt, endAt } = query;

      // Convert ISO string dates to Date objects if provided
      const startDate = startAt ? new Date(startAt) : undefined;
      const endDate = endAt ? new Date(endAt) : undefined;

      // Validate date range if both dates are provided
      if (startDate && endDate && startDate > endDate) {
        return {
          error: {
            message: 'Start date must be before or equal to end date',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      const availableVehicles = await this.repository.findAvailableVehicles({
        startAt: startDate,
        endAt: endDate,
        requesterId, // Pass requesterId to get user's orgUnitId for sorting
      });

      return { data: availableVehicles };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAvailableVehicles',
        error instanceof Error ? error.stack : undefined,
        'BookingsUseCase.findAvailableVehicles',
      );
      return { error };
    }
  };

  update = async (
    id: number,
    updateDto: UpdateBookingDto,
    requesterId: string,
    userId: string,
  ): Promise<IUsecaseResponse<IBooking>> => {
    try {
      // 1. Find booking by ID with segments included
      const existingBooking = await this.repository.findById(id, {
        segments: {
          where: { deletedAt: null },
          orderBy: { segmentNo: 'asc' },
        },
      } as Prisma.BookingInclude);
      if (!existingBooking) {
        return {
          error: {
            message: `Booking with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Validate booking status is DRAFT (only DRAFT bookings can be updated)
      // Exception: If isDraft is explicitly false, we allow update to submit the booking
      const shouldSubmit = updateDto.isDraft === false;
      if (existingBooking.bookingStatus !== BookingStatus.DRAFT && !shouldSubmit) {
        return {
          error: {
            message: `Booking can only be updated when status is DRAFT. Current status: ${existingBooking.bookingStatus}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Validate requester is the owner of the booking
      if (existingBooking.requesterId !== requesterId) {
        return {
          error: {
            message: `You can only update your own bookings`,
            code: HttpStatus.FORBIDDEN,
          },
        };
      }

      // 4. Validate supervisor exists if submitting (isDraft: false)
      let requester: {
        employeeId: string;
        approverL1Id: string | null;
        fullName: string;
        email: string | null;
      } | null = null;
      if (shouldSubmit) {
        requester = await this.repository.findEmployeeByEmployeeId(requesterId);
        if (!requester) {
          return {
            error: {
              message: `Employee with ID ${requesterId} not found`,
              code: HttpStatus.NOT_FOUND,
            },
          };
        }

        if (!requester.approverL1Id) {
          return {
            error: {
              message: `Supervisor (approverL1Id) not found for employee ${requesterId}. Required for submitting booking.`,
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }

        // Validate supervisor employee exists in database
        const supervisor = await this.repository.findEmployeeByEmployeeId(requester.approverL1Id);
        if (!supervisor) {
          return {
            error: {
              message: `Supervisor with ID ${requester.approverL1Id} not found in Employee table`,
              code: HttpStatus.NOT_FOUND,
            },
          };
        }
      }

      // 5. Validate category if provided
      if (updateDto.categoryId) {
        const category = await this.repository.findCategoryById(updateDto.categoryId);
        if (!category) {
          return {
            error: {
              message: `Category with ID ${updateDto.categoryId} not found`,
              code: HttpStatus.NOT_FOUND,
            },
          };
        }
      }

      // 5. Validate vehicle availability if vehicleId is provided
      if (updateDto.vehicleId) {
        const startDate = updateDto.startAt ? new Date(updateDto.startAt) : new Date(existingBooking.startAt);
        const endDate = updateDto.endAt ? new Date(updateDto.endAt) : new Date(existingBooking.endAt);

        const availableVehicles = await this.repository.findAvailableVehicles({
          startAt: startDate,
          endAt: endDate,
        });

        const isVehicleAvailable = availableVehicles.some((vehicle) => vehicle.id === updateDto.vehicleId);

        if (!isVehicleAvailable) {
          return {
            error: {
              message: `Vehicle with ID ${updateDto.vehicleId} is not available for the requested date range`,
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 7. Prepare update data
      const updateData: Prisma.BookingUpdateInput = {
        updatedBy: userId,
      };

      if (updateDto.categoryId !== undefined) {
        updateData.category = { connect: { id: updateDto.categoryId } };
      }

      // Handle purpose and additionalNotes
      // If additionalNotes is provided, append it to purpose
      if (updateDto.purpose !== undefined || updateDto.additionalNotes !== undefined) {
        const currentPurpose = updateDto.purpose !== undefined ? updateDto.purpose : existingBooking.purpose;
        let finalPurpose = currentPurpose || '';

        if (updateDto.additionalNotes) {
          // Append additional notes to purpose
          finalPurpose = finalPurpose
            ? `${finalPurpose}\n\nAdditional Notes: ${updateDto.additionalNotes}`
            : `Additional Notes: ${updateDto.additionalNotes}`;
        }

        updateData.purpose = finalPurpose;
      }

      if (updateDto.startAt !== undefined) {
        updateData.startAt = new Date(updateDto.startAt);
      }

      if (updateDto.endAt !== undefined) {
        updateData.endAt = new Date(updateDto.endAt);
      }

      if (updateDto.passengerCount !== undefined) {
        updateData.passengerCount = updateDto.passengerCount;
      }

      // Handle passengerIds and passengerNames
      if (updateDto.passengerIds !== undefined && updateDto.passengerIds.length > 0) {
        // If passengerIds provided, fetch employee names
        try {
          const employees = await this.db.employee.findMany({
            where: {
              employeeId: { in: updateDto.passengerIds },
              deletedAt: null,
            },
            select: {
              employeeId: true,
              fullName: true,
            },
          });

          // Validate all passengerIds exist
          const foundIds = employees.map((e) => e.employeeId);
          const missingIds = updateDto.passengerIds.filter((id) => !foundIds.includes(id));
          if (missingIds.length > 0) {
            return {
              error: {
                message: `Passenger IDs not found: ${missingIds.join(', ')}`,
                code: HttpStatus.BAD_REQUEST,
              },
            };
          }

          // Auto-populate passengerNames from passengerIds
          updateData.passengerIds = updateDto.passengerIds as Prisma.InputJsonValue;
          updateData.passengerNames = employees.map((e) => e.fullName) as Prisma.InputJsonValue;
        } catch (error) {
          Logger.error(
            error instanceof Error ? error.message : 'Error fetching passenger data',
            error instanceof Error ? error.stack : undefined,
            'BookingsUseCase.update - fetchPassengers',
          );
          return {
            error: {
              message: 'Failed to fetch passenger data',
              code: HttpStatus.INTERNAL_SERVER_ERROR,
            },
          };
        }
      } else if (updateDto.passengerNames !== undefined) {
        // Backward compatibility: if only passengerNames provided, use it
        updateData.passengerNames = updateDto.passengerNames as Prisma.InputJsonValue;
      }

      if (updateDto.serviceType !== undefined) {
        updateData.serviceType = updateDto.serviceType;
      }

      if (updateDto.resourceMode !== undefined) {
        updateData.resourceMode = updateDto.resourceMode;
      }

      // Handle bookingStatus update based on isDraft flag
      if (updateDto.isDraft !== undefined) {
        if (updateDto.isDraft === false) {
          // Submit booking: Change status to SUBMITTED
          updateData.bookingStatus = BookingStatus.SUBMITTED;
        } else {
          // Keep as DRAFT
          updateData.bookingStatus = BookingStatus.DRAFT;
        }
      }

      // Handle vehicleId update
      // Note: Using type assertion because Prisma client may not have vehicle relation yet
      const updateDataWithVehicle = updateData as Prisma.BookingUpdateInput & {
        vehicle?: { disconnect?: boolean } | { connect?: { id: number } };
      };
      if (updateDto.vehicleId !== undefined) {
        if (updateDto.vehicleId === null) {
          // Disconnect vehicle if vehicleId is explicitly null
          updateDataWithVehicle.vehicle = { disconnect: true };
        } else {
          // Connect or update vehicle
          updateDataWithVehicle.vehicle = { connect: { id: updateDto.vehicleId } };
        }
      }

      // 8. Update booking
      await this.repository.update(id, updateDataWithVehicle as Prisma.BookingUpdateInput);

      // 9. Create approval header if submitting (isDraft: false)
      if (shouldSubmit && requester && requester.approverL1Id) {
        // Check if approval header already exists
        const existingApprovalHeader = await this.repository.findApprovalHeaderByBookingId(id);

        if (!existingApprovalHeader) {
          // Calculate SLA due date: currentDate + 24 hours
          const assignedAt = new Date();
          const slaDueAt = new Date(assignedAt.getTime() + 24 * 60 * 60 * 1000); // Exactly 24 hours from now

          // Create approval header
          await this.repository.createApprovalHeader({
            booking: { connect: { id } },
            approverL1: { connect: { employeeId: requester.approverL1Id } },
            assignedAt,
            slaDueAt,
            decisionL1: null, // PENDING status
            createdBy: userId,
          });

          // Send notification to supervisor
          try {
            if (requester && requester.approverL1Id) {
              const supervisor = await this.repository.findEmployeeByEmployeeId(requester.approverL1Id);
              if (supervisor) {
                const bookingNumber = existingBooking.bookingNumber;
                const purpose =
                  typeof updateData.purpose === 'string' ? updateData.purpose : existingBooking.purpose || '';
                await this.notificationService.sendBookingSubmissionNotifications(
                  supervisor.email || '',
                  supervisor.employeeId,
                  bookingNumber,
                  requester.fullName,
                  purpose,
                );
              }
            }
          } catch (notificationError) {
            // Log error but don't fail the booking update
            Logger.error(
              notificationError instanceof Error ? notificationError.message : 'Failed to send notifications',
              notificationError instanceof Error ? notificationError.stack : undefined,
              'BookingsUseCase.update - Notification',
            );
          }
        }
      }

      // 10. Update segment if provided
      if (updateDto.segment) {
        const segmentData: Prisma.BookingSegmentUpdateInput = {};

        // Get current segment to determine from/to values
        const existingBookingWithSegments = existingBooking as any;
        const currentSegment = existingBookingWithSegments.segments?.[0];

        // Update segment data from FE (FE already sends lat/lng)
        if (updateDto.segment.from !== undefined) {
          segmentData.from = updateDto.segment.from;
        }
        if (updateDto.segment.to !== undefined) {
          segmentData.to = updateDto.segment.to;
        }
        if (updateDto.segment.originLatLong !== undefined) {
          segmentData.originLatLong = updateDto.segment.originLatLong;
        }
        if (updateDto.segment.destinationLatLong !== undefined) {
          segmentData.destinationLatLong = updateDto.segment.destinationLatLong;
        }

        // Calculate route distance and duration using OSRM API if coordinates are available
        const originLatLong = updateDto.segment.originLatLong || currentSegment?.originLatLong;
        const destinationLatLong = updateDto.segment.destinationLatLong || currentSegment?.destinationLatLong;
        if (originLatLong && destinationLatLong) {
          try {
            const route = await this.geospatialService.calculateRouteFromCoordinates(originLatLong, destinationLatLong);
            if (route) {
              // Save to segment for backward compatibility
              segmentData.estKm = route.distance;
              if (route.polyline) {
                segmentData.routePolyline = route.polyline;
              }
              // Save to booking model for driver display
              // Using type assertion because Prisma client may not have these fields yet until prisma generate is run
              const updateDataWithRoute = updateData as Prisma.BookingUpdateInput & {
                distance?: number;
                travelTime?: number;
              };
              updateDataWithRoute.distance = route.distance;
              updateDataWithRoute.travelTime = route.duration;
              Object.assign(updateData, updateDataWithRoute);
            }
          } catch (error) {
            // Route calculation failed - not critical, just log warning
            Logger.warn(
              `Route calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              'BookingsUseCase.update',
            );
          }
          segmentData.geocodeValidated = true; // FE already validated coordinates
        }

        // Update segment type based on serviceType
        if (updateDto.serviceType !== undefined) {
          segmentData.type =
            updateDto.serviceType === ServiceType.DROP
              ? 'DROP'
              : updateDto.serviceType === ServiceType.PICKUP
                ? 'PICKUP'
                : 'BOTH';
        } else if (existingBooking.serviceType) {
          segmentData.type =
            existingBooking.serviceType === ServiceType.DROP
              ? 'DROP'
              : existingBooking.serviceType === ServiceType.PICKUP
                ? 'PICKUP'
                : 'BOTH';
        }

        if (Object.keys(segmentData).length > 0) {
          segmentData.updatedBy = userId;
          await this.repository.updateSegment(id, segmentData);
        }
      }

      // Update origin_note and destination_note if provided
      // Using type assertion because Prisma client may not have these fields yet until prisma generate is run
      const updateDataWithNotes = updateData as Prisma.BookingUpdateInput & {
        originNote?: string;
        destinationNote?: string;
      };
      if (updateDto.segment?.originNote !== undefined) {
        updateDataWithNotes.originNote = updateDto.segment.originNote;
      }
      if (updateDto.segment?.destinationNote !== undefined) {
        updateDataWithNotes.destinationNote = updateDto.segment.destinationNote;
      }
      Object.assign(updateData, updateDataWithNotes);

      // 11. Fetch updated booking with relations
      const booking = (await this.repository.findById(id)) as IBookingWithRelations | null;

      // Transform S3 keys into presigned URLs for vehicle images
      const bookingWithPresignedUrls = await transformBookingWithPresignedUrls(booking, this.s3Service);

      return { data: bookingWithPresignedUrls as IBooking };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update booking',
        error instanceof Error ? error.stack : undefined,
        'BookingsUseCase.update',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to update booking',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  /**
   * Generate unique booking number with format: BK-YYYYMMDD-RANDOM
   * Example: BK-20241224-A1B2C3
   *
   * Uses findUnique to check uniqueness (more efficient and accurate)
   * Retries up to 10 times to ensure uniqueness
   *
   * @param retryCount - Current retry attempt (default: 0)
   * @returns Unique booking number
   * @throws Error if unable to generate unique number after 10 attempts
   */
  private async generateBookingNumber(retryCount = 0): Promise<string> {
    const MAX_RETRIES = 10;

    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Failed to generate unique booking number after ${MAX_RETRIES} attempts`);
    }

    // Generate date prefix: YYYYMMDD
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Generate random alphanumeric string (6 characters)
    // Using uppercase letters and numbers for better readability
    const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }

    const bookingNumber = `BK-${datePrefix}-${randomPart}`;

    // Check if booking number already exists using findUnique (more efficient)
    // This uses the unique index on bookingNumber field
    const existing = await this.repository.findBookingByNumber(bookingNumber);

    if (existing) {
      // Booking number already exists, retry with new random part
      Logger.warn(
        `Booking number ${bookingNumber} already exists, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
        'BookingsUseCase.generateBookingNumber',
      );
      return this.generateBookingNumber(retryCount + 1);
    }

    // Booking number is unique
    return bookingNumber;
  }

  findOne = async (id: number, requesterId?: string): Promise<IUsecaseResponse<IBooking>> => {
    try {
      const booking = (await this.repository.findById(id)) as IBookingWithRelations | null;

      if (!booking) {
        return {
          error: {
            message: `Booking with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // Optional: Validate ownership for DRAFT bookings (only requester can view their own drafts)
      if (booking.bookingStatus === BookingStatus.DRAFT && requesterId && booking.requesterId !== requesterId) {
        return {
          error: {
            message: 'You are not authorized to view this booking',
            code: HttpStatus.FORBIDDEN,
          },
        };
      }

      // Transform S3 keys into presigned URLs for vehicle images
      const bookingWithPresignedUrls = await transformBookingWithPresignedUrls(booking, this.s3Service);

      // Manual mapping: Add computed status to receipt items in segments (if any)
      if (bookingWithPresignedUrls?.segments) {
        bookingWithPresignedUrls.segments.forEach((segment: any) => {
          if (segment.execution?.verification?.receiptItems) {
            segment.execution.verification.receiptItems.forEach((item: any) => {
              item.status = item.fundingSource ? 'VERIFIED' : 'IN_REVIEW';
            });
          }
        });
      }

      return { data: bookingWithPresignedUrls as IBooking };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOne',
        error instanceof Error ? error.stack : undefined,
        'BookingsUseCase.findOne',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch booking details',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findTripDetail = async (id: number): Promise<IUsecaseResponse<ITripDetail>> => {
    try {
      // 1. Get booking with all relations
      const booking = (await this.repository.findById(id)) as IBookingWithRelations | null;

      if (!booking) {
        return {
          error: {
            message: `Booking with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      let carpoolBookings: IBooking[] = [];

      // 2. Validate booking is assigned (trip only exists for assigned or merged bookings)
      if (booking.bookingStatus === BookingStatus.ASSIGNED || booking.bookingStatus === BookingStatus.MERGED) {
        if (booking.bookingStatus === BookingStatus.MERGED) {
          const bookingInvitation = await this.repository.findInvitationBookings(booking.carpoolGroupId ?? 0);
          if (bookingInvitation.length > 0) {
            const bookingIds = bookingInvitation.map((invite) => invite.joinerBookingId);
            carpoolBookings = await this.repository.findMany({
              skip: 0,
              take: 100,
              where: {
                id: { in: bookingIds },
              },
              include: BASE_BOOKING_INCLUDE,
            });
          }
        }

        // 3. Transform booking with presigned URLs
        const bookingWithPresignedUrls = await transformBookingWithPresignedUrls(booking, this.s3Service);

        // 4. Get SuratJalan (Travel Order) for the booking
        let suratJalan: ITripDetail['suratJalan'] = null;
        if (booking.segments && booking.segments.length > 0) {
          const segment = booking.segments[0];
          const sj = await this.db.suratJalan.findFirst({
            where: {
              bookingId: id,
              segmentId: segment.id,
              deletedAt: null,
            },
            include: {
              driver: {
                include: {
                  photoAsset: true,
                },
              },
              vehicle: true,
            },
          });

          if (sj) {
            // Get driver photo presigned URL if available
            let driverPhotoUrl: string | undefined;
            if (sj.driver.photoAsset) {
              try {
                // 24 hours expiry (86400 seconds) for driver photo
                driverPhotoUrl = await this.s3Service.getPresignedUrl(sj.driver.photoAsset.url, 86400);
              } catch (error) {
                Logger.warn(
                  `Failed to generate presigned URL for driver photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  'BookingsUseCase.findTripDetail',
                );
              }
            }

            suratJalan = {
              id: sj.id,
              sjCode: sj.sjCode,
              status: sj.status,
              isHandover: sj.isHandover,
              stopList: sj.stopList,
              createdAt: sj.createdAt,
              updatedAt: sj.updatedAt,
              driver: {
                id: sj.driver.id,
                driverCode: sj.driver.driverCode,
                fullName: sj.driver.fullName,
                phoneNumber: sj.driver.phoneNumber,
                photoUrl: driverPhotoUrl,
              },
              vehicle: {
                id: sj.vehicle.id,
                vehicleCode: sj.vehicle.vehicleCode,
                licensePlate: sj.vehicle.licensePlate,
                brandModel: sj.vehicle.brandModel,
              },
            };
          }
        }

        // 5. Get SegmentExecution if exists
        let execution: ITripDetail['execution'] = null;
        if (booking.segments && booking.segments.length > 0) {
          const segment = booking.segments[0];
          const segmentExecution = await this.db.segmentExecution.findFirst({
            where: {
              segmentId: segment.id,
              deletedAt: null,
            },
          });

          if (segmentExecution) {
            execution = {
              id: segmentExecution.id,
              status: segmentExecution.status,
              checkInAt: segmentExecution.checkInAt,
              checkOutAt: segmentExecution.checkOutAt,
              odoStart: segmentExecution.odoStart,
              odoEnd: segmentExecution.odoEnd,
              odoDistance: segmentExecution.odoDistance,
              gpsDistance: segmentExecution.gpsDistance,
              anomalyFlags: segmentExecution.anomalyFlags,
              createdAt: segmentExecution.createdAt,
              updatedAt: segmentExecution.updatedAt,
            };
          }
        }

        // 6. Get VerificationHeader if exists
        let verification: ITripDetail['verification'] = null;
        let receipts: ITripDetail['receipts'] = [];
        if (execution) {
          const verificationHeader = await this.db.verificationHeader.findFirst({
            where: {
              segmentExecutionId: execution.id,
              deletedAt: null,
            },
            include: {
              receiptItems: {
                where: {
                  deletedAt: null,
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          });

          if (verificationHeader) {
            verification = {
              id: verificationHeader.id,
              verifyStatus: verificationHeader.verifyStatus,
              verifierId: verificationHeader.verifierId,
              verifiedAt: verificationHeader.verifiedAt,
              anomalyHandled: verificationHeader.anomalyHandled,
              reimburseTicket: verificationHeader.reimburseTicket,
              replenishTicket: verificationHeader.replenishTicket,
            };

            // 7. Get ReceiptItems with presigned URLs (24 hours expiry)
            if (verificationHeader.receiptItems && verificationHeader.receiptItems.length > 0) {
              receipts = await Promise.all(
                verificationHeader.receiptItems.map(async (item) => {
                  let presignedPhotoUrl = item.photoUrl;
                  try {
                    // Check if photoUrl is already a presigned URL
                    const isPresignedUrl = item.photoUrl.includes('?X-Amz-');

                    if (isPresignedUrl) {
                      // Extract S3 key from presigned URL
                      // Decode URL to handle encoding
                      const decodedUrl = decodeURIComponent(item.photoUrl);

                      // Parse URL to get pathname (S3 key)
                      const url = new URL(decodedUrl);
                      const s3Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;

                      // Generate fresh presigned URL
                      presignedPhotoUrl = await this.s3Service.getPresignedUrl(s3Key, 86400);
                    } else {
                      // If it's an S3 key, generate presigned URL
                      presignedPhotoUrl = await this.s3Service.getPresignedUrl(item.photoUrl, 86400);
                    }
                  } catch (error) {
                    Logger.warn(
                      `Failed to generate presigned URL for receipt photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
                      'BookingsUseCase.findTripDetail',
                    );
                    presignedPhotoUrl = item.photoUrl;
                  }

                  return {
                    id: item.id,
                    category: item.category,
                    amountIdr: item.amountIdr,
                    receiptDate: item.receiptDate,
                    photoUrl: presignedPhotoUrl,
                    fundingSource: item.fundingSource,
                    gaNote: item.gaNote,
                    createdAt: item.createdAt,
                    createdBy: item.createdBy,
                    status: item.fundingSource ? 'VERIFIED' : 'IN_REVIEW',
                  };
                }),
              );
            }
          }
        }

        const tripDetail: ITripDetail = {
          booking: bookingWithPresignedUrls as IBooking,
          suratJalan,
          execution,
          verification,
          receipts,
          carpoolBookings,
        };

        return { data: tripDetail };
      }

      return {
        error: {
          message: `Booking is not assigned yet. Trip detail is only available for assigned bookings. Current status: ${booking.bookingStatus}`,
          code: HttpStatus.BAD_REQUEST,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findTripDetail',
        error instanceof Error ? error.stack : undefined,
        'BookingsUseCase.findTripDetail',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch trip details',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
