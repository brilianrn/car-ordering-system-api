import { Module } from '@nestjs/common';
import { OrgUnitController, OrgUnitSyncController } from './controller';
import { OrgUnitRepository } from './repository';
import { OrgUnitUseCase } from './usecase';

@Module({
  controllers: [OrgUnitController, OrgUnitSyncController],
  providers: [OrgUnitRepository, OrgUnitUseCase],
  exports: [OrgUnitUseCase], // Export for use in other modules (e.g., for RLS helpers)
})
export class OrgUnitModule {}
