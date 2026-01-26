import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { RBACController } from './controller/rbac.controller';

// Services
import { RBACService } from './services/rbac.service';
import { RoleMatrixService } from './services/role-matrix.service';
import { SoDService } from './services/sod.service';

// Schedulers
import { TempRoleCleanupScheduler } from './schedulers/temp-role-cleanup.scheduler';

@Module({
  imports: [
    // Enable scheduling for temp role cleanup
    ScheduleModule.forRoot(),
  ],
  controllers: [RBACController],
  providers: [
    // Services
    {
      provide: 'RBACService',
      useClass: RBACService,
    },
    {
      provide: 'RoleMatrixService',
      useClass: RoleMatrixService,
    },
    {
      provide: 'SoDService',
      useClass: SoDService,
    },

    // Schedulers
    TempRoleCleanupScheduler,
  ],
  exports: ['RBACService', 'RoleMatrixService', 'SoDService'],
})
export class RBACModule {}
