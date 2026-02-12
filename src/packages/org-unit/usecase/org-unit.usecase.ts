import { IPaginationResponse, IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildOrgUnitTree, getOrgDescendants } from '../domain/helpers';
import { GetOrgUnitsDto, IOrgUnit, IOrgUnitDetailResponse, IOrgUnitResponse, IOrgUnitTreeNode } from '../dto';
import { OrgUnitRepository } from '../repository';

@Injectable()
export class OrgUnitUseCase {
  constructor(private readonly repository: OrgUnitRepository) {}

  /**
   * Get organization units with pagination
   */
  async getOrgUnitsPaginated(dto: GetOrgUnitsDto): Promise<IUsecaseResponse<IPaginationResponse<IOrgUnit>>> {
    try {
      const result = await this.repository.findAllPaginated(dto);

      const items: IOrgUnit[] = result.items.map((unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        type: unit.type,
        parentCode: unit.parentCode,
        parentName: unit.parent?.name,
        costCenter: null, // Not in schema
        description: undefined, // Not in schema
      }));

      return {
        data: {
          ...result,
          items,
        },
      };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to retrieve organization units',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get organization units with optional filters (flat list)
   */
  async getOrgUnits(dto: GetOrgUnitsDto): Promise<IUsecaseResponse<IOrgUnitResponse[]>> {
    try {
      // Build where clause
      const where: Prisma.OrganizationUnitWhereInput = {};

      // Filter by type if provided
      if (dto.type) {
        where.type = dto.type;
      }

      // Search by name or code if provided
      if (dto.search) {
        where.OR = [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { code: { contains: dto.search, mode: 'insensitive' } },
        ];
      }

      // Note: is_active is not mapped to a field in the schema
      // If needed in the future, add a status field to OrganizationUnit model

      const units = await this.repository.findMany(where);

      const response: IOrgUnitResponse[] = units.map((unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        type: unit.type,
        parentCode: unit.parentCode,
        costCenter: (unit as any).costCenter || null,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
      }));

      return { data: response };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to retrieve organization units',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get organization units tree (hierarchical structure)
   */
  async getOrgUnitsTree(): Promise<IUsecaseResponse<IOrgUnitTreeNode[]>> {
    try {
      const allUnits = await this.repository.findAll();
      const tree = buildOrgUnitTree(allUnits);

      return { data: tree };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to retrieve organization units tree',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get organization unit by code (with parent detail)
   */
  async getOrgUnitByCode(code: string): Promise<IUsecaseResponse<IOrgUnitDetailResponse>> {
    try {
      const unit: any = await this.repository.findByCode(code);

      if (!unit) {
        return {
          error: {
            message: 'Organization unit not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      const response: IOrgUnitDetailResponse = {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        type: unit.type,
        parentCode: unit.parentCode,
        costCenter: unit.costCenter || null,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
        parent: unit.parent
          ? {
              code: unit.parent.code,
              name: unit.parent.name,
              type: unit.parent.type,
            }
          : null,
      };

      return { data: response };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to retrieve organization unit',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get all descendant organization unit codes for RLS (Row-Level Security)
   * @param code Parent organization unit code
   * @returns Array of descendant codes (including the parent)
   */
  async getOrgDescendants(code: string): Promise<string[]> {
    const allUnits = await this.repository.findAll();
    return getOrgDescendants(code, allUnits);
  }
}
