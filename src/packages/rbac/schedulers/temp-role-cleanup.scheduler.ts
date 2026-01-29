import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RBACService } from '../services/rbac.service';

@Injectable()
export class TempRoleCleanupScheduler {
  private readonly logger = new Logger(TempRoleCleanupScheduler.name);

  constructor(
    @Inject('RBACService')
    private readonly rbacService: RBACService,
  ) {
    this.logger.log('TempRoleCleanupScheduler initialized');
  }

  /**
   * Run cleanup every day at 2 AM
   * This ensures expired temp roles are cleaned up promptly
   */
  @Cron('0 2 * * *', {
    timeZone: 'Asia/Jakarta',
  })
  async handleTempRoleCleanup() {
    try {
      this.logger.log('Starting scheduled temporary role cleanup');

      const result = await this.rbacService.cleanupExpiredTempRoles();

      if (result.error) {
        this.logger.error(`Scheduled temp role cleanup failed: ${result.error.message}`);
        return;
      }

      const cleanedCount = result.data!;
      if (cleanedCount > 0) {
        this.logger.log(`Successfully cleaned up ${cleanedCount} expired temporary roles`);
      } else {
        this.logger.debug('No expired temporary roles to clean up');
      }
    } catch (error) {
      this.logger.error(`Scheduled temp role cleanup failed: ${error.message}`, error.stack);

      // In production, you might want to send alerts here
      // e.g., send email, Slack notification, etc.
    }
  }

  /**
   * Also run cleanup every 4 hours as a backup
   * This ensures cleanup happens even if daily cron fails
   */
  @Cron('0 */4 * * *', {
    timeZone: 'Asia/Jakarta',
  })
  async handleBackupTempRoleCleanup() {
    try {
      this.logger.debug('Running backup temporary role cleanup');

      const result = await this.rbacService.cleanupExpiredTempRoles();

      if (result.data && result.data > 0) {
        this.logger.log(`Backup cleanup: ${result.data} expired temporary roles cleaned up`);
      }
    } catch (error) {
      this.logger.error(`Backup temp role cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualCleanup(): Promise<number> {
    this.logger.log('Manual temp role cleanup triggered');
    const result = await this.rbacService.cleanupExpiredTempRoles();
    return result.data || 0;
  }
}
