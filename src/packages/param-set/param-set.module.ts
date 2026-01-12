import { Module } from '@nestjs/common';
import { ParamSetController } from './controller/param-set.controller';
import { ParamSetRepository } from './repository/param-set.repository';
import { ParamSetUseCase } from './usecase/param-set.usecase';
import { RabbitMQService } from '@/shared/rabbitmq/rabbitmq.service';

@Module({
  controllers: [ParamSetController],
  providers: [
    {
      provide: 'ParamSetRepositoryPort',
      useClass: ParamSetRepository,
    },
    {
      provide: 'ParamSetUsecasePort',
      useClass: ParamSetUseCase,
    },
    RabbitMQService,
  ],
  exports: ['ParamSetUsecasePort', 'ParamSetRepositoryPort'],
})
export class ParamSetModule {}
