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

  @IsNumber()
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
  @IsNumber()
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceptionItemDto)
  items: ReceptionItemDto[];
}

