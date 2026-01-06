import { AssignmentController } from '@/packages/assignment/controller/assignment.controller';
import { AssignmentRepository } from '@/packages/assignment/repository/assignment.repository';
import { AssignmentUseCase } from '@/packages/assignment/usecase/assignment.usecase';
import { NotificationService, S3Service } from '@/shared/utils';
import { Module } from '@nestjs/common';
import { RabbitMQModule } from './rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  controllers: [AssignmentController],
  providers: [
    {
      provide: 'AssignmentRepositoryPort',
      useClass: AssignmentRepository,
    },
    {
      provide: 'AssignmentUsecasePort',
      useClass: AssignmentUseCase,
    },
    S3Service,
    NotificationService,
  ],
  exports: ['AssignmentUsecasePort', 'AssignmentRepositoryPort'],
})
export class AssignmentModule {}
