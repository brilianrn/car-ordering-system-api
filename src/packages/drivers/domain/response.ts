import { Driver } from '@prisma/client';

export interface IDriver extends Driver {
  vendor?: {
    id: number;
    name: string;
    contactPic?: string | null;
  } | null;
  dedicatedVehicle?: {
    id: number;
    vehicleCode: string;
    licensePlate: string;
    brandModel: string;
  } | null;
  isSimExpired?: boolean;
}

export interface IDriverListResponse {
  data: IDriver[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface IDriverDetailResponse extends Partial<IDriver> {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
}

export interface IDriverEligibleResponse {
  data: IDriver[];
  meta: {
    total: number;
  };
}
