import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerController } from '../packages/scheduler/controller/scheduler.controller';
import { HRISClientConfig } from '../packages/scheduler/domain/types';
import { SchedulerRepository } from '../packages/scheduler/repository/scheduler.repository';
import { HRISSyncScheduler } from '../packages/scheduler/scheduler/hris-sync.scheduler';
import { HRISClientService } from '../packages/scheduler/services/hris-client.service';
import { SchedulerService } from '../packages/scheduler/usecase/scheduler.usecase';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SchedulerController],
  providers: [
    // Repository
    {
      provide: 'SchedulerRepositoryPort',
      useClass: SchedulerRepository,
    },
    // HRIS Client Service
    {
      provide: 'HRISClientService',
      useFactory: (): HRISClientService => {
        const config: HRISClientConfig = {
          baseUrl: process.env.HRIS_API_BASE_URL || '',
          apiKey: process.env.HRIS_API_KEY || '',
          timeout: parseInt(process.env.HRIS_API_TIMEOUT || '30000'),
          retryAttempts: parseInt(process.env.HRIS_API_RETRY_ATTEMPTS || '3'),
          rateLimit: {
            requests: parseInt(process.env.HRIS_RATE_LIMIT_REQUESTS || '100'),
            period: parseInt(process.env.HRIS_RATE_LIMIT_PERIOD || '60000'),
          },
        };
        return new HRISClientService(config);
      },
    },
    // Usecase/Service
    {
      provide: 'SchedulerService',
      useClass: SchedulerService,
    },
    // Scheduler (Cron Job)
    HRISSyncScheduler,
  ],
  exports: ['SchedulerService', 'HRISClientService'],
})
export class SchedulerPackageModule {}
