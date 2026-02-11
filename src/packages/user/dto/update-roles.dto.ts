import { Role } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateRolesDto {
  @IsNotEmpty()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles: Role[];
}
