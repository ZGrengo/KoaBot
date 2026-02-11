import { IsString, IsNotEmpty } from 'class-validator';

export class QueryWastagesDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
}

