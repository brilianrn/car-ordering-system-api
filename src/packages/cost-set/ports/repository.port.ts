import { CostSetEnvironment, CostSetScope, CostSetStatus, Prisma } from '@prisma/client';

export interface CostSetRepositoryPort {
  create(data: Prisma.CostSetCreateInput): Promise<any>;
  findById(id: number): Promise<any | null>;
  findByVersion(version: number): Promise<any | null>;
  findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.CostSetWhereInput;
    orderBy?: Prisma.CostSetOrderByWithRelationInput;
  }): Promise<any[]>;
  count(where?: Prisma.CostSetWhereInput): Promise<number>;
  update(id: number, data: Prisma.CostSetUpdateInput): Promise<any>;
  findPublishedCostSetForDate(params: {
    effectiveDate: Date;
    environment: CostSetEnvironment;
    scope?: CostSetScope;
  }): Promise<any | null>;
  checkOverlappingCostSet(params: {
    effectiveFrom: Date;
    effectiveTo?: Date;
    scope: CostSetScope;
    environment: CostSetEnvironment;
    excludeVersion?: number;
  }): Promise<boolean>;
  getLatestVersion(): Promise<number>;
}
