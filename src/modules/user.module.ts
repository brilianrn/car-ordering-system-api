import { UserController } from '@/packages/user/controller/user.controller';
import { UserRepository } from '@/packages/user/repository/user.repository';
import { UserUseCase } from '@/packages/user/usecase/user.usecase';
import { Module } from '@nestjs/common';

@Module({
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
