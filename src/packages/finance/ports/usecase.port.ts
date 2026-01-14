import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { CloseTripDto } from '../dto/close-trip.dto';
import { VerifyItemDto } from '../dto/verify-item.dto';

export interface FinanceUsecasePort {
  verifyItem(itemId: number, dto: VerifyItemDto, userId: string): Promise<IUsecaseResponse<any>>;
  closeTrip(executionId: number, dto: CloseTripDto, userId: string): Promise<IUsecaseResponse<any>>;
}
