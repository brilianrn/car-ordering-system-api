import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Response } from 'express';
import { IUploadResponse } from '../domain/response';
import { UploadDto } from '../dto/upload.dto';

export interface UploadControllerPort {
  upload: (uploadDto: UploadDto, userId: string, res: Response) => Promise<Response<ResponseREST<IUploadResponse>>>;
}
