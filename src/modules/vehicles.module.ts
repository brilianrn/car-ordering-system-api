import { VehiclesController } from '@/packages/vehicles/controller/vehicles.controller';
import { VehiclesRepository } from '@/packages/vehicles/repository/vehicles.repository';
import { VehiclesUseCase } from '@/packages/vehicles/usecase/vehicles.usecase';
import { Module } from '@nestjs/common';

@Module({
  controllers: [VehiclesController],
  providers: [
    VehiclesUseCase,
    {
      provide: 'VehiclesRepositoryPort',
      useClass: VehiclesRepository,
    },
    VehiclesRepository,
    // PrismaService,
  ],
  exports: [VehiclesUseCase, VehiclesRepository],
})
export class VehiclesModule {}
