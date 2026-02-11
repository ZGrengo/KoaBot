import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { generateId, ID_PREFIX } from '@koabot/shared';

export interface SheetRow {
  [key: string]: string | number | null | undefined;
}

@Injectable()
export class SheetsRepository implements OnModuleInit {
  private readonly logger = new Logger(SheetsRepository.name);
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;

  // Sheet names and their headers
  private readonly SHEET_CONFIG = {
    users: ['user_id', 'telegram_id', 'name', 'created_at'],
    receptions: [
      'reception_id',
      'occurred_at',
      'supplier',
      'total',
      'attachment_url',
      'registered_by_user_id',
      'created_at'
    ],
    reception_items: [
      'item_id',
      'reception_id',
      'ref',
      'product',
      'quantity',
      'unit'
    ],
    wastages: [
      'wastage_id',
      'occurred_at',
      'ref',
      'product',
      'quantity',
      'unit',
      'reason',
      'attachment_url',
      'registered_by_user_id',
      'created_at'
    ],
    productions: [
      'production_id',
      'occurred_at',
      'batch_name',
      'produced_by_user_id',
      'created_at'
    ],
    production_outputs: [
      'output_id',
      'production_id',
      'ref',
      'product',
      'quantity',
      'unit'
    ]
  };

  constructor(private configService: ConfigService) {
    this.spreadsheetId = this.configService.get<string>(
      'GOOGLE_SHEETS_SPREADSHEET_ID',
    )!;
  }

  async onModuleInit() {
    await this.initializeGoogleSheets();
    await this.bootstrapSheets();
  }

  private async initializeGoogleSheets() {
    const jsonPath = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_JSON_PATH',
    );
    const jsonString = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_JSON',
    );

    let credentials: any;

    if (jsonPath) {
      // Load from file path
      const fs = await import('fs/promises');
      const path = await import('path');
      // Resolve path relative to project root (or absolute path)
      // If cwd is in apps/api, go up two levels to project root
      let projectRoot = process.cwd();
      if (projectRoot.endsWith('apps/api') || projectRoot.endsWith('apps\\api')) {
        projectRoot = path.resolve(projectRoot, '../..');
      }
      const resolvedPath = path.isAbsolute(jsonPath)
        ? jsonPath
        : path.resolve(projectRoot, jsonPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      credentials = JSON.parse(content);
    } else if (jsonString) {
      // Parse inline JSON string
      credentials = JSON.parse(jsonString);
    } else {
      throw new Error(
        'Either GOOGLE_SERVICE_ACCOUNT_JSON_PATH or GOOGLE_SERVICE_ACCOUNT_JSON must be set',
      );
    }

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.logger.log('Google Sheets API initialized');
  }

  /**
   * Bootstrap sheets: create them if they don't exist and ensure headers are set
   */
  async bootstrapSheets() {
    try {
      // Get all existing sheets
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const existingSheets = new Set(
        spreadsheet.data.sheets?.map((s) => s.properties?.title) || []
      );

      // Create missing sheets and set headers
      for (const [sheetName, headers] of Object.entries(this.SHEET_CONFIG)) {
        if (!existingSheets.has(sheetName)) {
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sheetName
                    }
                  }
                }
              ]
            }
          });
          this.logger.log(`Created sheet: ${sheetName}`);
        }

        // Ensure headers exist (check first row)
        const existingData = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`
        });

        if (!existingData.data.values || existingData.data.values.length === 0) {
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [headers]
            }
          });
          this.logger.log(`Set headers for sheet: ${sheetName}`);
        }
      }
    } catch (error) {
      this.logger.error('Error bootstrapping sheets', error);
      throw error;
    }
  }

  /**
   * Append a row to a sheet
   */
  async appendRow(sheetName: string, rowValues: (string | number | null | undefined)[]): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowValues]
        }
      });
    } catch (error) {
      this.logger.error(`Error appending row to ${sheetName}`, error);
      throw error;
    }
  }

  /**
   * Get all rows from a sheet, parsed with headers
   */
  async getRows<T extends SheetRow>(sheetName: string): Promise<T[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

      const headers = rows[0] as string[];
      const dataRows = rows.slice(1);

      return dataRows.map((row) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || null;
        });
        return obj as T;
      });
    } catch (error) {
      this.logger.error(`Error getting rows from ${sheetName}`, error);
      throw error;
    }
  }

  /**
   * Query rows by date range
   */
  async queryByDateRange<T extends SheetRow>(
    sheetName: string,
    dateColumnName: string,
    from: string,
    to: string
  ): Promise<T[]> {
    const allRows = await this.getRows<T>(sheetName);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // Include entire end day

    return allRows.filter((row) => {
      const dateStr = row[dateColumnName] as string;
      if (!dateStr) return false;
      const rowDate = new Date(dateStr);
      return rowDate >= fromDate && rowDate <= toDate;
    });
  }

  /**
   * Upsert user by telegram ID
   */
  async upsertUserByTelegramId(telegramId: string, name: string): Promise<string> {
    const users = await this.getRows<{
      user_id: string;
      telegram_id: string;
      name: string;
      created_at: string;
    }>('users');

    const existing = users.find((u) => u.telegram_id === telegramId);

    if (existing) {
      // Update name if different
      if (existing.name !== name) {
        const rowIndex = users.indexOf(existing) + 2; // +2 because: 1 header + 1-based index
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `users!C${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[name]]
          }
        });
      }
      return existing.user_id;
    } else {
      // Insert new user
      const userId = generateId(ID_PREFIX.user);
      const now = new Date().toISOString();
      await this.appendRow('users', [userId, telegramId, name, now]);
      return userId;
    }
  }
}

