import { apiClient } from './client';
import { Unit } from '@koabot/shared';

export interface CreateProductionRequest {
  occurredAt: string;
  batchName: string;
  producedByTelegramId: string;
  producedByName: string;
  outputs: {
    ref: string;
    product: string;
    quantity: number;
    unit: Unit;
  }[];
}

export interface ProductionResponse {
  production: {
    id: string;
    occurredAt: string;
    batchName: string;
    producedByUserId: string;
    createdAt: string;
  };
  outputs: Array<{
    id: string;
    productionId: string;
    ref: string;
    product: string;
    quantity: number;
    unit: Unit;
  }>;
}

export async function createProduction(
  data: CreateProductionRequest
): Promise<ProductionResponse> {
  const response = await apiClient.post<ProductionResponse>('/productions', data);
  return response.data;
}

