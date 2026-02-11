import { customAlphabet } from 'nanoid';

// --- Domain types ---

export type Unit = 'ud' | 'kg' | 'L';

export interface BaseEntity {
  id: string;
  createdAt: string; // ISO string
}

export interface User extends BaseEntity {
  id: string; // user_id
  telegramId: string;
  name: string;
}

export interface Reception extends BaseEntity {
  id: string; // reception_id
  occurredAt: string; // ISO date or datetime
  supplier: string;
  total: number | null;
  attachmentUrl?: string | null;
  registeredByUserId: string;
}

export interface ReceptionItem {
  id: string; // item_id
  receptionId: string;
  ref: string;
  product: string;
  quantity: number;
  unit: Unit;
}

export interface Wastage extends BaseEntity {
  id: string; // wastage_id
  occurredAt: string;
  ref: string;
  product: string;
  quantity: number;
  unit: Unit;
  reason?: string | null;
  attachmentUrl?: string | null;
  registeredByUserId: string;
}

export interface Production extends BaseEntity {
  id: string; // production_id
  occurredAt: string;
  batchName: string;
  producedByUserId: string;
}

export interface ProductionOutput {
  id: string; // output_id
  productionId: string;
  ref: string;
  product: string;
  quantity: number;
  unit: Unit;
}

export interface ReceptionWithItems {
  reception: Reception;
  items: ReceptionItem[];
}

export interface ProductionWithOutputs {
  production: Production;
  outputs: ProductionOutput[];
}

// --- ID helpers (using nanoid) ---

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

export function generateId(prefix: string): string {
  return `${prefix}_${nanoid()}`;
}

export const ID_PREFIX = {
  user: 'usr',
  reception: 'rcp',
  receptionItem: 'rit',
  wastage: 'wst',
  production: 'prd',
  productionOutput: 'out'
} as const;

// --- Unit & quantity helpers ---

export function normalizeUnit(raw: string): Unit | null {
  const value = raw.trim().toLowerCase();
  if (value === 'ud' || value === 'unidad' || value === 'unidades') return 'ud';
  if (value === 'kg' || value === 'kilo' || value === 'kilos') return 'kg';
  if (value === 'l' || value === 'lt' || value === 'litro' || value === 'litros') return 'L';
  return null;
}

export function parseDecimal(input: string): number | null {
  const normalized = input.replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

export interface ParsedLine {
  ref: string;
  product: string;
  quantity: number;
  unit: Unit;
}

/**
 * Parse a line like: "REF; nombre; cantidad; unidad"
 * Missing ref is replaced with "UNKNOWN".
 */
export function parseItemLine(line: string): ParsedLine {
  const parts = line.split(';').map((p) => p.trim());

  if (parts.length < 3) {
    throw new Error(
      'Formato inválido. Usa "REF; nombre; cantidad; unidad", por ejemplo: "ABC123; Tomate; 10; kg".',
    );
  }

  const [rawRef, rawProduct, rawQuantity, rawUnit] = parts;

  const ref = rawRef || 'UNKNOWN';
  const product = rawProduct;
  const quantity = parseDecimal(rawQuantity);
  const unit = normalizeUnit(rawUnit ?? '');

  if (!product) {
    throw new Error('El nombre del producto es obligatorio.');
  }

  if (quantity === null) {
    throw new Error(
      'Cantidad inválida. Usa un número decimal, por ejemplo "10" o "2,5".',
    );
  }

  if (!unit) {
    throw new Error(
      'Unidad inválida. Usa "ud", "kg" o "L". Ejemplo: "ABC123; Tomate; 10; kg".',
    );
  }

  return { ref, product, quantity, unit };
}


