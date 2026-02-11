import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpsertUserByTelegramIdDto } from './dto/upsert-user-by-telegram-id.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('upsertByTelegramId')
  async upsertByTelegramId(@Body() dto: UpsertUserByTelegramIdDto) {
    const userId = await this.usersService.upsertByTelegramId(
      dto.telegramId,
      dto.name
    );
    return { userId };
  }
}

