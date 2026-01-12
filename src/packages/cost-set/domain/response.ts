import { CostItem, CostSet, CostSetEnvironment, CostSetScope, CostSetStatus } from '@prisma/client';

export interface ICostSet extends CostSet {
  status: CostSetStatus;
  environment: CostSetEnvironment;
  scope: CostSetScope;
  items: ICostItem[];
}

export interface ICostItem extends CostItem {}

export interface ICostSetListResponse {
  data: ICostSet[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IEstimateCostResponse {
  fuelCost: number; // BBM cost
  tollCost: number; // Tol cost
  parkingCost: number; // Parkir cost
  markup: number; // Markup amount
  subtotal: number; // Subtotal sebelum markup
  total: number; // Total setelah markup dan rounding
  rounding: number; // Jumlah pembulatan
  breakdown: {
    fuel: {
      category: string;
      value: number;
      unit: string;
      calculated: number;
    };
    toll: {
      category: string;
      value: number;
      unit: string;
      calculated: number;
    };
    parking: {
      category: string;
      value: number;
      unit: string;
      calculated: number;
    };
    markup: {
      percentage: number;
      amount: number;
    };
    rounding: {
      step: number;
      before: number;
      after: number;
    };
  };
  costSetVersion: number; // Version CostSet yang digunakan untuk snapshot
  costSetEffectiveFrom: string; // Effective from date
}
