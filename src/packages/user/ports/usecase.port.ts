import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { UpdateUserDto } from '../dto';

export interface IUpdateUserResponse {
  message: string;
  employeeId: string;
}

export interface UserUsecasePort {
  updateUser(employeeId: string, dto: UpdateUserDto): Promise<IUsecaseResponse<IUpdateUserResponse>>;
}
