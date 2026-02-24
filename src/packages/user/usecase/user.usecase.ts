import { globalLogger as Logger } from '@/shared/utils/logger';
import { IPaginationResponse, IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Employee } from '@prisma/client';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import * as https from 'https';
import { ListUserQueryDto } from '../dto/list-user-query.dto';
import { UpdateRolesDto } from '../dto/update-roles.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserRepositoryPort } from '../ports/repository.port';
import {
  IAssignLeadersResponse,
  ISyncHrResponse,
  IUpdateUserResponse,
  IUploadL1FailedRow,
  IUploadL1Response,
  UserUsecasePort,
} from '../ports/usecase.port';

const HRIS_BASE_URL = 'https://msa-be.dharmagroup.co.id';
const HRIS_COMPANY = 'DPM';
const EMAIL_DOMAIN = '@dharma.cos.com';
const BCRYPT_ROUNDS = 10;
const HTTP_TIMEOUT = 60_000; // 60 seconds per spec
const MAX_RETRIES = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  params: Record<string, string>,
  apiKey: string,
  retries = MAX_RETRIES,
): Promise<any> {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false }); // self-signed certs in dev
  let lastError: unknown;

  // Masked log as requested by user
  const maskedKey = apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined';
  Logger.debug(`[HRIS Sync] Sending Request to ${url} with x-api-key: ${maskedKey}`, 'UserUseCase.fetchWithRetry');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        params,
        timeout: HTTP_TIMEOUT,
        httpsAgent,
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (err) {
      lastError = err;

      // Explicit 401 Handling
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        throw new Error('Failed to sync: Invalid or Missing MSA API Key');
      }

      const wait = attempt * 1_000; // 1s, 2s, 3s
      Logger.warn(
        `HRIS fetch attempt ${attempt}/${retries} failed: ${err instanceof Error ? err.message : String(err)}. Retrying in ${wait}ms…`,
        'UserUseCase.fetchWithRetry',
      );
      if (attempt < retries) await sleep(wait);
    }
  }

  throw lastError;
}

import { ConfigService } from '@nestjs/config';

// ─── UseCase ─────────────────────────────────────────────────────────────────

@Injectable()
export class UserUseCase implements UserUsecasePort {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly repository: UserRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  // ─── Existing methods ───────────────────────────────────────────────────────

