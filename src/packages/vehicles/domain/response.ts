import { Vehicle } from '@prisma/client';

export interface IVehicle extends Vehicle {
  vendor?: {
    id: number;
    name: string;
    contactPic?: string | null;
  } | null;
  dedicatedOrg?: {
    id: number;
    code: string;
    name: string;
    type: string;
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

export interface IVehicleImage {
  id: number;
  name: string;
  url: string; // Presigned URL
}

export interface IVehicleDetailResponse extends Partial<IVehicle> {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  images?: IVehicleImage[];
}

export interface IOrganizationLOV {
  label: string;
  value: number;
}
