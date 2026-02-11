import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsIn,
  IsOptional
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWastageDto {
  @IsString()
  @IsNotEmpty()
  occurredAt: string;

  @IsString()
  @IsNotEmpty()
  ref: string;

  @IsString()
  @IsNotEmpty()
  product: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity: number;

  @IsString()
  @IsIn(['ud', 'kg', 'L'])
  unit: 'ud' | 'kg' | 'L';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  registeredByUserId?: string;

  @IsOptional()
  @IsString()
  registeredByTelegramId?: string;

  @IsOptional()
  @IsString()
  registeredByName?: string;
}

