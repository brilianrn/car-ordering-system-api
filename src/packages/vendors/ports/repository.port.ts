import { Prisma, Vendor } from '@prisma/client';

export interface VendorsRepositoryPort {
  findMany: (params: {
    skip: number;
    take: number;
    where?: Prisma.VendorWhereInput;
    orderBy?: Prisma.VendorOrderByWithRelationInput;
  }) => Promise<Vendor[]>;
  count: (where?: Prisma.VendorWhereInput) => Promise<number>;
  findUnique: (where: Prisma.VendorWhereUniqueInput) => Promise<Vendor | null>;
  create: (data: Prisma.VendorCreateInput) => Promise<Vendor>;
  update: (params: { where: Prisma.VendorWhereUniqueInput; data: Prisma.VendorUpdateInput }) => Promise<Vendor>;
  findFirst: (where: Prisma.VendorWhereInput) => Promise<Vendor | null>;
  findOptions: () => Promise<Pick<Vendor, 'id' | 'code' | 'name'>[]>;
}
