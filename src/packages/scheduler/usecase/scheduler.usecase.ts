import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  AuditSync,
  HRISClientConfig,
  HRISSyncResult,
  HierarchyCycleError,
  SchedulerConfig,
  SchedulerContext,
  SyncBatch,
  SyncBatchStatus,
  SyncOperationResult,
  SyncRunType,
  SyncSummary,
} from '../domain/types';
import { SyncSummaryDto, SyncTriggerDto } from '../dto';
import { SchedulerRepositoryPort } from '../ports/repository.port';
import { SchedulerUsecasePort } from '../ports/usecase.port';
import { HRISClientService } from '../services/hris-client.service';

@Injectable()
export class SchedulerService implements SchedulerUsecasePort {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly schedulerConfig: SchedulerConfig;
  private readonly hrisConfig: HRISClientConfig;

  constructor(
    @Inject('SchedulerRepositoryPort')
    private readonly repository: SchedulerRepositoryPort,
    @Inject('HRISClientService')
    private readonly hrisClient: HRISClientService,
  ) {
    // Initialize configurations from environment
    this.schedulerConfig = {
      // cronExpression: process.env.SCHEDULER_CRON_EXPRESSION || '0 1 * * *', // 01:00 AM WIB
      cronExpression: '6 10 * * *',
      timezone: process.env.SCHEDULER_TIMEZONE || 'Asia/Jakarta', // UTC+7
      retryAttempts: parseInt(process.env.SCHEDULER_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.SCHEDULER_RETRY_DELAY || '5000'),
      batchTimeout: parseInt(process.env.SCHEDULER_BATCH_TIMEOUT || '3600000'), // 1 hour
      enableRollback: process.env.SCHEDULER_ENABLE_ROLLBACK === 'true',
    };

    this.hrisConfig = {
      baseUrl: process.env.HRIS_API_BASE_URL || '',
      apiKey: process.env.HRIS_API_KEY || '',
      timeout: parseInt(process.env.HRIS_API_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.HRIS_API_RETRY_ATTEMPTS || '3'),
      rateLimit: {
        requests: parseInt(process.env.HRIS_RATE_LIMIT_REQUESTS || '100'),
        period: parseInt(process.env.HRIS_RATE_LIMIT_PERIOD || '60000'),
      },
    };
  }

  async triggerSync(dto: SyncTriggerDto, userId: string): Promise<IUsecaseResponse<SyncOperationResult>> {
    try {
      this.logger.log(`Manual sync triggered by ${userId}, type: ${dto.runType}`);

      // Use UTC+7 timestamp for all operations
      const startTime = this.getCurrentWIBTime();

      const context: SchedulerContext = {
        batchId: '',
        startTime,
        userId,
        config: this.schedulerConfig,
        hrisConfig: this.hrisConfig,
      };

      const result = await this.executeSync(dto.runType || SyncRunType.DELTA, context);

      return {
        data: result,
        error: undefined,
      };
    } catch (error) {
      this.logger.error(`Manual sync failed: ${error.message}`, error.stack);
      return {
        data: undefined,
        error: {
          message: error.message,
          code: error.code || 500,
        },
      };
    }
  }

  async executeScheduledSync(): Promise<SyncOperationResult> {
    // Check for running batches to prevent overlapping executions
    const runningBatch = await this.repository.getRunningBatch();
    if (runningBatch) {
      this.logger.warn(`Another sync batch is already running: ${runningBatch.id}. Skipping scheduled sync.`);
      throw new Error(`Sync already in progress: batch ${runningBatch.id}`);
    }

    // Use UTC+7 timestamp for all operations
    const startTime = this.getCurrentWIBTime();

    const context: SchedulerContext = {
      batchId: '',
      startTime,
      userId: 'SYSTEM_SCHEDULER',
      config: this.schedulerConfig,
      hrisConfig: this.hrisConfig,
    };

    this.logger.log('Executing scheduled sync');
    return await this.executeSync(SyncRunType.DELTA, context);
  }

