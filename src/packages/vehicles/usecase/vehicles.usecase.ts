import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, VehicleStatus } from '@prisma/client';
import {
  IVehicle,
  IVehicleDetailResponse,
  IVehicleListResponse,
} from '../domain/response';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { QueryVehicleDto } from '../dto/query-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import type { VehiclesRepositoryPort } from '../ports/repository.port';
import { VehiclesUsecasePort } from '../ports/usecase.port';

@Injectable()
export class VehiclesUseCase implements VehiclesUsecasePort {
  constructor(
    @Inject('VehiclesRepositoryPort')
    private readonly repository: VehiclesRepositoryPort,
  ) {
    this.repository = repository;
  }

  findAll = async (
    query: QueryVehicleDto,
  ): Promise<IUsecaseResponse<IVehicleListResponse>> => {
    try {
      const {
        page = 1,
        limit = 10,
        licensePlate,
        brandModel,
        vehicleType,
        vendorId,
        status,
      } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.VehicleWhereInput = {};

      if (licensePlate) {
        where.licensePlate = {
          contains: licensePlate,
          mode: 'insensitive',
        };
      }

      if (brandModel) {
        where.brandModel = {
          contains: brandModel,
          mode: 'insensitive',
        };
      }

      if (vehicleType) {
        where.vehicleType = {
          contains: vehicleType,
          mode: 'insensitive',
        };
      }

      if (vendorId !== undefined) {
        where.vendorId = vendorId;
      }

      if (status) {
        where.status = status;
      }

      const [data, total] = await Promise.all([
        this.repository.findMany({
          skip,
          take: limit,
          where,
          include: {
            vendor: true,
          },
        }),
        this.repository.count(where),
      ]);

      return {
        data: {
          data: data as IVehicle[],
          meta: {
            page,
            limit,
            total,
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.restore',
      );
      return { error };
    }
  };

  findOne = async (id: number): Promise<IUsecaseResponse<IVehicle>> => {
    try {
      const vehicle = await this.repository.findUnique({
        where: { id },
        include: {
          vendor: true,
        },
      });

      if (!vehicle) {
        return {
          error: {
            message: `Vehicle with ID ${id} not found`,
            code: 404,
          },
        };
      }

      return { data: vehicle as IVehicle };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOne',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.findOne',
      );
      return { error };
    }
  };

  findDetail = async (
    id: number,
  ): Promise<IUsecaseResponse<IVehicleDetailResponse>> => {
    try {
      const vehicle = await this.repository.findUnique(
        {
          where: { id },
          include: {
            vendor: true,
          },
        },
        true, // Include deleted for detail view
      );

      if (!vehicle || vehicle.deletedAt) {
        return {
          error: {
            message: `Vehicle with ID ${id} not found`,
            code: 404,
          },
        };
      }

      return { data: vehicle as IVehicleDetailResponse };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findDetail',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.findDetail',
      );
      return { error };
    }
  };

  create = async (
    createDto: CreateVehicleDto,
    userId: string,
  ): Promise<IUsecaseResponse<IVehicle>> => {
    try {
      // Check for duplicate vehicleCode
      const existingByCode = await this.repository.findFirst({
        vehicleCode: createDto.vehicleCode,
      });

      if (existingByCode) {
        return {
          error: {
            message: `Vehicle with code ${createDto.vehicleCode} already exists`,
            code: 409,
          },
        };
      }

      // Check for duplicate licensePlate
      const existingByPlate = await this.repository.findFirst({
        licensePlate: createDto.licensePlate,
      });

      if (existingByPlate) {
        return {
          error: {
            message: `Vehicle with license plate ${createDto.licensePlate} already exists`,
            code: 409,
          },
        };
      }

      const vehicle = await this.repository.create({
        ...createDto,
        createdBy: userId,
        status: createDto.status || VehicleStatus.ACTIVE,
        isDedicated: createDto.isDedicated ?? false,
      });

      return { data: vehicle as IVehicle };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.create',
      );
      return { error };
    }
  };

  update = async (
    id: number,
    updateDto: UpdateVehicleDto,
    userId: string,
  ): Promise<IUsecaseResponse<IVehicle>> => {
    try {
      // Check if vehicle exists
      const existing = await this.repository.findUnique({
        where: { id },
      });

      if (!existing || existing.deletedAt) {
        return {
          error: {
            message: `Vehicle with ID ${id} not found`,
            code: 404,
          },
        };
      }

      // Check for duplicate vehicleCode if being updated
      if (
        updateDto.vehicleCode &&
        updateDto.vehicleCode !== existing.vehicleCode
      ) {
        const duplicateCode = await this.repository.findFirst({
          vehicleCode: updateDto.vehicleCode,
        });

        if (duplicateCode) {
          return {
            error: {
              message: `Vehicle with code ${updateDto.vehicleCode} already exists`,
              code: 409,
            },
          };
        }
      }

      // Check for duplicate licensePlate if being updated
      if (
        updateDto.licensePlate &&
        updateDto.licensePlate !== existing.licensePlate
      ) {
        const duplicatePlate = await this.repository.findFirst({
          licensePlate: updateDto.licensePlate,
        });

        if (duplicatePlate) {
          return {
            error: {
              message: `Vehicle with license plate ${updateDto.licensePlate} already exists`,
              code: 409,
            },
          };
        }
      }

      const vehicle = await this.repository.update({
        where: { id },
        data: {
          ...updateDto,
          updatedBy: userId,
        },
      });

      return { data: vehicle as IVehicle };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.update',
      );
      return { error };
    }
  };

  remove = async (
    id: number,
    userId: string,
  ): Promise<IUsecaseResponse<void>> => {
    try {
      const existing = await this.repository.findUnique({
        where: { id },
      });

      if (!existing || existing.deletedAt) {
        return {
          error: {
            message: `Vehicle with ID ${id} not found`,
            code: 404,
          },
        };
      }

      await this.repository.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: userId,
        },
      });

      return { data: undefined };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in remove',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.remove',
      );
      return { error };
    }
  };

  restore = async (id: number): Promise<IUsecaseResponse<IVehicle>> => {
    try {
      const existing = await this.repository.findUnique(
        {
          where: { id },
        },
        true, // Include deleted for restore
      );

      if (!existing || !existing.deletedAt) {
        return {
          error: {
            message: `Vehicle with ID ${id} not found or not deleted`,
            code: 404,
          },
        };
      }

      const vehicle = await this.repository.update({
        where: { id },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });

      return { data: vehicle as IVehicle };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.restore',
      );
      return { error };
    }
  };
}
