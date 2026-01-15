import { Module } from '@nestjs/common';
import { AnalyticsController } from './controller/analytics.controller';
import { AnalyticsUseCase } from './usecase/analytics.usecase';
import { AnalyticsRepository } from './repository/analytics.repository';
import { PrismaService } from '../../shared/database/prisma/prisma.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsUseCase,
    {
      provide: 'AnalyticsRepositoryPort',
      useClass: AnalyticsRepository,
    },
    PrismaService,
  ],
})
export class AnalyticsModule {}
