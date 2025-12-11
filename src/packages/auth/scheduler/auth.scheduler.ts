import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class AuthScheduler {
  private readonly logger = new Logger(AuthScheduler.name);

  constructor(private readonly db: PrismaClient) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions() {
    this.logger.log('Cleaning expired sessions...');

    // const deleted = await this.db.session.deleteMany({
    //   where: {
    //     expiresAt: { lte: new Date() },
    //   },
    // });

    // this.logger.log(`Deleted expired sessions: ${deleted.count}`);
  }
}
