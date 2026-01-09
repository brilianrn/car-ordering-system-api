import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ICostVariable, ICostVariableListResponse } from '../domain/response';
import { CreateCostVariableDto } from '../dto/create-cost-variable.dto';
import { QueryCostVariableDto } from '../dto/query-cost-variable.dto';
import { UpdateCostVariableDto } from '../dto/update-cost-variable.dto';
import { CostVariableRepositoryPort } from '../ports/repository.port';
import { CostVariableUsecasePort } from '../ports/usecase.port';

@Injectable()
export class CostVariableUseCase implements CostVariableUsecasePort {
  constructor(
    @Inject('CostVariableRepositoryPort')
    private readonly repository: CostVariableRepositoryPort,
  ) {}

  create = async (createDto: CreateCostVariableDto, userId: string): Promise<IUsecaseResponse<ICostVariable>> => {
    try {
      let code: string;

      // If code is provided, validate uniqueness
      if (createDto.code) {
        const existing = await this.repository.findByCode(createDto.code.toUpperCase());
        if (existing) {
          return {
            error: {
              message: `Cost variable with code ${createDto.code} already exists`,
              code: HttpStatus.CONFLICT,
            },
          };
        }
        code = createDto.code.toUpperCase();
      } else {
        // Auto-generate unique code
        const generatedCode = await this.generateCostVariableCode(createDto.category);
        if (!generatedCode) {
          return {
            error: {
              message: 'Failed to generate cost variable code',
              code: HttpStatus.INTERNAL_SERVER_ERROR,
            },
          };
        }
        code = generatedCode;
      }

      const costVariable = await this.repository.create({
        code,
        name: createDto.name,
        category: createDto.category,
        unit: createDto.unit,
        value: createDto.value,
        currency: createDto.currency || 'IDR',
        isActive: createDto.isActive ?? true,
        effectiveFrom: new Date(createDto.effectiveFrom),
        effectiveTo: createDto.effectiveTo ? new Date(createDto.effectiveTo) : null,
        description: createDto.description || null,
        metadata: createDto.metadata || null,
        createdBy: userId,
      });

      return { data: costVariable as ICostVariable };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'CostVariableUseCase.create',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to create cost variable',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findAll = async (query: QueryCostVariableDto): Promise<IUsecaseResponse<ICostVariableListResponse>> => {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (query.search) {
        where.OR = [
          { code: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query.category) {
        where.category = query.category;
      }

      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
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

      return {
        data: {
          data: data as ICostVariable[],
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
        'CostVariableUseCase.findAll',
      );
      return { error };
    }
  };

  findOne = async (id: number): Promise<IUsecaseResponse<ICostVariable>> => {
    try {
      const costVariable = await this.repository.findById(id);
      if (!costVariable) {
        return {
          error: {
            message: `Cost variable with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      return { data: costVariable as ICostVariable };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOne',
        error instanceof Error ? error.stack : undefined,
        'CostVariableUseCase.findOne',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch cost variable',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  update = async (
    id: number,
    updateDto: UpdateCostVariableDto,
    userId: string,
  ): Promise<IUsecaseResponse<ICostVariable>> => {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          error: {
            message: `Cost variable with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      const updateData: any = {
        updatedBy: userId,
      };

      if (updateDto.name !== undefined) {
        updateData.name = updateDto.name;
      }
      if (updateDto.category !== undefined) {
        updateData.category = updateDto.category;
      }
      if (updateDto.unit !== undefined) {
        updateData.unit = updateDto.unit;
      }
      if (updateDto.value !== undefined) {
        updateData.value = updateDto.value;
      }
      if (updateDto.currency !== undefined) {
        updateData.currency = updateDto.currency;
      }
      if (updateDto.isActive !== undefined) {
        updateData.isActive = updateDto.isActive;
      }
      if (updateDto.effectiveFrom !== undefined) {
        updateData.effectiveFrom = new Date(updateDto.effectiveFrom);
      }
      if (updateDto.effectiveTo !== undefined) {
        updateData.effectiveTo = updateDto.effectiveTo ? new Date(updateDto.effectiveTo) : null;
      }
      if (updateDto.description !== undefined) {
        updateData.description = updateDto.description || null;
      }
      if (updateDto.metadata !== undefined) {
        updateData.metadata = updateDto.metadata || null;
      }

      const costVariable = await this.repository.update({
        where: { id },
        data: updateData,
      });

      return { data: costVariable as ICostVariable };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'CostVariableUseCase.update',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to update cost variable',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  delete = async (id: number, userId: string): Promise<IUsecaseResponse<void>> => {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          error: {
            message: `Cost variable with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      await this.repository.softDelete(id, userId);
      return { data: undefined };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in delete',
        error instanceof Error ? error.stack : undefined,
        'CostVariableUseCase.delete',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete cost variable',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  restore = async (id: number): Promise<IUsecaseResponse<ICostVariable>> => {
    try {
      const existing = await this.repository.findById(id, true);
      if (!existing) {
        return {
          error: {
            message: `Cost variable with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      if (!existing.deletedAt) {
        return {
          error: {
            message: `Cost variable with ID ${id} is not deleted`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      const costVariable = await this.repository.restore(id);
      return { data: costVariable as ICostVariable };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'CostVariableUseCase.restore',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to restore cost variable',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  /**
   * Generate unique cost variable code based on category
   * Format: {CATEGORY}_{SEQUENCE}
   * Example: FUEL_001, TOLL_001, PARKING_001
   */
  private async generateCostVariableCode(category: string): Promise<string | null> {
    try {
      const categoryPrefix = category.toUpperCase();

      // Find all existing cost variables with same category prefix
      const allWithPrefix = await this.repository.findList({
        skip: 0,
        take: 10000,
        where: {
          code: {
            startsWith: `${categoryPrefix}_`,
          },
        },
      });

      let maxSequence = 0;
      for (const costVar of allWithPrefix) {
        const code = costVar.code;
        // Extract numeric part after "{CATEGORY}_"
        const numericPart = code.substring(categoryPrefix.length + 1);
        const sequence = parseInt(numericPart, 10);
        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }

      const maxAttempts = 100;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const newSequence = maxSequence + 1 + attempt;
        const sequenceStr = newSequence.toString().padStart(3, '0');
        const generatedCode = `${categoryPrefix}_${sequenceStr}`;

        const duplicateCheck = await this.repository.findByCode(generatedCode);
        if (!duplicateCheck) {
          return generatedCode;
        }
      }

      Logger.error(
        'Failed to generate unique cost variable code after max attempts',
        undefined,
        'CostVariableUseCase.generateCostVariableCode',
      );
      return null;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in generateCostVariableCode',
        error instanceof Error ? error.stack : undefined,
        'CostVariableUseCase.generateCostVariableCode',
      );
      return null;
    }
  }
}
