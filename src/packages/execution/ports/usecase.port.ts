import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { CheckInSegmentDto } from '../dto/check-in-segment.dto';
import { CheckOutSegmentDto } from '../dto/check-out-segment.dto';
import { UploadReceiptDto } from '../dto/upload-receipt.dto';
import { UploadMultipleReceiptsDto } from '../dto/upload-multiple-receipts.dto';
import { VerifyExecutionDto } from '../dto/verify-execution.dto';
import { ScanReceiptDto } from '../dto/scan-receipt.dto';

export interface ExecutionUsecasePort {
  checkInSegment(segmentId: number, dto: CheckInSegmentDto, userId: string): Promise<IUsecaseResponse<any>>;

  checkOutSegment(segmentId: number, dto: CheckOutSegmentDto, userId: string): Promise<IUsecaseResponse<any>>;

  scanReceipt(executionId: number, dto: ScanReceiptDto): Promise<IUsecaseResponse<any>>;

  uploadReceipt(executionId: number, dto: UploadReceiptDto, userId: string): Promise<IUsecaseResponse<any>>;

  uploadMultipleReceipts(
    executionId: number,
    dto: UploadMultipleReceiptsDto,
    userId: string,
  ): Promise<IUsecaseResponse<any>>;

  verifyExecution(executionId: number, dto: VerifyExecutionDto, userId: string): Promise<IUsecaseResponse<any>>;
}
