import { Module } from '@nestjs/common';
import { CarpoolController } from './controller/carpool.controller';
import { CarpoolUseCase } from './usecase/carpool.usecase';
import { CarpoolRepository } from './repository/carpool.repository';
import { CarpoolCandidateMatcherService } from './services/carpool-candidate-matcher.service';
import { CarpoolMergeEngineService } from './services/carpool-merge-engine.service';
import { CarpoolCostAllocatorService } from './services/carpool-cost-allocator.service';
import { CarpoolAuditService } from './services/carpool-audit.service';
import { CarpoolConfigService } from './services/carpool-config.service';

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
  ],
  exports: [CarpoolUseCase],
})
export class CarpoolModule {}
