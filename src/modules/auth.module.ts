import { AuthController } from '@/packages/auth/controller/auth.controller';
import { AuthRepository } from '@/packages/auth/repository/auth.repository';
import { JwtStrategy } from '@/packages/auth/strategy';
import { AuthUseCase } from '@/packages/auth/usecase/auth.usecase';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: 'AuthRepositoryPort',
      useClass: AuthRepository,
    },
    {
      provide: 'AuthUsecasePort',
      useClass: AuthUseCase,
    },
    JwtStrategy,
  ],
  exports: ['AuthUsecasePort', JwtStrategy],
})
export class AuthModule {}
