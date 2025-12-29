import { S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, ServiceType } from '@prisma/client';
import { IAvailableVehicle, IBooking, IBookingListResponse } from '../domain/response';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { QueryAvailableVehiclesDto } from '../dto/query-available-vehicles.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';
import { BookingsRepositoryPort } from '../ports/repository.port';
import { BookingsUsecasePort } from '../ports/usecase.port';

@Injectable()
export class BookingsUseCase implements BookingsUsecasePort {
  constructor(
    @Inject('BookingsRepositoryPort')
    private readonly repository: BookingsRepositoryPort,
    private readonly s3Service: S3Service,
  ) {
    this.repository = repository;
  }

  create = async (
    createDto: CreateBookingDto,
    requesterId: string,
    userId: string,
  ): Promise<IUsecaseResponse<IBooking>> => {
    try {
      // ============================================
      // VALIDATION PHASE (Before Transaction)
      // All validations must pass before starting transaction
      // ============================================

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

      // 3. Validate supervisor exists (check approverL1Id field)
      if (!requester.approverL1Id) {
        return {
          error: {
            message: `Supervisor (approverL1Id) not found for employee ${requesterId}`,
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

      // 7. Calculate SLA due date: currentDate + 24 hours
      const assignedAt = new Date(); // Current date/time
      const slaDueAt = new Date(assignedAt.getTime() + 24 * 60 * 60 * 1000); // Exactly 24 hours from now

      // Prepare transaction data
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
        bookingStatus: BookingStatus.SUBMITTED, // Set to SUBMITTED when created
        createdBy: userId,
      };

      // Prepare segment data (booking will be connected in repository)
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
        createdBy: userId,
      };

      // Prepare approval header data (booking will be connected in repository)
      // approverL1Id is taken from requester.approverL1Id field
      const approvalHeaderData: Omit<Prisma.ApprovalHeaderCreateInput, 'booking'> = {
        approverL1: {
          connect: { employeeId: requester.approverL1Id }, // From requester's approverL1Id field
        },
        assignedAt, // Current date/time
        slaDueAt, // assignedAt + 24 hours (exactly 24 * 60 * 60 * 1000 milliseconds)
        decisionL1: null, // PENDING status
        createdBy: userId,
      };

      // ============================================
      // TRANSACTION PHASE
      // All validations passed, now execute transaction
      // If any step fails, Prisma will automatically rollback all changes
      // ============================================
      const booking = await this.repository.createWithTransaction({
        booking: bookingData,
        segment: segmentData,
        approvalHeader: approvalHeaderData,
      });

      return { data: booking as IBooking };
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

      // Filter by requesterId (for "My Bookings" view)
      if (requesterId) {
        where.requesterId = requesterId;
      } else if (query.requesterId) {
        where.requesterId = query.requesterId;
      }

      // Filter by booking status
      if (query.bookingStatus) {
        where.bookingStatus = query.bookingStatus;
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
      if (query.search) {
        where.OR = [
          {
            bookingNumber: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            purpose: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ];
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
      // Note: Currently, bookings don't directly have images, but if they do in the future,
      // this is where we would transform them
      const dataWithPresignedUrls = await Promise.all(
        data.map(async (booking: any) => {
          // If booking has assignment with vehicle images, transform them here
          // For now, just return the booking as is
          return booking;
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
}
