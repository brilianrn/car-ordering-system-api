import { RMQ } from '@/config/rabbitmq';
import { RabbitMQService } from '@/shared/rabbitmq/rabbitmq.service';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class OrderWorker implements OnModuleInit {
  constructor(private readonly rmq: RabbitMQService) {}

  async onModuleInit() {
    const { exchange, retryExchange, queue, retryQueue, routingKey } = RMQ.ORDER;

    // declare exchange + retry exchange
    await this.rmq.assertExchange(exchange);
    await this.rmq.assertExchange(retryExchange);

    // declare queues
    await this.rmq.assertQueue(queue);
    await this.rmq.assertQueue(retryQueue, {
      deadLetterExchange: retryExchange,
    });

    // bind queue
    await this.rmq.bindQueue(queue, exchange, routingKey);

    // consume
    await this.rmq.consume(queue, async (msg) => {
      const payload = JSON.parse(msg.content.toString());
      console.log('OrderWorker processing:', payload);
      // TODO: panggil service / usecase order
    });
  }
}
