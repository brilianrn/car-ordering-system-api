import { CarpoolController } from '@/packages/carpool/controller/carpool.controller';
import { CarpoolRepository } from '@/packages/carpool/repository/carpool.repository';
import { CarpoolAuditService } from '@/packages/carpool/services/carpool-audit.service';
import { CarpoolCandidateMatcherService } from '@/packages/carpool/services/carpool-candidate-matcher.service';
import { CarpoolConfigService } from '@/packages/carpool/services/carpool-config.service';
import { CarpoolCostAllocatorService } from '@/packages/carpool/services/carpool-cost-allocator.service';
import { CarpoolMergeEngineService } from '@/packages/carpool/services/carpool-merge-engine.service';
import { CarpoolUseCase } from '@/packages/carpool/usecase/carpool.usecase';
import { GeospatialService } from '@/shared/services/geospatial.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [CarpoolController],
  providers: [
    CarpoolUseCase,
    CarpoolRepository,
    CarpoolCandidateMatcherService,
    CarpoolMergeEngineService,
    CarpoolCostAllocatorService,
    CarpoolAuditService,
    CarpoolConfigService,
    GeospatialService,
  ],
  exports: [CarpoolUseCase],
})
export class CarpoolModule {}
