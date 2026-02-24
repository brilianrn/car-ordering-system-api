import { Roles } from '@/packages/auth/decorators/roles.decorator';
import { ERoutes } from '@/shared/constants/routes';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ListUserQueryDto, UpdateRolesDto, UpdateUserDto } from '../dto';
import { UserUsecasePort } from '../ports/usecase.port';

@Controller([ERoutes.USER, ERoutes.USERS])
// @UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    @Inject('UserUsecasePort')
    private readonly usecase: UserUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Get('')
  @Roles(Role.GA, Role.ADMIN)
  async findAll(@Query() query: ListUserQueryDto, @Res() res: Response) {
    try {
      const result = await this.usecase.findAll(query);
      if (result.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message,
        });
      }
      return response[HttpStatus.OK](res, {
        message: 'Users fetched successfully',
        data: result.data,
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while fetching users',
      });
    }
  }

  @Get('/:id')
  @Roles(Role.GA, Role.ADMIN)
  async findOne(@Param('id') employeeId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.findOne(employeeId);
      if (result.error) {
        return response[result.error.code || HttpStatus.NOT_FOUND](res, {
          message: result.error.message,
        });
      }
      return response[HttpStatus.OK](res, {
        message: 'User fetched successfully',
        data: result.data,
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while fetching user',
      });
    }
  }

  @Patch('/:id')
  @Roles(Role.GA, Role.ADMIN)
  async updateUser(@Param('id') employeeId: string, @Body() dto: UpdateUserDto, @Res() res: Response) {
    try {
      const result = await this.usecase.updateUser(employeeId, dto);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: result.data?.message || 'User updated successfully',
        data: { employeeId: result.data?.employeeId },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in updateUser controller',
        error instanceof Error ? error.stack : undefined,
        'UserController.updateUser',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while updating user',
      });
    }
  }

  @Patch('/:id/roles')
  @Roles(Role.GA, Role.ADMIN)
  async updateRoles(
    @Param('id') employeeId: string,
    @Body() dto: UpdateRolesDto,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      const actorId = (req.user?.employeeId as string) || 'SYSTEM';
      const result = await this.usecase.updateRoles(employeeId, dto, actorId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: result.data?.message || 'Roles updated successfully',
        data: { employeeId: result.data?.employeeId },
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while updating roles',
      });
    }
  }

  @Delete('/:id')
  @Roles(Role.GA, Role.ADMIN)
  async remove(@Param('id') employeeId: string, @Res() res: Response, @Req() req: any) {
    try {
      const actorId = req.user?.employeeId || 'SYSTEM';
      const result = await this.usecase.remove(employeeId, actorId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'User deleted successfully',
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while deleting user',
      });
    }
  }

  // ─── POST /sync-hr ──────────────────────────────────────────────────────────

  @Post('/sync-hr')
  @Roles(Role.GA, Role.ADMIN)
  async syncHr(@Req() req: any, @Res() res: Response) {
    try {
      const actorId: string = req.user?.employeeId || 'SYSTEM';
      const result = await this.usecase.syncHr(actorId);

      if (result?.error) {
        return response[result.error.code ?? HttpStatus.INTERNAL_SERVER_ERROR](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: `HRIS sync completed – ${result.data!.created} created, ${result.data!.updated} updated, ${result.data!.failed} failed`,
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in syncHr controller',
        error instanceof Error ? error.stack : undefined,
        'UserController.syncHr',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during HR sync',
      });
    }
  }

  // ─── POST /upload-l1 ────────────────────────────────────────────────────────

  @Post('/upload-l1')
  @Roles(Role.GA, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // keep file in memory as Buffer
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream', // some clients send xlsx as this
        ];
        if (
          allowed.includes(file.mimetype) ||
          file.originalname.endsWith('.xlsx') ||
          file.originalname.endsWith('.xls')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only Excel files (.xlsx / .xls) are allowed'), false);
        }
      },
    }),
  )
  async uploadL1(@UploadedFile() file: any, @Req() req: any, @Res() res: Response) {
    try {
      if (!file) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: 'No file uploaded. Attach an Excel file with form-field name "file".',
        });
      }

      const actorId: string = req.user?.employeeId || 'SYSTEM';
      const result = await this.usecase.uploadL1(file.buffer, actorId);

      if (result?.error) {
        return response[result.error.code ?? HttpStatus.INTERNAL_SERVER_ERROR](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: `L1 mapping upload completed – ${result.data!.updated} updated, ${result.data!.failed} failed`,
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in uploadL1 controller',
        error instanceof Error ? error.stack : undefined,
        'UserController.uploadL1',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error instanceof Error ? error.message : 'An error occurred during L1 upload',
      });
    }
  }
}
