import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchedulerService } from '../usecase/scheduler.usecase';

@Injectable()
export class HRISSyncScheduler {
  private readonly logger = new Logger(HRISSyncScheduler.name);

  constructor(
    @Inject('SchedulerService')
    private readonly schedulerService: SchedulerService,
  ) {
    const mode = process.env.MODE;
    const port = process.env.PORT;

    if (mode !== 'SCHEDULER' || port !== '3003') {
      this.logger.warn(
        `Scheduler not active. MODE=${mode}, PORT=${port}. Scheduler only runs when MODE=SCHEDULER and PORT=3003`,
      );
    } else {
      this.logger.log('HRIS Sync Scheduler initialized and active');
    }
  }

  @Cron('30 17 * * *', {
    timeZone: 'Asia/Jakarta', // UTC+7 timezone
  }) // Every day at 01:00 AM WIB (18:00 UTC)
  async handleScheduledSync() {
    // Only run if MODE=SCHEDULER and PORT=3003
    const mode = process.env.MODE;
    const port = process.env.PORT;

    if (mode !== 'SCHEDULER' || port !== '3003') {
      this.logger.debug(
        `Skipping scheduled sync: MODE=${mode}, PORT=${port}. Scheduler only runs when MODE=SCHEDULER and PORT=3003`,
      );
      return;
    }

    try {
      this.logger.log('Starting scheduled HRIS synchronization');

      const result = await this.schedulerService.executeScheduledSync();

      this.logger.log(
        `Scheduled HRIS sync completed. Batch: ${result.batch.id}, ` +
          `Processed: ${result.summary.processedRecords}, ` +
          `Errors: ${result.summary.errorRecords}`,
      );

      // Log summary details
      this.logger.log(
        `Organizations - Inserted: ${result.organizations.inserted}, ` +
          `Updated: ${result.organizations.updated}, ` +
          `Deactivated: ${result.organizations.deactivated}`,
      );

      if (result.summary.errorRecords > 0) {
        this.logger.warn(`Sync completed with ${result.summary.errorRecords} errors`);
        result.summary.errors.forEach((error, index) => {
          this.logger.warn(`Error ${index + 1}: ${error}`);
        });
      }
    } catch (error) {
      this.logger.error(`Scheduled HRIS sync failed: ${error.message}`, error.stack);

      // In a production environment, you might want to send alerts here
      // e.g., send email, Slack notification, etc.
    }
  }

  // Optional: Manual trigger method for testing
  async triggerManualSync() {
    this.logger.log('Manual sync triggered');
    return this.handleScheduledSync();
  }
}
