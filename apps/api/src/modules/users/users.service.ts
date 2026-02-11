import { Injectable } from '@nestjs/common';
import { SheetsRepository } from '../sheets/sheets.repository';

@Injectable()
export class UsersService {
  constructor(private readonly sheetsRepository: SheetsRepository) {}

  async upsertByTelegramId(telegramId: string, name: string): Promise<string> {
    return this.sheetsRepository.upsertUserByTelegramId(telegramId, name);
  }
}

