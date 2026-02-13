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

export interface Product {
  ref: string;
  product: string;
  default_unit: string;
}

export async function getSupplierProducts(supplierName: string): Promise<Product[]> {
  try {
    const encodedName = encodeURIComponent(supplierName);
    const response = await axios.get(`${getApiBaseUrl()}/operations/supplier-products/${encodedName}`);
    return response.data.products || [];
  } catch (error: any) {
    console.error('[getSupplierProducts] Error:', error.response?.data || error.message);
    return [];
  }
}

export async function getWastageProducts(): Promise<Product[]> {
  try {
    const response = await axios.get(`${getApiBaseUrl()}/operations/wastage-products`);
    return response.data.products || [];
  } catch (error: any) {
    console.error('[getWastageProducts] Error:', error.response?.data || error.message);
    return [];
  }
}

export async function getProductionOutputsTemplate(batchName: string): Promise<Product[]> {
  try {
    const encodedName = encodeURIComponent(batchName);
    const response = await axios.get(`${getApiBaseUrl()}/operations/production-outputs-template/${encodedName}`);
    return response.data.outputs || [];
  } catch (error: any) {
    console.error('[getProductionOutputsTemplate] Error:', error.response?.data || error.message);
    return [];
  }
}

