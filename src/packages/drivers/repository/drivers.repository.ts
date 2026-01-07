import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Driver, Prisma, PrismaClient } from '@prisma/client';
import { DriversRepositoryPort } from '../ports/repository.port';

@Injectable()
export class DriversRepository implements DriversRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  create = async (data: Prisma.DriverCreateInput): Promise<Driver> => {
    try {
      return await this.db.driver.create({
        data,
        include: {
          vendor: true,
          photoAsset: true,
          ktpAsset: true,
          simAsset: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.create',
      );
      throw error;
    }
  };

  update = async (params: {
    where: Prisma.DriverWhereUniqueInput;
    data: Prisma.DriverUpdateInput;
  }): Promise<Driver> => {
    try {
      return await this.db.driver.update({
        ...params,
        include: {
          vendor: true,
          photoAsset: true,
          ktpAsset: true,
          simAsset: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.update',
      );
      throw error;
    }
  };

  softDelete = async (id: number, deletedBy: string): Promise<Driver> => {
    try {
      return await this.db.driver.update({
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
        'DriversRepository.softDelete',
      );
      throw error;
    }
  };

  restore = async (id: number): Promise<Driver> => {
    try {
      return await this.db.driver.update({
        where: { id },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
        include: {
          vendor: true,
          photoAsset: true,
          ktpAsset: true,
          simAsset: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.restore',
      );
      throw error;
    }
  };

  findById = async (id: number, includeDeleted = false): Promise<Driver | null> => {
    try {
      const driver = await this.db.driver.findUnique({
        where: { id },
        include: {
          vendor: true,
          photoAsset: true,
          ktpAsset: true,
          simAsset: true,
        },
      });

      if (!includeDeleted && driver?.deletedAt) {
        return null;
      }

      return driver;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.findById',
      );
      throw error;
    }
  };

  findList = async (params: {
    skip: number;
    take: number;
    where?: Prisma.DriverWhereInput;
    orderBy?: Prisma.DriverOrderByWithRelationInput;
  }): Promise<Driver[]> => {
    try {
      return await this.db.driver.findMany({
        ...params,
        include: {
          vendor: true,
          photoAsset: true,
          ktpAsset: true,
          simAsset: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findList',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.findList',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.DriverWhereInput): Promise<number> => {
    try {
      return await this.db.driver.count({
        where,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.count',
      );
      throw error;
    }
  };

  findFirst = async (where: Prisma.DriverWhereInput): Promise<Driver | null> => {
    try {
      return await this.db.driver.findFirst({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findFirst',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.findFirst',
      );
      throw error;
    }
  };

  findEligible = async (params: { where: Prisma.DriverWhereInput; take?: number }): Promise<Driver[]> => {
    try {
      return await this.db.driver.findMany({
        where: params.where,
        take: params.take,
        include: {
          vendor: true,
          photoAsset: true,
          ktpAsset: true,
          simAsset: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findEligible',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.findEligible',
      );
      throw error;
    }
  };

  findExpiredSIM = async (): Promise<Driver[]> => {
    try {
      return await this.db.driver.findMany({
        where: {
          deletedAt: null,
          simExpiry: {
            lt: new Date(),
          },
        },
        include: {
          vendor: true,
          photoAsset: true,
          ktpAsset: true,
          simAsset: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findExpiredSIM',
        error instanceof Error ? error.stack : undefined,
        'DriversRepository.findExpiredSIM',
      );
      throw error;
    }
  };
}
