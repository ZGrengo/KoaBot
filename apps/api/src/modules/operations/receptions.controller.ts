import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { QueryReceptionsDto } from './dto/query-receptions.dto';

@Controller('receptions')
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Post()
  async create(@Body() dto: CreateReceptionDto) {
    return this.receptionsService.create(dto);
  }

  @Get()
  async findAll(@Query() query: QueryReceptionsDto) {
    return this.receptionsService.findByDateRange(query.from, query.to);
  }
}

