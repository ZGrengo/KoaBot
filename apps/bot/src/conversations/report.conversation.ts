import { Context } from 'telegraf';
import { getState, setState, clearState } from './conversation-state';
import { getWeeklyReportPdf } from '../api/reports.api';

export async function handleReportConversation(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = 'text' in ctx.message ? ctx.message.text : '';
  const state = getState(chatId);

  if (text.toLowerCase().trim() === 'semana' || text.toLowerCase().trim() === 'semana actual') {
    // Generate report for current week (Monday to Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const from = monday.toISOString().split('T')[0];
    const to = sunday.toISOString().split('T')[0];

    await generateAndSendReport(ctx, from, to);
    return;
  }

  if (!state || state.type !== 'report') {
    setState(chatId, {
      type: 'report',
      step: 'dateRange',
      data: {}
    });
    await ctx.reply(
      '📊 Generar Reporte Semanal\n\n' +
        'Envía "semana" para la semana actual (lunes a domingo)\n' +
        'O envía el rango de fechas en formato:\n' +
        'YYYY-MM-DD a YYYY-MM-DD\n\n' +
        'Ejemplo: 2024-01-01 a 2024-01-07'
    );
    return;
  }

  if (state.step === 'dateRange') {
    const dateRangeMatch = text.match(/(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})/i);
    if (dateRangeMatch) {
      const from = dateRangeMatch[1];
      const to = dateRangeMatch[2];
      await generateAndSendReport(ctx, from, to);
      clearState(chatId);
    } else {
      await ctx.reply(
        '❌ Formato inválido. Usa: YYYY-MM-DD a YYYY-MM-DD\n' +
          'Ejemplo: 2024-01-01 a 2024-01-07'
      );
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
        caption: `📊 Reporte semanal\n${from} - ${to}`
      }
    );
  } catch (error: any) {
    console.error('Error generating report:', error);
    await ctx.reply(
      `❌ Error al generar el reporte: ${error.message || 'Error desconocido'}`
    );
  }
}