  private getCurrentWIBTime(): Date {
    // Return current time in WIB (UTC+7)
    // Use proper timezone conversion instead of simple offset
    const now = new Date();
    // Create a date string in WIB timezone and parse it back
    const wibTimeString =
      now
        .toLocaleString('sv-SE', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        .replace(' ', 'T') + '.000Z';
    return new Date(wibTimeString);
  }

  private async executeSync(runType: SyncRunType, context: SchedulerContext): Promise<SyncOperationResult> {
    let batch: SyncBatch;
    const auditLogs: AuditSync[] = [];
    const startTime = Date.now();

    try {
      // 1. Create sync batch
      batch = await this.repository.createBatch(runType, context.userId);
      context.batchId = batch.id;

      this.logger.log(`Started sync batch ${batch.id}`);

      // 2. Update batch status to running
      batch = await this.repository.updateBatchStatus(
        batch.id,
        SyncBatchStatus.RUNNING,
        undefined,
        undefined,
        context.userId,
      );

      // 3. Get data from HRIS
      const lastSync = await this.repository.getLastSyncTimestamp();
      const hrisData = await this.fetchHRISData(lastSync || undefined);

      // 4. Validate hierarchy cycles and sync organization units
      let hierarchyValidation: { isValid: boolean; cycles: any[]; warnings: string[] } = {
        isValid: true,
        cycles: [],
        warnings: [],
      };
      let orgSyncResult: { inserted: number; updated: number; deactivated: number; errors: any[] } = {
        inserted: 0,
        updated: 0,
        deactivated: 0,
        errors: [],
      };

      try {
        hierarchyValidation = await this.repository.validateHierarchyCycles(hrisData.organizations);
        if (!hierarchyValidation.isValid) {
          throw new HierarchyCycleError(hierarchyValidation.cycles);
        }
        hierarchyValidation.warnings = [];

        // 5. Sync organization units
        orgSyncResult = await this.repository.syncOrganizationUnits(batch.id, hrisData, context.userId);
        this.logger.log(
          `Organization sync completed: ${orgSyncResult.inserted} inserted, ${orgSyncResult.updated} updated, ${orgSyncResult.deactivated} deactivated`,
        );
      } catch (orgError) {
        this.logger.error(`Organization sync failed: ${orgError.message}`, orgError.stack);
        orgSyncResult.errors.push({
          code: 'ORG_SYNC_FAILED',
          name: 'Organization Sync',
          error: orgError.message,
        });
        hierarchyValidation = {
          isValid: false,
          cycles: [],
          warnings: [`Organization sync failed: ${orgError.message}`],
        };
      }

      // 6. Update approver mappings (only if org sync succeeded)
      let approverResult: { updated: number; errors: any[] } = { updated: 0, errors: [] };
      if (hierarchyValidation.isValid) {
        try {
          approverResult = await this.repository.updateApproverMappings(batch.id, context.userId);
          this.logger.log(`Approver mapping completed: ${approverResult.updated} updated`);
        } catch (approverError) {
          this.logger.error(`Approver mapping failed: ${approverError.message}`, approverError.stack);
          approverResult.errors.push({
            employeeId: 'SYSTEM',
            error: approverError.message,
          });
        }
      } else {
        this.logger.warn('Skipping approver mapping due to organization sync failure');
        approverResult.errors.push({
          employeeId: 'SYSTEM',
          error: 'Skipped due to organization sync failure',
        });
      }

      // 7. Sync employees (only if valid HRIS data is available)
      let employeeResult: { inserted: number; updated: number; deactivated: number; errors: any[] } = {
        inserted: 0,
        updated: 0,
        deactivated: 0,
        errors: [],
      };

      if (hrisData.isValidData && hrisData.employees.length > 0) {
        try {
          employeeResult = await this.repository.syncEmployees(batch.id, hrisData.employees, context.userId);
          this.logger.log(
            `Employee sync completed: ${employeeResult.inserted} inserted, ${employeeResult.updated} updated, ${employeeResult.deactivated} deactivated`,
          );
        } catch (employeeError) {
          this.logger.error(`Employee sync failed: ${employeeError.message}`, employeeError.stack);
          employeeResult.errors.push({
            employeeId: 'SYSTEM',
            error: employeeError.message,
          });
        }
      } else if (!hrisData.isValidData) {
        this.logger.warn('Skipping employee sync - invalid HRIS data (API failure fallback)');
        employeeResult.errors.push({
          employeeId: 'SYSTEM',
          error: 'Skipped - HRIS API failure (fallback mode)',
        });
      } else {
        this.logger.warn('Skipping employee sync - no employee data available from HRIS');
        employeeResult.errors.push({
          employeeId: 'SYSTEM',
          error: 'Skipped - no employee data available',
        });
      }

      // 8. Determine batch success status
      const totalErrors = orgSyncResult.errors.length + approverResult.errors.length + employeeResult.errors.length;
      const actualProcessedRecords =
        orgSyncResult.inserted +
        orgSyncResult.updated +
        orgSyncResult.deactivated +
        approverResult.updated +
        employeeResult.inserted +
        employeeResult.updated +
        employeeResult.deactivated;

      this.logger.log(`Sync summary: ${totalErrors} errors, ${actualProcessedRecords} records processed`);
      this.logger.log(
        `Organization sync: ${orgSyncResult.inserted} inserted, ${orgSyncResult.updated} updated, ${orgSyncResult.deactivated} deactivated`,
      );
      this.logger.log(`Approver mapping: ${approverResult.updated} updated`);
      this.logger.log(
        `Employee sync: ${employeeResult.inserted} inserted, ${employeeResult.updated} updated, ${employeeResult.deactivated} deactivated`,
      );

      // Complete the batch
      const finalBatch = await this.repository.completeBatch(
        batch.id,
        actualProcessedRecords, // Use actual processed count instead of HRIS total
        orgSyncResult.inserted,
        orgSyncResult.updated,
        orgSyncResult.deactivated,
        totalErrors,
        this.compileErrorDetails(orgSyncResult.errors, approverResult.errors, employeeResult.errors),
        context.userId,
      );

      // 9. Create summary
      const summary: SyncSummary = {
        batchId: finalBatch.id,
        status: finalBatch.status,
        duration: finalBatch.endTime!.getTime() - finalBatch.startTime.getTime(),
        totalRecords: finalBatch.totalRecords,
        processedRecords: finalBatch.processedRecords,
        successRecords: finalBatch.insertedRecords + finalBatch.updatedRecords + finalBatch.deactivatedRecords,
        errorRecords: finalBatch.errorRecords,
        errors: finalBatch.errorDetails || [],
        startTime: finalBatch.startTime,
        endTime: finalBatch.endTime!,
      };

      const result: SyncOperationResult = {
        batch: finalBatch,
        organizations: {
          inserted: orgSyncResult.inserted,
          updated: orgSyncResult.updated,
          deactivated: orgSyncResult.deactivated,
          errors: orgSyncResult.errors,
        },
        employees: {
          inserted: employeeResult.deactivated, // Note: This is actually deactivated count for now
          updated: 0,
          deactivated: employeeResult.deactivated,
          errors: employeeResult.errors,
        },
        approverMappings: {
          updated: approverResult.updated,
          errors: approverResult.errors,
        },
        hierarchyValidation,
        summary,
        auditLogs,
      };

      this.logger.log(`Sync batch ${batch.id} completed successfully`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Sync batch ${context.batchId} failed after ${duration}ms: ${error.message}`, error.stack);

      // Check if operation timed out
      if (duration >= this.schedulerConfig.batchTimeout) {
        this.logger.error(`Sync operation timed out after ${this.schedulerConfig.batchTimeout}ms`);
      }

      // Try to update batch status to failed
      try {
        if (context.batchId) {
          const errorMessages = [
            `Sync failed: ${error.message}`,
            `Duration: ${duration}ms`,
            `Timeout: ${duration >= this.schedulerConfig.batchTimeout ? 'YES' : 'NO'}`,
          ];
          await this.repository.failBatch(context.batchId, errorMessages, context.userId);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update batch status to failed: ${updateError.message}`);
      }

      // Re-throw the original error
      throw error;
    }
  }

