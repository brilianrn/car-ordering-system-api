import { ExecutionController } from '@/packages/execution/controller/execution.controller';
import { ExecutionRepository } from '@/packages/execution/repository/execution.repository';
import { ExecutionUseCase } from '@/packages/execution/usecase/execution.usecase';
import { OCRService, S3Service } from '@/shared/utils';
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
    OCRService,
    S3Service,
  ],
  exports: ['ExecutionUsecasePort', 'ExecutionRepositoryPort'],
})
export class ExecutionModule {}
