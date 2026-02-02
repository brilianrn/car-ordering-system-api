import { OrgUnitController, OrgUnitSyncController } from '@/packages/org-unit/controller';
import { OrgUnitRepository } from '@/packages/org-unit/repository';
import { OrgUnitUseCase } from '@/packages/org-unit/usecase';
import { Module } from '@nestjs/common';

@Module({
  controllers: [OrgUnitController, OrgUnitSyncController],
  providers: [OrgUnitRepository, OrgUnitUseCase],
  exports: [OrgUnitUseCase], // Export for use in other modules (e.g., for RLS helpers)
})
export class OrgUnitModule {}
