import { IPaginationResponse, IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Employee } from '@prisma/client';
import { UpdateUserDto } from '../dto';
import { ListUserQueryDto } from '../dto/list-user-query.dto';
import { UpdateRolesDto } from '../dto/update-roles.dto';

export interface IUpdateUserResponse {
  message: string;
  employeeId: string;
}

export interface ISyncHrResponse {
  batchId: string;
  synced: number;
  created: number;
  updated: number;
  accountsCreated: number;
  failed: number;
  errors: string[];
}

export interface IUploadL1FailedRow {
  row: number;
  employeeId: string;
  approverId: string;
  reason: string;
}

export interface IUploadL1Response {
  updated: number;
  failed: number;
  failedRows: IUploadL1FailedRow[];
}

export interface IAssignLeadersResponse {
  promoted: number;
  skipped: number;
  notFound: number;
  message: string;
}

export interface UserUsecasePort {
  findAll(query: ListUserQueryDto): Promise<IUsecaseResponse<IPaginationResponse<Employee>>>;
  findOne(employeeId: string): Promise<IUsecaseResponse<Employee>>;
  updateUser(employeeId: string, dto: UpdateUserDto): Promise<IUsecaseResponse<IUpdateUserResponse>>;
  updateRoles(employeeId: string, dto: UpdateRolesDto, actorId: string): Promise<IUsecaseResponse<IUpdateUserResponse>>;
  remove(employeeId: string, actorId: string): Promise<IUsecaseResponse<void>>;
  syncHr(actorId: string): Promise<IUsecaseResponse<ISyncHrResponse>>;
  uploadL1(fileBuffer: Buffer, actorId: string): Promise<IUsecaseResponse<IUploadL1Response>>;
  assignLeaders(leaderIds: string[], actorId: string): Promise<IUsecaseResponse<IAssignLeadersResponse>>;
}
