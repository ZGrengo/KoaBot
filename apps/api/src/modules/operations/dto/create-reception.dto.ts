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

class ReceptionItemDto {
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

export class CreateReceptionDto {
  @IsString()
  @IsNotEmpty()
  occurredAt: string;

  @IsString()
  @IsNotEmpty()
  supplier: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  total?: number;

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

  @IsOptional()
  @IsString()
  createdByChatId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceptionItemDto)
  items: ReceptionItemDto[];
}

