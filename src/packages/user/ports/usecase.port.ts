import { IPaginationResponse, IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Employee } from '@prisma/client';
import { UpdateUserDto } from '../dto';
import { ListUserQueryDto } from '../dto/list-user-query.dto';
import { UpdateRolesDto } from '../dto/update-roles.dto';

export interface IUpdateUserResponse {
  message: string;
  employeeId: string;
}

export interface UserUsecasePort {
  findAll(query: ListUserQueryDto): Promise<IUsecaseResponse<IPaginationResponse<Employee>>>;
  findOne(employeeId: string): Promise<IUsecaseResponse<Employee>>;
  updateUser(employeeId: string, dto: UpdateUserDto): Promise<IUsecaseResponse<IUpdateUserResponse>>;
  updateRoles(employeeId: string, dto: UpdateRolesDto, actorId: string): Promise<IUsecaseResponse<IUpdateUserResponse>>;
  remove(employeeId: string, actorId: string): Promise<IUsecaseResponse<void>>;
}
