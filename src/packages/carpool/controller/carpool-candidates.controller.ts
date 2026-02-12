import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { ERoutes, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Controller, Get, Headers, HttpStatus, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GetCarpoolCandidatesDto } from '../dto';
import { CarpoolCandidateMatcherService } from '../services/carpool-candidate-matcher.service';

@Controller(ERoutes.CARPOOL)
@UseGuards(JwtAuthGuard)
export class CarpoolCandidatesController {
  constructor(private readonly matcherService: CarpoolCandidateMatcherService) {}

  /**
   * GET /api/v1/carpool/candidates
   * Fetch carpool candidates with grouping logic (FR-REQ-002)
   */
  @Get('candidates')
  async getCandidates(
    @Query() dto: GetCarpoolCandidatesDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      if (!userId) {
        return response[HttpStatus.UNAUTHORIZED](res, {
          message: 'User ID is required in headers (x-user-id)',
        });
      }

      const candidates = await this.matcherService.findGlobalCandidates(dto, userId);

      return res.status(HttpStatus.OK).json(candidates);
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error fetching carpool candidates',
        error instanceof Error ? error.stack : undefined,
        'CarpoolCandidatesController.getCandidates',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error instanceof Error ? error.message : validationMessage()[500](),
      });
    }
  }
}
