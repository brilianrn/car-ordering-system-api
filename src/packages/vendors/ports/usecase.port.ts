import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IVendor, IVendorListResponse, IVendorOption } from '../domain/response';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { QueryVendorDto } from '../dto/query-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';

export interface VendorsUsecasePort {
  findAll: (query: QueryVendorDto) => Promise<IUsecaseResponse<IVendorListResponse>>;
  findOne: (id: number) => Promise<IUsecaseResponse<IVendor>>;
  create: (createDto: CreateVendorDto, userId: string) => Promise<IUsecaseResponse<IVendor>>;
  update: (id: number, updateDto: UpdateVendorDto, userId: string) => Promise<IUsecaseResponse<IVendor>>;
  remove: (id: number, userId: string) => Promise<IUsecaseResponse<void>>;
  findOptions: () => Promise<IUsecaseResponse<IVendorOption[]>>;
}
