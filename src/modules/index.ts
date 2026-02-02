import { SchedulerPackageModule } from '@/modules/scheduler.module';
import { AnalyticsModule } from '@/packages/analytics/analytics.module';
import { CategoryModule } from '@/packages/category/category.module';
import { ParamSetModule } from '@/packages/param-set/param-set.module';
import { RBACModule } from '@/packages/rbac/rbac.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalModule } from './approval.module';
import { AssignmentModule } from './assignment.module';
import { AuthModule } from './auth.module';
import { BookingsModule } from './bookings.module';
import { CarpoolModule } from './carpool.module';
import { CostVariableModule } from './cost-variable.module';
import { DriversModule } from './driver.module';
import { ExecutionModule } from './execution.module';
import { FinanceModule } from './finance.module';
import { OrgUnitModule } from './org-unit.module';
import { ReportsModule } from './reports.module';
import { UploadModule } from './upload.module';
import { VehiclesModule } from './vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    OrgUnitModule,
    VehiclesModule,
    DriversModule,
    UploadModule,
    BookingsModule,
    CarpoolModule,
    ApprovalModule,
    AssignmentModule,
    ExecutionModule,
    CostVariableModule,
    CategoryModule,
    ParamSetModule,
    FinanceModule,
    AnalyticsModule,
    ReportsModule,
    SchedulerPackageModule,
    RBACModule,
  ],
})
export class AppModule {}
