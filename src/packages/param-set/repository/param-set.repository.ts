import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { ParamEnvironment, ParamSetStatus, Prisma, PrismaClient } from '@prisma/client';
import { ParamSetRepositoryPort } from '../ports/repository.port';

@Injectable()
export class ParamSetRepository implements ParamSetRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  create = async (data: Prisma.ParamSetCreateInput): Promise<any> => {
    try {
      return await this.db.paramSet.create({
        data,
        include: {
          items: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.create',
      );
      throw error;
    }
  };

  findById = async (id: string): Promise<any | null> => {
    try {
      return await this.db.paramSet.findUnique({
        where: { id, deletedAt: null },
        include: {
          items: {
            where: { deletedAt: null },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.findById',
      );
      throw error;
    }
  };

  findByVersion = async (version: number): Promise<any | null> => {
    try {
      return await this.db.paramSet.findUnique({
        where: { version, deletedAt: null },
        include: {
          items: {
            where: { deletedAt: null },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findByVersion',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.findByVersion',
      );
      throw error;
    }
  };

  findMany = async (params: {
    skip?: number;
    take?: number;
    where?: Prisma.ParamSetWhereInput;
    orderBy?: Prisma.ParamSetOrderByWithRelationInput | Prisma.ParamSetOrderByWithRelationInput[];
  }): Promise<any[]> => {
    try {
      return await this.db.paramSet.findMany({
        skip: params.skip,
        take: params.take,
        where: {
          ...params.where,
          deletedAt: null,
        },
        orderBy: params.orderBy || [{ version: 'desc' }],
        include: {
          items: {
            where: { deletedAt: null },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.findMany',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.ParamSetWhereInput): Promise<number> => {
    try {
      return await this.db.paramSet.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.count',
      );
      throw error;
    }
  };

  findActive = async (environment: ParamEnvironment, date: Date = new Date()): Promise<any | null> => {
    try {
      return await this.db.paramSet.findFirst({
        where: {
          status: ParamSetStatus.PUBLISHED,
          environment,
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
          deletedAt: null,
        },
        include: {
          items: {
            where: { deletedAt: null },
          },
        },
        orderBy: {
          version: 'desc',
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findActive',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.findActive',
      );
      throw error;
    }
  };

  findLatestPublished = async (environment: ParamEnvironment): Promise<any | null> => {
    try {
      return await this.db.paramSet.findFirst({
        where: {
          status: ParamSetStatus.PUBLISHED,
          environment,
          deletedAt: null,
        },
        include: {
          items: {
            where: { deletedAt: null },
          },
        },
        orderBy: {
          version: 'desc',
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findLatestPublished',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.findLatestPublished',
      );
      throw error;
    }
  };

  update = async (id: string, data: Prisma.ParamSetUpdateInput): Promise<any> => {
    try {
      return await this.db.paramSet.update({
        where: { id },
        data,
        include: {
          items: {
            where: { deletedAt: null },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.update',
      );
      throw error;
    }
  };

  updateStatus = async (id: string, status: ParamSetStatus, publishedBy?: string, publishedAt?: Date): Promise<any> => {
    try {
      return await this.db.paramSet.update({
        where: { id },
        data: {
          status,
          publishedBy,
          publishedAt: publishedAt || new Date(),
        },
        include: {
          items: {
            where: { deletedAt: null },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateStatus',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.updateStatus',
      );
      throw error;
    }
  };

  retirePreviousVersions = async (currentVersion: number, environment: ParamEnvironment): Promise<void> => {
    try {
      await this.db.paramSet.updateMany({
        where: {
          version: { not: currentVersion },
          environment,
          status: ParamSetStatus.PUBLISHED,
          deletedAt: null,
        },
        data: {
          status: ParamSetStatus.RETIRED,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in retirePreviousVersions',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.retirePreviousVersions',
      );
      throw error;
    }
  };

  getNextVersion = async (): Promise<number> => {
    try {
      const latest = await this.db.paramSet.findFirst({
        where: { deletedAt: null },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      return (latest?.version || 0) + 1;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getNextVersion',
        error instanceof Error ? error.stack : undefined,
        'ParamSetRepository.getNextVersion',
      );
      throw error;
    }
  };
}
