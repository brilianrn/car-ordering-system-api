import { S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Inject, Injectable } from '@nestjs/common';
import { DriverType, Prisma, RealtimeStatus } from '@prisma/client';
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
    private readonly s3Service: S3Service,
  ) {
    this.repository = repository;
  }

  /**
   * Helper method to generate presigned URLs for driver assets
   */
  private async enrichDriverWithPresignedUrls(driver: any): Promise<IDriver> {
    const enrichedDriver = { ...driver };

    // Generate presigned URL for photo asset
    if (enrichedDriver.photoAsset?.url) {
      try {
        const presignedUrl = await this.s3Service.getPresignedUrl(enrichedDriver.photoAsset.url, 86400); // 1 day expiry
        enrichedDriver.photoAsset = {
          ...enrichedDriver.photoAsset,
          url: presignedUrl,
        };
      } catch (error) {
        Logger.error(
          error instanceof Error ? error.message : 'Error generating presigned URL for photo asset',
          error instanceof Error ? error.stack : undefined,
          'DriversUseCase.enrichDriverWithPresignedUrls',
        );
      }
    }

    // Generate presigned URL for KTP asset
    if (enrichedDriver.ktpAsset?.url) {
      try {
        const presignedUrl = await this.s3Service.getPresignedUrl(enrichedDriver.ktpAsset.url, 86400); // 1 day expiry
        enrichedDriver.ktpAsset = {
          ...enrichedDriver.ktpAsset,
          url: presignedUrl,
        };
      } catch (error) {
        Logger.error(
          error instanceof Error ? error.message : 'Error generating presigned URL for KTP asset',
          error instanceof Error ? error.stack : undefined,
          'DriversUseCase.enrichDriverWithPresignedUrls',
        );
      }
    }

    // Generate presigned URL for SIM asset
    if (enrichedDriver.simAsset?.url) {
      try {
        const presignedUrl = await this.s3Service.getPresignedUrl(enrichedDriver.simAsset.url, 86400); // 1 day expiry
        enrichedDriver.simAsset = {
          ...enrichedDriver.simAsset,
          url: presignedUrl,
        };
      } catch (error) {
        Logger.error(
          error instanceof Error ? error.message : 'Error generating presigned URL for SIM asset',
          error instanceof Error ? error.stack : undefined,
          'DriversUseCase.enrichDriverWithPresignedUrls',
        );
      }
    }

    return enrichedDriver as IDriver;
  }

  create = async (createDto: CreateDriverDto, userId: string): Promise<IUsecaseResponse<IDriver>> => {
    try {
      let driverCode: string;

      // If driverCode is provided, validate uniqueness
      if (createDto.driverCode) {
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
        driverCode = createDto.driverCode.toUpperCase();
      } else {
        // Auto-generate unique driverCode
        const generatedCode = await this.generateDriverCode();
        if (!generatedCode) {
          return {
            error: {
              message: 'FAILED_TO_GENERATE_DRIVER_CODE',
              code: 500,
            },
          };
        }
        driverCode = generatedCode;
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
        driverCode,
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
        realtimeStatus: createDto.realtimeStatus ?? RealtimeStatus.Idle,
        isDedicated: createDto.isDedicated ?? false,
        photoAsset: createDto.photoAssetId ? { connect: { id: createDto.photoAssetId } } : undefined,
        ktpAsset: createDto.ktpAssetId ? { connect: { id: createDto.ktpAssetId } } : undefined,
        simAsset: createDto.simAssetId ? { connect: { id: createDto.simAssetId } } : undefined,
        createdBy: userId,
      });

      const enrichedDriver = await this.enrichDriverWithPresignedUrls(driver);

      return { data: enrichedDriver };
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
      if (updateDto.photoAssetId !== undefined) {
        updateData.photoAsset = updateDto.photoAssetId
          ? { connect: { id: updateDto.photoAssetId } }
          : { disconnect: true };
      }
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

      const enrichedDriver = await this.enrichDriverWithPresignedUrls(driver);

      return { data: enrichedDriver };
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

      const enrichedDriver = await this.enrichDriverWithPresignedUrls(driver);

      return { data: enrichedDriver };
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

      const enrichedDriver = await this.enrichDriverWithPresignedUrls(driver);

      return {
        data: {
          ...enrichedDriver,
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
          orderBy: { updatedAt: 'desc' },
        }),
        this.repository.count(where),
      ]);

      // Add computed isSimExpired and enrich with presigned URLs
      const driversWithExpiry = await Promise.all(
        data.map(async (driver) => {
          const enrichedDriver = await this.enrichDriverWithPresignedUrls(driver);
          return {
            ...enrichedDriver,
            isSimExpired: driver.simExpiry < new Date(),
          };
        }),
      );

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
    fullName?: string;
  }): Promise<IUsecaseResponse<IDriverEligibleResponse>> => {
    try {
      const now = new Date();

      const where: Prisma.DriverWhereInput = {
        deletedAt: null,
        realtimeStatus: RealtimeStatus.Idle,
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

      // Full name filter
      if (query.fullName) {
        where.fullName = {
          contains: query.fullName,
          mode: 'insensitive',
        };
      }

      const data = await this.repository.findEligible({
        where,
      });

      // Enrich with presigned URLs and add computed isSimExpired
      const driversWithExpiry = await Promise.all(
        data.map(async (driver) => {
          const enrichedDriver = await this.enrichDriverWithPresignedUrls(driver);
          return {
            ...enrichedDriver,
            isSimExpired: driver.simExpiry < now,
          };
        }),
      );

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

      // Enrich with presigned URLs and add computed isSimExpired
      const driversWithExpiry = await Promise.all(
        data.map(async (driver) => {
          const enrichedDriver = await this.enrichDriverWithPresignedUrls(driver);
          return {
            ...enrichedDriver,
            isSimExpired: true,
          };
        }),
      );

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

  /**
   * Generate unique driver code with format: DRV{SEQUENCE}
   * Example: DRV001, DRV002, DRV003
   * Retries until a unique code is found
   */
  private async generateDriverCode(): Promise<string | null> {
    try {
      // Find all existing driver codes with DRV prefix
      const allDriversWithPrefix = await this.repository.findList({
        skip: 0,
        take: 10000,
        where: {
          driverCode: {
            startsWith: 'DRV',
          },
        },
      });

      let maxSequence = 0;
      for (const driver of allDriversWithPrefix) {
        const code = driver.driverCode;
        // Extract numeric part after "DRV"
        const numericPart = code.substring(3);
        const sequence = parseInt(numericPart, 10);
        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }

      const maxAttempts = 100;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const newSequence = maxSequence + 1 + attempt;
        const sequenceStr = newSequence.toString().padStart(3, '0');
        const generatedCode = `DRV${sequenceStr}`;

        const duplicateCheck = await this.repository.findFirst({
          driverCode: generatedCode,
        });

        if (!duplicateCheck) {
          return generatedCode;
        }
      }

      Logger.error(
        `Failed to generate unique driver code after ${maxAttempts} attempts`,
        undefined,
        'DriversUseCase.generateDriverCode',
      );
      return null;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in generateDriverCode',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.generateDriverCode',
      );
      return null;
    }
  }
}
