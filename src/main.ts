import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { AppModule } from './modules';
import { SchedulerModule } from './modules/scheduler.module';
import { WorkerModule } from './modules/worker.module';
import { AllExceptionsFilter } from './shared/utils';

async function bootstrap() {
  const mode = process.env.MODE;

  console.log(`🚀 COS Backend starting in MODE = ${mode?.toUpperCase()}`);
  console.log(process.env.DATABASE_URL, 'DATABASE_URL DATABASE_URL');

  switch (mode) {
    case 'API': {
      const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
      });
      const configService = app.get(ConfigService);

      console.log(
        'Database URL in main.ts:',
        configService.get('DATABASE_URL'),
      );

      app.enableCors();

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
      await NestFactory.createApplicationContext(SchedulerModule, {
        logger: ['error', 'warn', 'log'],
      });

      console.log('🗓️ Scheduler started — running cron jobs...');
      break;
    }

    default:
      throw new Error(
        `❌ Invalid MODE "${mode}". Use api | worker | scheduler`,
      );
  }
}

bootstrap();
