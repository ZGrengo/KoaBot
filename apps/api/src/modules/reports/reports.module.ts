import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SheetsModule } from '../sheets/sheets.module';
import { UsersModule } from '../users/users.module';
import { OperationsModule } from '../operations/operations.module';

@Module({
  imports: [SheetsModule, UsersModule, OperationsModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}

