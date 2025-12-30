import { Injectable } from '@nestjs/common';
import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';

export interface CarpoolConfig {
  timeWindowMinutes: number; // ±X minutes from planned start (default: 30)
  routeSimilarityThreshold: number; // Minimum route similarity threshold (0-100, default: 70)
  maxDetourPercentage: number; // Maximum detour percentage allowed (default: 15)
  defaultInviteExpiryMinutes: number; // Default invitation expiry (default: 60)
  maxVehicleSeatCapacity: number; // Maximum seat capacity to consider (default: 7)
}

@Injectable()
export class CarpoolConfigService {
  private readonly db = clientDb;
  private defaultConfig: CarpoolConfig = {
    timeWindowMinutes: 30,
    routeSimilarityThreshold: 70,
    maxDetourPercentage: 15,
    defaultInviteExpiryMinutes: 60,
    maxVehicleSeatCapacity: 7,
  };

  /**
   * Get carpool configuration from ParamSet
   * Falls back to default values if not configured
   */
  async getConfig(): Promise<CarpoolConfig> {
    try {
      // Get active ParamSet
      const activeParamSet = await this.db.paramSet.findFirst({
        where: {
          status: 'Published',
          deletedAt: null,
        },
        orderBy: {
          version: 'desc',
        },
        include: {
          items: {
            where: {
              group: 'CARPOOL',
              deletedAt: null,
            },
          },
        },
      });

      if (!activeParamSet || !activeParamSet.items.length) {
        Logger.info('No carpool config found, using defaults', 'CarpoolConfigService.getConfig');
        return this.defaultConfig;
      }

      const config: CarpoolConfig = { ...this.defaultConfig };

      // Parse config values from ParamItem
      for (const item of activeParamSet.items) {
        const value = parseFloat(item.value);
        switch (item.name) {
          case 'TIME_WINDOW_MINUTES':
            config.timeWindowMinutes = value || this.defaultConfig.timeWindowMinutes;
            break;
          case 'ROUTE_SIMILARITY_THRESHOLD':
            config.routeSimilarityThreshold = value || this.defaultConfig.routeSimilarityThreshold;
            break;
          case 'MAX_DETOUR_PERCENTAGE':
            config.maxDetourPercentage = value || this.defaultConfig.maxDetourPercentage;
            break;
          case 'DEFAULT_INVITE_EXPIRY_MINUTES':
            config.defaultInviteExpiryMinutes = value || this.defaultConfig.defaultInviteExpiryMinutes;
            break;
          case 'MAX_VEHICLE_SEAT_CAPACITY':
            config.maxVehicleSeatCapacity = value || this.defaultConfig.maxVehicleSeatCapacity;
            break;
        }
      }

      return config;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error fetching carpool config',
        error instanceof Error ? error.stack : undefined,
        'CarpoolConfigService.getConfig',
      );
      return this.defaultConfig;
    }
  }
}
