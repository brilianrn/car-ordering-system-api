import { Module } from '@nestjs/common';
import { CategoryController } from './controller/category.controller';
import { CategoryRepository } from './repository/category.repository';
import { CategoryUseCase } from './usecase/category.usecase';

@Module({
  controllers: [CategoryController],
  providers: [
    {
      provide: 'CategoryRepositoryPort',
      useClass: CategoryRepository,
    },
    {
      provide: 'CategoryUsecasePort',
      useClass: CategoryUseCase,
    },
  ],
  exports: ['CategoryUsecasePort'],
})
export class CategoryModule {}
