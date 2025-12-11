import { discoverSchedulers } from '@/shared/utils/scheduler-loader';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({})
export class SchedulerModule {
  static async register(): Promise<DynamicModule> {
    const schedulers = await discoverSchedulers();

    return {
      module: SchedulerModule,
      imports: [ScheduleModule.forRoot()],
      providers: schedulers as Provider[],
    };
  }
}
