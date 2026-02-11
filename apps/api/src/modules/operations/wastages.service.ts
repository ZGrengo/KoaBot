import { Injectable } from '@nestjs/common';
import { SheetsRepository } from '../sheets/sheets.repository';
import { UsersService } from '../users/users.service';
import { generateId, ID_PREFIX, Wastage } from '@koabot/shared';
import { CreateWastageDto } from './dto/create-wastage.dto';
import { CreateWastageBatchDto } from './dto/create-wastage-batch.dto';

@Injectable()
export class WastagesService {
  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly usersService: UsersService
  ) {}

  async create(dto: CreateWastageDto): Promise<Wastage> {
    let userId = dto.registeredByUserId;
    if (dto.registeredByTelegramId) {
      userId = await this.usersService.upsertByTelegramId(
        dto.registeredByTelegramId,
        dto.registeredByName || 'Unknown'
      );
    }

    const wastageId = generateId(ID_PREFIX.wastage);
    const now = new Date().toISOString();

    const wastage: Wastage = {
      id: wastageId,
      occurredAt: dto.occurredAt,
      ref: dto.ref,
      product: dto.product,
      quantity: dto.quantity,
      unit: dto.unit,
      reason: dto.reason || null,
      attachmentUrl: dto.attachmentUrl || null,
      registeredByUserId: userId,
      createdAt: now
    };

    await this.sheetsRepository.appendRow('wastages', [
      wastage.id,
      wastage.occurredAt,
      wastage.ref,
      wastage.product,
      wastage.quantity,
      wastage.unit,
      wastage.reason || '',
      wastage.attachmentUrl || '',
      wastage.registeredByUserId,
      wastage.createdAt
    ]);

    return wastage;
  }

  async createBatch(dto: CreateWastageBatchDto): Promise<Wastage[]> {
    let userId = dto.registeredByUserId;
    if (dto.registeredByTelegramId) {
      userId = await this.usersService.upsertByTelegramId(
        dto.registeredByTelegramId,
        dto.registeredByName || 'Unknown'
      );
    }

    const wastages: Wastage[] = [];
    const now = new Date().toISOString();

    for (const item of dto.items) {
      const wastageId = generateId(ID_PREFIX.wastage);
      const wastage: Wastage = {
        id: wastageId,
        occurredAt: dto.occurredAt,
        ref: item.ref,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        reason: dto.reason || null,
        attachmentUrl: dto.attachmentUrl || null,
        registeredByUserId: userId,
        createdAt: now
      };

      await this.sheetsRepository.appendRow('wastages', [
        wastage.id,
        wastage.occurredAt,
        wastage.ref,
        wastage.product,
        wastage.quantity,
        wastage.unit,
        wastage.reason || '',
        wastage.attachmentUrl || '',
        wastage.registeredByUserId,
        wastage.createdAt
      ]);

      wastages.push(wastage);
    }

    return wastages;
  }

  async findByDateRange(from: string, to: string): Promise<Wastage[]> {
    const wastages = await this.sheetsRepository.queryByDateRange<{
      wastage_id: string;
      occurred_at: string;
      ref: string;
      product: string;
      quantity: string;
      unit: string;
      reason: string | null;
      attachment_url: string | null;
      registered_by_user_id: string;
      created_at: string;
    }>('wastages', 'occurred_at', from, to);

    return wastages.map((w) => ({
      id: w.wastage_id,
      occurredAt: w.occurred_at,
      ref: w.ref,
      product: w.product,
      quantity: parseFloat(w.quantity),
      unit: w.unit as 'ud' | 'kg' | 'L',
      reason: w.reason || null,
      attachmentUrl: w.attachment_url || null,
      registeredByUserId: w.registered_by_user_id,
      createdAt: w.created_at
    }));
  }
}

