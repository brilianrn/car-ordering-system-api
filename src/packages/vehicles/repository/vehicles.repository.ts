import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { OrganizationUnit, Prisma, PrismaClient, Vehicle, VehicleImage } from '@prisma/client';
import { VehiclesRepositoryPort } from '../ports/repository.port';

@Injectable()
export class VehiclesRepository implements VehiclesRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  findMany = async (params: {
    skip: number;
    take: number;
    where?: Prisma.VehicleWhereInput;
    include?: Prisma.VehicleInclude;
  }): Promise<Vehicle[]> => {
    try {
      return await this.db.vehicle.findMany({
        ...params,
        where: {
          ...params.where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findFirst',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.findFirst',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.VehicleWhereInput): Promise<number> => {
    try {
      return await this.db.vehicle.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.count',
      );
      throw error;
    }
  };

  findUnique = async (
    params: {
      where: Prisma.VehicleWhereUniqueInput;
      include?: Prisma.VehicleInclude;
    },
    includeDeleted = false,
  ): Promise<Vehicle | null> => {
    try {
      const vehicle = await this.db.vehicle.findUnique({
        ...params,
      });

      // If not including deleted, check if record is soft-deleted
      if (!includeDeleted && vehicle?.deletedAt) {
        return null;
      }

      return vehicle;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findUnique',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.findUnique',
      );
      throw error;
    }
  };

  create = async (data: Prisma.VehicleCreateInput): Promise<Vehicle> => {
    try {
      return await this.db.vehicle.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.create',
      );
      throw error;
    }
  };

  update = async (params: {
    where: Prisma.VehicleWhereUniqueInput;
    data: Prisma.VehicleUpdateInput;
  }): Promise<Vehicle> => {
    try {
      return await this.db.vehicle.update({
        ...params,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.update',
      );
      throw error;
    }
  };

  findFirst = async (where: Prisma.VehicleWhereInput): Promise<Vehicle | null> => {
    try {
      return await this.db.vehicle.findFirst({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findFirst',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.findFirst',
      );
      throw error;
    }
  };

  countVehicleImages = async (vehicleId: number): Promise<number> => {
    try {
      return await this.db.vehicleImage.count({
        where: {
          vehicleId,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in countVehicleImages',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.countVehicleImages',
      );
      throw error;
    }
  };

  createVehicleImage = async (data: Prisma.VehicleImageCreateInput): Promise<VehicleImage> => {
    try {
      return await this.db.vehicleImage.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createVehicleImage',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.createVehicleImage',
      );
      throw error;
    }
  };

  deleteVehicleImages = async (vehicleId: number): Promise<void> => {
    try {
      await this.db.vehicleImage.deleteMany({
        where: {
          vehicleId,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in deleteVehicleImages',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.deleteVehicleImages',
      );
      throw error;
    }
  };

  findActiveOrganizations = async (): Promise<OrganizationUnit[]> => {
    try {
      return await this.db.organizationUnit.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findActiveOrganizations',
        error instanceof Error ? error.stack : undefined,
        'VehiclesRepository.findActiveOrganizations',
      );
      throw error;
    }
  };
}
