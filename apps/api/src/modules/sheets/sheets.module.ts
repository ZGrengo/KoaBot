import { Module } from '@nestjs/common';
import { SheetsRepository } from './sheets.repository';

@Module({
  providers: [SheetsRepository],
  exports: [SheetsRepository]
})
export class SheetsModule {}

