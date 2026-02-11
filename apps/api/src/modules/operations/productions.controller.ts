import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ProductionsService } from './productions.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { QueryProductionsDto } from './dto/query-productions.dto';

@Controller('productions')
export class ProductionsController {
  constructor(private readonly productionsService: ProductionsService) {}

  @Post()
  async create(@Body() dto: CreateProductionDto) {
    return this.productionsService.create(dto);
  }

  @Get()
  async findAll(@Query() query: QueryProductionsDto) {
    return this.productionsService.findByDateRange(query.from, query.to);
  }
}

