import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Booking, Prisma, PrismaClient } from '@prisma/client';
import { BASE_BOOKING_INCLUDE } from '../domain/entities';
import { BookingsRepositoryPort } from '../ports/repository.port';

@Injectable()
export class BookingsRepository implements BookingsRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  /**
   * Helper function to retry database operations with connection recovery
   */
  private async retryWithConnectionRecovery<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    retryDelay = 1000,
  ): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);

        // Check if it's a connection error
        const isConnectionError =
          errorMessage.includes('Server has closed the connection') ||
          errorMessage.includes('Connection terminated') ||
          errorMessage.includes('Connection closed') ||
          errorMessage.includes('Connection timeout') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ETIMEDOUT');

        if (isConnectionError && attempt < maxRetries) {
          Logger.warn(
            `Database connection error (attempt ${attempt}/${maxRetries}): ${errorMessage}. Retrying...`,
            'BookingsRepository.retryWithConnectionRecovery',
          );

          // Try to reconnect
          try {
            await this.db.$connect();
          } catch (reconnectError) {
            Logger.warn(
              `Failed to reconnect: ${reconnectError instanceof Error ? reconnectError.message : 'Unknown error'}`,
              'BookingsRepository.retryWithConnectionRecovery',
            );
          }

          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        // If not a connection error or max retries reached, throw
        throw error;
      }
    }

    throw lastError;
  }

  createWithTransaction = async (data: {
    booking: Prisma.BookingCreateInput;
    segment: Omit<Prisma.BookingSegmentCreateInput, 'booking'>;
    approvalHeader?: Omit<Prisma.ApprovalHeaderCreateInput, 'booking'>; // Optional for draft bookings
  }): Promise<any> => {
    try {
      // Prisma transaction ensures atomicity:
      // - If any step fails, ALL changes are automatically rolled back
      // - No partial data will be saved
      return await this.db.$transaction(async (tx) => {
        // Step 1: Create Booking
        // If this fails, transaction rolls back
        const booking = await tx.booking.create({
          data: data.booking,
        });

        // Step 2: Create BookingSegment linked to the booking
        // If this fails, transaction rolls back (including Step 1)
        await tx.bookingSegment.create({
          data: {
            ...data.segment,
            booking: {
              connect: { id: booking.id },
            },
          },
        });

        // Step 3: Create ApprovalHeader linked to the booking (only if provided)
        // For draft bookings, approvalHeader is not created
        // If this fails, transaction rolls back (including Step 1 & 2)
        if (data.approvalHeader) {
          await tx.approvalHeader.create({
            data: {
              ...data.approvalHeader,
              booking: {
                connect: { id: booking.id },
              },
            },
          });
        }

        // All steps succeeded, return the created booking with relations
        // Transaction will commit automatically after this returns
        // Use base include to ensure compatibility even if migration hasn't been run yet
        return await tx.booking.findUnique({
          where: { id: booking.id },
          include: BASE_BOOKING_INCLUDE as Prisma.BookingInclude,
        });
      });
    } catch (error) {
      // Transaction automatically rolled back on any error
      // Log the error for debugging
      Logger.error(
        error instanceof Error ? error.message : 'Error in createWithTransaction - Transaction rolled back',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.createWithTransaction',
      );
      // Re-throw to let usecase handle the error
      throw error;
    }
  };

  findMany = async (params: {
    skip: number;
    take: number;
    where?: Prisma.BookingWhereInput;
    include?: Prisma.BookingInclude;
    orderBy?: Prisma.BookingOrderByWithRelationInput;
  }): Promise<Booking[]> => {
    try {
      return await this.db.booking.findMany({
        skip: params.skip,
        take: params.take,
        where: {
          ...params.where,
          deletedAt: null, // Always exclude soft-deleted records
        },
        include: params.include,
        orderBy: params.orderBy,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findMany',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.BookingWhereInput): Promise<number> => {
    try {
      return await this.db.booking.count({
        where: {
          ...where,
          deletedAt: null, // Always exclude soft-deleted records
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.count',
      );
      throw error;
    }
  };

  findCategoryById = async (id: number): Promise<{ id: number; code: string; name: string } | null> => {
    try {
      const category = await this.db.category.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });
      return category;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findCategoryById',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findCategoryById',
      );
      throw error;
    }
  };

  findEmployeeById = async (
    employeeId: string,
  ): Promise<{ employeeId: string; approverL1Id: string | null; fullName: string; email: string } | null> => {
    try {
      const employee = await this.db.employee.findUnique({
        where: { employeeId },
        select: {
          employeeId: true,
          approverL1Id: true,
          fullName: true,
          email: true,
        },
      });
      return employee;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findEmployeeById',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findEmployeeById',
      );
      throw error;
    }
  };

  findBookingByNumber = async (bookingNumber: string): Promise<Booking | null> => {
    try {
      return await this.db.booking.findUnique({
        where: { bookingNumber },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findBookingByNumber',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findBookingByNumber',
      );
      throw error;
    }
  };

  findEmployeeByEmployeeId = async (
    employeeId: string,
  ): Promise<{ employeeId: string; approverL1Id: string | null; fullName: string; email: string } | null> => {
    try {
      const employee = await this.db.employee.findUnique({
        where: { employeeId },
        select: {
          employeeId: true,
          approverL1Id: true,
          fullName: true,
          email: true,
        },
      });
      return employee;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findEmployeeByEmployeeId',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findEmployeeByEmployeeId',
      );
      throw error;
    }
  };

  findAvailableVehicles = async (params: {
    startAt?: Date;
    endAt?: Date;
    requesterId?: string;
  }): Promise<
    Array<{
      id: number;
      vehicleCode: string;
      licensePlate: string;
      brandModel: string;
      vehicleType: string;
      seatCapacity: number;
      year: number;
      status: string;
      dedicatedOrgId: number | null;
    }>
  > => {
    try {
      const { startAt, endAt, requesterId } = params;

      // Get requester's orgUnitId if requesterId is provided
      let userOrgUnitId: number | null = null;
      if (requesterId) {
        const employee = await this.db.employee.findUnique({
          where: { employeeId: requesterId },
          select: { orgUnitId: true },
        });
        if (employee) {
          userOrgUnitId = employee.orgUnitId;
        }
      }

      // Build where clause for vehicle availability
      const vehicleWhere: Prisma.VehicleWhereInput = {
        deletedAt: null, // Not deleted
        status: 'ACTIVE', // Only active vehicles
      };

      // Get all active vehicles first
      const allVehicles = await this.db.vehicle.findMany({
        where: vehicleWhere,
        select: {
          id: true,
          vehicleCode: true,
          licensePlate: true,
          brandModel: true,
          vehicleType: true,
          seatCapacity: true,
          year: true,
          status: true,
          dedicatedOrgId: true,
        },
      });

      // If no date range provided, sort and return all active vehicles
      if (!startAt || !endAt) {
        // Sort vehicles:
        // 1. Vehicles from same division (dedicatedOrgId === userOrgUnitId) first
        // 2. Then sort by year (newest to oldest)
        const sortedVehicles = allVehicles.sort((a, b) => {
          // Priority 1: Same division vehicles first
          const aIsSameDivision = userOrgUnitId !== null && a.dedicatedOrgId === userOrgUnitId;
          const bIsSameDivision = userOrgUnitId !== null && b.dedicatedOrgId === userOrgUnitId;

          if (aIsSameDivision && !bIsSameDivision) {
            return -1; // a comes first
          }
          if (!aIsSameDivision && bIsSameDivision) {
            return 1; // b comes first
          }

          // Priority 2: Sort by year (newest to oldest)
          return b.year - a.year;
        });

        return sortedVehicles;
      }

      // Find vehicles that are already assigned during the requested time period
      // Check in Assignment table where booking is approved/assigned and dates overlap
      const conflictingAssignments = await this.db.assignment.findMany({
        where: {
          deletedAt: null,
          vehicleChosenId: {
            not: null,
          },
          booking: {
            deletedAt: null,
            bookingStatus: {
              in: ['APPROVED_L1', 'ASSIGNED'], // Only check bookings that are approved/assigned
            },
            // Check for date overlap: booking dates overlap with requested dates
            OR: [
              // Booking starts before requested period and ends during/after
              {
                startAt: {
                  lte: endAt,
                },
                endAt: {
                  gte: startAt,
                },
              },
            ],
          },
        },
        select: {
          vehicleChosenId: true,
        },
      });

      // Get list of vehicle IDs that are already assigned
      const assignedVehicleIds = new Set(
        conflictingAssignments
          .map((assignment) => assignment.vehicleChosenId)
          .filter((id): id is number => id !== null),
      );

      // Filter out vehicles that are already assigned
      const availableVehicles = allVehicles.filter((vehicle) => !assignedVehicleIds.has(vehicle.id));

      // Sort vehicles:
      // 1. Vehicles from same division (dedicatedOrgId === userOrgUnitId) first
      // 2. Then sort by year (newest to oldest)
      const sortedVehicles = availableVehicles.sort((a, b) => {
        // Priority 1: Same division vehicles first
        const aIsSameDivision = userOrgUnitId !== null && a.dedicatedOrgId === userOrgUnitId;
        const bIsSameDivision = userOrgUnitId !== null && b.dedicatedOrgId === userOrgUnitId;

        if (aIsSameDivision && !bIsSameDivision) {
          return -1; // a comes first
        }
        if (!aIsSameDivision && bIsSameDivision) {
          return 1; // b comes first
        }

        // Priority 2: Sort by year (newest to oldest)
        return b.year - a.year;
      });

      return sortedVehicles;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAvailableVehicles',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findAvailableVehicles',
      );
      throw error;
    }
  };

  findById = async (id: number, include?: Prisma.BookingInclude): Promise<Booking | null> => {
    try {
      return await this.retryWithConnectionRecovery(async () => {
        if (include) {
          return await this.db.booking.findUnique({
            where: { id, deletedAt: null },
            include,
          });
        }

        return await this.db.booking.findUnique({
          where: { id, deletedAt: null },
          include: BASE_BOOKING_INCLUDE as Prisma.BookingInclude,
        });
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findById',
      );
      throw error;
    }
  };

  update = async (id: number, data: Prisma.BookingUpdateInput): Promise<Booking> => {
    try {
      return await this.db.booking.update({
        where: { id },
        data,
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
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.update',
      );
      throw error;
    }
  };

  updateSegment = async (bookingId: number, data: Prisma.BookingSegmentUpdateInput): Promise<void> => {
    try {
      // Find the first segment for this booking (segmentNo: 1)
      const segment = await this.db.bookingSegment.findFirst({
        where: { bookingId, segmentNo: 1 },
      });

      if (segment) {
        await this.db.bookingSegment.update({
          where: { id: segment.id },
          data,
        });
      } else {
        // If segment doesn't exist, create it
        // Exclude booking and segmentNo from data to avoid conflicts
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { booking, segmentNo, ...restData } = data as Prisma.BookingSegmentCreateInput & {
          booking?: unknown;
          segmentNo?: unknown;
        };
        await this.db.bookingSegment.create({
          data: {
            booking: { connect: { id: bookingId } },
            segmentNo: 1,
            ...restData,
          },
        });
      }
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateSegment',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.updateSegment',
      );
      throw error;
    }
  };

  findApprovalHeaderByBookingId = async (bookingId: number): Promise<{ id: number; bookingId: number } | null> => {
    try {
      const approvalHeader = await this.db.approvalHeader.findUnique({
        where: { bookingId },
        select: {
          id: true,
          bookingId: true,
        },
      });
      return approvalHeader;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findApprovalHeaderByBookingId',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.findApprovalHeaderByBookingId',
      );
      throw error;
    }
  };

  createApprovalHeader = async (data: Prisma.ApprovalHeaderCreateInput): Promise<void> => {
    try {
      await this.db.approvalHeader.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createApprovalHeader',
        error instanceof Error ? error.stack : undefined,
        'BookingsRepository.createApprovalHeader',
      );
      throw error;
    }
  };
}
