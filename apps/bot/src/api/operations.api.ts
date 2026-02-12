import axios from 'axios';
import { getApiBaseUrl } from '../config';

export async function getRecentSuppliers(): Promise<string[]> {
  const response = await axios.get(`${getApiBaseUrl()}/operations/recent-suppliers`);
  return response.data.suppliers || [];
}

export async function getRecentBatches(): Promise<string[]> {
  const response = await axios.get(`${getApiBaseUrl()}/operations/recent-batches`);
  return response.data.batches || [];
}

export async function undoLastOperation(chatId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/operations/undo`, {
      chatId: String(chatId)
    });
    return response.data;
  } catch (error: any) {
    console.error('[undoLastOperation] Error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Error al deshacer la operación'
    };
  }
}

