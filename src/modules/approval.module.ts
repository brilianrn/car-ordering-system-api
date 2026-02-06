import { ApprovalController } from '@/packages/approval/controller/approval.controller';
import { ApprovalRepository } from '@/packages/approval/repository/approval.repository';
import { ApprovalUseCase } from '@/packages/approval/usecase/approval.usecase';
import { WhatsAppService } from '@/shared/services/whatsapp.service';
import { NotificationService, S3Service } from '@/shared/utils';
import { Module } from '@nestjs/common';
import { RabbitMQModule } from './rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  controllers: [ApprovalController],
  providers: [
    {
      provide: 'ApprovalRepositoryPort',
      useClass: ApprovalRepository,
    },
    {
      provide: 'ApprovalUsecasePort',
      useClass: ApprovalUseCase,
    },
    S3Service,
    WhatsAppService,
    NotificationService,
  ],
  exports: ['ApprovalUsecasePort', 'ApprovalRepositoryPort'],
})
export class ApprovalModule {}
