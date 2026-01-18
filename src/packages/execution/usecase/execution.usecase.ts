import { CostCategory } from '@/packages/cost-variable/dto/create-cost-variable.dto';
import { clientDb, OCRService, S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, RealtimeStatus } from '@prisma/client';
import { CheckInSegmentDto } from '../dto/check-in-segment.dto';
import { CheckOutSegmentDto } from '../dto/check-out-segment.dto';
import { ScanReceiptDto } from '../dto/scan-receipt.dto';
import { UploadMultipleReceiptsDto } from '../dto/upload-multiple-receipts.dto';
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
    private readonly ocrService: OCRService,
    private readonly s3Service: S3Service,
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
      if (
        !booking ||
        (booking.bookingStatus !== BookingStatus.ASSIGNED && booking.bookingStatus !== BookingStatus.MERGED)
      ) {
        return {
          error: {
            message: 'Booking is not assigned yet',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 4. Get SuratJalan to get driver ID
      const suratJalan = await this.db.suratJalan.findFirst({
        where: {
          segmentId,
          deletedAt: null,
        },
        select: {
          driverId: true,
        },
      });

      // 5. Create segment execution
      const checkInAt = new Date();
      const execution = await this.repository.createSegmentExecution({
        segment: { connect: { id: segmentId } },
        status: 'InProgress',
        checkInAt,
        odoStart: dto.odoStart,
        createdBy: userId,
      });

      // 6. Update SuratJalan status
      await this.db.suratJalan.updateMany({
        where: { segmentId, deletedAt: null },
        data: { status: 'Active', updatedBy: userId },
      });

      // 7. Update driver realtime status to OnDuty
      if (suratJalan?.driverId) {
        try {
          await this.db.driver.update({
            where: { id: suratJalan.driverId },
            data: {
              realtimeStatus: RealtimeStatus.OnDuty,
              updatedBy: userId,
            },
          });
        } catch (driverUpdateError) {
          // Log error but don't fail check-in
          Logger.warn(
            `Failed to update driver realtime status: ${driverUpdateError instanceof Error ? driverUpdateError.message : 'Unknown error'}`,
            'ExecutionUseCase.checkInSegment',
          );
        }
      }

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

      // 5. Get SuratJalan to get driver ID
      const suratJalan = await this.db.suratJalan.findFirst({
        where: {
          segmentId,
          deletedAt: null,
        },
        select: {
          driverId: true,
        },
      });

      // 6. Update segment execution
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

      // 7. Update SuratJalan status
      await this.db.suratJalan.updateMany({
        where: { segmentId, deletedAt: null },
        data: { status: 'Completed', updatedBy: userId },
      });

      // 8. Update driver realtime status back to Idle
      if (suratJalan?.driverId) {
        try {
          // Check if driver has other active trips (other than this one)
          const otherActiveTrips = await this.db.suratJalan.findFirst({
            where: {
              driverId: suratJalan.driverId,
              segmentId: { not: segmentId },
              status: { in: ['Draft', 'Active'] },
              deletedAt: null,
            },
          });

          // Only set to Idle if no other active trips
          if (!otherActiveTrips) {
            await this.db.driver.update({
              where: { id: suratJalan.driverId },
              data: {
                realtimeStatus: RealtimeStatus.Idle,
                updatedBy: userId,
              },
            });
          }
        } catch (driverUpdateError) {
          // Log error but don't fail check-out
          Logger.warn(
            `Failed to update driver realtime status: ${driverUpdateError instanceof Error ? driverUpdateError.message : 'Unknown error'}`,
            'ExecutionUseCase.checkOutSegment',
          );
        }
      }

      // 9. Create verification header for finance
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

  scanReceipt = async (executionId: number, dto: ScanReceiptDto): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get execution by ID (for validation)
      const execution = await this.repository.findSegmentExecutionById(executionId);
      if (!execution) {
        return {
          error: {
            message: `Execution with ID ${executionId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Process OCR to extract data from receipt photo
      const { finalCategory, finalAmountIdr, finalReceiptDate, ocrSnapshot } = await this.processReceiptOCR({
        photoUrl: dto.photoUrl,
      });

      // 3. Return OCR result (for frontend to populate form)
      return {
        data: {
          category: finalCategory || null,
          amountIdr: finalAmountIdr || null,
          receiptDate: finalReceiptDate || null,
          confidence: ocrSnapshot?.confidence || null,
          rawText: ocrSnapshot?.rawText || null,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in scanReceipt',
        error instanceof Error ? error.stack : undefined,
        'ExecutionUseCase.scanReceipt',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to scan receipt',
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

      // 3. Validate required fields (data should already be filled from OCR scan or manual input)

      if (!dto.category) {
        return {
          error: {
            message: 'Category is required.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      if (!dto.amountIdr) {
        return {
          error: {
            message: 'Amount is required.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      if (!dto.receiptDate) {
        return {
          error: {
            message: 'Receipt date is required.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 5. Get or create verification header
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

      // 5. Create receipt item (no OCR snapshot since OCR was done separately during scan)
      const receiptItem = await this.repository.createReceiptItem({
        verification: { connect: { id: verificationHeader.id } },
        category: dto.category,
        amountIdr: dto.amountIdr,
        receiptDate: new Date(dto.receiptDate),
        photoUrl: dto.photoUrl,
        fundingSource: dto.fundingSource,
        dupHash,
        // OCR snapshot not stored during submit (was done during scan)
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

  uploadMultipleReceipts = async (
    executionId: number,
    dto: UploadMultipleReceiptsDto,
    userId: string,
  ): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Validate receipts array
      if (!dto.receipts || dto.receipts.length === 0) {
        return {
          error: {
            message: 'At least one receipt is required',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 2. Get execution by ID
      const execution = await this.repository.findSegmentExecutionById(executionId);
      if (!execution) {
        return {
          error: {
            message: `Execution with ID ${executionId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 3. Validate execution is completed
      if (execution.status !== 'Completed') {
        return {
          error: {
            message: 'Execution is not completed yet',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 4. Get or create verification header
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

      // 5. Process each receipt with OCR
      const receiptItems: any[] = [];
      const errors: Array<{ index: number; error: string; receipt: any }> = [];

      for (let i = 0; i < dto.receipts.length; i++) {
        const receiptDto = dto.receipts[i];
        try {
          // Validate required fields (data should already be filled from OCR scan or manual input)
          if (!receiptDto.category) {
            throw new Error('Category is required.');
          }
          if (!receiptDto.amountIdr) {
            throw new Error('Amount is required.');
          }
          if (!receiptDto.receiptDate) {
            throw new Error('Receipt date is required.');
          }

          // Generate duplicate hash
          const dupHash =
            receiptDto.dupHash || `${receiptDto.category}-${receiptDto.amountIdr}-${receiptDto.receiptDate}`;

          // Create receipt item (no OCR snapshot since OCR was done separately during scan)
          const receiptItem = await this.repository.createReceiptItem({
            verification: { connect: { id: verificationHeader.id } },
            category: receiptDto.category,
            amountIdr: receiptDto.amountIdr,
            receiptDate: new Date(receiptDto.receiptDate),
            photoUrl: receiptDto.photoUrl,
            fundingSource: receiptDto.fundingSource,
            dupHash,
            // OCR snapshot not stored during submit (was done during scan)
            createdBy: userId,
          });

          receiptItems.push(receiptItem);
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Failed to create receipt item',
            receipt: receiptDto,
          });
        }
      }

      // 6. Return response
      if (receiptItems.length === 0) {
        // All failed
        return {
          error: {
            message: 'All receipts failed to upload',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      } else if (errors.length > 0) {
        // Partial success
        return {
          data: {
            verificationHeaderId: verificationHeader.id,
            totalReceipts: dto.receipts.length,
            successCount: receiptItems.length,
            failedCount: errors.length,
            receipts: [
              ...receiptItems.map((item) => ({ status: 'success' as const, data: item })),
              ...errors.map((err) => ({
                index: err.index,
                status: 'failed' as const,
                error: err.error,
                receipt: err.receipt,
              })),
            ],
          },
        };
      } else {
        // All success
        return {
          data: {
            verificationHeaderId: verificationHeader.id,
            totalReceipts: receiptItems.length,
            receipts: receiptItems,
          },
        };
      }
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in uploadMultipleReceipts',
        error instanceof Error ? error.stack : undefined,
        'ExecutionUseCase.uploadMultipleReceipts',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to upload receipts',
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

  /**
   * Helper method to process OCR for a receipt
   * Returns final values (from DTO or OCR) and OCR snapshot
   */
  private async processReceiptOCR(receiptDto: {
    photoUrl: string;
    category?: CostCategory;
    amountIdr?: number;
    receiptDate?: string;
  }): Promise<{
    finalCategory?: CostCategory;
    finalAmountIdr?: number;
    finalReceiptDate?: string;
    ocrSnapshot: any;
  }> {
    let ocrSnapshot: any = null;
    const parsedData: {
      category?: CostCategory;
      amountIdr?: number;
      receiptDate?: string;
    } = {};

    try {
      // Get image URL for OCR (use presigned URL if it's an S3 key)
      let imageUrl = receiptDto.photoUrl;

      // If photoUrl is an S3 key (not a full URL), get presigned URL
      if (!receiptDto.photoUrl.startsWith('http') && !receiptDto.photoUrl.startsWith('data:')) {
        try {
          imageUrl = await this.s3Service.getPresignedUrl(receiptDto.photoUrl, 300); // 5 minutes expiry
        } catch (s3Error) {
          Logger.error(
            `Failed to get presigned URL for OCR: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}`,
            undefined,
            'ExecutionUseCase.processReceiptOCR - OCR presigned URL',
          );
          // Continue with original photoUrl, might be base64 or already a URL
        }
      }

      // Perform OCR
      const ocrResult = await this.ocrService.extractText(imageUrl);
      const parsed = this.ocrService.parseReceiptData(ocrResult.text, ocrResult.confidence);

      ocrSnapshot = {
        rawText: parsed.rawText,
        confidence: parsed.confidence,
        extracted: {
          category: parsed.category,
          amountIdr: parsed.amountIdr,
          receiptDate: parsed.receiptDate,
        },
      };

      // Auto-fill missing fields from OCR
      if (!receiptDto.category && parsed.category) {
        parsedData.category = parsed.category;
      }
      if (!receiptDto.amountIdr && parsed.amountIdr) {
        parsedData.amountIdr = parsed.amountIdr;
      }
      if (!receiptDto.receiptDate && parsed.receiptDate) {
        parsedData.receiptDate = parsed.receiptDate;
      }

      Logger.info(
        `OCR completed for receipt. Confidence: ${ocrResult.confidence}%. Extracted: ${JSON.stringify(parsedData)}`,
        'ExecutionUseCase.processReceiptOCR - OCR',
      );
    } catch (ocrError) {
      // OCR failure should not block receipt upload
      Logger.error(
        `OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
        ocrError instanceof Error ? ocrError.stack : undefined,
        'ExecutionUseCase.processReceiptOCR - OCR',
      );
      // Continue without OCR data
    }

    return {
      finalCategory: receiptDto.category || parsedData.category,
      finalAmountIdr: receiptDto.amountIdr || parsedData.amountIdr,
      finalReceiptDate: receiptDto.receiptDate || parsedData.receiptDate,
      ocrSnapshot,
    };
  }
}
