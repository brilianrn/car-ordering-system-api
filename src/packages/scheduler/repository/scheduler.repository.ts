import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { clientDb } from '../../../shared/utils';
import { globalLogger as AppLogger } from '../../../shared/utils/logger';
import {
  AuditSync,
  HRISSyncResult,
  SyncBatch,
  SyncBatchStatus,
  SyncOperationResult,
  SyncRunType,
  SyncSummary,
  HierarchyValidation,
  OrganizationSyncResult,
  EmployeeSyncResult,
  ApproverMappingResult,
  AuditEntityType,
  AuditAction,
} from '../domain/types';
import { SchedulerRepositoryPort } from '../ports/repository.port';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SchedulerRepository implements SchedulerRepositoryPort {
  private readonly logger = new Logger(SchedulerRepository.name);
  private readonly db: PrismaClient = clientDb;

  async createBatch(runType: SyncRunType, createdBy: string, totalRecords: number = 0): Promise<SyncBatch> {
    try {
      const batchId = uuidv4();
      const batch = await this.db.syncBatch.create({
        data: {
          id: batchId,
          runType,
          status: SyncBatchStatus.PENDING,
          totalRecords,
          processedRecords: 0,
          insertedRecords: 0,
          updatedRecords: 0,
          deactivatedRecords: 0,
          errorRecords: 0,
          createdBy,
        },
      });

      this.logger.log(`Created sync batch: ${batchId}`);
      return this.mapPrismaBatchToDomain(batch);
    } catch (error) {
      this.logger.error(`Failed to create sync batch: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateBatchStatus(
    batchId: string,
    status: SyncBatchStatus,
    processedRecords?: number,
    errorDetails?: string[],
    updatedBy?: string,
  ): Promise<SyncBatch> {
    try {
      const updateData: any = {
        status,
        updatedBy,
      };

      if (processedRecords !== undefined) {
        updateData.processedRecords = processedRecords;
      }

      if (errorDetails && errorDetails.length > 0) {
        updateData.errorDetails = errorDetails;
      }

      if (status === SyncBatchStatus.RUNNING) {
        // Don't set endTime for running status
      } else if ([SyncBatchStatus.DONE, SyncBatchStatus.FAIL, SyncBatchStatus.ROLLBACK].includes(status)) {
        updateData.endTime = new Date();
      }

      const batch = await this.db.syncBatch.update({
        where: { id: batchId },
        data: updateData,
      });

      this.logger.log(`Updated batch ${batchId} status to ${status}`);
      return this.mapPrismaBatchToDomain(batch);
    } catch (error) {
      this.logger.error(`Failed to update batch ${batchId} status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async completeBatch(
    batchId: string,
    processedRecords: number,
    insertedRecords: number,
    updatedRecords: number,
    deactivatedRecords: number,
    errorRecords: number,
    errorDetails?: string[],
    updatedBy?: string,
  ): Promise<SyncBatch> {
    try {
      const batch = await this.db.syncBatch.update({
        where: { id: batchId },
        data: {
          status: SyncBatchStatus.DONE,
          endTime: new Date(),
          processedRecords,
          insertedRecords,
          updatedRecords,
          deactivatedRecords,
          errorRecords,
          errorDetails: errorDetails || [],
          updatedBy,
        },
      });

      this.logger.log(
        `Completed batch ${batchId}: ${processedRecords} processed, ${insertedRecords} inserted, ${updatedRecords} updated, ${deactivatedRecords} deactivated, ${errorRecords} errors`,
      );
      return this.mapPrismaBatchToDomain(batch);
    } catch (error) {
      this.logger.error(`Failed to complete batch ${batchId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async failBatch(batchId: string, errorDetails: string[], updatedBy?: string): Promise<SyncBatch> {
    try {
      const batch = await this.db.syncBatch.update({
        where: { id: batchId },
        data: {
          status: SyncBatchStatus.FAIL,
          endTime: new Date(),
          errorDetails,
          updatedBy,
        },
      });

      this.logger.error(`Failed batch ${batchId} with errors: ${errorDetails.join(', ')}`);

      // Attempt rollback if enabled
      if (process.env.SCHEDULER_ENABLE_ROLLBACK === 'true') {
        try {
          await this.updateBatchToRollback(batchId, 'Automatic rollback due to sync failure', updatedBy || 'SYSTEM');
          this.logger.log(`Rollback completed for failed batch ${batchId}`);
        } catch (rollbackError) {
          this.logger.error(`Rollback failed for batch ${batchId}: ${rollbackError.message}`, rollbackError.stack);
        }
      }

      return this.mapPrismaBatchToDomain(batch);
    } catch (error) {
      this.logger.error(`Failed to mark batch ${batchId} as failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async rollbackBatch(batchId: string, reason: string, updatedBy?: string): Promise<SyncBatch> {
    try {
      this.logger.log(`Starting rollback for batch ${batchId}`);

      await this.db.$transaction(async (tx) => {
        // Get all audit logs for this batch
        const auditLogs = await tx.auditSync.findMany({
          where: { batchId },
          orderBy: { timestamp: 'desc' }, // Reverse order for rollback
        });

        // Rollback each operation in reverse order
        for (const log of auditLogs) {
          try {
            switch (log.entityType) {
              case 'ORGANIZATION_UNIT':
                await this.rollbackOrganizationUnit(tx, log);
                break;
              case 'EMPLOYEE':
                await this.rollbackEmployee(tx, log);
                break;
              case 'APPROVER_MAPPING':
                await this.rollbackApproverMapping(tx, log);
                break;
            }
          } catch (rollbackError) {
            this.logger.error(`Failed to rollback operation ${log.id}: ${rollbackError.message}`);
            // Continue with other rollbacks
          }
        }

        // Mark batch as rolled back
        await tx.syncBatch.update({
          where: { id: batchId },
          data: {
            status: SyncBatchStatus.ROLLBACK,
            rollbackReason: 'Automatic rollback due to batch failure',
            updatedBy,
          },
        });
      });

      this.logger.log(`Rollback completed for batch ${batchId}`);

      // Update batch status to rollback
      return await this.updateBatchToRollback(batchId, reason, updatedBy);
    } catch (error) {
      this.logger.error(`Rollback failed for batch ${batchId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async rollbackOrganizationUnit(tx: Prisma.TransactionClient, log: any): Promise<void> {
    switch (log.action) {
      case 'INSERT':
        // Delete the inserted organization unit
        await tx.organizationUnit.delete({
          where: { code: log.entityId },
        });
        break;
      case 'UPDATE':
        // Revert to old values
        if (log.oldValue) {
          await tx.organizationUnit.update({
            where: { code: log.entityId },
            data: log.oldValue,
          });
        }
        break;
      case 'DEACTIVATE':
        // Reactivate the organization unit
        await tx.organizationUnit.update({
          where: { code: log.entityId },
          data: {
            deletedAt: null,
            deletedBy: null,
          },
        });
        break;
    }
  }

  private async rollbackEmployee(tx: Prisma.TransactionClient, log: any): Promise<void> {
    switch (log.action) {
      case 'INSERT':
        // Delete the inserted employee
        await tx.employee.delete({
          where: { employeeId: log.entityId },
        });
        break;
      case 'UPDATE':
        // Revert to old values
        if (log.oldValue) {
          await tx.employee.update({
            where: { employeeId: log.entityId },
            data: log.oldValue,
          });
        }
        break;
      case 'DEACTIVATE':
        // Reactivate the employee
        await tx.employee.update({
          where: { employeeId: log.entityId },
          data: {
            deletedAt: null,
            deletedBy: null,
          },
        });
        break;
    }
  }

  private async rollbackApproverMapping(tx: Prisma.TransactionClient, log: any): Promise<void> {
    // Revert approver mapping to old value
    if (log.oldValue && log.oldValue.approverL1Id !== undefined) {
      await tx.employee.update({
        where: { employeeId: log.entityId },
        data: {
          approverL1Id: log.oldValue.approverL1Id,
        },
      });
    }
  }

  async updateBatchToRollback(batchId: string, reason: string, updatedBy?: string): Promise<SyncBatch> {
    try {
      const batch = await this.db.syncBatch.update({
        where: { id: batchId },
        data: {
          status: SyncBatchStatus.ROLLBACK,
          endTime: new Date(),
          rollbackReason: reason,
          updatedBy,
        },
      });

      this.logger.warn(`Rolled back batch ${batchId}: ${reason}`);
      return this.mapPrismaBatchToDomain(batch);
    } catch (error) {
      this.logger.error(`Failed to rollback batch ${batchId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getBatchById(batchId: string): Promise<SyncBatch | null> {
    try {
      const batch = await this.db.syncBatch.findUnique({
        where: { id: batchId },
      });

      return batch ? this.mapPrismaBatchToDomain(batch) : null;
    } catch (error) {
      this.logger.error(`Failed to get batch ${batchId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getLatestBatch(): Promise<SyncBatch | null> {
    try {
      const batch = await this.db.syncBatch.findFirst({
        orderBy: { startTime: 'desc' },
      });

      return batch ? this.mapPrismaBatchToDomain(batch) : null;
    } catch (error) {
      this.logger.error(`Failed to get latest batch: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getRunningBatch(): Promise<SyncBatch | null> {
    try {
      const batch = await this.db.syncBatch.findFirst({
        where: { status: SyncBatchStatus.RUNNING },
      });
      return batch ? this.mapPrismaBatchToDomain(batch) : null;
    } catch (error) {
      this.logger.error(`Failed to get running batch: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getBatches(limit: number = 50, offset: number = 0, status?: SyncBatchStatus): Promise<SyncBatch[]> {
    try {
      const where = status ? { status } : {};
      const batches = await this.db.syncBatch.findMany({
        where,
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset,
      });

      return batches.map(this.mapPrismaBatchToDomain);
    } catch (error) {
      this.logger.error(`Failed to get batches: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createAuditLog(auditLog: Omit<AuditSync, 'id' | 'timestamp'>): Promise<AuditSync> {
    try {
      const log = await this.db.auditSync.create({
        data: {
          id: uuidv4(),
          ...auditLog,
          timestamp: new Date(),
        },
      });

      return this.mapPrismaAuditToDomain(log);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createAuditLogs(auditLogs: Omit<AuditSync, 'id' | 'timestamp'>[]): Promise<AuditSync[]> {
    if (auditLogs.length === 0) {
      return [];
    }

    const createdLogs: AuditSync[] = [];
    const batchSize = 10; // Process in smaller batches to avoid transaction timeout

    try {
      // Process audit logs in batches
      for (let i = 0; i < auditLogs.length; i += batchSize) {
        const batch = auditLogs.slice(i, i + batchSize);

        try {
          const batchLogs = await this.db.auditSync.createMany({
            data: batch.map((log) => ({
              id: uuidv4(),
              ...log,
              timestamp: new Date(),
            })),
            skipDuplicates: true, // Skip if log already exists
          });

          this.logger.debug(`Created ${batchLogs.count} audit logs in batch ${Math.floor(i / batchSize) + 1}`);
        } catch (batchError) {
          this.logger.warn(`Failed to create audit log batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`);
          // Continue with next batch instead of failing completely
        }
      }

      // Return empty array since we're not retrieving the created logs for performance
      // In production, we might not need to return the actual log objects
      return createdLogs;
    } catch (error) {
      this.logger.error(`Failed to create audit logs: ${error.message}`, error.stack);
      // Don't throw error - audit logging failure shouldn't break the sync process
      return [];
    }
  }

  async getAuditLogsByBatch(batchId: string): Promise<AuditSync[]> {
    try {
      const logs = await this.db.auditSync.findMany({
        where: { batchId },
        orderBy: { timestamp: 'asc' },
      });

      return logs.map(this.mapPrismaAuditToDomain);
    } catch (error) {
      this.logger.error(`Failed to get audit logs for batch ${batchId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async syncOrganizationUnits(
    batchId: string,
    hrisData: HRISSyncResult,
    createdBy: string,
  ): Promise<{
    inserted: number;
    updated: number;
    deactivated: number;
    errors: Array<{ code: string; name: string; error: string }>;
  }> {
    const result = {
      inserted: 0,
      updated: 0,
      deactivated: 0,
      errors: [] as Array<{ code: string; name: string; error: string }>,
    };

    try {
      await this.db.$transaction(async (tx) => {
        const auditLogs: Omit<AuditSync, 'id' | 'timestamp'>[] = [];

        // Process each organization unit
        for (const hrisOrg of hrisData.organizations) {
          try {
            const existingOrg = await tx.organizationUnit.findUnique({
              where: { code: hrisOrg.code },
            });

            if (!existingOrg) {
              // Insert new organization unit
              await tx.organizationUnit.create({
                data: {
                  code: hrisOrg.code,
                  name: hrisOrg.name,
                  type: hrisOrg.type,
                  parentCode: hrisOrg.parentCode,
                  createdBy,
                },
              });

              auditLogs.push({
                batchId,
                entityType: AuditEntityType.ORGANIZATION_UNIT,
                entityId: hrisOrg.code,
                action: AuditAction.INSERT,
                newValue: hrisOrg,
                createdBy,
              });

              result.inserted++;
            } else {
              // Check if update is needed
              const needsUpdate =
                existingOrg.name !== hrisOrg.name ||
                existingOrg.parentCode !== hrisOrg.parentCode ||
                existingOrg.type !== hrisOrg.type;

              if (needsUpdate) {
                await tx.organizationUnit.update({
                  where: { code: hrisOrg.code },
                  data: {
                    name: hrisOrg.name,
                    type: hrisOrg.type,
                    parentCode: hrisOrg.parentCode,
                    updatedBy: createdBy,
                    updatedAt: new Date(),
                  },
                });

                auditLogs.push({
                  batchId,
                  entityType: AuditEntityType.ORGANIZATION_UNIT,
                  entityId: hrisOrg.code,
                  action: AuditAction.UPDATE,
                  oldValue: {
                    name: existingOrg.name,
                    parentCode: existingOrg.parentCode,
                    type: existingOrg.type,
                  },
                  newValue: hrisOrg,
                  createdBy,
                });

                result.updated++;
              }
            }
          } catch (error) {
            const errorMsg = `Failed to sync organization ${hrisOrg.code}: ${error.message}`;
            this.logger.error(errorMsg, error.stack);

            result.errors.push({
              code: hrisOrg.code,
              name: hrisOrg.name,
              error: error.message,
            });

            auditLogs.push({
              batchId,
              entityType: AuditEntityType.ORGANIZATION_UNIT,
              entityId: hrisOrg.code,
              action: AuditAction.ERROR,
              errorMessage: error.message,
              newValue: hrisOrg,
              createdBy,
            });
          }
        }

        // Deactivate organizations not in HRIS data (soft delete by setting deletedAt)
        const hrisCodes = hrisData.organizations.map((org) => org.code);
        const orgsToDeactivate = await tx.organizationUnit.findMany({
          where: {
            code: { notIn: hrisCodes },
            deletedAt: null,
          },
        });

        for (const org of orgsToDeactivate) {
          try {
            await tx.organizationUnit.update({
              where: { id: org.id },
              data: {
                deletedAt: new Date(),
                deletedBy: createdBy,
              },
            });

            auditLogs.push({
              batchId,
              entityType: AuditEntityType.ORGANIZATION_UNIT,
              entityId: org.code,
              action: AuditAction.DEACTIVATE,
              oldValue: { deletedAt: null },
              newValue: { deletedAt: new Date() },
              createdBy,
            });

            result.deactivated++;
          } catch (error) {
            const errorMsg = `Failed to deactivate organization ${org.code}: ${error.message}`;
            this.logger.error(errorMsg, error.stack);

            result.errors.push({
              code: org.code,
              name: org.name,
              error: error.message,
            });
          }
        }

        // Create audit logs (non-blocking to avoid transaction timeout)
        if (auditLogs.length > 0) {
          this.createAuditLogs(auditLogs).catch((error) => {
            this.logger.warn(`Failed to create organization audit logs: ${error.message}`);
          });
        }
      });

      this.logger.log(
        `Organization sync completed: ${result.inserted} inserted, ${result.updated} updated, ${result.deactivated} deactivated, ${result.errors.length} errors`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Organization sync failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateHierarchyCycles(organizationUnits: any[]): Promise<{
    isValid: boolean;
    cycles: Array<{ cycle: string[]; description: string }>;
    warnings: string[];
  }> {
    // Implementation of hierarchy cycle detection using DFS
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: Array<{ cycle: string[]; description: string }> = [];

    // Build graph
    for (const org of organizationUnits) {
      if (org.parentCode) {
        if (!graph.has(org.parentCode)) {
          graph.set(org.parentCode, []);
        }
        graph.get(org.parentCode)!.push(org.code);
      }
    }

    const detectCycle = (node: string, path: string[]): boolean => {
      if (recStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push({
          cycle: [...path.slice(cycleStart), node],
          description: `Hierarchy cycle detected: ${[...path.slice(cycleStart), node].join(' -> ')}`,
        });
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (detectCycle(neighbor, path)) {
          return true;
        }
      }

      path.pop();
      recStack.delete(node);
      return false;
    };

    // Check all nodes
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        detectCycle(node, []);
      }
    }

    return {
      isValid: cycles.length === 0,
      cycles,
      warnings: [], // No warnings for now, can be extended later
    };
  }

  async updateApproverMappings(
    batchId: string,
    createdBy: string,
  ): Promise<{
    updated: number;
    errors: Array<{ employeeId: string; error: string }>;
  }> {
    const result = {
      updated: 0,
      errors: [] as Array<{ employeeId: string; error: string }>,
    };

    try {
      await this.db.$transaction(async (tx) => {
        const auditLogs: Omit<AuditSync, 'id' | 'timestamp'>[] = [];

        // Get all active employees with their organization hierarchy
        const employees = await tx.employee.findMany({
          where: { isActive: true, deletedAt: null },
          include: {
            orgUnit: {
              include: {
                parent: {
                  include: {
                    parent: {
                      include: {
                        parent: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        for (const employee of employees) {
          try {
            // Find approver L1 by traversing up the hierarchy
            let currentOrg = employee.orgUnit;
            let approverL1Id: string | null = null;

            // Traverse up to 3 levels to find an approver
            for (let level = 0; level < 3 && currentOrg; level++) {
              // Find employees in current org unit who can be approvers
              const potentialApprovers = await tx.employee.findMany({
                where: {
                  orgUnitId: currentOrg.id,
                  isActive: true,
                  deletedAt: null,
                  employeeId: { not: employee.employeeId }, // Not self
                },
                take: 1, // Get first available approver
              });

              if (potentialApprovers.length > 0) {
                approverL1Id = potentialApprovers[0].employeeId;
                break;
              }

              currentOrg = currentOrg.parent as any;
              if (!currentOrg) break;
            }

            // Update approver mapping if changed
            if (employee.approverL1Id !== approverL1Id) {
              await tx.employee.update({
                where: { employeeId: employee.employeeId },
                data: {
                  approverL1Id,
                  updatedBy: createdBy,
                  updatedAt: new Date(),
                },
              });

              auditLogs.push({
                batchId,
                entityType: AuditEntityType.APPROVER_MAPPING,
                entityId: employee.employeeId,
                action: AuditAction.UPDATE,
                oldValue: { approverL1Id: employee.approverL1Id },
                newValue: { approverL1Id },
                createdBy,
              });

              result.updated++;
            }
          } catch (error) {
            const errorMsg = `Failed to update approver mapping for ${employee.employeeId}: ${error.message}`;
            this.logger.error(errorMsg, error.stack);

            result.errors.push({
              employeeId: employee.employeeId,
              error: error.message,
            });

            auditLogs.push({
              batchId,
              entityType: AuditEntityType.APPROVER_MAPPING,
              entityId: employee.employeeId,
              action: AuditAction.ERROR,
              errorMessage: error.message,
              createdBy,
            });
          }
        }

        // Create audit logs (non-blocking to avoid transaction timeout)
        if (auditLogs.length > 0) {
          this.createAuditLogs(auditLogs).catch((error) => {
            this.logger.warn(`Failed to create approver mapping audit logs: ${error.message}`);
          });
        }
      });

      this.logger.log(`Approver mapping update completed: ${result.updated} updated, ${result.errors.length} errors`);
      return result;
    } catch (error) {
      this.logger.error(`Approver mapping update failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async getOrgUnitId(tx: Prisma.TransactionClient, orgUnitCode: string): Promise<number> {
    const orgUnit = await tx.organizationUnit.findUnique({
      where: { code: orgUnitCode },
      select: { id: true },
    });

    if (!orgUnit) {
      throw new Error(`Organization unit ${orgUnitCode} not found`);
    }

    return orgUnit.id;
  }
  async syncEmployees(
    batchId: string,
    hrisEmployees: Array<{
      employeeId: string;
      fullName: string;
      email?: string;
      orgUnitCode: string;
      statusAktif: boolean;
      effectiveRoles?: string[];
      immediateSupervisor?: string | null;
      immediateManager?: string | null;
      position?: string;
      jobFamily?: string;
    }>,
    createdBy: string,
  ): Promise<{
    inserted: number;
    updated: number;
    deactivated: number;
    errors: Array<{ employeeId: string; error: string }>;
  }> {
    const result = {
      inserted: 0,
      updated: 0,
      deactivated: 0,
      errors: [] as Array<{ employeeId: string; error: string }>,
    };

    await this.db.$transaction(async (tx) => {
      // Process each HRIS employee
      for (const hrisEmployee of hrisEmployees) {
        try {
          // Check if employee exists
          const existingEmployee = await tx.employee.findUnique({
            where: { employeeId: hrisEmployee.employeeId },
          });

          if (existingEmployee) {
            // Update existing employee
            const oldValue = {
              fullName: existingEmployee.fullName,
              email: existingEmployee.email,
              orgUnitId: existingEmployee.orgUnitId,
              isActive: existingEmployee.isActive,
              effectiveRoles: existingEmployee.effectiveRoles,
            };

            await tx.employee.update({
              where: { employeeId: hrisEmployee.employeeId },
              data: {
                fullName: hrisEmployee.fullName,
                email: hrisEmployee.email || undefined,
                orgUnitId: await this.getOrgUnitId(tx, hrisEmployee.orgUnitCode),
                isActive: hrisEmployee.statusAktif,
                effectiveRoles: this.mapStringRolesToEnum(hrisEmployee.effectiveRoles || []),
                // position: hrisEmployee.position || null, // Commented out until Prisma schema is updated
                // jobFamily: hrisEmployee.jobFamily || null, // Commented out until Prisma schema is updated
                // immediateSupervisor: hrisEmployee.immediateSupervisor, // Commented out until Prisma schema is updated
                // immediateManager: hrisEmployee.immediateManager, // Commented out until Prisma schema is updated
                updatedBy: createdBy,
                updatedAt: new Date(),
              },
            });

            await this.createAuditLog({
              batchId,
              entityType: AuditEntityType.EMPLOYEE,
              entityId: hrisEmployee.employeeId,
              action: AuditAction.UPDATE,
              oldValue,
              newValue: hrisEmployee,
              createdBy,
            });

            result.updated++;
          } else {
            // Insert new employee
            await tx.employee.create({
              data: {
                employeeId: hrisEmployee.employeeId,
                fullName: hrisEmployee.fullName,
                email: hrisEmployee.email || `${hrisEmployee.employeeId}@company.com`,
                orgUnitId: await this.getOrgUnitId(tx, hrisEmployee.orgUnitCode),
                isActive: hrisEmployee.statusAktif,
                effectiveFrom: new Date(),
                effectiveRoles: this.mapStringRolesToEnum(hrisEmployee.effectiveRoles || []),
                // position: hrisEmployee.position || null, // Commented out until Prisma schema is updated
                // jobFamily: hrisEmployee.jobFamily || null, // Commented out until Prisma schema is updated
                // immediateSupervisor: hrisEmployee.immediateSupervisor, // Commented out until Prisma schema is updated
                // immediateManager: hrisEmployee.immediateManager, // Commented out until Prisma schema is updated
                createdBy,
                updatedBy: createdBy,
              },
            });

            await this.createAuditLog({
              batchId,
              entityType: AuditEntityType.EMPLOYEE,
              entityId: hrisEmployee.employeeId,
              action: AuditAction.INSERT,
              newValue: hrisEmployee,
              createdBy,
            });

            result.inserted++;
          }
        } catch (error) {
          this.logger.error(`Failed to sync employee ${hrisEmployee.employeeId}: ${error.message}`);
          result.errors.push({
            employeeId: hrisEmployee.employeeId,
            error: error.message,
          });
        }
      }

      // Deactivate employees not in HRIS data
      const hrisEmployeeIds = hrisEmployees.map((emp) => emp.employeeId);
      const employeesToDeactivate = await tx.employee.findMany({
        where: {
          isActive: true,
          employeeId: {
            notIn: hrisEmployeeIds,
          },
        },
      });

      for (const employee of employeesToDeactivate) {
        try {
          await tx.employee.update({
            where: { employeeId: employee.employeeId },
            data: {
              isActive: false,
              updatedBy: createdBy,
              updatedAt: new Date(),
            },
          });

          await this.createAuditLog({
            batchId,
            entityType: AuditEntityType.EMPLOYEE,
            entityId: employee.employeeId,
            action: AuditAction.DEACTIVATE,
            oldValue: { isActive: true },
            newValue: { isActive: false },
            createdBy,
          });

          result.deactivated++;
        } catch (error) {
          this.logger.error(`Failed to deactivate employee ${employee.employeeId}: ${error.message}`);
          result.errors.push({
            employeeId: employee.employeeId,
            error: `Deactivation failed: ${error.message}`,
          });
        }
      }
    });

    this.logger.log(
      `Employee sync result: ${result.inserted} inserted, ${result.updated} updated, ${result.deactivated} deactivated, ${result.errors.length} errors`,
    );
    return result;
  }

  async deactivateInactiveEmployees(
    batchId: string,
    createdBy: string,
  ): Promise<{
    deactivated: number;
    errors: Array<{ employeeId: string; error: string }>;
  }> {
    try {
      const result = {
        deactivated: 0,
        errors: [] as Array<{ employeeId: string; error: string }>,
      };

      // Get all active employees that are no longer in HRIS or marked inactive
      // This would typically compare with HRIS data, but for now we'll implement
      // a placeholder that deactivates employees based on some criteria
      // In a real implementation, this would compare with the latest HRIS sync

      await this.db.$transaction(async (tx) => {
        // Find employees to deactivate (placeholder logic)
        // In real implementation, this would check against HRIS data
        const employeesToDeactivate = await tx.employee.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            // Add logic to identify inactive employees from HRIS
          },
        });

        for (const employee of employeesToDeactivate) {
          try {
            await tx.employee.update({
              where: { employeeId: employee.employeeId },
              data: {
                isActive: false,
                updatedBy: createdBy,
                updatedAt: new Date(),
              },
            });

            // Create audit log
            await this.createAuditLog({
              batchId,
              entityType: AuditEntityType.EMPLOYEE,
              entityId: employee.employeeId,
              action: AuditAction.DEACTIVATE,
              oldValue: { isActive: true },
              newValue: { isActive: false },
              createdBy,
            });

            result.deactivated++;
          } catch (error) {
            result.errors.push({
              employeeId: employee.employeeId,
              error: error.message,
            });
          }
        }
      });

      return result;
    } catch (error) {
      this.logger.error(`Employee deactivation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private mapPrismaBatchToDomain(prismaBatch: any): SyncBatch {
    return {
      id: prismaBatch.id,
      runType: prismaBatch.runType,
      startTime: prismaBatch.startTime,
      endTime: prismaBatch.endTime,
      status: prismaBatch.status,
      totalRecords: prismaBatch.totalRecords,
      processedRecords: prismaBatch.processedRecords,
      insertedRecords: prismaBatch.insertedRecords,
      updatedRecords: prismaBatch.updatedRecords,
      deactivatedRecords: prismaBatch.deactivatedRecords,
      errorRecords: prismaBatch.errorRecords,
      errorDetails: prismaBatch.errorDetails,
      createdBy: prismaBatch.createdBy,
      updatedBy: prismaBatch.updatedBy,
      rollbackReason: prismaBatch.rollbackReason,
    };
  }

  private mapPrismaAuditToDomain(prismaAudit: any): AuditSync {
    return {
      id: prismaAudit.id,
      batchId: prismaAudit.batchId,
      entityType: prismaAudit.entityType,
      entityId: prismaAudit.entityId,
      action: prismaAudit.action,
      oldValue: prismaAudit.oldValue,
      newValue: prismaAudit.newValue,
      errorMessage: prismaAudit.errorMessage,
      timestamp: prismaAudit.timestamp,
      createdBy: prismaAudit.createdBy,
    };
  }

  async getSyncSummary(): Promise<SyncSummary> {
    // Implementation would go here - simplified placeholder
    return {
      batchId: 'latest',
      status: SyncBatchStatus.DONE,
      duration: 0,
      totalRecords: 0,
      processedRecords: 0,
      successRecords: 0,
      errorRecords: 0,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
    };
  }

  async getSyncStatistics(days: number): Promise<{
    totalBatches: number;
    successRate: number;
    averageDuration: number;
    errorRate: number;
  }> {
    // Implementation would go here - simplified placeholder
    return {
      totalBatches: 0,
      successRate: 0,
      averageDuration: 0,
      errorRate: 0,
    };
  }

  async cleanupOldAuditLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.auditSync.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async getLastSyncTimestamp(): Promise<Date | null> {
    const lastBatch = await this.db.syncBatch.findFirst({
      where: {
        status: SyncBatchStatus.DONE,
      },
      orderBy: {
        endTime: 'desc',
      },
      select: {
        endTime: true,
      },
    });

    return lastBatch?.endTime || null;
  }

  private mapStringRolesToEnum(roles: string[]): any[] {
    // Map string roles to enum values, filter out invalid ones
    const validRoles = ['USER', 'LEADER', 'GA', 'DRIVER', 'FINANCE', 'MANAGEMENT', 'ADMIN', 'AUDITOR'];
    return roles.filter((role) => validRoles.includes(role.toUpperCase())).map((role) => role.toUpperCase());
  }
}
