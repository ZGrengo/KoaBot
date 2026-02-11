/**
 * Bootstrap script to create sheets and headers in Google Sheets
 * Run with: pnpm api:bootstrap-sheets
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { SheetsRepository } from './modules/sheets/sheets.repository';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const sheetsRepository = app.get(SheetsRepository);
  
  console.log('Bootstrapping Google Sheets...');
  await sheetsRepository.bootstrapSheets();
  console.log('✅ Sheets bootstrapped successfully!');
  
  await app.close();
}

bootstrap().catch((error) => {
  console.error('Error bootstrapping sheets:', error);
  process.exit(1);
});

