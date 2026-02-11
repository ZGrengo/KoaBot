import { apiClient } from './client';

export interface UpsertUserResponse {
  userId: string;
}

export async function upsertUserByTelegramId(
  telegramId: string,
  name: string
): Promise<string> {
  const response = await apiClient.post<UpsertUserResponse>(
    '/users/upsertByTelegramId',
    { telegramId, name }
  );
  return response.data.userId;
}

