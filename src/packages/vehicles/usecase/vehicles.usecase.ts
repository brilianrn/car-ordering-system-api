import { S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, VehicleStatus } from '@prisma/client';
import {
  IOrganizationLOV,
  IVehicle,
  IVehicleDetailResponse,
  IVehicleImage,
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
    private readonly s3Service: S3Service,
  ) {
    this.repository = repository;
  }

  findAll = async (query: QueryVehicleDto): Promise<IUsecaseResponse<IVehicleListResponse>> => {
    try {
      const { page = 1, limit = 10, licensePlate, brandModel, vehicleType, vendorId, status, orgUnitId } = query;
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

      if (orgUnitId !== undefined) {
        where.OR = [
          {
            isDedicated: true,
            dedicatedOrg: {
              id: orgUnitId,
            },
          },
          {
            isDedicated: false,
          },
        ];
      }

      const [data, total] = await Promise.all([
        this.repository.findMany({
          skip,
          take: limit,
          where,
          include: {
            vendor: true,
            images: {
              select: {
                asset: true,
              },
            },
            dedicatedOrg: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.repository.count(where),
      ]);

      // Transform S3 keys into presigned URLs for nested images array
      // Using Promise.all to efficiently resolve all URLs
      const dataWithPresignedUrls = await Promise.all(
        data.map(async (vehicle: any) => {
          // Transform images array with presigned URLs
          if (vehicle.images && vehicle.images.length > 0) {
            const imagesWithUrls = await Promise.all(
              vehicle.images.map(async (vehicleImage: any) => {
                try {
                  const presignedUrl = await this.s3Service.getPresignedUrl(vehicleImage.asset.url, 86400); // 1 day expiry
                  return {
                    ...vehicleImage,
                    asset: {
                      ...vehicleImage.asset,
                      url: presignedUrl,
                    },
                  };
                } catch (error) {
                  Logger.error(
                    error instanceof Error ? error.message : 'Error generating presigned URL for vehicle image',
                    error instanceof Error ? error.stack : undefined,
                    'VehiclesUseCase.findAll - presigned URL generation',
                  );
                  // Return original asset with S3 key if presigned URL generation fails
                  return vehicleImage;
                }
              }),
            );
            return {
              ...vehicle,
              images: imagesWithUrls,
            };
          }
          // If no images, return vehicle as is
          return vehicle;
        }),
      );

      return {
        data: {
          data: dataWithPresignedUrls as IVehicle[],
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
          dedicatedOrg: true,
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

  findDetail = async (id: number): Promise<IUsecaseResponse<IVehicleDetailResponse>> => {
    try {
      const vehicle = await this.repository.findUnique(
        {
          where: { id },
          include: {
            vendor: true,
            dedicatedOrg: true,
            images: {
              include: {
                asset: true,
              },
            },
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

      // Transform images with presigned URLs
      // Using Promise.all to ensure all async operations complete before returning
      let images: IVehicleImage[] = [];
      const vehicleWithImages = vehicle as any;
      if (vehicleWithImages.images && vehicleWithImages.images.length > 0) {
        images = await Promise.all(
          vehicleWithImages.images.map(async (vehicleImage: any) => {
            try {
              const presignedUrl = await this.s3Service.getPresignedUrl(vehicleImage.asset.url);
              return {
                id: vehicleImage.asset.id,
                name: vehicleImage.asset.fileName,
                url: presignedUrl,
              };
            } catch (error) {
              Logger.error(
                error instanceof Error ? error.message : 'Error generating presigned URL for vehicle image',
                error instanceof Error ? error.stack : undefined,
                'VehiclesUseCase.findDetail - presigned URL generation',
              );
              // Return image with original S3 key if presigned URL generation fails
              return {
                id: vehicleImage.asset.id,
                name: vehicleImage.asset.fileName,
                url: vehicleImage.asset.url,
              };
            }
          }),
        );
      }

      const response: IVehicleDetailResponse = {
        ...vehicle,
        images,
      };

      return { data: response };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findDetail',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.findDetail',
      );
      return { error };
    }
  };

  create = async (createDto: CreateVehicleDto, userId: string): Promise<IUsecaseResponse<IVehicle>> => {
    try {
      let vehicleCode: string = createDto.vehicleCode || '';
      const isUserProvidedCode = !!createDto.vehicleCode;

      if (!vehicleCode) {
        const generatedCode = await this.generateVehicleCode(createDto.plantLocation);
        if (!generatedCode) {
          return {
            error: {
              message: 'Failed to generate unique vehicle code',
              code: 500,
            },
          };
        }
        vehicleCode = generatedCode;
      }

      if (isUserProvidedCode) {
        const existingByCode = await this.repository.findFirst({
          vehicleCode,
        });

        if (existingByCode) {
          return {
            error: {
              message: `Vehicle with code ${vehicleCode} already exists`,
              code: 409,
            },
          };
        }
      }

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

      if (createDto.isDedicated === true && !createDto.dedicatedOrgId) {
        return {
          error: {
            message: 'dedicatedOrgId is required when isDedicated is true',
            code: 400,
          },
        };
      }

      if (createDto.isDedicated === false && createDto.dedicatedOrgId) {
        return {
          error: {
            message: 'dedicatedOrgId should not be provided when isDedicated is false',
            code: 400,
          },
        };
      }

      const MAX_IMAGES = 3;
      if (createDto.imageAssetIds.length > MAX_IMAGES) {
        return {
          error: {
            message: `Maximum ${MAX_IMAGES} images allowed per vehicle`,
            code: 400,
          },
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageAssetIds, dedicatedOrgId, ...vehicleData } = createDto;

      const vehicle = await this.repository.create({
        ...vehicleData,
        vehicleCode,
        createdBy: userId,
        status: createDto.status || VehicleStatus.ACTIVE,
        isDedicated: createDto.isDedicated ?? false,
        // Use dedicatedOrg relation instead of dedicatedOrgId field
        dedicatedOrg:
          createDto.isDedicated && createDto.dedicatedOrgId ? { connect: { id: createDto.dedicatedOrgId } } : undefined,
      });

      if (imageAssetIds && imageAssetIds.length > 0) {
        for (const assetId of imageAssetIds) {
          await this.repository.createVehicleImage({
            vehicle: { connect: { id: vehicle.id } },
            asset: { connect: { id: assetId } },
            createdBy: userId,
          });
        }
      }

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

  update = async (id: number, updateDto: UpdateVehicleDto, userId: string): Promise<IUsecaseResponse<IVehicle>> => {
    try {
      // Check if vehicle exists
      const existing = await this.repository.findUnique({
        where: { id },
        include: {
          dedicatedOrg: true,
        },
      });

      if (!existing || existing.deletedAt) {
        return {
          error: {
            message: `Vehicle with ID ${id} not found`,
            code: 404,
          },
        };
      }

      // Check for duplicate vehicleCode only if user is trying to change it
      // If vehicleCode is not provided, keep the existing one (no check needed)
      // If vehicleCode is provided and different from existing, check for duplicate
      if (updateDto.vehicleCode !== undefined) {
        // If user provided the same code, no need to check (it's the same vehicle)
        if (updateDto.vehicleCode !== existing.vehicleCode) {
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
      }

      // Check for duplicate licensePlate if being updated
      if (updateDto.licensePlate && updateDto.licensePlate !== existing.licensePlate) {
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

      // Validate dedicated vehicle logic if updating
      if (updateDto.isDedicated !== undefined || updateDto.dedicatedOrgId !== undefined) {
        const finalIsDedicated = updateDto.isDedicated ?? existing.isDedicated;
        const finalDedicatedOrgId = updateDto.dedicatedOrgId ?? (existing.dedicatedOrgId || null);

        if (finalIsDedicated === true && !finalDedicatedOrgId) {
          return {
            error: {
              message: 'dedicatedOrgId is required when isDedicated is true',
              code: 400,
            },
          };
        }

        if (finalIsDedicated === false && finalDedicatedOrgId) {
          return {
            error: {
              message: 'dedicatedOrgId should not be provided when isDedicated is false',
              code: 400,
            },
          };
        }
      }

      // Validate image count if updating images (min 1, max 3)
      const MIN_IMAGES = 1;
      const MAX_IMAGES = 3;
      if (updateDto.imageAssetIds !== undefined) {
        if (updateDto.imageAssetIds.length < MIN_IMAGES) {
          return {
            error: {
              message: `At least ${MIN_IMAGES} image is required`,
              code: 400,
            },
          };
        }
        if (updateDto.imageAssetIds.length > MAX_IMAGES) {
          return {
            error: {
              message: `Maximum ${MAX_IMAGES} images allowed per vehicle`,
              code: 400,
            },
          };
        }
      }

      // Extract fields that should not be passed directly to Prisma
      // dedicatedOrgId is removed from spread but still used via updateDto.dedicatedOrgId
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageAssetIds, dedicatedOrgId, ...vehicleUpdateData } = updateDto;

      // Handle dedicatedOrg update logic
      const updateData: any = {
        ...vehicleUpdateData,
        updatedBy: userId,
      };

      // If isDedicated is being set to false, clear dedicatedOrg
      if (updateDto.isDedicated === false) {
        updateData.dedicatedOrg = { disconnect: true };
      }
      // If isDedicated is being set to true, use provided dedicatedOrgId
      else if (updateDto.isDedicated === true && updateDto.dedicatedOrgId) {
        updateData.dedicatedOrg = { connect: { id: updateDto.dedicatedOrgId } };
      }
      // If only dedicatedOrgId is being updated
      else if (updateDto.dedicatedOrgId !== undefined && existing.isDedicated) {
        updateData.dedicatedOrg = updateDto.dedicatedOrgId
          ? { connect: { id: updateDto.dedicatedOrgId } }
          : { disconnect: true };
      }

      const vehicle = await this.repository.update({
        where: { id },
        data: updateData,
      });

      // Handle image updates: replace all existing images with new ones
      if (imageAssetIds !== undefined) {
        // Delete existing images
        await this.repository.deleteVehicleImages(id);

        // Create new VehicleImage records
        if (imageAssetIds.length > 0) {
          for (const assetId of imageAssetIds) {
            await this.repository.createVehicleImage({
              vehicle: { connect: { id } },
              asset: { connect: { id: assetId } },
              createdBy: userId,
            });
          }
        }
      }

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

  remove = async (id: number, userId: string): Promise<IUsecaseResponse<void>> => {
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

  /**
   * Generate unique vehicle code based on plantLocation
   * Format: {PLANT_PREFIX}{SEQUENCE_NUMBER}
   * Example: JKT001, BDG001, SBY001
   * Retries until a unique code is found
   */
  private async generateVehicleCode(plantLocation: string): Promise<string | null> {
    try {
      const cleanLocation = plantLocation.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const prefix = cleanLocation.substring(0, 4).padEnd(3, 'X');

      const allVehiclesWithPrefix = await this.repository.findMany({
        skip: 0,
        take: 1000,
        where: {
          vehicleCode: {
            startsWith: prefix,
          },
        },
        include: undefined,
      });

      let maxSequence = 0;
      for (const vehicle of allVehiclesWithPrefix) {
        const code = vehicle.vehicleCode;

        const numericPart = code.substring(prefix.length);
        const sequence = parseInt(numericPart, 10);
        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }

      const maxAttempts = 100;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const newSequence = maxSequence + 1 + attempt;
        const sequenceStr = newSequence.toString().padStart(3, '0');
        const generatedCode = `${prefix}${sequenceStr}`;

        const duplicateCheck = await this.repository.findFirst({
          vehicleCode: generatedCode,
        });

        if (!duplicateCheck) {
          return generatedCode;
        }
      }

      Logger.error(
        `Failed to generate unique vehicle code after ${maxAttempts} attempts for prefix: ${prefix}`,
        undefined,
        'VehiclesUseCase.generateVehicleCode',
      );
      return null;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in generateVehicleCode',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.generateVehicleCode',
      );
      return null;
    }
  }

  lovOrganizations = async (): Promise<IUsecaseResponse<IOrganizationLOV[]>> => {
    try {
      const organizations = await this.repository.findActiveOrganizations();

      const lovData: IOrganizationLOV[] = organizations.map((org) => ({
        label: `${org.name} (${org.code})`,
        value: org.id,
      }));

      return {
        data: lovData,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in lovOrganizations',
        error instanceof Error ? error.stack : undefined,
        'VehiclesUseCase.lovOrganizations',
      );
      return { error };
    }
  };
}
