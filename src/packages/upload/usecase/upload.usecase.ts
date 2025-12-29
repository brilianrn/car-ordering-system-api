import { S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { IUploadFileResponse, IUploadResponse } from '../domain/response';
import { UploadDto } from '../dto/upload.dto';
import type { UploadRepositoryPort } from '../ports/repository.port';
import { UploadUsecasePort } from '../ports/usecase.port';

@Injectable()
export class UploadUseCase implements UploadUsecasePort {
  constructor(
    @Inject('UploadRepositoryPort')
    private readonly repository: UploadRepositoryPort,
    private readonly s3Service: S3Service,
  ) {
    this.repository = repository;
  }

  upload = async (uploadDto: UploadDto, userId: string): Promise<IUsecaseResponse<IUploadResponse>> => {
    try {
      const assets: Array<{ id: number; name: string; s3Key: string }> = [];

      for (const file of uploadDto.files) {
        try {
          const s3Key = await this.s3Service.uploadBase64(file.base64, file.name, uploadDto.path);

          const fileType = this.extractFileType(file.base64, file.name);

          const asset = await this.repository.create({
            fileName: file.name,
            url: s3Key,
            fileType,
            createdBy: userId || 'SYSTEM',
          });

          assets.push({
            id: asset.id,
            name: file.name,
            s3Key: asset.url,
          });
        } catch (error) {
          Logger.error(
            error instanceof Error ? error.message : 'Error uploading file',
            error instanceof Error ? error.stack : undefined,
            'UploadUseCase.upload - file processing',
          );
        }
      }

      if (!assets.length) {
        return {
          error: {
            message: 'All files failed to upload',
            code: HttpStatus.INTERNAL_SERVER_ERROR,
          },
        };
      }

      // Generate presigned URLs for all assets
      // Using Promise.all to ensure all async operations complete before returning
      const filesWithPresignedUrls: IUploadFileResponse[] = await Promise.all(
        assets.map(async (asset) => {
          try {
            const presignedUrl = await this.s3Service.getPresignedUrl(asset.s3Key);
            return {
              id: asset.id,
              name: asset.name,
              url: presignedUrl,
            };
          } catch (error) {
            Logger.error(
              error instanceof Error ? error.message : 'Error generating presigned URL',
              error instanceof Error ? error.stack : undefined,
              'UploadUseCase.upload - presigned URL generation',
            );
            // Return asset with original S3 key if presigned URL generation fails
            return {
              id: asset.id,
              name: asset.name,
              url: asset.s3Key,
            };
          }
        }),
      );

      return {
        data: {
          files: filesWithPresignedUrls,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in upload',
        error instanceof Error ? error.stack : undefined,
        'UploadUseCase.upload',
      );
      return { error };
    }
  };

  private extractFileType(base64: string, fileName: string): string | null {
    const dataUrlMatch = base64.match(/^data:([^;]+);base64,/);
    if (dataUrlMatch) {
      return dataUrlMatch[1];
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
    };

    return mimeTypes[ext || ''] || null;
  }
}
