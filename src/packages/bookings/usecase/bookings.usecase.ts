import { GeospatialService } from '@/shared/services/geospatial.service';
import { clientDb, S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { NotificationService } from '@/shared/utils/notification.service';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, ServiceType } from '@prisma/client';
import { IBookingWithRelations } from '../domain/entities';
import { transformBookingWithPresignedUrls } from '../domain/helpers/presigned-url.helper';
import { IAvailableVehicle, IBooking, IBookingListResponse } from '../domain/response';
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
      const bookingData: Prisma.BookingCreateInput = {
        bookingNumber,
        requester: {
          connect: { employeeId: requesterId },
        },
        category: {
          connect: { id: createDto.categoryId },
        },
        serviceType: createDto.serviceType,
        purpose: createDto.purpose,
        startAt: new Date(createDto.startAt),
        endAt: new Date(createDto.endAt),
        passengerCount: createDto.passengerCount,
        resourceMode: createDto.resourceMode,
        bookingStatus: isDraft ? BookingStatus.DRAFT : BookingStatus.SUBMITTED, // Set status based on isDraft flag
        createdBy: userId,
        ...(createDto.passengerNames && { passengerNames: createDto.passengerNames as Prisma.InputJsonValue }),
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
              supervisor.email,
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

      // Determine the effective requesterId (from parameter or query)
      const effectiveRequesterId = requesterId || query.requesterId;

      // Build base conditions for requesterId and bookingStatus
      // IMPORTANT: Draft bookings can only be seen by the requester who created them
      if (effectiveRequesterId) {
        // User's own bookings: include DRAFT and non-DRAFT
        // If bookingStatus filter is provided, apply it within the requesterId scope
        if (query.bookingStatus) {
          // Filter by specific status for this requester
          where.requesterId = effectiveRequesterId;
          where.bookingStatus = query.bookingStatus;
        } else {
          // Show all statuses for this requester (DRAFT + non-DRAFT)
          where.requesterId = effectiveRequesterId;
          // No bookingStatus filter - show all statuses
        }
      } else {
        // No requesterId: exclude DRAFT bookings (only show submitted bookings)
        // Unless bookingStatus filter is explicitly provided
        if (query.bookingStatus) {
          // Apply the status filter
          where.bookingStatus = query.bookingStatus;
        }
      }

      // Filter by service type
      if (query.serviceType) {
        where.serviceType = query.serviceType;
      }

      // Filter by resource mode
      if (query.resourceMode) {
        where.resourceMode = query.resourceMode;
      }

      // Filter by category ID
      if (query.categoryId) {
        where.categoryId = query.categoryId;
      }

      // Filter by booking number (exact match or contains)
      if (query.bookingNumber) {
        where.bookingNumber = {
          contains: query.bookingNumber,
          mode: 'insensitive', // Case-insensitive search
        };
      }

      // Filter by start date range (startAt)
      if (query.startDateFrom || query.startDateTo) {
        where.startAt = {};
        if (query.startDateFrom) {
          where.startAt.gte = new Date(query.startDateFrom);
        }
        if (query.startDateTo) {
          where.startAt.lte = new Date(query.startDateTo);
        }
      }

      // Filter by submitted date range (submittedAt)
      if (query.submittedDateFrom || query.submittedDateTo) {
        where.submittedAt = {};
        if (query.submittedDateFrom) {
          where.submittedAt.gte = new Date(query.submittedDateFrom);
        }
        if (query.submittedDateTo) {
          where.submittedAt.lte = new Date(query.submittedDateTo);
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

      const [data, total] = await Promise.all([
        this.repository.findMany({
          skip,
          take: limit,
          where,
          include: {
            category: true,
            segments: true,
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
          },
        }),
        this.repository.count(where),
      ]);

      // Transform S3 keys into presigned URLs if any vehicle/asset images are involved
      const dataWithPresignedUrls = await Promise.all(
        data.map(async (booking) => {
          const bookingWithRelations = booking as IBookingWithRelations;
          return transformBookingWithPresignedUrls(bookingWithRelations, this.s3Service);
        }),
      );

      return {
        data: {
          data: dataWithPresignedUrls as IBooking[],
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
      let requester: { employeeId: string; approverL1Id: string | null; fullName: string; email: string } | null = null;
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

      if (updateDto.passengerNames !== undefined) {
        updateData.passengerNames = updateDto.passengerNames as Prisma.InputJsonValue; // Store as JSON
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
                  supervisor.email,
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
}
