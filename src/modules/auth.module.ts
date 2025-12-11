import { AuthController } from '@/packages/auth/controller/auth.controller';
import { AuthRepository } from '@/packages/auth/repository/auth.repository';
import { AuthUseCase } from '@/packages/auth/usecase/auth.usecase';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthUseCase, AuthRepository],
})
export class AuthModule {}
