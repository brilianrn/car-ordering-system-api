import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { CheckInSegmentDto } from '../dto/check-in-segment.dto';
import { CheckOutSegmentDto } from '../dto/check-out-segment.dto';
import { UploadReceiptDto } from '../dto/upload-receipt.dto';
import { VerifyExecutionDto } from '../dto/verify-execution.dto';
import { ExecutionRepositoryPort } from '../ports/repository.port';
import { ExecutionUsecasePort } from '../ports/usecase.port';

@Injectable()
export class ExecutionUseCase implements ExecutionUsecasePort {
  private readonly db = clientDb;

  constructor(
    @Inject('ExecutionRepositoryPort')
    private readonly repository: ExecutionRepositoryPort,
  ) {}

  checkInSegment = async (
    segmentId: number,
    dto: CheckInSegmentDto,
    userId: string,
  ): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get segment
      const segment = await this.repository.findSegmentById(segmentId);
      if (!segment) {
        return {
          error: {
            message: `Segment with ID ${segmentId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Check if execution already exists
      const existingExecution = await this.repository.findSegmentExecutionBySegmentId(segmentId);
      if (existingExecution) {
        return {
          error: {
            message: 'Segment already checked in',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Validate booking is assigned
      const booking = await this.repository.findBookingById(segment.bookingId);
      if (!booking || booking.bookingStatus !== BookingStatus.ASSIGNED) {
        return {
          error: {
            message: 'Booking is not assigned yet',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 4. Create segment execution
      const checkInAt = new Date();
      const execution = await this.repository.createSegmentExecution({
        segment: { connect: { id: segmentId } },
        status: 'InProgress',
        checkInAt,
        odoStart: dto.odoStart,
        createdBy: userId,
      });

      // 5. Update SuratJalan status
      await this.db.suratJalan.updateMany({
        where: { segmentId, deletedAt: null },
        data: { status: 'Active', updatedBy: userId },
      });

      return { data: execution };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in checkInSegment',
        error instanceof Error ? error.stack : undefined,
        'ExecutionUseCase.checkInSegment',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to check in segment',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  checkOutSegment = async (
    segmentId: number,
    dto: CheckOutSegmentDto,
    userId: string,
  ): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get segment execution
      const execution = await this.repository.findSegmentExecutionBySegmentId(segmentId);
      if (!execution) {
        return {
          error: {
            message: 'Segment not checked in yet',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 2. Validate status
      if (execution.status !== 'InProgress') {
        return {
          error: {
            message: `Segment is not in progress. Current status: ${execution.status}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Calculate distance
      const odoDistance = dto.odoEnd - (execution.odoStart || 0);

      // 4. Anomaly detection (basic)
      const anomalyFlags: any = {};
      if (dto.gpsDistance && Math.abs(odoDistance - dto.gpsDistance) > 10) {
        // More than 10km difference
        anomalyFlags.routeDeviation = true;
        anomalyFlags.distanceDifference = Math.abs(odoDistance - dto.gpsDistance);
      }

      // 5. Update segment execution
      const checkOutAt = new Date();
      await this.repository.updateSegmentExecution(segmentId, {
        status: 'Completed',
        checkOutAt,
        odoEnd: dto.odoEnd,
        odoDistance,
        gpsDistance: dto.gpsDistance || null,
        anomalyFlags: Object.keys(anomalyFlags).length > 0 ? (anomalyFlags as Prisma.InputJsonValue) : Prisma.JsonNull,
        updatedBy: userId,
      });

      // 6. Update SuratJalan status
      await this.db.suratJalan.updateMany({
        where: { segmentId, deletedAt: null },
        data: { status: 'Completed', updatedBy: userId },
      });

      // 7. Create verification header for finance
      const updatedExecution = await this.repository.findSegmentExecutionBySegmentId(segmentId);
      if (updatedExecution) {
        const verifierId = userId; // TODO: Get finance user

        await this.repository.createVerificationHeader({
          segmentExecution: { connect: { id: updatedExecution.id } },
          verifyStatus: 'IN_REVIEW',
          verifierId,
          createdBy: userId,
        });
      }

      // 8. Get updated execution
      const finalExecution = await this.repository.findSegmentExecutionBySegmentId(segmentId);

      return { data: finalExecution };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in checkOutSegment',
        error instanceof Error ? error.stack : undefined,
        'ExecutionUseCase.checkOutSegment',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to check out segment',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  uploadReceipt = async (
    executionId: number,
    dto: UploadReceiptDto,
    userId: string,
  ): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get execution by ID
      const execution = await this.repository.findSegmentExecutionById(executionId);
      if (!execution) {
        return {
          error: {
            message: `Execution with ID ${executionId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Validate execution is completed
      if (execution.status !== 'Completed') {
        return {
          error: {
            message: 'Execution is not completed yet',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Get or create verification header
      let verificationHeader = await this.repository.findVerificationHeaderByExecutionId(execution.id);
      if (!verificationHeader) {
        const verifierId = userId; // TODO: Get finance user
        verificationHeader = await this.repository.createVerificationHeader({
          segmentExecution: { connect: { id: execution.id } },
          verifyStatus: 'IN_REVIEW',
          verifierId,
          createdBy: userId,
        });
      }

      // 4. Generate duplicate hash
      const dupHash = dto.dupHash || `${dto.category}-${dto.amountIdr}-${dto.receiptDate}`;

      // 5. Create receipt item
      const receiptItem = await this.repository.createReceiptItem({
        verification: { connect: { id: verificationHeader.id } },
        category: dto.category,
        amountIdr: dto.amountIdr,
        receiptDate: new Date(dto.receiptDate),
        photoUrl: dto.photoUrl,
        fundingSource: dto.fundingSource,
        dupHash,
        createdBy: userId,
      });

      return { data: receiptItem };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in uploadReceipt',
        error instanceof Error ? error.stack : undefined,
        'ExecutionUseCase.uploadReceipt',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to upload receipt',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  verifyExecution = async (
    executionId: number,
    dto: VerifyExecutionDto,
    userId: string,
  ): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get execution first
      const execution = await this.repository.findSegmentExecutionById(executionId);
      if (!execution) {
        return {
          error: {
            message: `Execution with ID ${executionId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Get verification header
      const verificationHeader = await this.repository.findVerificationHeaderByExecutionId(execution.id);
      if (!verificationHeader) {
        return {
          error: {
            message: `Verification header not found for execution ${executionId}`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 3. Validate status
      if (verificationHeader.verifyStatus !== 'IN_REVIEW') {
        return {
          error: {
            message: `Verification is not in review. Current status: ${verificationHeader.verifyStatus}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 4. Calculate result snapshot
      const receiptItems = verificationHeader.receiptItems || [];
      const totalAmount = receiptItems.reduce((sum: number, item: any) => sum + item.amountIdr, 0);

      const resultSnapshot = {
        totalReceipts: receiptItems.length,
        totalAmount,
        receipts: receiptItems.map((item: any) => ({
          category: item.category,
          amountIdr: item.amountIdr,
          fundingSource: item.fundingSource,
        })),
        verifiedAt: new Date().toISOString(),
      };

      // 5. Update verification header
      await this.repository.updateVerificationHeader(execution.id, {
        verifyStatus: dto.verifyStatus,
        verifiedAt: new Date(),
        resultSnapshot: resultSnapshot as Prisma.InputJsonValue,
        reimburseTicket: dto.reimburseTicket || null,
        replenishTicket: dto.replenishTicket || null,
        anomalyHandled: dto.anomalyHandled || false,
        updatedBy: userId,
      });

      // 6. Get updated verification header
      const updatedVerification = await this.repository.findVerificationHeaderByExecutionId(execution.id);

      return { data: updatedVerification };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in verifyExecution',
        error instanceof Error ? error.stack : undefined,
        'ExecutionUseCase.verifyExecution',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to verify execution',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
