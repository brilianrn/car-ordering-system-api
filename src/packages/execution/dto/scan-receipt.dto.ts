import { IsNotEmpty, IsString } from 'class-validator';

export class ScanReceiptDto {
  @IsString()
  @IsNotEmpty()
  photoUrl: string; // S3 key or presigned URL of receipt photo
}
