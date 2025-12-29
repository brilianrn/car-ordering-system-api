import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IUploadResponse } from '../domain/response';
import { UploadDto } from '../dto/upload.dto';

export interface UploadUsecasePort {
  upload: (uploadDto: UploadDto, userId: string) => Promise<IUsecaseResponse<IUploadResponse>>;
}
