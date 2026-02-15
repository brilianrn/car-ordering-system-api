import { Module } from '@nestjs/common';
import { ReportsController } from '../packages/reports/controller/reports.controller';
import { ReportsRepository } from '../packages/reports/repository/reports.repository';
import { ReportsService } from '../packages/reports/usecase/reports.usecase';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    {
      provide: 'ReportsRepositoryPort',
      useClass: ReportsRepository,
    },
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
