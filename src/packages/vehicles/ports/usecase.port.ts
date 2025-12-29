import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IOrganizationLOV, IVehicle, IVehicleDetailResponse, IVehicleListResponse } from '../domain/response';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { QueryVehicleDto } from '../dto/query-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';

export interface VehiclesUsecasePort {
  findAll: (query: QueryVehicleDto) => Promise<IUsecaseResponse<IVehicleListResponse>>;
  findOne: (id: number) => Promise<IUsecaseResponse<IVehicle>>;
  findDetail: (id: number) => Promise<IUsecaseResponse<IVehicleDetailResponse>>;
  create: (createDto: CreateVehicleDto, userId: string) => Promise<IUsecaseResponse<IVehicle>>;
  update: (id: number, updateDto: UpdateVehicleDto, userId: string) => Promise<IUsecaseResponse<IVehicle>>;
  remove: (id: number, userId: string) => Promise<IUsecaseResponse<void>>;
  restore: (id: number) => Promise<IUsecaseResponse<IVehicle>>;
  lovOrganizations: () => Promise<IUsecaseResponse<IOrganizationLOV[]>>;
}
