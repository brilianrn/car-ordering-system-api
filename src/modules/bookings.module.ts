import { BookingsController } from '@/packages/bookings/controller/bookings.controller';
import { BookingsRepository } from '@/packages/bookings/repository/bookings.repository';
import { BookingsUseCase } from '@/packages/bookings/usecase/bookings.usecase';
import { S3Service } from '@/shared/utils';
import { Module } from '@nestjs/common';

@Module({
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
  ],
  exports: ['BookingsUsecasePort', 'BookingsRepositoryPort'],
})
export class BookingsModule {}
