import { OrderWorker } from '@/packages/order/worker/order.worker';
import { Module } from '@nestjs/common';
import { RabbitMQModule } from './rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  providers: [OrderWorker],
})
export class WorkerModule {}
