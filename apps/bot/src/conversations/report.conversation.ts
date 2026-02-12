import { Context } from 'telegraf';
import { getState, setState, clearState } from './conversation-state';
import { getWeeklyReportPdf } from '../api/reports.api';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function parseFlexibleDate(dateStr: string): string | null {
  const trimmed = dateStr.trim().toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // "hoy"
  if (trimmed === 'hoy') {
    return getTodayDate();
  }

  // Full date: YYYY-MM-DD
  const fullDateMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10);
    const day = parseInt(fullDateMatch[3], 10);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Month and day: MM-DD or M-D
  const monthDayMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})$/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10);
    const day = parseInt(monthDayMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Only day: D or DD
  const dayOnlyMatch = trimmed.match(/^(\d{1,2})$/);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function parseDateRange(text: string): { from: string; to: string } | null {
  const trimmed = text.trim();

  // Case 1: "semana" or "semana actual" - current week
  if (trimmed.toLowerCase() === 'semana' || trimmed.toLowerCase() === 'semana actual') {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
      from: monday.toISOString().split('T')[0],
      to: sunday.toISOString().split('T')[0]
    };
  }

  // Case 2: Single date - from that date to today
  const singleDate = parseFlexibleDate(trimmed);
  if (singleDate) {
    return {
      from: singleDate,
      to: getTodayDate()
    };
  }

  // Case 3: Date range with "a" separator
  const dateRangeMatch = trimmed.match(/^(.+?)\s+a\s+(.+)$/i);
  if (dateRangeMatch) {
    const fromPart = dateRangeMatch[1].trim();
    const toPart = dateRangeMatch[2].trim();

    const from = parseFlexibleDate(fromPart);
    const to = parseFlexibleDate(toPart);

    if (from && to) {
      return { from, to };
    }
  }

  return null;
}

export async function handleReportConversation(ctx: Context, textOverride?: string): Promise<void> {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      console.error('[handleReportConversation] No chatId');
      return;
    }

    // Use textOverride if provided, otherwise get from context
    let text = '';
    if (textOverride !== undefined) {
      text = textOverride.trim();
    } else {
      if (!ctx.message || !('text' in ctx.message)) {
        console.error('[handleReportConversation] Invalid context - no text in message');
        return;
      }
      text = ctx.message.text?.trim() || '';
    }

    console.log(`[handleReportConversation] text: "${text}"`);
    const state = getState(chatId);

    // If text is empty, show help
    if (!text) {
      setState(chatId, {
        type: 'report',
        step: 'dateRange',
        data: {}
      });
      await ctx.reply(
        '📊 Generar Reporte\n\n' +
        'Opciones:\n' +
        '• "semana" - Semana actual (lunes a domingo)\n' +
        '• "1" - Desde día 1 del mes actual hasta hoy\n' +
        '• "1 a 11" - Del día 1 al 11 del mes actual\n' +
        '• "1-2 a 11-2" - Del 1 de febrero al 11 de febrero\n' +
        '• "2024-01-01" - Desde esa fecha hasta hoy\n' +
        '• "2024-01-01 a 2024-01-07" - Rango específico\n' +
        '• "2024-01-01 a hoy" - Desde fecha hasta hoy\n\n' +
        'Ejemplos:\n' +
        '/reporte semana\n' +
        '/reporte 1\n' +
        '/reporte 1 a 11\n' +
        '/reporte 1-2 a 11-2\n' +
        '/reporte 2024-01-01 a hoy'
      );
      return;
    }

    // Try to parse the date range directly
    const dateRange = parseDateRange(text);
    if (dateRange) {
      await generateAndSendReport(ctx, dateRange.from, dateRange.to);
      clearState(chatId);
      return;
    }

    // If no state, prompt for input
    if (!state || state.type !== 'report') {
      setState(chatId, {
        type: 'report',
        step: 'dateRange',
        data: {}
      });
      await ctx.reply(
        '📊 Generar Reporte\n\n' +
        'Opciones:\n' +
        '• "semana" - Semana actual (lunes a domingo)\n' +
        '• "1" - Desde día 1 del mes actual hasta hoy\n' +
        '• "1 a 11" - Del día 1 al 11 del mes actual\n' +
        '• "1-2 a 11-2" - Del 1 de febrero al 11 de febrero\n' +
        '• "2024-01-01" - Desde esa fecha hasta hoy\n' +
        '• "2024-01-01 a 2024-01-07" - Rango específico\n' +
        '• "2024-01-01 a hoy" - Desde fecha hasta hoy\n\n' +
        'Ejemplos:\n' +
        '/reporte semana\n' +
        '/reporte 1\n' +
        '/reporte 1 a 11\n' +
        '/reporte 1-2 a 11-2\n' +
        '/reporte 2024-01-01 a hoy'
      );
      return;
    }

    // If in conversation state, try to parse again
    if (state.step === 'dateRange') {
      const parsedRange = parseDateRange(text);
      if (parsedRange) {
        await generateAndSendReport(ctx, parsedRange.from, parsedRange.to);
        clearState(chatId);
      } else {
        await ctx.reply(
          '❌ Formato inválido. Usa uno de estos formatos:\n\n' +
          '• "semana" - Semana actual\n' +
          '• "1" - Desde día 1 del mes actual hasta hoy\n' +
          '• "1 a 11" - Del día 1 al 11 del mes actual\n' +
          '• "1-2 a 11-2" - Del 1 de febrero al 11 de febrero\n' +
          '• "2024-01-01 a hoy" - Desde fecha hasta hoy'
        );
      }
    }
  } catch (error) {
    console.error('Error in handleReportConversation:', error);
    if (ctx.chat?.id) {
      try {
        await ctx.reply('❌ Error al procesar la solicitud de reporte. Por favor intenta de nuevo.');
      } catch (replyError) {
        console.error('Error sending error message:', replyError);
      }
    }
  }
}

async function generateAndSendReport(ctx: Context, from: string, to: string): Promise<void> {
  try {
    await ctx.reply('⏳ Generando reporte...');
    const pdfBuffer = await getWeeklyReportPdf(from, to);

    await ctx.replyWithDocument(
      {
        source: pdfBuffer,
        filename: `reporte-semanal-${from}-${to}.pdf`
      },
      {
        caption: `📊 Reporte\n${from} - ${to}`
      }
    );
  } catch (error: any) {
    console.error('Error generating report:', error);
    await ctx.reply(
      `❌ Error al generar el reporte: ${error.message || 'Error desconocido'}`
    );
  }
}


