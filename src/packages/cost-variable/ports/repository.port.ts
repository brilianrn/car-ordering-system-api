import { Prisma, CostVariable } from '@prisma/client';

export interface CostVariableRepositoryPort {
  create: (data: Prisma.CostVariableCreateInput) => Promise<CostVariable>;
  update: (params: {
    where: Prisma.CostVariableWhereUniqueInput;
    data: Prisma.CostVariableUpdateInput;
  }) => Promise<CostVariable>;
  softDelete: (id: number, deletedBy: string) => Promise<CostVariable>;
  restore: (id: number) => Promise<CostVariable>;
  findById: (id: number, includeDeleted?: boolean) => Promise<CostVariable | null>;
  findByCode: (code: string, includeDeleted?: boolean) => Promise<CostVariable | null>;
  findList: (params: {
    skip: number;
    take: number;
    where?: Prisma.CostVariableWhereInput;
    orderBy?: Prisma.CostVariableOrderByWithRelationInput;
  }) => Promise<CostVariable[]>;
  count: (where?: Prisma.CostVariableWhereInput) => Promise<number>;
  findFirst: (where: Prisma.CostVariableWhereInput) => Promise<CostVariable | null>;
}
