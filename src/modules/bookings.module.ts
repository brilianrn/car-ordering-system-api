import { BookingsController } from '@/packages/bookings/controller/bookings.controller';
import { BookingsRepository } from '@/packages/bookings/repository/bookings.repository';
import { BookingsUseCase } from '@/packages/bookings/usecase/bookings.usecase';
import { NotificationService, S3Service } from '@/shared/utils';
import { Module } from '@nestjs/common';
import { RabbitMQModule } from './rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  controllers: [BookingsController],
  providers: [
    {
      provide: 'BookingsRepositoryPort',
      useClass: BookingsRepository,
    },
    {
      provide: 'BookingsUsecasePort',
      useClass: BookingsUseCase,
    },
    S3Service,
    NotificationService,
  ],
  exports: ['BookingsUsecasePort', 'BookingsRepositoryPort'],
})
export class BookingsModule {}
