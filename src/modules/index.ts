import { SchedulerPackageModule } from '@/modules/scheduler.module';
import { AnalyticsModule } from '@/packages/analytics/analytics.module';
import { CategoryModule } from '@/packages/category/category.module';
import { EmployeesModule } from '@/packages/employees/employees.module';
import { ParamSetModule } from '@/packages/param-set/param-set.module';
import { RBACModule } from '@/packages/rbac/rbac.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalModule } from './approval.module';
import { ApprovalsModule } from './approvals.module';
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
import { UserModule } from './user.module';
import { VehiclesModule } from './vehicles.module';
import { VendorsModule } from './vendors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UserModule,
    EmployeesModule,
    OrgUnitModule,
    VehiclesModule,
    DriversModule,
    UploadModule,
    BookingsModule,
    CarpoolModule,
    ApprovalModule,
    ApprovalsModule, // Multi-channel actionable approvals
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
    VendorsModule,
  ],
})
export class AppModule {}
