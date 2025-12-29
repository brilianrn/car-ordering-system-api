import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Inject, Injectable } from '@nestjs/common';
import { DriverType, Prisma } from '@prisma/client';
import { IDriver, IDriverDetailResponse, IDriverEligibleResponse, IDriverListResponse } from '../domain/response';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { ListDriverQueryDto } from '../dto/list-driver-query.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';
import type { DriversRepositoryPort } from '../ports/repository.port';
import { DriversUsecasePort } from '../ports/usecase.port';

@Injectable()
export class DriversUseCase implements DriversUsecasePort {
  constructor(
    @Inject('DriversRepositoryPort')
    private readonly repository: DriversRepositoryPort,
  ) {
    this.repository = repository;
  }

  create = async (createDto: CreateDriverDto, userId: string): Promise<IUsecaseResponse<IDriver>> => {
    try {
      // Validate unique driverCode
      const existingByCode = await this.repository.findFirst({
        driverCode: createDto.driverCode.toUpperCase(),
      });

      if (existingByCode) {
        return {
          error: {
            message: 'DRIVER_CODE_EXISTS',
            code: 409,
          },
        };
      }

      // Validate unique simNumber
      const existingBySIM = await this.repository.findFirst({
        simNumber: createDto.simNumber,
      });

      if (existingBySIM) {
        return {
          error: {
            message: 'SIM_ALREADY_USED',
            code: 409,
          },
        };
      }

      // Validate vendor based on driverType
      if (createDto.driverType === DriverType.EXTERNAL && !createDto.vendorId) {
        return {
          error: {
            message: 'VENDOR_REQUIRED',
            code: 400,
          },
        };
      }

      if (createDto.driverType === DriverType.INTERNAL && createDto.vendorId) {
        return {
          error: {
            message: 'VENDOR_NOT_ALLOWED_FOR_INTERNAL',
            code: 400,
          },
        };
      }

      const driver = await this.repository.create({
        driverCode: createDto.driverCode.toUpperCase(),
        fullName: createDto.fullName,
        internalNik: createDto.internalNik,
        driverType: createDto.driverType,
        vendor:
          createDto.driverType === DriverType.EXTERNAL && createDto.vendorId
            ? { connect: { id: createDto.vendorId } }
            : undefined,
        simNumber: createDto.simNumber,
        simExpiry: new Date(createDto.simExpiry),
        phoneNumber: createDto.phoneNumber,
        transmissionPref: createDto.transmissionPref,
        plantLocation: createDto.plantLocation,
        realtimeStatus: 'Idle',
        isDedicated: createDto.isDedicated ?? false,
        ktpAsset: createDto.ktpAssetId ? { connect: { id: createDto.ktpAssetId } } : undefined,
        simAsset: createDto.simAssetId ? { connect: { id: createDto.simAssetId } } : undefined,
        createdBy: userId,
      });

      return { data: driver as IDriver };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.create',
      );
      return { error };
    }
  };

  update = async (id: number, updateDto: UpdateDriverDto, userId: string): Promise<IUsecaseResponse<IDriver>> => {
    try {
      const existing = await this.repository.findById(id);

      if (!existing || existing.deletedAt) {
        return {
          error: {
            message: 'DRIVER_NOT_FOUND',
            code: 404,
          },
        };
      }

      // Validate SIM uniqueness if being updated
      if (updateDto.simNumber && updateDto.simNumber !== existing.simNumber) {
        const duplicateSIM = await this.repository.findFirst({
          simNumber: updateDto.simNumber,
        });

        if (duplicateSIM) {
          return {
            error: {
              message: 'SIM_ALREADY_USED',
              code: 409,
            },
          };
        }
      }

      // Validate vendor rules if driverType is being changed
      if (updateDto.driverType) {
        if (updateDto.driverType === DriverType.EXTERNAL && updateDto.vendorId === undefined && !existing.vendorId) {
          return {
            error: {
              message: 'VENDOR_REQUIRED',
              code: 400,
            },
          };
        }

        if (
          updateDto.driverType === DriverType.INTERNAL &&
          updateDto.vendorId !== undefined &&
          updateDto.vendorId !== null
        ) {
          return {
            error: {
              message: 'VENDOR_NOT_ALLOWED_FOR_INTERNAL',
              code: 400,
            },
          };
        }
      }

      const updateData: any = {
        ...updateDto,
        updatedBy: userId,
      };

      if (updateDto.simExpiry) {
        updateData.simExpiry = new Date(updateDto.simExpiry);
      }

      if (updateDto.driverType === DriverType.INTERNAL) {
        updateData.vendorId = null;
      }

      // Handle asset IDs
      if (updateDto.ktpAssetId !== undefined) {
        updateData.ktpAsset = updateDto.ktpAssetId ? { connect: { id: updateDto.ktpAssetId } } : { disconnect: true };
      }
      if (updateDto.simAssetId !== undefined) {
        updateData.simAsset = updateDto.simAssetId ? { connect: { id: updateDto.simAssetId } } : { disconnect: true };
      }

      const driver = await this.repository.update({
        where: { id },
        data: updateData,
      });

      return { data: driver as IDriver };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.update',
      );
      return { error };
    }
  };

  remove = async (id: number, userId: string): Promise<IUsecaseResponse<void>> => {
    try {
      const existing = await this.repository.findById(id);

      if (!existing || existing.deletedAt) {
        return {
          error: {
            message: 'DRIVER_NOT_FOUND',
            code: 404,
          },
        };
      }

      await this.repository.softDelete(id, userId);

      return { data: undefined };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in remove',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.remove',
      );
      return { error };
    }
  };

  restore = async (id: number): Promise<IUsecaseResponse<IDriver>> => {
    try {
      const existing = await this.repository.findById(id, true);

      if (!existing || !existing.deletedAt) {
        return {
          error: {
            message: 'DRIVER_NOT_DELETED',
            code: 404,
          },
        };
      }

      const driver = await this.repository.restore(id);

      return { data: driver as IDriver };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.restore',
      );
      return { error };
    }
  };

  getDetail = async (id: number): Promise<IUsecaseResponse<IDriverDetailResponse>> => {
    try {
      const driver = await this.repository.findById(id);

      if (!driver || driver.deletedAt) {
        return {
          error: {
            message: 'DRIVER_NOT_FOUND',
            code: 404,
          },
        };
      }

      const isSimExpired = driver.simExpiry < new Date();

      return {
        data: {
          ...driver,
          isSimExpired,
        } as IDriverDetailResponse,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getDetail',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.getDetail',
      );
      return { error };
    }
  };

  findAll = async (query: ListDriverQueryDto): Promise<IUsecaseResponse<IDriverListResponse>> => {
    try {
      const { page = 1, limit = 10, search, type, vendor, plant, dedicated, transmission, activeOnly = true } = query;

      const skip = (page - 1) * limit;

      const where: Prisma.DriverWhereInput = {};

      // Active only filter
      if (activeOnly) {
        where.deletedAt = null;
      }

      // Search filter (name, driverCode, simNumber)
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          {
            driverCode: { contains: search.toUpperCase(), mode: 'insensitive' },
          },
          { simNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Type filter
      if (type) {
        where.driverType = type;
      }

      // Vendor filter
      if (vendor !== undefined) {
        where.vendorId = vendor;
      }

      // Plant filter
      if (plant) {
        where.plantLocation = { contains: plant, mode: 'insensitive' };
      }

      // Dedicated filter
      if (dedicated !== undefined) {
        where.isDedicated = dedicated;
      }

      // Transmission filter
      if (transmission) {
        where.transmissionPref = {
          in: [transmission, 'ALL'],
        };
      }

      const [data, total] = await Promise.all([
        this.repository.findList({
          skip,
          take: limit,
          where,
          orderBy: { createdAt: 'desc' },
        }),
        this.repository.count(where),
      ]);

      // Add computed isSimExpired
      const driversWithExpiry = data.map((driver) => ({
        ...driver,
        isSimExpired: driver.simExpiry < new Date(),
      })) as IDriver[];

      return {
        data: {
          data: driversWithExpiry,
          meta: {
            page,
            limit,
            total,
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.findAll',
      );
      return { error };
    }
  };

  findEligible = async (query: {
    transmission?: string;
    plantLocation?: string;
    vendorId?: number;
    driverType?: DriverType;
    isDedicated?: boolean;
  }): Promise<IUsecaseResponse<IDriverEligibleResponse>> => {
    try {
      const now = new Date();

      const where: Prisma.DriverWhereInput = {
        deletedAt: null,
        realtimeStatus: 'Idle',
        simExpiry: {
          gte: now,
        },
      };

      // Transmission filter
      if (query.transmission) {
        where.transmissionPref = {
          in: ['ALL', query.transmission as any],
        };
      } else {
        where.transmissionPref = {
          in: ['AUTOMATIC', 'MANUAL', 'ALL'],
        };
      }

      // Plant location filter
      if (query.plantLocation) {
        where.plantLocation = {
          contains: query.plantLocation,
          mode: 'insensitive',
        };
      }

      // Vendor filter
      if (query.vendorId !== undefined) {
        where.vendorId = query.vendorId;
      }

      // Driver type filter
      if (query.driverType) {
        where.driverType = query.driverType;
      }

      // Dedicated filter
      if (query.isDedicated !== undefined) {
        where.isDedicated = query.isDedicated;
      }

      const data = await this.repository.findEligible({
        where,
      });

      const driversWithExpiry = data.map((driver) => ({
        ...driver,
        isSimExpired: driver.simExpiry < now,
      })) as IDriver[];

      return {
        data: {
          data: driversWithExpiry,
          meta: {
            total: driversWithExpiry.length,
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findEligible',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.findEligible',
      );
      return { error };
    }
  };

  findExpiredSIM = async (): Promise<IUsecaseResponse<IDriverEligibleResponse>> => {
    try {
      const data = await this.repository.findExpiredSIM();

      const driversWithExpiry = data.map((driver) => ({
        ...driver,
        isSimExpired: true,
      })) as IDriver[];

      return {
        data: {
          data: driversWithExpiry,
          meta: {
            total: driversWithExpiry.length,
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findExpiredSIM',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.findExpiredSIM',
      );
      return { error };
    }
  };
}
