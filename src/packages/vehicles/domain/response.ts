import { Vehicle } from '@prisma/client';

export interface IVehicle extends Vehicle {
  vendor?: {
    id: number;
    name: string;
    contactPic?: string | null;
  } | null;
}

export interface IVehicleListResponse {
  data: IVehicle[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface IVehicleDetailResponse extends Partial<IVehicle> {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
}
