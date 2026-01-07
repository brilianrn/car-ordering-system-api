import { OrganizationUnit, Prisma, Vehicle, VehicleImage } from '@prisma/client';

export interface VehiclesRepositoryPort {
  findMany: (params: {
    skip: number;
    take: number;
    where?: Prisma.VehicleWhereInput;
    include?: Prisma.VehicleInclude;
    orderBy?: Prisma.VehicleOrderByWithRelationInput;
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
  update: (params: { where: Prisma.VehicleWhereUniqueInput; data: Prisma.VehicleUpdateInput }) => Promise<Vehicle>;
  findFirst: (where: Prisma.VehicleWhereInput) => Promise<Vehicle | null>;
  countVehicleImages: (vehicleId: number) => Promise<number>;
  createVehicleImage: (data: Prisma.VehicleImageCreateInput) => Promise<VehicleImage>;
  deleteVehicleImages: (vehicleId: number) => Promise<void>;
  findActiveOrganizations: () => Promise<OrganizationUnit[]>;
}
