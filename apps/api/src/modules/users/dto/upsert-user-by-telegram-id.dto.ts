import { IsString, IsNotEmpty } from 'class-validator';

export class UpsertUserByTelegramIdDto {
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

