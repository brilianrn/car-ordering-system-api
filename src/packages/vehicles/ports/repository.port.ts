import { Prisma, Vehicle } from '@prisma/client';

export interface VehiclesRepositoryPort {
  findMany: (params: {
    skip: number;
    take: number;
    where?: Prisma.VehicleWhereInput;
    include?: Prisma.VehicleInclude;
  }) => Promise<Vehicle[]>;
  count: (where?: Prisma.VehicleWhereInput) => Promise<number>;
  findUnique: (
    params: {
      where: Prisma.VehicleWhereUniqueInput;
      include?: Prisma.VehicleInclude;
    },
    includeDeleted?: boolean,
  ) => Promise<Vehicle | null>;
  create: (data: Prisma.VehicleCreateInput) => Promise<Vehicle>;
  update: (params: {
    where: Prisma.VehicleWhereUniqueInput;
    data: Prisma.VehicleUpdateInput;
  }) => Promise<Vehicle>;
  findFirst: (where: Prisma.VehicleWhereInput) => Promise<Vehicle | null>;
}
