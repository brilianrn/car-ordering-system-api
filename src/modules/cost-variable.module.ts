import { CostVariableController } from '@/packages/cost-variable/controller/cost-variable.controller';
import { CostVariableRepository } from '@/packages/cost-variable/repository/cost-variable.repository';
import { CostVariableUseCase } from '@/packages/cost-variable/usecase/cost-variable.usecase';
import { Module } from '@nestjs/common';

@Module({
  controllers: [CostVariableController],
  providers: [
    {
      provide: 'CostVariableRepositoryPort',
      useClass: CostVariableRepository,
    },
    CostVariableRepository,
    CostVariableUseCase,
  ],
  exports: [CostVariableRepository, CostVariableUseCase],
})
export class CostVariableModule {}

