import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from '../modules/health/health.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { SheetsModule } from '../modules/sheets/sheets.module';
import { UsersModule } from '../modules/users/users.module';
import { OperationsModule } from './operations/operations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    SheetsModule,
    HealthModule,
    UsersModule,
    OperationsModule,
    ReportsModule
  ]
})
export class AppModule {}