  private async fetchHRISData(lastSync?: Date): Promise<HRISSyncResult> {
    try {
      this.logger.log(`Fetching HRIS data, last sync: ${lastSync?.toISOString() || 'never'}`);
      const data = await this.hrisClient.getOrganizationUnits(lastSync);

      // Validate HRIS data
      if (!data || !Array.isArray(data.organizations) || !Array.isArray(data.employees)) {
        throw new Error('Invalid HRIS data structure received');
      }

      if (data.organizations.length === 0 && data.employees.length === 0) {
        this.logger.warn('HRIS returned no data - this might indicate an issue with the data source');
      }

      // Check for data quality issues
      const invalidOrgs = data.organizations.filter(
        (org) => !org.code || !org.name || typeof org.statusAktif !== 'boolean',
      );

      if (invalidOrgs.length > 0) {
        this.logger.warn(`${invalidOrgs.length} organization records have missing or invalid required fields`);
      }

      const invalidEmployees = data.employees.filter(
        (emp) => !emp.employeeId || !emp.fullName || !emp.orgUnitCode || typeof emp.statusAktif !== 'boolean',
      );

      if (invalidEmployees.length > 0) {
        this.logger.warn(`${invalidEmployees.length} employee records have missing or invalid required fields`);
      }

      this.logger.log(
        `Fetched ${data.totalRecords} records from HRIS (${data.organizations.length} orgs, ${data.employees.length} employees)`,
      );
      return {
        ...data,
        isValidData: true,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch HRIS data: ${error.message}`, error.stack);

      // For development/testing, provide fallback empty data instead of failing completely
      // This allows employee sync to continue even if HRIS is down
      if (process.env.NODE_ENV !== 'production' || process.env.SCHEDULER_ALLOW_EMPTY_HRIS_DATA === 'true') {
        this.logger.warn(
          'Using empty HRIS data fallback - employee sync will continue but organization sync will be skipped',
        );
        return {
          organizations: [],
          employees: [],
          totalRecords: 0,
          lastSyncTimestamp: new Date(),
          isValidData: false,
        };
      }

      throw new Error(`HRIS data fetch failed: ${error.message}`);
    }
  }

  private compileErrorDetails(
    orgErrors: Array<{ code: string; name: string; error: string }>,
    approverErrors: Array<{ employeeId: string; error: string }>,
    employeeErrors: Array<{ employeeId: string; error: string }>,
  ): string[] {
    const errors: string[] = [];

    orgErrors.forEach((err) => {
      errors.push(`ORG ${err.code} (${err.name}): ${err.error}`);
    });

    approverErrors.forEach((err) => {
      errors.push(`APPROVER ${err.employeeId}: ${err.error}`);
    });

    employeeErrors.forEach((err) => {
      errors.push(`EMPLOYEE ${err.employeeId}: ${err.error}`);
    });

    return errors;
  }

  async getSyncSummary(): Promise<IUsecaseResponse<SyncSummary>> {
    try {
      const summary = await this.repository.getSyncSummary();
      return {
        data: summary,
        error: undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync summary: ${error.message}`, error.stack);
      return {
        data: undefined,
        error: {
          message: error.message,
          code: 500,
        },
      };
    }
  }

