import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Response } from 'express';
import { IDriver, IDriverDetailResponse, IDriverEligibleResponse, IDriverListResponse } from '../domain/response';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { ListDriverQueryDto } from '../dto/list-driver-query.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';

export interface DriversControllerPort {
  create: (createDto: CreateDriverDto, userId: string, res: Response) => Promise<Response<ResponseREST<IDriver>>>;
  findAll: (query: ListDriverQueryDto, res: Response) => Promise<Response<ResponseREST<IDriverListResponse>>>;
  findOne: (id: number, res: Response) => Promise<Response<ResponseREST<IDriverDetailResponse>>>;
  update: (
    id: number,
    updateDto: UpdateDriverDto,
    userId: string,
    res: Response,
  ) => Promise<Response<ResponseREST<IDriver>>>;
  remove: (id: number, userId: string, res: Response) => Promise<Response<ResponseREST<void>>>;
  restore: (id: number, res: Response) => Promise<Response<ResponseREST<IDriver>>>;
  findEligible: (
    query: {
      transmission?: string;
      plantLocation?: string;
      vendorId?: number;
      driverType?: string;
      isDedicated?: boolean;
    },
    res: Response,
  ) => Promise<Response<ResponseREST<IDriverEligibleResponse>>>;
  findExpiredSIM: (res: Response) => Promise<Response<ResponseREST<IDriverEligibleResponse>>>;
}
