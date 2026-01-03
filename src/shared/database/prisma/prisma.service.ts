import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return (target as any)[prop];
        }
        return (clientDb as any)[prop];
      },
    });
  }

  async onModuleInit() {
    try {
      await clientDb.$connect();
      Logger.info('Database connection established', 'PrismaService');
    } catch (error) {
      Logger.error(
        `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'PrismaService',
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      Logger.info('Closing database connections...', 'PrismaService');
      // Only disconnect Prisma client
      // DO NOT end the pool here - PrismaPg adapter manages it
      // Ending the pool here can cause "Cannot use a pool after calling end" errors
      // if there are still pending queries or the pool is being used elsewhere
      // The pool will be cleaned up automatically when the process exits
      await clientDb.$disconnect();
      Logger.info('Database connections closed', 'PrismaService');
    } catch (error) {
      Logger.error(
        `Error closing database connections: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'PrismaService',
      );
    }
  }
}
