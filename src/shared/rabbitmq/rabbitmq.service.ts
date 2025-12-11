import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;

  async onModuleInit() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
    this.channel = await this.connection.createChannel();
  }

  async onModuleDestroy() {
    await this.channel.close();
    await this.connection.close();
  }

  async assertExchange(name: string, type: string = 'direct') {
    await this.channel.assertExchange(name, type, { durable: true });
  }

  async assertQueue(name: string, options?: amqp.Options.AssertQueue) {
    await this.channel.assertQueue(name, { durable: true, ...(options || {}) });
  }

  async bindQueue(queue: string, exchange: string, routingKey: string) {
    await this.channel.bindQueue(queue, exchange, routingKey);
  }

  async publish(exchange: string, routingKey: string, payload: any) {
    const buf = Buffer.from(JSON.stringify(payload));
    this.channel.publish(exchange, routingKey, buf, {
      contentType: 'application/json',
      persistent: true,
    });
  }

  async consume(
    queue: string,
    handler: (msg: amqp.ConsumeMessage) => Promise<void>,
  ) {
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        await handler(msg);
        this.channel.ack(msg);
      } catch (err) {
        console.error('Message handling failed, requeue:', err);
        this.channel.nack(msg, false, true);
      }
    });
  }
}
