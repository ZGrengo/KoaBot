import { apiClient } from './client';

export async function getWeeklyReportPdf(
  from: string,
  to: string
): Promise<Buffer> {
  const response = await apiClient.post<Buffer>(
    '/reports/weekly',
    {},
    {
      params: { from, to },
      responseType: 'arraybuffer'
    }
  );
  return Buffer.from(response.data);
}

