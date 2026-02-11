import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { WastagesService } from './wastages.service';
import { CreateWastageDto } from './dto/create-wastage.dto';
import { CreateWastageBatchDto } from './dto/create-wastage-batch.dto';
import { QueryWastagesDto } from './dto/query-wastages.dto';

@Controller('wastages')
export class WastagesController {
  constructor(private readonly wastagesService: WastagesService) {}

  @Post()
  async create(@Body() dto: CreateWastageDto) {
    return this.wastagesService.create(dto);
  }

  @Post('batch')
  async createBatch(@Body() dto: CreateWastageBatchDto) {
    return this.wastagesService.createBatch(dto);
  }

  @Get()
  async findAll(@Query() query: QueryWastagesDto) {
    return this.wastagesService.findByDateRange(query.from, query.to);
  }
}

