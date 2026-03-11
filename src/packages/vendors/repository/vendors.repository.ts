import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, Vendor } from '@prisma/client';
import { VendorsRepositoryPort } from '../ports/repository.port';

@Injectable()
export class VendorsRepository implements VendorsRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  findMany = async (params: {
    skip: number;
    take: number;
    where?: Prisma.VendorWhereInput;
    orderBy?: Prisma.VendorOrderByWithRelationInput;
  }): Promise<Vendor[]> => {
    try {
      return await this.db.vendor.findMany({
        ...params,
        where: {
          ...params.where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'VendorsRepository.findMany',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.VendorWhereInput): Promise<number> => {
    try {
      return await this.db.vendor.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'VendorsRepository.count',
      );
      throw error;
    }
  };

  findUnique = async (where: Prisma.VendorWhereUniqueInput): Promise<Vendor | null> => {
    try {
      const vendor = await this.db.vendor.findUnique({ where });
      if (vendor?.deletedAt) return null;
      return vendor;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findUnique',
        error instanceof Error ? error.stack : undefined,
        'VendorsRepository.findUnique',
      );
      throw error;
    }
  };

  create = async (data: Prisma.VendorCreateInput): Promise<Vendor> => {
    try {
      return await this.db.vendor.create({ data });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'VendorsRepository.create',
      );
      throw error;
    }
  };

  update = async (params: {
    where: Prisma.VendorWhereUniqueInput;
    data: Prisma.VendorUpdateInput;
  }): Promise<Vendor> => {
    try {
      return await this.db.vendor.update(params);
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'VendorsRepository.update',
      );
      throw error;
    }
  };

  findFirst = async (where: Prisma.VendorWhereInput): Promise<Vendor | null> => {
    try {
      return await this.db.vendor.findFirst({
        where: { ...where, deletedAt: null },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findFirst',
        error instanceof Error ? error.stack : undefined,
        'VendorsRepository.findFirst',
      );
      throw error;
    }
  };

  findOptions = async (): Promise<Pick<Vendor, 'id' | 'code' | 'name'>[]> => {
    try {
      return await this.db.vendor.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOptions',
        error instanceof Error ? error.stack : undefined,
        'VendorsRepository.findOptions',
      );
      throw error;
    }
  };
}
