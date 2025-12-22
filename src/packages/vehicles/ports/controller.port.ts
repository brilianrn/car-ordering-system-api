import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Response } from 'express';
import {
  IVehicle,
  IVehicleDetailResponse,
  IVehicleListResponse,
} from '../domain/response';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { QueryVehicleDto } from '../dto/query-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';

export interface VehiclesControllerPort {
  findAll: (
    query: QueryVehicleDto,
    res: Response,
  ) => Promise<Response<ResponseREST<IVehicleListResponse>>>;
  findOne: (
    id: number,
    res: Response,
  ) => Promise<Response<ResponseREST<IVehicle>>>;
  findDetail: (
    id: number,
    res: Response,
  ) => Promise<Response<ResponseREST<IVehicleDetailResponse>>>;
  create: (
    createDto: CreateVehicleDto,
    userId: string,
    res: Response,
  ) => Promise<Response<ResponseREST<IVehicle>>>;
  update: (
    id: number,
    updateDto: UpdateVehicleDto,
    userId: string,
    res: Response,
  ) => Promise<Response<ResponseREST<IVehicle>>>;
  remove: (
    id: number,
    userId: string,
    res: Response,
  ) => Promise<Response<ResponseREST<void>>>;
  restore: (
    id: number,
    res: Response,
  ) => Promise<Response<ResponseREST<IVehicle>>>;
}
