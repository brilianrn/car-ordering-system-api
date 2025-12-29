import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { DriverType } from '@prisma/client';
import { IDriver, IDriverDetailResponse, IDriverEligibleResponse, IDriverListResponse } from '../domain/response';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { ListDriverQueryDto } from '../dto/list-driver-query.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';

export interface DriversUsecasePort {
  create: (createDto: CreateDriverDto, userId: string) => Promise<IUsecaseResponse<IDriver>>;
  update: (id: number, updateDto: UpdateDriverDto, userId: string) => Promise<IUsecaseResponse<IDriver>>;
  remove: (id: number, userId: string) => Promise<IUsecaseResponse<void>>;
  restore: (id: number) => Promise<IUsecaseResponse<IDriver>>;
  getDetail: (id: number) => Promise<IUsecaseResponse<IDriverDetailResponse>>;
  findAll: (query: ListDriverQueryDto) => Promise<IUsecaseResponse<IDriverListResponse>>;
  findEligible: (query: {
    transmission?: string;
    plantLocation?: string;
    vendorId?: number;
    driverType?: DriverType;
    isDedicated?: boolean;
  }) => Promise<IUsecaseResponse<IDriverEligibleResponse>>;
  findExpiredSIM: () => Promise<IUsecaseResponse<IDriverEligibleResponse>>;
}
