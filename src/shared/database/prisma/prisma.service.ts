import { clientDb } from '@/shared/utils';
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
    await clientDb.$connect();
  }

  async onModuleDestroy() {
    await clientDb.$disconnect();
  }
}