  async getSyncStatus(): Promise<IUsecaseResponse<SyncSummaryDto>> {
    try {
      const latestBatch = await this.repository.getLatestBatch();
      const statistics = await this.repository.getSyncStatistics(30);

      const summary: SyncSummaryDto = {
        lastSyncBatch: latestBatch
          ? {
              id: latestBatch.id,
              runType: latestBatch.runType,
              startTime: latestBatch.startTime,
              endTime: latestBatch.endTime,
              status: latestBatch.status,
              totalRecords: latestBatch.totalRecords,
              processedRecords: latestBatch.processedRecords,
              insertedRecords: latestBatch.insertedRecords,
              updatedRecords: latestBatch.updatedRecords,
              deactivatedRecords: latestBatch.deactivatedRecords,
              errorRecords: latestBatch.errorRecords,
              errorDetails: latestBatch.errorDetails,
              createdBy: latestBatch.createdBy,
              updatedBy: latestBatch.updatedBy,
              rollbackReason: latestBatch.rollbackReason,
              duration: latestBatch.endTime
                ? latestBatch.endTime.getTime() - latestBatch.startTime.getTime()
                : undefined,
            }
          : undefined,
        totalBatches: statistics.totalBatches,
        successRate: statistics.successRate,
        averageDuration: statistics.averageDuration,
        lastSyncStatus: latestBatch?.status || SyncBatchStatus.PENDING,
        nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
      };

      return {
        data: summary,
        error: undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync status: ${error.message}`, error.stack);
      return {
        data: undefined,
        error: {
          message: error.message,
          code: 500,
        },
      };
    }
  }

  async getSyncHistory(limit?: number, offset?: number): Promise<IUsecaseResponse<SyncBatch[]>> {
    try {
      const batches = await this.repository.getBatches(limit, offset);
      return {
        data: batches,
        error: undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync history: ${error.message}`, error.stack);
      return {
        data: undefined,
        error: {
          message: error.message,
          code: 500,
        },
      };
    }
  }

  async cleanupOldData(retentionDays?: number): Promise<IUsecaseResponse<{ deletedRecords: number }>> {
    try {
      const days = retentionDays || 1825;
      const deletedRecords = await this.repository.cleanupOldAuditLogs(days);
      return {
        data: { deletedRecords },
        error: undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to cleanup old data: ${error.message}`, error.stack);
      return {
        data: undefined,
        error: {
          message: error.message,
          code: 500,
        },
      };
    }
  }

  async rollbackBatch(batchId: string, userId: string): Promise<IUsecaseResponse<boolean>> {
    try {
      await this.repository.rollbackBatch(batchId, 'Manual rollback requested', userId);
      return {
        data: true,
        error: undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to rollback batch ${batchId}: ${error.message}`, error.stack);
      return {
        data: false,
        error: {
          message: error.message,
          code: 500,
        },
      };
    }
  }

  private async processInBatches<T>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<void>,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processor(batch);
    }
  }
}
