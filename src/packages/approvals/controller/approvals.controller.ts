import { actionableApprovalRoute, ERoutes } from '@/shared/constants/routes';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Get, HttpStatus, Inject, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExecuteActionDto, ValidateTokenDto } from '../dto';
import { ApprovalsUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.APPROVALS)
export class ApprovalsController {
  constructor(
    @Inject('ApprovalsUsecasePort')
    private readonly usecase: ApprovalsUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Get(actionableApprovalRoute.validateToken)
  async validateToken(@Query() dto: ValidateTokenDto, @Res() res: Response) {
    try {
      const result = await this.usecase.validateToken(dto.token);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Token validated successfully',
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in validateToken controller',
        error instanceof Error ? error.stack : undefined,
        'ApprovalsController.validateToken',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during token validation',
      });
    }
  }

  @Post(actionableApprovalRoute.execute)
  async executeAction(@Body() dto: ExecuteActionDto, @Res() res: Response) {
    try {
      // TODO: Extract requesterId from AuthServer or token
      const requesterId = 'SYSTEM'; // For now, use SYSTEM as we're using token-based auth

      const result = await this.usecase.executeAction(dto, requesterId);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: result.data?.message || 'Action executed successfully',
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in executeAction controller',
        error instanceof Error ? error.stack : undefined,
        'ApprovalsController.executeAction',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during action execution',
      });
    }
  }
}
