import { Asset } from '@prisma/client';

export interface IAsset extends Asset {}

export interface IUploadFileResponse {
  id: number;
  name: string;
  url: string;
}

export interface IUploadResponse {
  files: IUploadFileResponse[];
}
