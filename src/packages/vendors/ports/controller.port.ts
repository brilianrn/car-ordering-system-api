import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Response } from 'express';
import { IVendor, IVendorListResponse, IVendorOption } from '../domain/response';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { QueryVendorDto } from '../dto/query-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';

export interface VendorsControllerPort {
  findAll: (query: QueryVendorDto, res: Response) => Promise<Response<ResponseREST<IVendorListResponse>>>;
  findOne: (id: number, res: Response) => Promise<Response<ResponseREST<IVendor>>>;
  create: (createDto: CreateVendorDto, userId: string, res: Response) => Promise<Response<ResponseREST<IVendor>>>;
  update: (
    id: number,
    updateDto: UpdateVendorDto,
    userId: string,
    res: Response,
  ) => Promise<Response<ResponseREST<IVendor>>>;
  remove: (id: number, userId: string, res: Response) => Promise<Response<ResponseREST<void>>>;
  findOptions: (res: Response) => Promise<Response<ResponseREST<IVendorOption[]>>>;
}
