import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetOrgUnitsDto } from '../dto';
import { OrgUnitUseCase } from '../usecase';

@Controller('api/v1/master/org-units')
export class OrgUnitController {
  constructor(private readonly usecase: OrgUnitUseCase) {}

  /**
   * GET /api/v1/master/org-units
   * Get organization units with optional filters (flat list)
   */
  @Get()
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
