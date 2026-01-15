import { RMQ } from '@/config/rabbitmq';
import { RabbitMQService } from '@/shared/rabbitmq/rabbitmq.service';
import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ParamEnvironment, ParamName, ParamScope, ParamSetStatus, Prisma } from '@prisma/client';
import { CreateParamSetDto, PublishParamSetDto, QueryParamSetDto, RollbackParamSetDto } from '../dto';
import { ParamSetRepositoryPort } from '../ports/repository.port';
import { ParamSetUsecasePort } from '../ports/usecase.port';

@Injectable()
export class ParamSetUseCase implements ParamSetUsecasePort {
  private readonly db = clientDb;

  constructor(
    @Inject('ParamSetRepositoryPort')
    private readonly repository: ParamSetRepositoryPort,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  createDraft = async (dto: CreateParamSetDto, userId: string, ipAddress?: string): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Validasi No Back-Dating: Effective_From >= Now
      const now = new Date();
      if (dto.effectiveFrom < now) {
        return {
          error: {
            message: 'Effective_From cannot be in the past. Must be >= current time.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 2. Validasi Effective_To jika ada
      if (dto.effectiveTo && dto.effectiveTo <= dto.effectiveFrom) {
        return {
          error: {
            message: 'Effective_To must be greater than Effective_From.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Validasi Grace No-Show: 5-120 menit (default: 30)
      const graceNoShowItem = dto.items.find((item) => item.name === ParamName.GRACE_NO_SHOW);
      if (graceNoShowItem) {
        const graceValue = parseInt(graceNoShowItem.value, 10);
        if (isNaN(graceValue) || graceValue < 5 || graceValue > 120) {
          return {
            error: {
              message: 'Grace No-Show value must be between 5 and 120 minutes.',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 4. Validasi Kategori Aktif: Minimal 1 kategori aktif
      const activeCategoriesItem = dto.items.find((item) => item.name === ParamName.ACTIVE_CATEGORIES);
      if (activeCategoriesItem) {
        try {
          const categories = JSON.parse(activeCategoriesItem.value);
          if (!Array.isArray(categories) || categories.length === 0) {
            return {
              error: {
                message: 'Active Categories must contain at least 1 category.',
                code: HttpStatus.BAD_REQUEST,
              },
            };
          }
        } catch (parseError) {
          return {
            error: {
              message: 'Active Categories value must be a valid JSON array.',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 5. Get next version
      const nextVersion = await this.repository.getNextVersion();

      // 6. Create ParamSet with items
      const paramSet = await this.repository.create({
        version: nextVersion,
        status: ParamSetStatus.DRAFT,
        environment: dto.environment || ParamEnvironment.UAT,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo || null,
        notes: dto.notes || null,
        createdBy: userId,
        items: {
          create: dto.items.map((item) => ({
            name: item.name,
            group: item.group,
            value: item.value,
            unit: item.unit || null,
            scope: item.scope || ParamScope.GLOBAL, // Default scope
            notes: item.notes || null,
            createdBy: userId,
          })),
        },
      });

      // 7. Log audit trail
      await this.logAudit('CREATE_DRAFT', paramSet.id, userId, null, paramSet, ipAddress, dto.notes);

      return { data: paramSet };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createDraft',
        error instanceof Error ? error.stack : undefined,
        'ParamSetUseCase.createDraft',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to create draft',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findActive = async (environment: string): Promise<IUsecaseResponse<any>> => {
    try {
      const env = environment.toUpperCase() as ParamEnvironment;
      if (!Object.values(ParamEnvironment).includes(env)) {
        return {
          error: {
            message: `Invalid environment. Must be one of: ${Object.values(ParamEnvironment).join(', ')}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      const activeParamSet = await this.repository.findActive(env);

      if (!activeParamSet) {
        return {
          error: {
            message: `No active parameter set found for environment: ${env}`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      return { data: activeParamSet };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findActive',
        error instanceof Error ? error.stack : undefined,
        'ParamSetUseCase.findActive',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to find active parameters',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findMany = async (query: QueryParamSetDto): Promise<IUsecaseResponse<any>> => {
    try {
      const skip = ((query.page || 1) - 1) * (query.limit || 10);
      const take = query.limit || 10;

      const where: Prisma.ParamSetWhereInput = {};
      if (query.status) {
        where.status = query.status;
      }
      if (query.environment) {
        where.environment = query.environment;
      }

      const [data, total] = await Promise.all([
        this.repository.findMany({ skip, take, where }),
        this.repository.count(where),
      ]);

      return {
        data: {
          items: data,
          pagination: {
            page: query.page || 1,
            limit: query.limit || 10,
            total,
            totalPages: Math.ceil(total / (query.limit || 10)),
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'ParamSetUseCase.findMany',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch parameter sets',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findById = async (id: string): Promise<IUsecaseResponse<any>> => {
    try {
      const paramSet = await this.repository.findById(id);

      if (!paramSet) {
        return {
          error: {
            message: `Parameter set with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      return { data: paramSet };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'ParamSetUseCase.findById',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch parameter set',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  publish = async (
    id: string,
    dto: PublishParamSetDto,
    userId: string,
    ipAddress?: string,
  ): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get ParamSet
      const paramSet = await this.repository.findById(id);
      if (!paramSet) {
        return {
          error: {
            message: `Parameter set with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Validasi status harus DRAFT
      if (paramSet.status !== ParamSetStatus.DRAFT) {
        return {
          error: {
            message: `Cannot publish parameter set. Current status: ${paramSet.status}. Must be DRAFT.`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Two-Person Rule: Creator tidak boleh sama dengan Publisher
      if (paramSet.createdBy === dto.publishedBy) {
        return {
          error: {
            message: 'Two-Person Rule violation: Creator cannot be the same as Publisher.',
            code: HttpStatus.FORBIDDEN,
          },
        };
      }

      // 4. Validasi No Back-Dating: Effective_From >= Now
      const now = new Date();
      if (paramSet.effectiveFrom < now) {
        return {
          error: {
            message: 'Cannot publish parameter set with Effective_From in the past.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 5. Validasi Grace No-Show
      const graceNoShowItem = paramSet.items.find((item: any) => item.name === ParamName.GRACE_NO_SHOW);
      if (graceNoShowItem) {
        const graceValue = parseInt(graceNoShowItem.value, 10);
        if (isNaN(graceValue) || graceValue < 5 || graceValue > 120) {
          return {
            error: {
              message: 'Grace No-Show value must be between 5 and 120 minutes.',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 6. Validasi Kategori Aktif
      const activeCategoriesItem = paramSet.items.find((item: any) => item.name === ParamName.ACTIVE_CATEGORIES);
      if (activeCategoriesItem) {
        try {
          const categories = JSON.parse(activeCategoriesItem.value);
          if (!Array.isArray(categories) || categories.length === 0) {
            return {
              error: {
                message: 'Active Categories must contain at least 1 category.',
                code: HttpStatus.BAD_REQUEST,
              },
            };
          }
        } catch (parseError) {
          return {
            error: {
              message: 'Active Categories value must be a valid JSON array.',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 7. Idempotensi: Check if identical to latest published version
      const latestPublished = await this.repository.findLatestPublished(paramSet.environment);
      if (latestPublished) {
        const isIdentical = this.compareParamSets(paramSet, latestPublished);
        if (isIdentical) {
          Logger.info(
            `Publish skipped: Identical to latest published version ${latestPublished.version}`,
            'ParamSetUseCase.publish',
          );
          return {
            error: {
              message: 'No changes detected. This parameter set is identical to the latest published version.',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 8. Retire previous published versions
      await this.repository.retirePreviousVersions(paramSet.version, paramSet.environment);

      // 9. Update status to PUBLISHED
      const publishedParamSet = await this.repository.updateStatus(id, ParamSetStatus.PUBLISHED, dto.publishedBy, now);

      // 10. Log audit trail
      await this.logAudit('PUBLISH', id, userId, paramSet, publishedParamSet, ipAddress, dto.notes);

      // 11. Broadcast event untuk konsumen (Scheduler No-Show, Tracking Engine, dll)
      try {
        await this.rabbitMQService.publish(RMQ.NOTIFICATION.exchange, 'param.published', {
          paramSetId: id,
          version: paramSet.version,
          environment: paramSet.environment,
          effectiveFrom: paramSet.effectiveFrom,
          effectiveTo: paramSet.effectiveTo,
          publishedAt: now,
          publishedBy: dto.publishedBy,
        });
        Logger.info(`Event broadcasted for published param set ${id}`, 'ParamSetUseCase.publish');
      } catch (eventError) {
        Logger.error(
          `Failed to broadcast event: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`,
          eventError instanceof Error ? eventError.stack : undefined,
          'ParamSetUseCase.publish - Event Broadcast',
        );
        // Don't fail publish if event broadcast fails
      }

      return { data: publishedParamSet };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in publish',
        error instanceof Error ? error.stack : undefined,
        'ParamSetUseCase.publish',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to publish parameter set',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  rollback = async (
    id: string,
    dto: RollbackParamSetDto,
    userId: string,
    ipAddress?: string,
  ): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get ParamSet
      const paramSet = await this.repository.findById(id);
      if (!paramSet) {
        return {
          error: {
            message: `Parameter set with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Validasi status harus PUBLISHED
      if (paramSet.status !== ParamSetStatus.PUBLISHED) {
        return {
          error: {
            message: `Cannot rollback parameter set. Current status: ${paramSet.status}. Must be PUBLISHED.`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Find previous published version
      const previousVersion = await this.repository.findMany({
        where: {
          environment: paramSet.environment,
          status: ParamSetStatus.PUBLISHED,
          version: { lt: paramSet.version },
        },
        orderBy: [{ version: 'desc' }],
        take: 1,
      });

      if (previousVersion.length === 0) {
        return {
          error: {
            message: 'No previous version found to rollback to.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      const previousParamSet = previousVersion[0];

      // 4. Retire current version
      await this.repository.updateStatus(id, ParamSetStatus.RETIRED, userId, new Date());

      // 5. Restore previous version to PUBLISHED
      const restoredParamSet = await this.repository.updateStatus(
        previousParamSet.id,
        ParamSetStatus.PUBLISHED,
        userId,
        new Date(),
      );

      // 6. Retire other published versions
      await this.repository.retirePreviousVersions(previousParamSet.version, paramSet.environment);

      // 7. Log audit trail
      await this.logAudit('ROLLBACK', id, userId, paramSet, restoredParamSet, ipAddress, dto.notes);

      // 8. Broadcast event
      try {
        await this.rabbitMQService.publish(RMQ.NOTIFICATION.exchange, 'param.rolled_back', {
          paramSetId: id,
          rolledBackToVersion: previousParamSet.version,
          environment: paramSet.environment,
          rolledBackAt: new Date(),
          rolledBackBy: userId,
        });
        Logger.info(`Event broadcasted for rolled back param set ${id}`, 'ParamSetUseCase.rollback');
      } catch (eventError) {
        Logger.error(
          `Failed to broadcast event: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`,
          eventError instanceof Error ? eventError.stack : undefined,
          'ParamSetUseCase.rollback - Event Broadcast',
        );
      }

      return { data: restoredParamSet };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in rollback',
        error instanceof Error ? error.stack : undefined,
        'ParamSetUseCase.rollback',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to rollback parameter set',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  /**
   * Compare two parameter sets to check if they are identical
   */
  private compareParamSets(paramSet1: any, paramSet2: any): boolean {
    // Compare items (ignore id, timestamps, etc.)
    if (paramSet1.items.length !== paramSet2.items.length) {
      return false;
    }

    const items1 = paramSet1.items
      .map((item: any) => ({
        name: item.name,
        group: item.group,
        value: item.value,
        unit: item.unit,
        scope: item.scope,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    const items2 = paramSet2.items
      .map((item: any) => ({
        name: item.name,
        group: item.group,
        value: item.value,
        unit: item.unit,
        scope: item.scope,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return JSON.stringify(items1) === JSON.stringify(items2);
  }

  /**
   * Log audit trail for parameter set changes
   */
  private async logAudit(
    action: string,
    entityId: string,
    userId: string,
    before: any,
    after: any,
    ipAddress?: string,
    notes?: string,
  ): Promise<void> {
    try {
      const beforeAfter: any = {};
      if (before) {
        beforeAfter.before = {
          status: before.status,
          version: before.version,
          effectiveFrom: before.effectiveFrom,
          effectiveTo: before.effectiveTo,
          items: before.items?.map((item: any) => ({
            name: item.name,
            group: item.group,
            value: item.value,
            unit: item.unit,
            scope: item.scope,
          })),
        };
      }
      if (after) {
        beforeAfter.after = {
          status: after.status,
          version: after.version,
          effectiveFrom: after.effectiveFrom,
          effectiveTo: after.effectiveTo,
          items: after.items?.map((item: any) => ({
            name: item.name,
            group: item.group,
            value: item.value,
            unit: item.unit,
            scope: item.scope,
          })),
        };
      }

      await this.db.auditLog.create({
        data: {
          userNik: userId,
          featureCode: 'FR-SET-006',
          action,
          entityType: 'ParamSet',
          entityId: parseInt(entityId) || 0, // AuditLog entityId is Int, but ParamSet.id is UUID
          beforeAfter: beforeAfter as Prisma.InputJsonValue,
          reasonCode: notes || null,
          // Note: IP address and timestamp are handled by AuditLog model
        },
      });
    } catch (error) {
      Logger.warn(
        `Failed to log audit trail: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ParamSetUseCase.logAudit',
      );
      // Don't throw - audit failure shouldn't block operations
    }
  }
}
