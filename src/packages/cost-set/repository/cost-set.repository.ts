import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { CostSetEnvironment, CostSetScope, Prisma, PrismaClient } from '@prisma/client';
import { CostSetRepositoryPort } from '../ports/repository.port';

@Injectable()
export class CostSetRepository implements CostSetRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  create = async (data: Prisma.CostSetCreateInput): Promise<any> => {
    try {
      return await this.db.costSet.create({
        data,
        include: {
          items: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.create',
      );
      throw error;
    }
  };

  findById = async (id: number): Promise<any | null> => {
    try {
      return await this.db.costSet.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          items: {
            where: {
              deletedAt: null,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.findById',
      );
      throw error;
    }
  };

  findByVersion = async (version: number): Promise<any | null> => {
    try {
      return await this.db.costSet.findFirst({
        where: {
          version,
          deletedAt: null,
        },
        include: {
          items: {
            where: {
              deletedAt: null,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findByVersion',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.findByVersion',
      );
      throw error;
    }
  };

  findMany = async (params: {
    skip: number;
    take: number;
    where?: Prisma.CostSetWhereInput;
    orderBy?: Prisma.CostSetOrderByWithRelationInput;
  }): Promise<any[]> => {
    try {
      return await this.db.costSet.findMany({
        skip: params.skip,
        take: params.take,
        where: {
          ...params.where,
          deletedAt: null,
        },
        include: {
          items: {
            where: {
              deletedAt: null,
            },
          },
        },
        orderBy: params.orderBy || { version: 'desc' },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.findMany',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.CostSetWhereInput): Promise<number> => {
    try {
      return await this.db.costSet.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.count',
      );
      throw error;
    }
  };

  update = async (id: number, data: Prisma.CostSetUpdateInput): Promise<any> => {
    try {
      return await this.db.costSet.update({
        where: { id },
        data,
        include: {
          items: {
            where: {
              deletedAt: null,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.update',
      );
      throw error;
    }
  };

  findPublishedCostSetForDate = async (params: {
    effectiveDate: Date;
    environment: CostSetEnvironment;
    scope?: CostSetScope;
  }): Promise<any | null> => {
    try {
      const where: Prisma.CostSetWhereInput = {
        status: 'PUBLISHED',
        environment: params.environment,
        effectiveFrom: {
          lte: params.effectiveDate,
        },
        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gte: params.effectiveDate,
            },
          },
        ],
        deletedAt: null,
      };

      if (params.scope) {
        where.scope = params.scope;
      } else {
        where.scope = CostSetScope.GLOBAL;
      }

      // Get the most relevant CostSet (latest version yang effective)
      return await this.db.costSet.findFirst({
        where,
        include: {
          items: {
            where: {
              deletedAt: null,
            },
          },
        },
        orderBy: {
          version: 'desc',
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findPublishedCostSetForDate',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.findPublishedCostSetForDate',
      );
      throw error;
    }
  };

  checkOverlappingCostSet = async (params: {
    effectiveFrom: Date;
    effectiveTo?: Date;
    scope: CostSetScope;
    environment: CostSetEnvironment;
    excludeVersion?: number;
  }): Promise<boolean> => {
    try {
      const where: Prisma.CostSetWhereInput = {
        scope: params.scope,
        environment: params.environment,
        deletedAt: null,
        AND: [
          {
            effectiveFrom: {
              lte: params.effectiveTo || params.effectiveFrom,
            },
          },
          {
            OR: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  gte: params.effectiveFrom,
                },
              },
            ],
          },
        ],
      };

      if (params.excludeVersion) {
        const excludeCostSet = await this.db.costSet.findFirst({
          where: {
            version: params.excludeVersion,
            deletedAt: null,
          },
        });
        if (excludeCostSet) {
          where.id = {
            not: excludeCostSet.id,
          };
        }
      }

      const count = await this.db.costSet.count({ where });
      return count > 0;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in checkOverlappingCostSet',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.checkOverlappingCostSet',
      );
      throw error;
    }
  };

  getLatestVersion = async (): Promise<number> => {
    try {
      const latest = await this.db.costSet.findFirst({
        where: {
          deletedAt: null,
        },
        orderBy: {
          version: 'desc',
        },
        select: {
          version: true,
        },
      });

      return latest ? latest.version + 1 : 1;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getLatestVersion',
        error instanceof Error ? error.stack : undefined,
        'CostSetRepository.getLatestVersion',
      );
      return 1;
    }
  };
}
