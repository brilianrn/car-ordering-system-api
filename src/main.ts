import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules';
import { SchedulerModule } from './modules/scheduler.module';
import { WorkerModule } from './modules/worker.module';
import { AllExceptionsFilter } from './shared/utils';

async function bootstrap() {
  const mode = process.env.MODE;

  console.log(`🚀 COS Backend starting in MODE = ${mode?.toUpperCase()}`);

  switch (mode) {
    case 'API': {
      const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
      });

      app.setGlobalPrefix('v1');
      app.enableCors();

      const port = process.env.PORT || 3000;

      app.enableCors({
        origin: [process.env.BASE_URL_WEB as string],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
      });

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
