import { Module } from '@nestjs/common';
import { EmployeesController } from './controller/employees.controller';
import { EmployeesUseCase } from './usecase/employees.usecase';

@Module({
  imports: [],
  controllers: [EmployeesController],
  providers: [
    {
      provide: 'EmployeesUsecasePort',
      useClass: EmployeesUseCase,
    },
  ],
})
export class EmployeesModule {}
