import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { BookingsModule } from './bookings.module';
import { DriversModule } from './driver.module';
import { UploadModule } from './upload.module';
import { VehiclesModule } from './vehicles.module';
import { CarpoolModule } from '@/packages/carpool/carpool.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    VehiclesModule,
    DriversModule,
    UploadModule,
    BookingsModule,
    CarpoolModule,
  ],
})
export class AppModule {}
