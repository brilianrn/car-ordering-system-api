import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { BookingStatus } from '@prisma/client';
import { ExecuteActionDto } from '../dto';

export interface IValidateTokenResponse {
  bookingId: number;
  bookingNumber: string;
  requesterName: string;
  destination: string;
  date: string;
  purpose: string;
  action: 'APPROVE' | 'REJECT';
  level: 'L1' | 'L2';
  approverId: string;
}

export interface IExecuteActionResponse {
  message: string;
  bookingId: number;
  newStatus: BookingStatus;
}

export interface ApprovalsUsecasePort {
  validateToken(token: string): Promise<IUsecaseResponse<IValidateTokenResponse>>;
  executeAction(dto: ExecuteActionDto, requesterId: string): Promise<IUsecaseResponse<IExecuteActionResponse>>;
}
