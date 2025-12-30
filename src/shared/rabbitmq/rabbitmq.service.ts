import { RMQ } from '@/config/rabbitmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;
  private exchangesAsserted = new Set<string>();

  async onModuleInit() {
    try {
      console.log('📨 Connecting to RabbitMQ...', process.env.RABBITMQ_URL);
      this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
      this.channel = await this.connection.createChannel();
      console.log('✅ RabbitMQ connected successfully');

      // Initialize all exchanges and queues
      await this.initializeExchangesAndQueues();
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Initialize all exchanges and queues defined in RMQ config
   */
  private async initializeExchangesAndQueues() {
    try {
      const rmqConfigs = [RMQ.ORDER, RMQ.DRIVER_ASSIGN, RMQ.VEHICLE_CHECK, RMQ.TRACKING, RMQ.NOTIFICATION, RMQ.AUDIT];

      for (const config of rmqConfigs) {
        // Assert main exchange
        await this.assertExchange(config.exchange);
        // Assert retry exchange
        await this.assertExchange(config.retryExchange);
        // Assert main queue
        await this.assertQueue(config.queue);
        // Assert retry queue with dead letter exchange
        await this.assertQueue(config.retryQueue, {
          deadLetterExchange: config.retryExchange,
        });
        // Bind main queue to exchange
        await this.bindQueue(config.queue, config.exchange, config.routingKey);
      }

      console.log('✅ All RabbitMQ exchanges and queues initialized');
    } catch (error) {
      console.error('❌ Failed to initialize RabbitMQ exchanges/queues:', error);
      // Don't throw - allow app to continue, exchanges will be created on-demand
    }
  }

  async onModuleDestroy() {
    await this.channel.close();
    await this.connection.close();
  }

  async assertExchange(name: string, type: string = 'direct') {
    if (!this.exchangesAsserted.has(name)) {
      await this.channel.assertExchange(name, type, { durable: true });
      this.exchangesAsserted.add(name);
    }
  }

  async assertQueue(name: string, options?: amqp.Options.AssertQueue) {
    await this.channel.assertQueue(name, { durable: true, ...(options || {}) });
  }

  async bindQueue(queue: string, exchange: string, routingKey: string) {
    await this.channel.bindQueue(queue, exchange, routingKey);
  }

  async publish(exchange: string, routingKey: string, payload: any) {
    // Ensure exchange exists before publishing
    await this.assertExchange(exchange);

    const buf = Buffer.from(JSON.stringify(payload));
    this.channel.publish(exchange, routingKey, buf, {
      contentType: 'application/json',
      persistent: true,
    });
  }

  async consume(queue: string, handler: (msg: amqp.ConsumeMessage) => Promise<void>) {
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
