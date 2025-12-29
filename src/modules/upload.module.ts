import { UploadController } from '@/packages/upload/controller/upload.controller';
import { UploadRepository } from '@/packages/upload/repository/upload.repository';
import { UploadUseCase } from '@/packages/upload/usecase/upload.usecase';
import { S3Service } from '@/shared/utils/bucket-s3';
import { Module } from '@nestjs/common';

@Module({
  controllers: [UploadController],
  providers: [
    {
      provide: 'UploadRepositoryPort',
      useClass: UploadRepository,
    },
    {
      provide: 'UploadUsecasePort',
      useClass: UploadUseCase,
    },
    S3Service,
  ],
  exports: ['UploadUsecasePort', 'UploadRepositoryPort', S3Service],
})
export class UploadModule {}
