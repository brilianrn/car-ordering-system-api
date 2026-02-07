import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SsoUserData {
  npk: string;
  name: string;
  email: string;
}

@Injectable()
export class SsoService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate SSO token and extract user data
   *
   * TODO: Replace this mock implementation with actual HTTP call to api-sso.dharmap.com
   *
   * @param token - SSO token from client
   * @returns User data from SSO provider
   * @throws Error if token is invalid
   */
  async validateToken(token: string): Promise<SsoUserData> {
    try {
      // MOCK IMPLEMENTATION - Replace with actual API call
      // const ssoApiUrl = this.configService.get<string>('SSO_API_URL');
      // const validationEndpoint = this.configService.get<string>('SSO_VALIDATION_ENDPOINT');

      Logger.info(`Validating SSO token (MOCK): ${token.substring(0, 10)}...`, 'SsoService.validateToken');

      // Mock validation logic
      if (!token || token.length < 10) {
        throw new Error('Invalid SSO token format');
      }

      // Mock response - simulate different users based on token
      if (token.includes('existing')) {
        return {
          npk: '12345',
          name: 'Existing User',
          email: 'existing.user@dharmap.com',
        };
      } else if (token.includes('new')) {
        return {
          npk: `NEW${Date.now()}`,
          name: 'New SSO User',
          email: `new.user.${Date.now()}@dharmap.com`,
        };
      }

      // Default mock user
      return {
        npk: `SSO${Date.now()}`,
        name: 'SSO Test User',
        email: `sso.test.${Date.now()}@dharmap.com`,
      };

      /* 
      // REAL IMPLEMENTATION (uncomment when SSO API is ready):
      
      const response = await fetch(`${ssoApiUrl}${validationEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('SSO token validation failed');
      }

      const data = await response.json();
      
      return {
        npk: data.npk || data.employeeId,
        name: data.name || data.fullName,
        email: data.email,
      };
      */
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during SSO validation',
        error instanceof Error ? error.stack : undefined,
        'SsoService.validateToken',
      );
      throw new Error('SSO token validation failed');
    }
  }
}
