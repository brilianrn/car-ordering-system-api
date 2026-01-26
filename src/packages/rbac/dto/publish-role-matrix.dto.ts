import { IsString } from 'class-validator';

export class PublishRoleMatrixDto {
  @IsString()
  roleMatrixId: string;

  @IsString()
  reviewerId: string;
}
