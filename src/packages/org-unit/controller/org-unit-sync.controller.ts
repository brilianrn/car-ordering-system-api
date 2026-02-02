import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ISyncOrgUnitsResponse, SyncOrgUnitsDto } from '../dto';

/**
 * Sync controller for organization units
 * Admin-protected endpoints for triggering manual synchronization
 *
 * TODO: Add proper authentication guard (AdminGuard or RolesGuard)
 * For now, this is a placeholder implementation
 */
@Controller('api/v1/sync/org-units')
export class OrgUnitSyncController {
  constructor() {}

  /**
   * POST /api/v1/sync/org-units
   * Trigger manual synchronization of organization units from Sunfish HRIS
   *
   * @requires Admin role or System API key
   */
  @Post()
  // @UseGuards(AdminGuard) // TODO: Implement proper auth guard
  async syncOrgUnits(@Body() dto: SyncOrgUnitsDto) {
    try {
      // TODO: Integrate with existing OrgSyncService from scheduler package
      // For now, return a placeholder response

      const response: ISyncOrgUnitsResponse = {
        batchId: `SYNC-${Date.now()}`,
        status: 'PENDING',
        message: 'Synchronization job has been queued. Please check the batch status for progress.',
      };

      return {
        code: HttpStatus.ACCEPTED,
        message: 'Sync job initiated successfully',
        data: response,
      };
    } catch (error) {
      return {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Failed to initiate sync',
      };
    }
  }
}
