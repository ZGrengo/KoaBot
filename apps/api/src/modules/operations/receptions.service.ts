import { Injectable } from '@nestjs/common';
import { SheetsRepository } from '../sheets/sheets.repository';
import { UsersService } from '../users/users.service';
import {
  generateId,
  ID_PREFIX,
  Reception,
  ReceptionItem,
  ReceptionWithItems
} from '@koabot/shared';
import { CreateReceptionDto } from './dto/create-reception.dto';

@Injectable()
export class ReceptionsService {
  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly usersService: UsersService
  ) {}

  async create(dto: CreateReceptionDto): Promise<ReceptionWithItems> {
    // Resolve user ID
    let userId: string | undefined = dto.registeredByUserId;
    if (dto.registeredByTelegramId) {
      userId = await this.usersService.upsertByTelegramId(
        dto.registeredByTelegramId,
        dto.registeredByName || 'Unknown'
      );
    }

    if (!userId) {
      throw new Error('Either registeredByUserId or registeredByTelegramId must be provided');
    }

    // At this point, userId is guaranteed to be a string
    const finalUserId: string = userId;

    const receptionId = generateId(ID_PREFIX.reception);
    const now = new Date().toISOString();

    const reception: Reception = {
      id: receptionId,
      occurredAt: dto.occurredAt,
      supplier: dto.supplier,
      total: dto.total || null,
      attachmentUrl: dto.attachmentUrl || null,
      registeredByUserId: finalUserId,
      createdAt: now
    };

    // Insert reception
    await this.sheetsRepository.appendRow('receptions', [
      reception.id,
      reception.occurredAt,
      reception.supplier,
      reception.total || '',
      reception.attachmentUrl || '',
      finalUserId,
      reception.createdAt
    ]);

    // Insert items
    const items: ReceptionItem[] = [];
    for (const itemDto of dto.items) {
      const itemId = generateId(ID_PREFIX.receptionItem);
      const item: ReceptionItem = {
        id: itemId,
        receptionId: reception.id,
        ref: itemDto.ref,
        product: itemDto.product,
        quantity: itemDto.quantity,
        unit: itemDto.unit
      };

      await this.sheetsRepository.appendRow('reception_items', [
        item.id,
        item.receptionId,
        item.ref,
        item.product,
        item.quantity,
        item.unit
      ]);

      items.push(item);
    }

    return { reception, items };
  }

  async findByDateRange(from: string, to: string): Promise<ReceptionWithItems[]> {
    const receptions = await this.sheetsRepository.queryByDateRange<{
      reception_id: string;
      occurred_at: string;
      supplier: string;
      total: string | null;
      attachment_url: string | null;
      registered_by_user_id: string;
      created_at: string;
    }>('receptions', 'occurred_at', from, to);

    const allItems = await this.sheetsRepository.getRows<{
      item_id: string;
      reception_id: string;
      ref: string;
      product: string;
      quantity: string;
      unit: string;
    }>('reception_items');

    return receptions.map((rec) => {
      const items = allItems
        .filter((item) => item.reception_id === rec.reception_id)
        .map((item) => ({
          id: item.item_id,
          receptionId: item.reception_id,
          ref: item.ref,
          product: item.product,
          quantity: parseFloat(item.quantity),
          unit: item.unit as 'ud' | 'kg' | 'L'
        }));

      return {
        reception: {
          id: rec.reception_id,
          occurredAt: rec.occurred_at,
          supplier: rec.supplier,
          total: rec.total ? parseFloat(rec.total) : null,
          attachmentUrl: rec.attachment_url || null,
          registeredByUserId: rec.registered_by_user_id,
          createdAt: rec.created_at
        },
        items
      };
    });
  }
}

