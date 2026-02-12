/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get yesterday's date in ISO format (YYYY-MM-DD)
 */
export function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Convert date string (YYYY-MM-DD) to ISO datetime string (UTC, 12:00 local time)
 * If timezone is needed, we use local noon and convert to UTC
 */
export function dateToISO(dateStr: string): string {
  // Parse YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.toISOString();
}

/**
 * Parse date input (handles "hoy", "ayer", YYYY-MM-DD)
 */
export function parseDateInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  
  if (trimmed === 'hoy' || trimmed === 'today' || trimmed === '') {
    return getTodayDate();
  }
  
  if (trimmed === 'ayer' || trimmed === 'yesterday') {
    return getYesterdayDate();
  }
  
  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(trimmed)) {
    return trimmed;
  }
  
  return null;
}

