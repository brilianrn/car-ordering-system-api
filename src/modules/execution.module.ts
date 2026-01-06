import { ExecutionController } from '@/packages/execution/controller/execution.controller';
import { ExecutionRepository } from '@/packages/execution/repository/execution.repository';
import { ExecutionUseCase } from '@/packages/execution/usecase/execution.usecase';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ExecutionController],
  providers: [
    {
      provide: 'ExecutionRepositoryPort',
      useClass: ExecutionRepository,
    },
    {
      provide: 'ExecutionUsecasePort',
      useClass: ExecutionUseCase,
    },
  ],
  exports: ['ExecutionUsecasePort', 'ExecutionRepositoryPort'],
})
export class ExecutionModule {}
