import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { CostVariable, Prisma, PrismaClient } from '@prisma/client';
import { CostVariableRepositoryPort } from '../ports/repository.port';

@Injectable()
export class CostVariableRepository implements CostVariableRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  create = async (data: Prisma.CostVariableCreateInput): Promise<CostVariable> => {
    try {
      return await this.db.costVariable.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.create',
      );
      throw error;
    }
  };

  update = async (params: {
    where: Prisma.CostVariableWhereUniqueInput;
    data: Prisma.CostVariableUpdateInput;
  }): Promise<CostVariable> => {
    try {
      return await this.db.costVariable.update({
        ...params,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.update',
      );
      throw error;
    }
  };

  softDelete = async (id: number, deletedBy: string): Promise<CostVariable> => {
    try {
      return await this.db.costVariable.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in softDelete',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.softDelete',
      );
      throw error;
    }
  };

  restore = async (id: number): Promise<CostVariable> => {
    try {
      return await this.db.costVariable.update({
        where: { id },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.restore',
      );
      throw error;
    }
  };

  findById = async (id: number, includeDeleted = false): Promise<CostVariable | null> => {
    try {
      return await this.db.costVariable.findFirst({
        where: {
          id,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.findById',
      );
      throw error;
    }
  };

  findByCode = async (code: string, includeDeleted = false): Promise<CostVariable | null> => {
    try {
      return await this.db.costVariable.findFirst({
        where: {
          code,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findByCode',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.findByCode',
      );
      throw error;
    }
  };

  findList = async (params: {
    skip: number;
    take: number;
    where?: Prisma.CostVariableWhereInput;
    orderBy?: Prisma.CostVariableOrderByWithRelationInput;
  }): Promise<CostVariable[]> => {
    try {
      return await this.db.costVariable.findMany({
        skip: params.skip,
        take: params.take,
        where: {
          ...params.where,
          deletedAt: null,
        },
        orderBy: params.orderBy || { updatedAt: 'desc' },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findList',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.findList',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.CostVariableWhereInput): Promise<number> => {
    try {
      return await this.db.costVariable.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.count',
      );
      throw error;
    }
  };

  findFirst = async (where: Prisma.CostVariableWhereInput): Promise<CostVariable | null> => {
    try {
      return await this.db.costVariable.findFirst({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findFirst',
        error instanceof Error ? error.stack : undefined,
        'CostVariableRepository.findFirst',
      );
      throw error;
    }
  };
}

