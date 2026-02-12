import { Body, Controller, Get, Post } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { WastagesService } from './wastages.service';
import { ProductionsService } from './productions.service';
import { SheetsRepository } from '../sheets/sheets.repository';

class UndoDto {
  chatId: string;
}

@Controller('operations')
export class OperationsController {
  constructor(
    private readonly receptionsService: ReceptionsService,
    private readonly wastagesService: WastagesService,
    private readonly productionsService: ProductionsService,
    private readonly sheetsRepository: SheetsRepository
  ) {}

  @Get('recent-suppliers')
  async getRecentSuppliers() {
    const suppliers = await this.sheetsRepository.getRecentSuppliers(5);
    return { suppliers };
  }

  @Get('recent-batches')
  async getRecentBatches() {
    const batches = await this.sheetsRepository.getRecentBatchNames(5);
    return { batches };
  }

  @Post('undo')
  async undo(@Body() dto: UndoDto) {
    const operation = await this.sheetsRepository.findLastOperationByChatId(dto.chatId);
    
    if (!operation) {
      return { success: false, message: 'No operation found to undo' };
    }

    await this.sheetsRepository.softDelete(
      operation.sheetName,
      operation.idColumnName,
      operation.id
    );

    return { success: true, operation };
  }
}

