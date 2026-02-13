import { FundingSource } from '@prisma/client';
import { VerificationAction } from '../dto/verify-item.dto';

/**
 * Response for verifyItem use case
 */
export interface IVerifyItemResponse {
  itemId: number;
  action: VerificationAction;
  fundingSource: FundingSource | null;
  reimburseTicket: string | null;
  replenishTicket: string | null;
  message: string;
}

/**
 * Response for closeTrip use case
 */
export interface ICloseTripResponse {
  executionId: number;
  bookingId?: number;
  status: string;
  actualCost: number;
  estimatedCost: number;
  costDifference: number;
  costByCategory: Record<string, { count: number; totalAmount: number }>;
  reimburseTicket: string | null;
  replenishTicket: string | null;
  receiptCount: number;
  message: string;
}
