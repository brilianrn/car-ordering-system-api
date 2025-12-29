import { Asset, Prisma } from '@prisma/client';

export interface UploadRepositoryPort {
  create: (data: Prisma.AssetCreateInput) => Promise<Asset>;
  findById: (id: number) => Promise<Asset | null>;
  findMany: (params: { skip?: number; take?: number; where?: Prisma.AssetWhereInput }) => Promise<Asset[]>;
  count: (where?: Prisma.AssetWhereInput) => Promise<number>;
}
