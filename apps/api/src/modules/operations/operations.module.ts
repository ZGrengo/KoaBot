import { Module } from '@nestjs/common';
import { ReceptionsController } from './receptions.controller';
import { WastagesController } from './wastages.controller';
import { ProductionsController } from './productions.controller';
import { ReceptionsService } from './receptions.service';
import { WastagesService } from './wastages.service';
import { ProductionsService } from './productions.service';
import { SheetsModule } from '../sheets/sheets.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SheetsModule, UsersModule],
  controllers: [ReceptionsController, WastagesController, ProductionsController],
  providers: [ReceptionsService, WastagesService, ProductionsService]
})
export class OperationsModule {}

