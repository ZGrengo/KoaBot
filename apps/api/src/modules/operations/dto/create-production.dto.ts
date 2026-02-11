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

class ProductionOutputDto {
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

export class CreateProductionDto {
  @IsString()
  @IsNotEmpty()
  occurredAt: string;

  @IsString()
  @IsNotEmpty()
  batchName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionOutputDto)
  outputs: ProductionOutputDto[];

  @IsOptional()
  @IsString()
  producedByUserId?: string;

  @IsOptional()
  @IsString()
  producedByTelegramId?: string;

  @IsOptional()
  @IsString()
  producedByName?: string;
}