  async findAll(query: ListUserQueryDto): Promise<IUsecaseResponse<IPaginationResponse<Employee>>> {
    try {
      const result = await this.repository.findAll(query);
      return { data: result };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during findAll',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.findAll',
      );
      return {
        error: { message: 'An error occurred while fetching users', code: HttpStatus.INTERNAL_SERVER_ERROR },
      };
    }
  }

  async findOne(employeeId: string): Promise<IUsecaseResponse<Employee>> {
    try {
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        return { error: { message: 'User not found', code: HttpStatus.NOT_FOUND } };
      }
      return { data: employee };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during findOne',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.findOne',
      );
      return {
        error: { message: 'An error occurred while fetching user', code: HttpStatus.INTERNAL_SERVER_ERROR },
      };
    }
  }

  async updateUser(employeeId: string, dto: UpdateUserDto): Promise<IUsecaseResponse<IUpdateUserResponse>> {
    try {
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        return { error: { message: 'Employee not found', code: HttpStatus.NOT_FOUND } };
      }

      if (dto.approverL1Id) {
        const supervisor = await this.repository.findEmployeeById(dto.approverL1Id);
        if (!supervisor) {
          return { error: { message: 'Supervisor not found', code: HttpStatus.BAD_REQUEST } };
        }
      }

      await this.repository.updateEmployee(employeeId, {
        roles: dto.roles,
        approverL1Id: dto.approverL1Id,
        orgUnitId: dto.orgUnitId,
      });

      Logger.info(`Employee ${employeeId} updated successfully`, 'UserUseCase.updateUser');
      return { data: { message: 'User updated successfully', employeeId } };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during user update',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.updateUser',
      );
      return {
        error: { message: 'An error occurred while updating user', code: HttpStatus.INTERNAL_SERVER_ERROR },
      };
    }
  }

  async updateRoles(
    employeeId: string,
    dto: UpdateRolesDto,
    actorId: string,
  ): Promise<IUsecaseResponse<IUpdateUserResponse>> {
    try {
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        return { error: { message: 'Employee not found', code: HttpStatus.NOT_FOUND } };
      }

      if (dto.roles.includes('DRIVER')) {
        if (!employee.driverProfile) {
          await this.repository.createDriverProfile({
            employeeId: employee.employeeId,
            fullName: employee.fullName,
            driverCode: `DRV-${employee.employeeId}`,
            simNumber: employee.employeeId,
            simExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            plantLocation: employee.orgUnit?.name || 'Head Office',
            createdBy: actorId,
          });
          Logger.info(`Auto-created driver profile for ${employeeId}`, 'UserUseCase.updateRoles');
        }
      }

      await this.repository.updateEmployee(employeeId, { roles: dto.roles });
      await this.repository.upsertUserRoles(employeeId, dto.roles, actorId);

      await this.repository.createAuditLog({
        userNik: actorId,
        featureCode: 'USER_MANAGEMENT',
        action: 'UPDATE_ROLES',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        beforeAfter: { roles_before: employee.effectiveRoles, roles_after: dto.roles },
        reasonCode: 'MANUAL_UPDATE',
      });

      return { data: { message: 'User roles updated successfully', employeeId } };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during role update',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.updateRoles',
      );
      return {
        error: { message: 'An error occurred while updating roles', code: HttpStatus.INTERNAL_SERVER_ERROR },
      };
    }
  }

  async remove(employeeId: string, actorId: string): Promise<IUsecaseResponse<void>> {
    try {
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        return { error: { message: 'Employee not found', code: HttpStatus.NOT_FOUND } };
      }

      await this.repository.softDelete(employeeId, actorId);
      await this.repository.createAuditLog({
        userNik: actorId,
        featureCode: 'USER_MANAGEMENT',
        action: 'DELETE_USER',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        reasonCode: 'MANUAL_DELETE',
      });

      return { data: undefined };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during user deletion',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.remove',
      );
      return {
        error: { message: 'An error occurred while deleting user', code: HttpStatus.INTERNAL_SERVER_ERROR },
      };
    }
  }

  // ─── assignLeaders ───────────────────────────────────────────────────────────

  async assignLeaders(leaderIds: string[], actorId: string): Promise<IUsecaseResponse<IAssignLeadersResponse>> {
    try {
      if (!leaderIds || leaderIds.length === 0) {
        return {
          error: { message: 'leaderIds must be a non-empty array', code: HttpStatus.BAD_REQUEST },
        };
      }

      const result = await this.repository.bulkEnsureLeaderRole(leaderIds, actorId);

      Logger.info(
        `Bulk LEADER assign – promoted: ${result.promoted}, skipped: ${result.skipped}, notFound: ${result.notFound}`,
        'UserUseCase.assignLeaders',
      );

      return {
        data: {
          ...result,
          message: `Successfully promoted ${result.promoted} user(s) to LEADER.`,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during assignLeaders',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.assignLeaders',
      );
      return {
        error: { message: 'An error occurred while assigning leader roles', code: HttpStatus.INTERNAL_SERVER_ERROR },
      };
    }
  }

  // ─── syncHr ─────────────────────────────────────────────────────────────────

  async syncHr(actorId: string): Promise<IUsecaseResponse<ISyncHrResponse>> {
    const batchId = await this.repository.createSyncBatch({ runType: 'MANUAL', createdBy: actorId });

    const stats: ISyncHrResponse = {
      batchId,
      synced: 0,
      created: 0,
      updated: 0,
      accountsCreated: 0,
      failed: 0,
      errors: [],
    };

    try {
      // 1. Fetch from HRIS (with retry)
      Logger.info('Starting HRIS sync…', 'UserUseCase.syncHr');

      const apiKey = this.configService.get<string>('MSA_API_KEY') || '';

      const responseData = await fetchWithRetry(
        `${HRIS_BASE_URL}/api/v1/hr/employees`,
        { company: HRIS_COMPANY },
        apiKey,
      );

      const rawEmployees: any[] = responseData?.data ?? [];

      if (!Array.isArray(rawEmployees) || rawEmployees.length === 0) {
        await this.repository.updateSyncBatch(batchId, {
          status: 'FAIL',
          endTime: new Date(),
          errorDetails: ['HRIS API returned empty or invalid data'],
          updatedBy: actorId,
        });
        return {
          error: { message: 'HRIS API returned empty or invalid data', code: HttpStatus.BAD_GATEWAY },
        };
      }

      stats.synced = rawEmployees.length;
      Logger.info(`Fetched ${rawEmployees.length} employees from HRIS`, 'UserUseCase.syncHr');

      // 2. Process each employee atomically
      for (const item of rawEmployees) {
        const employeeId: string = item.EMPLOYEE_NO?.toString?.()?.trim() ?? '';
        const fullName: string = (item.EMPLOYEE_NAME ?? '').trim();

        if (!employeeId || !fullName) {
          const msg = `Skipped – missing EMPLOYEE_NO or EMPLOYEE_NAME: ${JSON.stringify(item)}`;
          stats.errors.push(msg);
          stats.failed++;
          continue;
        }

        try {
          // Generate email
          const email = fullName.toLowerCase().replace(/\s+/g, '.') + EMAIL_DOMAIN;

          // Resolve org unit (auto-create if missing)
          const orgUnitCode: string = (item.ORGANIZATION_UNIT ?? '').trim() || 'UNKNOWN';
          const orgUnitId = await this.repository.upsertOrganizationUnit(orgUnitCode, actorId);

          // Upsert employee + account inside a managed flow
          // (Each in its own try rather than one large $transaction to increase resilience)
          const { isNew: isNewEmployee } = await this.repository.upsertEmployee({
            employeeId,
            fullName,
            email,
            orgUnitId,
            isActive: (item.EMPLOYEE_STATUS ?? 'active').toLowerCase() === 'active',
            position: item.EMPLOYEE_POSITION ?? null,
            jobFamily: item.JOB_FAMILY ?? null,
            immediateSupervisor: item.IMMEDIATE_SUPERVISOR ?? null,
            immediateManager: item.IMMEDIATE_MANAGER ?? null,
            userType: item.EMPLOYEE_TYPE ?? null,
            createdBy: actorId,
          });

          isNewEmployee ? stats.created++ : stats.updated++;

          // Upsert account (password = hashed NIK)
          const hashedPassword = await bcrypt.hash(employeeId, BCRYPT_ROUNDS);
          const { isNew: isNewAccount } = await this.repository.upsertAccount({
            employeeId,
            email,
            hashedPassword,
          });

          if (isNewAccount) stats.accountsCreated++;

          // Ensure USER role is linked
          await this.repository.ensureUserRole(employeeId, actorId);
        } catch (rowErr) {
          const msg = `${employeeId}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`;
          Logger.warn(msg, 'UserUseCase.syncHr');
          stats.errors.push(msg);
          stats.failed++;
        }
      }

      // 3. Finalize batch record
      await this.repository.updateSyncBatch(batchId, {
        status: 'DONE',
        endTime: new Date(),
        totalRecords: stats.synced,
        processedRecords: stats.created + stats.updated,
        insertedRecords: stats.created,
        updatedRecords: stats.updated,
        errorRecords: stats.failed,
        errorDetails: stats.errors.slice(0, 50), // cap stored errors
        updatedBy: actorId,
      });

      Logger.info(
        `HRIS sync complete – created: ${stats.created}, updated: ${stats.updated}, accounts: ${stats.accountsCreated}, failed: ${stats.failed}`,
        'UserUseCase.syncHr',
      );

      return { data: stats };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error during HRIS sync';
      Logger.error(msg, error instanceof Error ? error.stack : undefined, 'UserUseCase.syncHr');

      await this.repository
        .updateSyncBatch(batchId, {
          status: 'FAIL',
          endTime: new Date(),
          errorDetails: [msg],
          updatedBy: actorId,
        })
        .catch(() => {}); // best-effort

      // Propagate 401 specifically as Unauthorized code if message matches
      const isUnauthorized = msg.includes('Failed to sync: Invalid or Missing MSA API Key');

      return {
        error: {
          message: msg,
          code: isUnauthorized ? HttpStatus.UNAUTHORIZED : HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  // ─── uploadL1 ───────────────────────────────────────────────────────────────

  async uploadL1(fileBuffer: Buffer, actorId: string): Promise<IUsecaseResponse<IUploadL1Response>> {
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      ) as ArrayBuffer;
      await workbook.xlsx.load(arrayBuffer);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return { error: { message: 'Excel file has no worksheets', code: HttpStatus.BAD_REQUEST } };
      }

      const result: IUploadL1Response = { updated: 0, failed: 0, failedRows: [] };

      const addFail = (row: number, employeeId: string, approverId: string, reason: string) => {
        result.failed++;
        result.failedRows.push({ row, employeeId, approverId, reason } satisfies IUploadL1FailedRow);
      };

      // Iterate rows from row 2 (skip header)
      for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
        const row = sheet.getRow(rowIndex);
        const employeeId = row.getCell(1).value?.toString()?.trim() ?? '';
        const approverId = row.getCell(2).value?.toString()?.trim() ?? '';

        if (!employeeId && !approverId) continue; // blank row

        if (!employeeId) {
          addFail(rowIndex, employeeId, approverId, 'employee_id is empty');
          continue;
        }
        if (!approverId) {
          addFail(rowIndex, employeeId, approverId, 'approver_id is empty');
          continue;
        }

        try {
          const [employee, approver] = await Promise.all([
            this.repository.findEmployeeById(employeeId),
            this.repository.findEmployeeById(approverId),
          ]);

          if (!employee) {
            addFail(rowIndex, employeeId, approverId, `Employee NIK "${employeeId}" not found`);
            continue;
          }
          if (!approver) {
            addFail(rowIndex, employeeId, approverId, `Approver NIK "${approverId}" not found`);
            continue;
          }

          await this.repository.updateEmployee(employeeId, { approverL1Id: approver.employeeId });
          result.updated++;
        } catch (rowErr) {
          addFail(rowIndex, employeeId, approverId, rowErr instanceof Error ? rowErr.message : String(rowErr));
        }
      }

      Logger.info(`L1 Upload complete – updated: ${result.updated}, failed: ${result.failed}`, 'UserUseCase.uploadL1');

      return { data: result };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in uploadL1',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.uploadL1',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to process Excel file',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }
}
