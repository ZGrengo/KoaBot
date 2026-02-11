import { Injectable } from '@nestjs/common';
import { SheetsRepository } from '../sheets/sheets.repository';
import { UsersService } from '../users/users.service';
import {
  generateId,
  ID_PREFIX,
  Production,
  ProductionOutput,
  ProductionWithOutputs
} from '@koabot/shared';
import { CreateProductionDto } from './dto/create-production.dto';

@Injectable()
export class ProductionsService {
  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly usersService: UsersService
  ) {}

  async create(dto: CreateProductionDto): Promise<ProductionWithOutputs> {
    let userId: string | undefined = dto.producedByUserId;
    if (dto.producedByTelegramId) {
      userId = await this.usersService.upsertByTelegramId(
        dto.producedByTelegramId,
        dto.producedByName || 'Unknown'
      );
    }

    if (!userId) {
      throw new Error('Either producedByUserId or producedByTelegramId must be provided');
    }

    const finalUserId: string = userId;

    const productionId = generateId(ID_PREFIX.production);
    const now = new Date().toISOString();

    const production: Production = {
      id: productionId,
      occurredAt: dto.occurredAt,
      batchName: dto.batchName,
      producedByUserId: finalUserId,
      createdAt: now
    };

    await this.sheetsRepository.appendRow('productions', [
      production.id,
      production.occurredAt,
      production.batchName,
      finalUserId,
      production.createdAt
    ]);

    const outputs: ProductionOutput[] = [];
    for (const outputDto of dto.outputs) {
      const outputId = generateId(ID_PREFIX.productionOutput);
      const output: ProductionOutput = {
        id: outputId,
        productionId: production.id,
        ref: outputDto.ref,
        product: outputDto.product,
        quantity: outputDto.quantity,
        unit: outputDto.unit
      };

      await this.sheetsRepository.appendRow('production_outputs', [
        output.id,
        output.productionId,
        output.ref,
        output.product,
        output.quantity,
        output.unit
      ]);

      outputs.push(output);
    }

    return { production, outputs };
  }

  async findByDateRange(from: string, to: string): Promise<ProductionWithOutputs[]> {
    const productions = await this.sheetsRepository.queryByDateRange<{
      production_id: string;
      occurred_at: string;
      batch_name: string;
      produced_by_user_id: string;
      created_at: string;
    }>('productions', 'occurred_at', from, to);

    const allOutputs = await this.sheetsRepository.getRows<{
      output_id: string;
      production_id: string;
      ref: string;
      product: string;
      quantity: string;
      unit: string;
    }>('production_outputs');

    return productions.map((prod) => {
      const outputs = allOutputs
        .filter((out) => out.production_id === prod.production_id)
        .map((out) => ({
          id: out.output_id,
          productionId: out.production_id,
          ref: out.ref,
          product: out.product,
          quantity: parseFloat(out.quantity),
          unit: out.unit as 'ud' | 'kg' | 'L'
        }));

      return {
        production: {
          id: prod.production_id,
          occurredAt: prod.occurred_at,
          batchName: prod.batch_name,
          producedByUserId: prod.produced_by_user_id,
          createdAt: prod.created_at
        },
        outputs
      };
    });
  }
}

