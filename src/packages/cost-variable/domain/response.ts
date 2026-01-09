import { CostVariable } from '@prisma/client';

export interface ICostVariable extends CostVariable {}

export interface ICostVariableListResponse {
  data: ICostVariable[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
