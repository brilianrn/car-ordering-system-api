import { RabbitMQService } from '@/shared/rabbitmq/rabbitmq.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class OrderScheduler {
  private readonly logger = new Logger(OrderScheduler.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly rabbit: RabbitMQService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelUnpaidOrders() {
    this.logger.log('Running: autoCancelUnpaidOrders');

    // const expired = await this.db.booking.updateMany({
    //   where: {
    //     : 'PENDING',
    //     createdAt: {
    //       lte: new Date(Date.now() - 30 * 60 * 1000),
    //     },
    //   },
    //   data: { status: 'CANCELLED' },
    // });

    // if (expired.count > 0) {
    //   await this.rabbit.publish('COS.ORDER.EVENT', 'order.expired', {
    //     type: 'ORDER_AUTO_EXPIRED',
    //     count: expired.count,
    //     timestamp: Date.now(),
    //   });
    // }

    // this.logger.log(`Expired orders: ${expired.count}`);
  }
}
