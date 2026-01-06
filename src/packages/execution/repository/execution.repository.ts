import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ExecutionRepositoryPort } from '../ports/repository.port';

@Injectable()
export class ExecutionRepository implements ExecutionRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  findSegmentById = async (segmentId: number): Promise<any | null> => {
    try {
      return await this.db.bookingSegment.findUnique({
        where: { id: segmentId, deletedAt: null },
        include: {
          booking: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findSegmentById',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.findSegmentById',
      );
      throw error;
    }
  };

  findBookingById = async (id: number): Promise<any | null> => {
    try {
      return await this.db.booking.findUnique({
        where: { id, deletedAt: null },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findBookingById',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.findBookingById',
      );
      throw error;
    }
  };

  createSegmentExecution = async (data: Prisma.SegmentExecutionCreateInput): Promise<any> => {
    try {
      return await this.db.segmentExecution.create({
        data,
        include: {
          segment: {
            include: {
              booking: true,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createSegmentExecution',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.createSegmentExecution',
      );
      throw error;
    }
  };

  findSegmentExecutionBySegmentId = async (segmentId: number): Promise<any | null> => {
    try {
      return await this.db.segmentExecution.findUnique({
        where: { segmentId, deletedAt: null },
        include: {
          segment: {
            include: {
              booking: true,
            },
          },
          verification: {
            include: {
              receiptItems: true,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findSegmentExecutionBySegmentId',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.findSegmentExecutionBySegmentId',
      );
      throw error;
    }
  };

  findSegmentExecutionById = async (executionId: number): Promise<any | null> => {
    try {
      return await this.db.segmentExecution.findUnique({
        where: { id: executionId, deletedAt: null },
        include: {
          segment: {
            include: {
              booking: true,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findSegmentExecutionById',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.findSegmentExecutionById',
      );
      throw error;
    }
  };

  updateSegmentExecution = async (segmentId: number, data: Prisma.SegmentExecutionUpdateInput): Promise<void> => {
    try {
      await this.db.segmentExecution.update({
        where: { segmentId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateSegmentExecution',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.updateSegmentExecution',
      );
      throw error;
    }
  };

  createVerificationHeader = async (data: Prisma.VerificationHeaderCreateInput): Promise<any> => {
    try {
      return await this.db.verificationHeader.create({
        data,
        include: {
          receiptItems: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createVerificationHeader',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.createVerificationHeader',
      );
      throw error;
    }
  };

  findVerificationHeaderByExecutionId = async (executionId: number): Promise<any | null> => {
    try {
      return await this.db.verificationHeader.findUnique({
        where: { segmentExecutionId: executionId, deletedAt: null },
        include: {
          receiptItems: true,
          segmentExecution: {
            include: {
              segment: {
                include: {
                  booking: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findVerificationHeaderByExecutionId',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.findVerificationHeaderByExecutionId',
      );
      throw error;
    }
  };

  updateVerificationHeader = async (executionId: number, data: Prisma.VerificationHeaderUpdateInput): Promise<void> => {
    try {
      await this.db.verificationHeader.update({
        where: { segmentExecutionId: executionId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateVerificationHeader',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.updateVerificationHeader',
      );
      throw error;
    }
  };

  createReceiptItem = async (data: Prisma.ReceiptItemCreateInput): Promise<any> => {
    try {
      return await this.db.receiptItem.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createReceiptItem',
        error instanceof Error ? error.stack : undefined,
        'ExecutionRepository.createReceiptItem',
      );
      throw error;
    }
  };
}
