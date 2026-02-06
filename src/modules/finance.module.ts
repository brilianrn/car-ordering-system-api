import { FinanceController } from '@/packages/finance/controller/finance.controller';
import { FinanceRepository } from '@/packages/finance/repository/finance.repository';
import { FinanceUseCase } from '@/packages/finance/usecase/finance.usecase';
import { WhatsAppService } from '@/shared/services/whatsapp.service';
import { NotificationService } from '@/shared/utils/notification.service';
import { Module } from '@nestjs/common';
import { RabbitMQModule } from './rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  controllers: [FinanceController],
  providers: [
    {
      provide: 'FinanceRepositoryPort',
      useClass: FinanceRepository,
    },
    {
      provide: 'FinanceUsecasePort',
      useClass: FinanceUseCase,
    },
    WhatsAppService,
    NotificationService,
  ],
  exports: ['FinanceUsecasePort', 'FinanceRepositoryPort'],
})
export class FinanceModule {}
