import { IsString, IsNotEmpty } from 'class-validator';

export class QueryReceptionsDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
}

