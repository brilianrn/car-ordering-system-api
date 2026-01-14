import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { BookingsModule } from './bookings.module';
import { CarpoolModule } from './carpool.module';
import { DriversModule } from './driver.module';
import { UploadModule } from './upload.module';
import { VehiclesModule } from './vehicles.module';
import { ApprovalModule } from './approval.module';
import { AssignmentModule } from './assignment.module';
import { ExecutionModule } from './execution.module';
import { CostVariableModule } from './cost-variable.module';
import { CategoryModule } from '@/packages/category/category.module';
import { ParamSetModule } from '@/packages/param-set/param-set.module';
import { FinanceModule } from './finance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
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
  ],
})
export class AppModule {}
