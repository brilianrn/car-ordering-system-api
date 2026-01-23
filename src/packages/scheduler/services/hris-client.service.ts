import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as https from 'https';
import { HRISClientConfig, HRISEmployee, HRISOrganizationUnit, HRISSyncResult } from '../domain/types';

@Injectable()
export class HRISClientService {
  private readonly logger = new Logger(HRISClientService.name);
  private readonly httpClient: AxiosInstance;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(private readonly config: HRISClientConfig) {
    // Create HTTPS agent with SSL certificate validation disabled for development/testing
    // TODO: Remove rejectUnauthorized: false in production and use proper certificates
    const httpsAgent = new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === 'production', // Only reject in production
    });

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        'User-Agent': 'COS-HRIS-Sync/1.0',
      },
    });

    // Add response interceptor for rate limiting and error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          // Rate limited, wait and retry
          const retryAfter = error.response.headers['retry-after'] || 1;
          this.logger.warn(`Rate limited by HRIS API, waiting ${retryAfter} seconds`);
          await this.delay(retryAfter * 1000);
          return this.httpClient.request(error.config);
        }
        return Promise.reject(error);
      },
    );

    this.logger.log(`HRIS Client initialized for ${this.config.baseUrl}`);
  }

  /**
   * Fetch employee data from HRIS and extract organization units from it
   * @param lastSync Optional last sync timestamp for delta sync
   * @returns Promise<HRISSyncResult>
   */
  async getOrganizationUnits(lastSync?: Date): Promise<HRISSyncResult> {
    try {
      await this.enforceRateLimit();

      this.logger.log(
        `Fetching employee data from HRIS${lastSync ? ` since ${lastSync.toISOString()}` : ' (full sync)'}`,
      );

      // Fetch employee data (this is the only available endpoint)
      const employeeResponse: AxiosResponse = await this.httpClient.get('/api/v1/hr/employees', {
        params: {
          company: 'DPM',
        },
        timeout: this.config.timeout,
      });

      const employees: HRISEmployee[] = employeeResponse.data.data.map((item: any) => ({
        employeeId: item.EMPLOYEE_NO,
        fullName: item.EMPLOYEE_NAME,
        email: undefined, // Not available in this API
        orgUnitCode: item.ORGANIZATION_UNIT,
        statusAktif: item.EMPLOYEE_STATUS === 'active',
        lastModified: new Date(), // No timestamp in this API, use current time
        effectiveRoles: this.mapEmployeeRoles(item),
        immediateSupervisor: item.IMMEDIATE_SUPERVISOR,
        immediateManager: item.IMMEDIATE_MANAGER,
        position: item.EMPLOYEE_POSITION,
        jobFamily: item.JOB_FAMILY,
      }));

      // Extract unique organization units from employee data
      const orgUnitMap = new Map<string, HRISOrganizationUnit>();
      employees.forEach((employee) => {
        if (employee.orgUnitCode && !orgUnitMap.has(employee.orgUnitCode)) {
          orgUnitMap.set(employee.orgUnitCode, {
            code: employee.orgUnitCode,
            name: employee.orgUnitCode, // Use code as name since no separate org data
            parentCode: undefined, // No parent info available
            costCenter: undefined, // No cost center info available
            statusAktif: true, // Assume active since employees exist
            type: 'DEPARTMENT', // Default type
            lastModified: new Date(),
          });
        }
      });

      const organizations: HRISOrganizationUnit[] = Array.from(orgUnitMap.values());

      const result: HRISSyncResult = {
        organizations,
        employees,
        totalRecords: organizations.length + employees.length,
        lastSyncTimestamp: new Date(),
        isValidData: true,
      };

      this.logger.log(
        `Successfully extracted ${organizations.length} organization units and ${employees.length} employees from HRIS`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch data from HRIS: ${error.message}`, error.stack);
      throw new Error(`HRIS API request failed: ${error.message}`);
    }
  }

  /**
   * Fetch employee data from HRIS (for future expansion)
   * @param lastSync Optional last sync timestamp
   * @returns Promise<any>
   */
  async getEmployeeData(lastSync?: Date): Promise<any> {
    try {
      await this.enforceRateLimit();

      this.logger.log(`Fetching employee data from HRIS${lastSync ? ` since ${lastSync.toISOString()}` : ''}`);

      const response: AxiosResponse = await this.httpClient.get('/api/v1/hr/employees', {
        params: {
          company: 'DPM',
        },
        timeout: this.config.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch employee data from HRIS: ${error.message}`, error.stack);
      throw new Error(`HRIS API request failed: ${error.message}`);
    }
  }

  /**
   * Test connectivity to HRIS API
   * @returns Promise<boolean>
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.enforceRateLimit();

      const response: AxiosResponse = await this.httpClient.get('/api/v1/health', {
        timeout: 5000, // Shorter timeout for health check
      });

      const isHealthy = response.status === 200;
      this.logger.log(`HRIS API connectivity test: ${isHealthy ? 'SUCCESS' : 'FAILED'}`);
      return isHealthy;
    } catch (error) {
      this.logger.error(`HRIS API connectivity test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Enforce rate limiting based on configuration
   * @private
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (this.requestCount >= this.config.rateLimit.requests) {
      const waitTime = this.config.rateLimit.period - timeSinceLastRequest;
      if (waitTime > 0) {
        this.logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        await this.delay(waitTime);
        this.requestCount = 0;
      }
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Map employee roles based on position and job family
   * @private
   */
  private mapEmployeeRoles(employee: any): string[] {
    const roles: string[] = [];
    const position = employee.EMPLOYEE_POSITION?.toLowerCase() || '';
    const jobFamily = employee.JOB_FAMILY?.toLowerCase() || '';

    // Base USER role for all employees
    roles.push('USER');

    // Leadership roles
    if (
      position.includes('head') ||
      position.includes('director') ||
      position.includes('manager') ||
      position.includes('lead')
    ) {
      roles.push('LEADER');
    }

    // GA roles (General Affairs)
    if (
      position.includes('ga') ||
      position.includes('general affairs') ||
      jobFamily.includes('ga') ||
      position.includes('admin')
    ) {
      roles.push('GA');
    }

    // Driver roles
    if (position.includes('driver') || jobFamily.includes('driver')) {
      roles.push('DRIVER');
    }

    // Finance roles
    if (
      position.includes('finance') ||
      position.includes('accounting') ||
      jobFamily.includes('finance') ||
      position.includes('accountant')
    ) {
      roles.push('FINANCE');
    }

    // Management roles
    if (
      position.includes('manager') ||
      position.includes('director') ||
      position.includes('head') ||
      jobFamily.includes('management')
    ) {
      roles.push('MANAGEMENT');
    }

    // Admin roles
    if (position.includes('admin') || position.includes('administrator')) {
      roles.push('ADMIN');
    }

    // Auditor roles
    if (position.includes('auditor') || position.includes('audit')) {
      roles.push('AUDITOR');
    }

    // Remove duplicates and validate
    const validRoles = ['USER', 'LEADER', 'GA', 'DRIVER', 'FINANCE', 'MANAGEMENT', 'ADMIN', 'AUDITOR'];
    return [...new Set(roles)].filter((role) => validRoles.includes(role));
  }

  /**
   * Utility method for delays
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
