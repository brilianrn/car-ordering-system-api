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

// import { RMQ } from '@/config/rabbitmq';
// import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// import * as amqp from 'amqplib';

// @Injectable()
// export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
//   private connection?: amqp.Connection;
//   private channel?: amqp.Channel;
//   private exchangesAsserted = new Set<string>();
//   private isConnected = false;

//   async onModuleInit() {
//     // Only connect to RabbitMQ in WORKER mode or if explicitly needed
//     const mode = process.env.MODE;
//     if (mode !== 'WORKER' && mode !== 'SCHEDULER') {
//       console.log('🔄 Skipping RabbitMQ connection (not in WORKER/SCHEDULER mode)');
//       return;
//     }

//     await this.connect();
//   }

//   async connect() {
//     if (this.isConnected) {
//       return;
//     }

//     try {
//       console.log('📨 Connecting to RabbitMQ...', process.env.RABBITMQ_URL?.replace(/:\/\/.*@/, '://***@'));
      
//       if (!process.env.RABBITMQ_URL) {
//         throw new Error('RABBITMQ_URL environment variable is not set');
//       }

//       // Parse the URL to handle authentication properly
//       const url = new URL(process.env.RABBITMQ_URL);
//       const connectionOptions: any = {
//         heartbeat: 60,
//         timeout: 10000,
//       };

//       // Handle SASL authentication for CloudAMQP
//       if (url.protocol === 'amqps:' && url.username && url.password) {
//         connectionOptions.credentials = {
//           mechanism: 'plain',
//           username: decodeURIComponent(url.username),
//           password: decodeURIComponent(url.password),
//         };
//       }

//       this.connection = await amqp.connect(process.env.RABBITMQ_URL, connectionOptions);
      
//       this.channel = await this.connection.createChannel();
//       this.isConnected = true;
      
//       console.log('✅ RabbitMQ connected successfully');

//       // Handle connection errors
//       this.connection.on('error', (err) => {
//         console.error('❌ RabbitMQ connection error:', err);
//         this.isConnected = false;
//       });

//       this.connection.on('close', () => {
//         console.warn('⚠️ RabbitMQ connection closed');
//         this.isConnected = false;
//       });

//       // Initialize all exchanges and queues
//       await this.initializeExchangesAndQueues();
//     } catch (error) {
//       console.error('❌ Failed to connect to RabbitMQ:', error.message);
//       this.isConnected = false;
      
//       // In API mode, don't throw the error - just log it
//       const mode = process.env.MODE;
//       if (mode === 'API') {
//         console.warn('⚠️ RabbitMQ connection failed in API mode - continuing without RabbitMQ');
//         return;
//       }
      
//       // In WORKER/SCHEDULER mode, this is critical
//       throw error;
//     }
//   }

//   /**
//    * Initialize all exchanges and queues defined in RMQ config
//    */
//   private async initializeExchangesAndQueues() {
//     if (!this.isConnected) {
//       console.log('🔄 Skipping RabbitMQ initialization - not connected');
//       return;
//     }

//     try {
//       const rmqConfigs = [RMQ.ORDER, RMQ.DRIVER_ASSIGN, RMQ.VEHICLE_CHECK, RMQ.TRACKING, RMQ.NOTIFICATION, RMQ.AUDIT];

//       for (const config of rmqConfigs) {
//         // Assert main exchange
//         await this.assertExchange(config.exchange);
//         // Assert retry exchange
//         await this.assertExchange(config.retryExchange);
//         // Assert main queue
//         await this.assertQueue(config.queue);
//         // Assert retry queue with dead letter exchange
//         await this.assertQueue(config.retryQueue, {
//           deadLetterExchange: config.retryExchange,
//         });
//         // Bind main queue to exchange
//         await this.bindQueue(config.queue, config.exchange, config.routingKey);
//       }

//       console.log('✅ All RabbitMQ exchanges and queues initialized');
//     } catch (error) {
//       console.error('❌ Failed to initialize RabbitMQ exchanges/queues:', error);
//       // Don't throw - allow app to continue, exchanges will be created on-demand
//     }
//   }

//   async onModuleDestroy() {
//     if (this.channel) {
//       await this.channel.close();
//     }
//     if (this.connection) {
//       await this.connection.close();
//     }
//     this.isConnected = false;
//   }

//   private ensureConnected() {
//     if (!this.isConnected || !this.channel) {
//       throw new Error('RabbitMQ is not connected. Call connect() first.');
//     }
//   }

//   isAvailable(): boolean {
//     return this.isConnected && !!this.channel;
//   }

//   async assertExchange(name: string, type: string = 'direct') {
//     this.ensureConnected();
//     if (!this.exchangesAsserted.has(name)) {
//       await this.channel!.assertExchange(name, type, { durable: true });
//       this.exchangesAsserted.add(name);
//     }
//   }

//   async assertQueue(name: string, options?: amqp.Options.AssertQueue) {
//     this.ensureConnected();
//     await this.channel!.assertQueue(name, { durable: true, ...(options || {}) });
//   }

//   async bindQueue(queue: string, exchange: string, routingKey: string) {
//     this.ensureConnected();
//     await this.channel!.bindQueue(queue, exchange, routingKey);
//   }

//   async publish(exchange: string, routingKey: string, payload: any) {
//     if (!this.isConnected) {
//       console.warn('⚠️ RabbitMQ not connected - skipping message publish');
//       return;
//     }
    
//     // Ensure exchange exists before publishing
//     await this.assertExchange(exchange);

//     const buf = Buffer.from(JSON.stringify(payload));
//     this.channel!.publish(exchange, routingKey, buf, {
//       contentType: 'application/json',
//       persistent: true,
//     });
//   }

//   async consume(queue: string, handler: (msg: amqp.ConsumeMessage) => Promise<void>) {
//     this.ensureConnected();
//     await this.channel!.consume(queue, async (msg) => {
//       if (!msg) return;
//       try {
//         await handler(msg);
//         this.channel!.ack(msg);
//       } catch (err) {
//         console.error('Message handling failed, requeue:', err);
//         this.channel!.nack(msg, false, true);
//       }
//     });
//   }
// }