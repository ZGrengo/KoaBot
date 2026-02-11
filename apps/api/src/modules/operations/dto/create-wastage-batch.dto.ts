import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  IsIn
} from 'class-validator';
import { Type } from 'class-transformer';

class WastageItemDto {
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
}

export class CreateWastageBatchDto {
  @IsString()
  @IsNotEmpty()
  occurredAt: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastageItemDto)
  items: WastageItemDto[];

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

