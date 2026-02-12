import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { ERoutes } from '@/shared/constants/routes';
import { response } from '@/shared/utils/rest-api/response';
import { Controller, Get, HttpStatus, Logger, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GetOrgUnitsDto } from '../dto';
import { OrgUnitUseCase } from '../usecase';

@Controller(ERoutes.ORG_UNIT)
@UseGuards(JwtAuthGuard)
export class OrgUnitController {
  constructor(private readonly usecase: OrgUnitUseCase) {}

  @Get('')
  async findAll(@Query() dto: GetOrgUnitsDto, @Res() res: Response) {
    try {
      const result = await this.usecase.getOrgUnitsPaginated(dto);

      if (result.error) {
        return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Organization units fetched successfully',
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in OrgUnitMasterController.findAll',
        error instanceof Error ? error.stack : undefined,
        'OrgUnitMasterController.findAll',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'Failed to fetch organization units',
      });
    }
  }

  /**
   * GET /api/v1/org-unit/list
   * GET /api/v1/org-unit
   * Get organization units with optional filters (flat list)
   */
  @Get('list')
  async getOrgUnits(@Query() dto: GetOrgUnitsDto) {
    return await this.usecase.getOrgUnits(dto);
  }

  /**
   * GET /api/v1/master/org-units/tree
   * Get organization units in hierarchical tree structure
   */
  @Get('tree')
  async getOrgUnitsTree() {
    return await this.usecase.getOrgUnitsTree();
  }

  /**
   * GET /api/v1/master/org-units/:code
   * Get organization unit detail by code
   */
  @Get(':code')
  async getOrgUnitByCode(@Param('code') code: string) {
    return await this.usecase.getOrgUnitByCode(code);
  }
}
