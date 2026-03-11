import { VendorsController } from '@/packages/vendors/controller/vendors.controller';
import { VendorsRepository } from '@/packages/vendors/repository/vendors.repository';
import { VendorsUseCase } from '@/packages/vendors/usecase/vendors.usecase';
import { Module } from '@nestjs/common';

@Module({
  controllers: [VendorsController],
  providers: [
    {
      provide: 'VendorsRepositoryPort',
      useClass: VendorsRepository,
    },
    {
      provide: 'VendorsUsecasePort',
      useClass: VendorsUseCase,
    },
  ],
  exports: ['VendorsUsecasePort', 'VendorsRepositoryPort'],
})
export class VendorsModule {}
