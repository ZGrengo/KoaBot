import { apiClient } from './client';
import { Unit } from '@koabot/shared';

export interface CreateReceptionRequest {
  occurredAt: string;
  supplier: string;
  total?: number;
  attachmentUrl?: string;
  registeredByTelegramId: string;
  registeredByName: string;
  items: {
    ref: string;
    product: string;
    quantity: number;
    unit: Unit;
  }[];
}

export interface ReceptionResponse {
  reception: {
    id: string;
    occurredAt: string;
    supplier: string;
    total: number | null;
    attachmentUrl: string | null;
    registeredByUserId: string;
    createdAt: string;
  };
  items: Array<{
    id: string;
    receptionId: string;
    ref: string;
    product: string;
    quantity: number;
    unit: Unit;
  }>;
}

export async function createReception(
  data: CreateReceptionRequest
): Promise<ReceptionResponse> {
  const response = await apiClient.post<ReceptionResponse>('/receptions', data);
  return response.data;
}

