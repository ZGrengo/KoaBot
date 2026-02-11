import { apiClient } from './client';
import { Unit } from '@koabot/shared';

export interface CreateWastageBatchRequest {
  occurredAt: string;
  registeredByTelegramId: string;
  registeredByName: string;
  reason?: string;
  attachmentUrl?: string;
  items: {
    ref: string;
    product: string;
    quantity: number;
    unit: Unit;
  }[];
}

export interface WastageResponse {
  id: string;
  occurredAt: string;
  ref: string;
  product: string;
  quantity: number;
  unit: Unit;
  reason: string | null;
  attachmentUrl: string | null;
  registeredByUserId: string;
  createdAt: string;
}

export async function createWastageBatch(
  data: CreateWastageBatchRequest
): Promise<WastageResponse[]> {
  const response = await apiClient.post<WastageResponse[]>('/wastages/batch', data);
  return response.data;
}

