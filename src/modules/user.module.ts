import { UserController } from '@/packages/user/controller/user.controller';
import { UserRepository } from '@/packages/user/repository/user.repository';
import { UserUseCase } from '@/packages/user/usecase/user.usecase';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    HttpModule, // for HttpService (available if needed in future)
    MulterModule.register({
      storage: memoryStorage(), // file uploads remain in-memory
    }),
  ],
  controllers: [UserController],
  providers: [
    {
      provide: 'UserRepositoryPort',
      useClass: UserRepository,
    },
    {
      provide: 'UserUsecasePort',
      useClass: UserUseCase,
    },
  ],
  exports: ['UserUsecasePort'],
})
export class UserModule {}
