import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Asset, Prisma, PrismaClient } from '@prisma/client';
import { UploadRepositoryPort } from '../ports/repository.port';

@Injectable()
export class UploadRepository implements UploadRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  create = async (data: Prisma.AssetCreateInput): Promise<Asset> => {
    try {
      return await this.db.asset.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'UploadRepository.create',
      );
      throw error;
    }
  };

  findById = async (id: number): Promise<Asset | null> => {
    try {
      return await this.db.asset.findUnique({
        where: { id },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'UploadRepository.findById',
      );
      throw error;
    }
  };

  findMany = async (params: { skip?: number; take?: number; where?: Prisma.AssetWhereInput }): Promise<Asset[]> => {
    try {
      return await this.db.asset.findMany({
        ...params,
        where: {
          ...params.where,
          deletedAt: null, // Always exclude soft-deleted records
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'UploadRepository.findMany',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.AssetWhereInput): Promise<number> => {
    try {
      return await this.db.asset.count({
        where: {
          ...where,
          deletedAt: null, // Always exclude soft-deleted records
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'UploadRepository.count',
      );
      throw error;
    }
  };
}
