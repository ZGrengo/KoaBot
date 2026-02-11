import { IsString, IsNotEmpty } from 'class-validator';

export class QueryProductionsDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
}

