import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IVendor, IVendorListResponse, IVendorOption } from '../domain/response';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { QueryVendorDto } from '../dto/query-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import type { VendorsRepositoryPort } from '../ports/repository.port';
import { VendorsUsecasePort } from '../ports/usecase.port';

@Injectable()
export class VendorsUseCase implements VendorsUsecasePort {
  constructor(
    @Inject('VendorsRepositoryPort')
    private readonly repository: VendorsRepositoryPort,
  ) {
    this.repository = repository;
  }

  findAll = async (query: QueryVendorDto): Promise<IUsecaseResponse<IVendorListResponse>> => {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const skip = (page - 1) * limit;

      const where: Prisma.VendorWhereInput = {};

      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
          { code: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
          { contactPic: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
        ];
      }

      if (query.status) {
        where.status = query.status;
      }

      const [data, total] = await Promise.all([
        this.repository.findMany({
          skip,
          take: limit,
          where,
          orderBy: { updatedAt: 'desc' },
        }),
        this.repository.count(where),
      ]);

      return {
        data: {
          data: data as IVendor[],
          meta: { page, limit, total },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'VendorsUseCase.findAll',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch vendors',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findOne = async (id: number): Promise<IUsecaseResponse<IVendor>> => {
    try {
      const vendor = await this.repository.findUnique({ id });
      if (!vendor) {
        return { error: { message: 'Vendor not found', code: HttpStatus.NOT_FOUND } };
      }
      return { data: vendor as IVendor };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOne',
        error instanceof Error ? error.stack : undefined,
        'VendorsUseCase.findOne',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch vendor',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  create = async (dto: CreateVendorDto, userId: string): Promise<IUsecaseResponse<IVendor>> => {
    try {
      let code = dto.code;

      if (!code) {
        // Generate auto-code: VND-0001
        const count = await this.repository.count({});
        code = `VND-${String(count + 1).padStart(4, '0')}`;

        // Ensure uniqueness just in case
        let isDuplicate = true;
        let retryCount = 0;
        while (isDuplicate && retryCount < 5) {
          const existing = await this.repository.findFirst({ code });
          if (!existing) {
            isDuplicate = false;
          } else {
            retryCount++;
            code = `VND-${String(count + 1 + retryCount).padStart(4, '0')}`;
          }
        }
      } else {
        // Check for duplicate manual code
        const existing = await this.repository.findFirst({ code });
        if (existing) {
          return { error: { message: `Vendor with code '${code}' already exists`, code: HttpStatus.CONFLICT } };
        }
      }

      const vendor = await this.repository.create({
        code,
        name: dto.name,
        address: dto.address,
        contactPic: dto.contactPic,
        phoneNumber: dto.phoneNumber,
        status: dto.status ?? 'ACTIVE',
        createdBy: userId,
      });

      return { data: vendor as IVendor };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'VendorsUseCase.create',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to create vendor',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  update = async (id: number, dto: UpdateVendorDto, userId: string): Promise<IUsecaseResponse<IVendor>> => {
    try {
      const existing = await this.repository.findUnique({ id });
      if (!existing) {
        return { error: { message: 'Vendor not found', code: HttpStatus.NOT_FOUND } };
      }

      // Check for duplicate code if code is being changed
      if (dto.code && dto.code !== existing.code) {
        const duplicate = await this.repository.findFirst({ code: dto.code });
        if (duplicate) {
          return { error: { message: `Vendor with code '${dto.code}' already exists`, code: HttpStatus.CONFLICT } };
        }
      }

      const vendor = await this.repository.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: userId,
        },
      });

      return { data: vendor as IVendor };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'VendorsUseCase.update',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to update vendor',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  remove = async (id: number, userId: string): Promise<IUsecaseResponse<void>> => {
    try {
      const vendor = await this.repository.findUnique({ id });
      if (!vendor) {
        return { error: { message: 'Vendor not found', code: HttpStatus.NOT_FOUND } };
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
        'VendorsUseCase.remove',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete vendor',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findOptions = async (): Promise<IUsecaseResponse<IVendorOption[]>> => {
    try {
      const options = await this.repository.findOptions();
      return { data: options as IVendorOption[] };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOptions',
        error instanceof Error ? error.stack : undefined,
        'VendorsUseCase.findOptions',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch vendor options',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
