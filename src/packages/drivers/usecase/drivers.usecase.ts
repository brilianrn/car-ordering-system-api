import { getDriverAccountCreatedEmailTemplate } from '@/shared/templates/mail/driver-account-created-email';
import { clientDb, S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { NotificationService } from '@/shared/utils/notification.service';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Inject, Injectable } from '@nestjs/common';
import { DriverType, Prisma, RealtimeStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
    private readonly notificationService: NotificationService,
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
      // ORDER STEP 1: Generate driverCode immediately
      // If driverCode is provided, validate uniqueness
      let driverCode: string;
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
              message: 'INTERNAL_SERVER_ERROR_CODE_GEN_FAILED',
              code: 500,
            },
          };
        }
        driverCode = generatedCode;
      }

      // ORDER STEP 2: Validation
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

      // Auto-provisioning Validation: If no employeeId (New Account), validate email & fullName
      if (!createDto.employeeId) {
        if (!createDto.email || !createDto.fullName) {
          return {
            error: {
              message: 'EMAIL_REQUIRED_FOR_AUTO_PROVISIONING', // As per req, though checking both
              code: 400,
            },
          };
        }
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

      if (createDto.driverType === DriverType.INTERNAL) {
        if (createDto.vendorId) {
          return {
            error: {
              message: 'VENDOR_NOT_ALLOWED_FOR_INTERNAL',
              code: 400,
            },
          };
        }

        if (createDto.employeeId) {
          // Check if employee already has a driver profile
          const existingEmployeeDriver = await this.repository.findFirst({
            employeeId: createDto.employeeId,
          });

          if (existingEmployeeDriver) {
            return {
              error: {
                message: 'EMPLOYEE_ALREADY_HAS_DRIVER_PROFILE',
                code: 409,
              },
            };
          }
        }
      }

      if (createDto.driverType === DriverType.EXTERNAL && createDto.employeeId) {
        return {
          error: {
            message: 'EMPLOYEE_ID_NOT_ALLOWED_FOR_EXTERNAL',
            code: 400,
          },
        };
      }

      // Validate dedicated vehicle logic
      if (createDto.isDedicated === true && !createDto.dedicatedVehicleId) {
        return {
          error: {
            message: 'dedicatedVehicleId is required when isDedicated is true',
            code: 400,
          },
        };
      }

      if (createDto.isDedicated === false && createDto.dedicatedVehicleId) {
        return {
          error: {
            message: 'dedicatedVehicleId should not be provided when isDedicated is false',
            code: 400,
          },
        };
      }

      // Check if email already exists in Account table if we are auto-provisioning
      if (!createDto.employeeId && createDto.email) {
        const existingAccount = await clientDb.account.findUnique({
          where: { email: createDto.email },
        });

        if (existingAccount) {
          return {
            error: {
              message: 'EMAIL_ALREADY_USED',
              code: 409,
            },
          };
        }
      }

      // ORDER STEP 3: Transaction
      let tempPassword: string | null = null;
      let shouldSendEmail = false;

      const transactionResult = await clientDb.$transaction(async (tx) => {
        let employeeId = createDto.employeeId;

        // Auto-provisioning: Create Employee & Account if needed
        if (!employeeId) {
          // Get default org unit (assuming ID = 1, adjust as needed)
          const defaultOrgUnit = await clientDb.organizationUnit.findFirst({
            where: { deletedAt: null },
            orderBy: { id: 'asc' },
          });

          if (!defaultOrgUnit) {
            throw new Error('DEFAULT_ORG_UNIT_NOT_FOUND');
          }

          // Generate unique employeeId
          const timestamp = Date.now().toString().slice(-8);
          const generatedEmployeeId =
            createDto.driverType === DriverType.INTERNAL ? `INT-DRV-${timestamp}` : `EXT-DRV-${timestamp}`;

          // Determine password: Prefer internalNik, fallback to generic
          if (createDto.internalNik) {
            tempPassword = createDto.internalNik;
          } else {
            tempPassword = `Driver${createDto.simNumber.slice(-4)}`;
          }

          const hashedPassword = await bcrypt.hash(tempPassword, 10);

          // Get DRIVER role
          const driverRole = await clientDb.rBACRole.findFirst({
            where: { name: Role.DRIVER },
          });

          if (!driverRole) {
            throw new Error('DRIVER_ROLE_NOT_FOUND');
          }

          // 1. Create Employee
          const newEmployee = await tx.employee.create({
            data: {
              employeeId: generatedEmployeeId,
              fullName: createDto.fullName,
              email: createDto.email,
              orgUnitId: defaultOrgUnit.id,
              effectiveFrom: new Date(),
              isActive: true, // Auto-active
              phoneNumber: createDto.phoneNumber,
              effectiveRoles: [Role.DRIVER],
              createdBy: userId,
            },
          });
          employeeId = newEmployee.employeeId;

          // 2. Create Account
          await tx.account.create({
            data: {
              email: createDto.email!,
              password: hashedPassword,
              employeeId: newEmployee.employeeId,
              isVerified: true,
            },
          });

          // 3. Assign DRIVER role
          await tx.userRole.create({
            data: {
              employeeId: newEmployee.employeeId,
              roleId: driverRole.id,
              assignedBy: userId,
              isActive: true,
            },
          });

          shouldSendEmail = true;
        }

        // 4. Create Driver using repository pattern logic but inside transaction
        // Since repository methods might not support transaction passed in, we use tx directly here to be safe and atomic
        const newDriver = await tx.driver.create({
          data: {
            driverCode,
            fullName: createDto.fullName,
            internalNik: createDto.internalNik,
            driverType: createDto.driverType,
            vendor:
              createDto.driverType === DriverType.EXTERNAL && createDto.vendorId
                ? { connect: { id: createDto.vendorId } }
                : undefined,
            employee: employeeId ? { connect: { employeeId } } : undefined,
            simNumber: createDto.simNumber,
            simExpiry: new Date(createDto.simExpiry),
            phoneNumber: createDto.phoneNumber,
            transmissionPref: createDto.transmissionPref,
            plantLocation: createDto.plantLocation,
            realtimeStatus: createDto.realtimeStatus ?? RealtimeStatus.Idle,
            isDedicated: createDto.isDedicated ?? false,
            dedicatedVehicle:
              createDto.isDedicated && createDto.dedicatedVehicleId
                ? { connect: { id: createDto.dedicatedVehicleId } }
                : undefined,
            photoAsset: createDto.photoAssetId ? { connect: { id: createDto.photoAssetId } } : undefined,
            ktpAsset: createDto.ktpAssetId ? { connect: { id: createDto.ktpAssetId } } : undefined,
            simAsset: createDto.simAssetId ? { connect: { id: createDto.simAssetId } } : undefined,
            createdBy: userId,
          },
          include: {
            vendor: true,
            employee: {
              include: {
                orgUnit: true,
              },
            },
            dedicatedVehicle: true,
            photoAsset: true,
            ktpAsset: true,
            simAsset: true,
          },
        });

        return newDriver;
      });

      // Send email notification (outside transaction)
      if (shouldSendEmail && tempPassword && createDto.email) {
        try {
          const emailTemplate = getDriverAccountCreatedEmailTemplate({
            driverName: createDto.fullName,
            email: createDto.email,
            tempPassword,
            loginUrl: process.env.FRONTEND_URL || 'https://app.example.com/login',
            driverCode,
          });

          await this.notificationService.sendEmail({
            to: createDto.email,
            subject: emailTemplate.subject,
            body: emailTemplate.text,
            html: emailTemplate.html,
          });

          Logger.info(
            `Account creation email sent to ${createDto.email} for driver ${driverCode}`,
            'DriversUseCase.create',
          );
        } catch (emailError) {
          // Log email error but don't fail the driver creation
          Logger.error(
            emailError instanceof Error ? emailError.message : 'Failed to send account creation email',
            emailError instanceof Error ? emailError.stack : undefined,
            'DriversUseCase.create - Email Notification',
          );
        }
      }

      const enrichedDriver = await this.enrichDriverWithPresignedUrls(transactionResult);
      return { data: enrichedDriver };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'DriversUseCase.create',
      );

      // Map known transaction errors if possible, or just return as is
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

      // Validate dedicated vehicle logic if updating
      if (updateDto.isDedicated !== undefined || updateDto.dedicatedVehicleId !== undefined) {
        const finalIsDedicated = updateDto.isDedicated ?? existing.isDedicated;
        const finalDedicatedVehicleId = updateDto.dedicatedVehicleId ?? (existing.dedicatedVehicleId || null);

        if (finalIsDedicated === true && !finalDedicatedVehicleId) {
          return {
            error: {
              message: 'dedicatedVehicleId is required when isDedicated is true',
              code: 400,
            },
          };
        }

        if (finalIsDedicated === false && finalDedicatedVehicleId) {
          return {
            error: {
              message: 'dedicatedVehicleId should not be provided when isDedicated is false',
              code: 400,
            },
          };
        }
      }

      // Exclude relation IDs from updateDto before spreading
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { dedicatedVehicleId, vendorId, photoAssetId, ktpAssetId, simAssetId, ...updateDtoWithoutRelationIds } =
        updateDto;

      const updateData: Prisma.DriverUpdateInput = {
        ...updateDtoWithoutRelationIds,
        updatedBy: userId,
      };

      if (updateDto.simExpiry) {
        updateData.simExpiry = new Date(updateDto.simExpiry);
      }

      if (updateDto.driverType === DriverType.INTERNAL) {
        updateData.vendor = { disconnect: true };
      }

      // Handle dedicatedVehicle update logic
      if (updateDto.isDedicated !== undefined || updateDto.dedicatedVehicleId !== undefined) {
        // If isDedicated is being set to false, clear dedicatedVehicle
        if (updateDto.isDedicated === false) {
          updateData.dedicatedVehicle = { disconnect: true };
        }
        // If isDedicated is being set to true, use provided dedicatedVehicleId
        else if (updateDto.isDedicated === true && updateDto.dedicatedVehicleId) {
          updateData.dedicatedVehicle = { connect: { id: updateDto.dedicatedVehicleId } };
        }
        // If only dedicatedVehicleId is being updated
        else if (updateDto.dedicatedVehicleId !== undefined && existing.isDedicated) {
          updateData.dedicatedVehicle = updateDto.dedicatedVehicleId
            ? { connect: { id: updateDto.dedicatedVehicleId } }
            : { disconnect: true };
        }
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
  /**
   * Generate unique driver code with format: DRV{SEQUENCE}
   * Example: DRV001, DRV002, DRV003
   * Retries until a unique code is found
   */
  private async generateDriverCode(): Promise<string | null> {
    try {
      const year = new Date().getFullYear();
      const prefix = `DRV-${year}-`;

      // Find the latest driver code with DRV-{YEAR} prefix
      const latestDriver = await this.repository.findFirst(
        {
          driverCode: {
            startsWith: prefix,
          },
        },
        {
          driverCode: 'desc',
        },
      );

      let nextSequence = 1;

      if (latestDriver && latestDriver.driverCode) {
        const code = latestDriver.driverCode;
        // Format: DRV-YYYY-XXX
        // Length of prefix is 9 (DRV-202X-)
        const numericPart = code.substring(prefix.length);
        const sequence = parseInt(numericPart, 10);
        if (!isNaN(sequence)) {
          nextSequence = sequence + 1;
        }
      }

      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const sequenceToTry = nextSequence + attempt;
        const sequenceStr = sequenceToTry.toString().padStart(3, '0');
        const generatedCode = `${prefix}${sequenceStr}`;

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
