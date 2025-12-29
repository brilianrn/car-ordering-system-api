import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Booking, Prisma, PrismaClient } from '@prisma/client';
import { BookingsRepositoryPort } from '../ports/repository.port';

@Injectable()
export class BookingsRepository implements BookingsRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  createWithTransaction = async (data: {
    booking: Prisma.BookingCreateInput;
    segment: Omit<Prisma.BookingSegmentCreateInput, 'booking'>;
    approvalHeader: Omit<Prisma.ApprovalHeaderCreateInput, 'booking'>;
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

        // Step 3: Create ApprovalHeader linked to the booking
        // If this fails, transaction rolls back (including Step 1 & 2)
        await tx.approvalHeader.create({
          data: {
            ...data.approvalHeader,
            booking: {
              connect: { id: booking.id },
            },
          },
        });

        // All steps succeeded, return the created booking with relations
        // Transaction will commit automatically after this returns
        return await tx.booking.findUnique({
          where: { id: booking.id },
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
  }): Promise<Booking[]> => {
    try {
      return await this.db.booking.findMany({
        ...params,
        where: {
          ...params.where,
          deletedAt: null, // Always exclude soft-deleted records
        },
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
  ): Promise<{ employeeId: string; approverL1Id: string | null } | null> => {
    try {
      const employee = await this.db.employee.findUnique({
        where: { employeeId },
        select: {
          employeeId: true,
          approverL1Id: true,
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
  ): Promise<{ employeeId: string; approverL1Id: string | null } | null> => {
    try {
      const employee = await this.db.employee.findUnique({
        where: { employeeId },
        select: {
          employeeId: true,
          approverL1Id: true,
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
        conflictingAssignments.map((assignment) => assignment.vehicleChosenId).filter((id): id is number => id !== null),
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
}
