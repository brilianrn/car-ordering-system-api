import { Vendor } from '@prisma/client';

export interface IVendor extends Vendor {}

export interface IVendorOption {
  id: number;
  code: string;
  name: string;
}

export interface IVendorListResponse {
  data: IVendor[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
