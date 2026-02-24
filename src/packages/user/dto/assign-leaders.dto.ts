import { ArrayMinSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AssignLeadersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  leaderIds: string[];
}
