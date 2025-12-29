import { VehiclesController } from '@/packages/vehicles/controller/vehicles.controller';
import { VehiclesRepository } from '@/packages/vehicles/repository/vehicles.repository';
import { VehiclesUseCase } from '@/packages/vehicles/usecase/vehicles.usecase';
import { S3Service } from '@/shared/utils';
import { Module } from '@nestjs/common';

@Module({
  controllers: [VehiclesController],
  providers: [
    {
      provide: 'VehiclesRepositoryPort',
      useClass: VehiclesRepository,
    },
    {
      provide: 'VehiclesUsecasePort',
      useClass: VehiclesUseCase,
    },
    S3Service,
  ],
  exports: ['VehiclesUsecasePort', 'VehiclesRepositoryPort'],
})
export class VehiclesModule {}
