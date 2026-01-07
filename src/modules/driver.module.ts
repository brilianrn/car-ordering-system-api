import { DriversController } from '@/packages/drivers/controller/drivers.controller';
import { DriversRepository } from '@/packages/drivers/repository/drivers.repository';
import { DriversUseCase } from '@/packages/drivers/usecase/drivers.usecase';
import { S3Service } from '@/shared/utils';
import { Module } from '@nestjs/common';

@Module({
  controllers: [DriversController],
  providers: [
    {
      provide: 'DriversRepositoryPort',
      useClass: DriversRepository,
    },
    DriversRepository,
    DriversUseCase,
    S3Service,
  ],
  exports: [DriversRepository, DriversUseCase],
})
export class DriversModule {}
