import { Prisma, Driver } from '@prisma/client';

export interface DriversRepositoryPort {
  create: (data: Prisma.DriverCreateInput) => Promise<Driver>;
  update: (params: { where: Prisma.DriverWhereUniqueInput; data: Prisma.DriverUpdateInput }) => Promise<Driver>;
  softDelete: (id: number, deletedBy: string) => Promise<Driver>;
  restore: (id: number) => Promise<Driver>;
  findById: (id: number, includeDeleted?: boolean) => Promise<Driver | null>;
  findList: (params: {
    skip: number;
    take: number;
    where?: Prisma.DriverWhereInput;
    orderBy?: Prisma.DriverOrderByWithRelationInput;
  }) => Promise<Driver[]>;
  count: (where?: Prisma.DriverWhereInput) => Promise<number>;
  findFirst: (where: Prisma.DriverWhereInput) => Promise<Driver | null>;
  findEligible: (params: { where: Prisma.DriverWhereInput; take?: number }) => Promise<Driver[]>;
  findExpiredSIM: () => Promise<Driver[]>;
}
