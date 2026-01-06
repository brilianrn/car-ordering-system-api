import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { ApprovalHeader, Prisma, PrismaClient } from '@prisma/client';
import { ApprovalRepositoryPort } from '../ports/repository.port';

@Injectable()
export class ApprovalRepository implements ApprovalRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  findApprovalHeaderByBookingId = async (bookingId: number): Promise<ApprovalHeader | null> => {
    try {
      return await this.db.approvalHeader.findUnique({
        where: { bookingId, deletedAt: null },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findApprovalHeaderByBookingId',
        error instanceof Error ? error.stack : undefined,
        'ApprovalRepository.findApprovalHeaderByBookingId',
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
        'ApprovalRepository.updateApprovalHeader',
      );
      throw error;
    }
  };

  findBookingById = async (id: number, include?: Prisma.BookingInclude): Promise<any | null> => {
    try {
      return await this.db.booking.findUnique({
        where: { id, deletedAt: null },
        include: include || {
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
        'ApprovalRepository.findBookingById',
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
        'ApprovalRepository.updateBooking',
      );
      throw error;
    }
  };

  findApprovalList = async (params: {
    skip: number;
    take: number;
    where: Prisma.BookingWhereInput;
    orderBy?: Prisma.BookingOrderByWithRelationInput;
  }): Promise<any[]> => {
    try {
      return await this.db.booking.findMany({
        ...params,
        include: {
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
              vehicleChosen: true,
              driverChosen: true,
            },
          },
          segments: {
            where: { deletedAt: null },
            orderBy: { segmentNo: 'asc' },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findApprovalList',
        error instanceof Error ? error.stack : undefined,
        'ApprovalRepository.findApprovalList',
      );
      throw error;
    }
  };

  countApprovalList = async (where: Prisma.BookingWhereInput): Promise<number> => {
    try {
      return await this.db.booking.count({ where });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in countApprovalList',
        error instanceof Error ? error.stack : undefined,
        'ApprovalRepository.countApprovalList',
      );
      throw error;
    }
  };
}
