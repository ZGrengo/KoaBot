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
      'created_at',
      'created_by_chat_id',
      'deleted_at'
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
      'created_at',
      'created_by_chat_id',
      'deleted_at'
    ],
    productions: [
      'production_id',
      'occurred_at',
      'batch_name',
      'produced_by_user_id',
      'created_at',
      'created_by_chat_id',
      'deleted_at'
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
   * Query rows by date range (excluding soft-deleted rows)
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
      // Exclude soft-deleted rows
      if (row.deleted_at) return false;

      const dateStr = row[dateColumnName] as string;
      if (!dateStr) return false;
      const rowDate = new Date(dateStr);
      return rowDate >= fromDate && rowDate <= toDate;
    });
  }

  /**
   * Get recent unique suppliers (top N, ordered by most recent)
   */
  async getRecentSuppliers(limit: number = 5): Promise<string[]> {
    const receptions = await this.getRows<{
      supplier: string;
      created_at: string;
      deleted_at?: string | null;
    }>('receptions');

    // Filter out deleted and get unique suppliers with their latest date
    const supplierMap = new Map<string, Date>();
    for (const rec of receptions) {
      if (rec.deleted_at) continue;
      const supplier = rec.supplier;
      if (!supplier) continue;

      const date = new Date(rec.created_at);
      const existing = supplierMap.get(supplier);
      if (!existing || date > existing) {
        supplierMap.set(supplier, date);
      }
    }

    // Sort by date (most recent first) and take top N
    return Array.from(supplierMap.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .slice(0, limit)
      .map(([supplier]) => supplier);
  }

  /**
   * Get recent unique batch names (top N, ordered by most recent)
   */
  async getRecentBatchNames(limit: number = 5): Promise<string[]> {
    const productions = await this.getRows<{
      batch_name: string;
      created_at: string;
      deleted_at?: string | null;
    }>('productions');

    // Filter out deleted and get unique batch names with their latest date
    const batchMap = new Map<string, Date>();
    for (const prod of productions) {
      if (prod.deleted_at) continue;
      const batchName = prod.batch_name;
      if (!batchName) continue;

      const date = new Date(prod.created_at);
      const existing = batchMap.get(batchName);
      if (!existing || date > existing) {
        batchMap.set(batchName, date);
      }
    }

    // Sort by date (most recent first) and take top N
    return Array.from(batchMap.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .slice(0, limit)
      .map(([batchName]) => batchName);
  }

  /**
   * Soft delete: update deleted_at column for a row
   */
  async softDelete(sheetName: string, idColumnName: string, id: string): Promise<void> {
    const rows = await this.getRows<SheetRow>(sheetName);
    const rowIndex = rows.findIndex((row) => row[idColumnName] === id);

    if (rowIndex === -1) {
      throw new Error(`Row with ${idColumnName}=${id} not found in ${sheetName}`);
    }

    // Find deleted_at column index
    const headers = this.SHEET_CONFIG[sheetName as keyof typeof this.SHEET_CONFIG];
    if (!headers) {
      throw new Error(`Unknown sheet: ${sheetName}`);
    }

    const deletedAtIndex = headers.indexOf('deleted_at');
    if (deletedAtIndex === -1) {
      throw new Error(`Sheet ${sheetName} does not have deleted_at column`);
    }

    const actualRowIndex = rowIndex + 2; // +2: 1 header + 1-based index
    const columnLetter = String.fromCharCode(65 + deletedAtIndex); // A=65

    const deletedAt = new Date().toISOString();
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!${columnLetter}${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[deletedAt]]
      }
    });
  }

  /**
   * Find the most recent operation (reception/wastage/production) for a chatId
   * Returns { sheetName, idColumnName, id } or null
   */
  async findLastOperationByChatId(chatId: string | number): Promise<{
    sheetName: string;
    idColumnName: string;
    id: string;
  } | null> {
    const chatIdStr = String(chatId);

    // Check receptions
    const receptions = await this.getRows<{
      reception_id: string;
      created_at: string;
      created_by_chat_id?: string | null;
      deleted_at?: string | null;
    }>('receptions');

    const validReceptions = receptions
      .filter((r) => r.created_by_chat_id === chatIdStr && !r.deleted_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (validReceptions.length > 0) {
      return {
        sheetName: 'receptions',
        idColumnName: 'reception_id',
        id: validReceptions[0].reception_id
      };
    }

    // Check wastages
    const wastages = await this.getRows<{
      wastage_id: string;
      created_at: string;
      created_by_chat_id?: string | null;
      deleted_at?: string | null;
    }>('wastages');

    const validWastages = wastages
      .filter((w) => w.created_by_chat_id === chatIdStr && !w.deleted_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (validWastages.length > 0) {
      return {
        sheetName: 'wastages',
        idColumnName: 'wastage_id',
        id: validWastages[0].wastage_id
      };
    }

    // Check productions
    const productions = await this.getRows<{
      production_id: string;
      created_at: string;
      created_by_chat_id?: string | null;
      deleted_at?: string | null;
    }>('productions');

    const validProductions = productions
      .filter((p) => p.created_by_chat_id === chatIdStr && !p.deleted_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (validProductions.length > 0) {
      return {
        sheetName: 'productions',
        idColumnName: 'production_id',
        id: validProductions[0].production_id
      };
    }

    return null;
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

