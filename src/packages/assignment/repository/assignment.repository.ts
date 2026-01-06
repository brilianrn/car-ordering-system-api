import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AssignmentRepositoryPort } from '../ports/repository.port';

@Injectable()
export class AssignmentRepository implements AssignmentRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  findBookingById = async (id: number, include?: Prisma.BookingInclude): Promise<any | null> => {
    try {
      return await this.db.booking.findUnique({
        where: { id, deletedAt: null },
        include: include || {
          approvalHeader: true,
          assignment: true,
          segments: {
            where: { deletedAt: null },
            orderBy: { segmentNo: 'asc' },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findBookingById',
        error instanceof Error ? error.stack : undefined,
        'AssignmentRepository.findBookingById',
      );
      throw error;
    }
  };

  findVehicleById = async (vehicleId: number): Promise<any | null> => {
    try {
      return await this.db.vehicle.findUnique({
        where: { id: vehicleId, deletedAt: null },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findVehicleById',
        error instanceof Error ? error.stack : undefined,
        'AssignmentRepository.findVehicleById',
      );
      throw error;
    }
  };

  findDriverById = async (driverId: number): Promise<any | null> => {
    try {
      return await this.db.driver.findUnique({
        where: { id: driverId, deletedAt: null },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findDriverById',
        error instanceof Error ? error.stack : undefined,
        'AssignmentRepository.findDriverById',
      );
      throw error;
    }
  };

  findAssignmentByBookingId = async (bookingId: number): Promise<any | null> => {
    try {
      return await this.db.assignment.findUnique({
        where: { bookingId, deletedAt: null },
        include: {
          vehicleChosen: true,
          driverChosen: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAssignmentByBookingId',
        error instanceof Error ? error.stack : undefined,
        'AssignmentRepository.findAssignmentByBookingId',
      );
      throw error;
    }
  };

  createAssignment = async (data: Prisma.AssignmentCreateInput): Promise<any> => {
    try {
      return await this.db.assignment.create({
        data,
        include: {
          vehicleChosen: true,
          driverChosen: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createAssignment',
        error instanceof Error ? error.stack : undefined,
        'AssignmentRepository.createAssignment',
      );
      throw error;
    }
  };

  updateBooking = async (id: number, data: Prisma.BookingUpdateInput): Promise<any> => {
    try {
      return await this.db.booking.update({
        where: { id },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateBooking',
        error instanceof Error ? error.stack : undefined,
        'AssignmentRepository.updateBooking',
      );
      throw error;
    }
  };

  updateApprovalHeader = async (bookingId: number, data: Prisma.ApprovalHeaderUpdateInput): Promise<void> => {
    try {
      await this.db.approvalHeader.update({
        where: { bookingId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateApprovalHeader',
        error instanceof Error ? error.stack : undefined,
        'AssignmentRepository.updateApprovalHeader',
      );
      throw error;
    }
  };
}
