import { IsString, IsNotEmpty } from 'class-validator';

export class QueryWeeklyReportDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
}

