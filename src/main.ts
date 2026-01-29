import dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './modules';
import { SchedulerPackageModule } from './modules/scheduler.module';
import { WorkerModule } from './modules/worker.module';
import { AllExceptionsFilter } from './shared/utils';


const bootstrap = async () => {
  const mode = process.env.MODE;

  console.log(`🚀 COS Backend starting in MODE = ${mode?.toUpperCase()}`);

  switch (mode) {
    case 'API': {
      console.log('🚀 Creating NestJS application...');
      const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
      });
      console.log('✅ NestJS application created');

      app.get(ConfigService);
      app.enableCors();

      app.use(json({ limit: '50mb' }));
      app.use(urlencoded({ limit: '50mb', extended: true }));

      const port = process.env.PORT || 3000;

      app.enableCors({
        origin: [process.env.BASE_URL_WEB as string],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
      });

      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
        }),
      );

      app.useGlobalFilters(new AllExceptionsFilter());

      const httpAdapter = app.getHttpAdapter();
      httpAdapter.get('/', (_, res) => {
        res.status(200).json({
          code: 200,
          message: 'Welcome to Car Ordering System API',
        });
      });

      console.log(`🚀 Starting server on port ${port}...`);
      await app.listen(port);
      console.log(`🌐 API server running on port: ${port}`);
      break;
    }

    case 'WORKER': {
      await NestFactory.createApplicationContext(WorkerModule, {
        logger: ['error', 'warn', 'log'],
      });

      console.log('📩 Worker started — listening to BullMQ queues...');
      break;
    }

    case 'SCHEDULER': {
      console.log({
        cronExpression: process.env.SCHEDULER_CRON_EXPRESSION,
        timezone: process.env.SCHEDULER_TIMEZONE,
        retryAttempts: parseInt(process.env.SCHEDULER_RETRY_ATTEMPTS!),
        retryDelay: parseInt(process.env.SCHEDULER_RETRY_DELAY!),
        batchTimeout: parseInt(process.env.SCHEDULER_BATCH_TIMEOUT!),
        enableRollback: process.env.SCHEDULER_ENABLE_ROLLBACK === 'true',
      });
      const port = process.env.PORT || '3003';
      if (port !== '3003') {
        throw new Error(`❌ Scheduler mode must run on PORT=3003, got PORT=${port}`);
      }

      await NestFactory.createApplicationContext(SchedulerPackageModule, {
        logger: ['error', 'warn', 'log'],
      });

      console.log('🗓️ Scheduler started on port 3003 — running cron jobs...');
      break;
    }

    default:
      throw new Error(`❌ Invalid MODE "${mode}". Use api | worker | scheduler`);
  }
}

bootstrap();
