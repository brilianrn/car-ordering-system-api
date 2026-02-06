import { RabbitMQModule } from '@/shared/rabbitmq/rabbitmq.module';
import { WhatsAppService } from '@/shared/services/whatsapp.service';
import { NotificationService } from '@/shared/utils/notification.service';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApprovalsController } from '../packages/approvals/controller/approvals.controller';
import { ApprovalsUseCase } from '../packages/approvals/usecase/approvals.usecase';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    RabbitMQModule,
  ],
  controllers: [ApprovalsController],
  providers: [
    {
      provide: 'ApprovalsUsecasePort',
      useClass: ApprovalsUseCase,
    },
    NotificationService,
    WhatsAppService,
  ],
  exports: ['ApprovalsUsecasePort', NotificationService],
})
export class ApprovalsModule {}
