import { Telegraf } from 'telegraf';
import { setState, getState, clearState } from './../conversations/conversation-state';
import { upsertUserByTelegramId } from '../api/users.api';
import { handleReportConversation } from '../conversations/report.conversation';
import { getHelpMessage, getUnknownMessage } from '../utils/help-message';

export function setupCommands(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const name = ctx.from?.first_name || ctx.from?.username || 'Usuario';

    try {
      await upsertUserByTelegramId(telegramId, name);
    } catch (error) {
      console.error('Error registering user:', error);
    }

    await ctx.reply(getHelpMessage());
  });

  bot.command('recepcion', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    setState(chatId, {
      type: 'reception',
      step: 'supplier',
      data: {}
    });

    await ctx.reply('📦 Registro de Recepción\n\n¿Cuál es el nombre del proveedor?');
  });

  bot.command('merma', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    setState(chatId, {
      type: 'wastage',
      step: 'items',
      data: {}
    });

    await ctx.reply(
      '🗑️ Registro de Merma\n\n' +
      'Envía los items de merma, uno por línea:\n\n' +
      'Formato: REF; nombre; cantidad; unidad\n\n' +
      'Ejemplo:\n' +
      'ABC123; Tomate dañado; 2; kg\n' +
      'DEF456; Lechuga; 1; ud\n\n' +
      'Puedes enviar múltiples líneas. Después podrás agregar un motivo opcional.'
    );
  });

  bot.command('produccion', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    setState(chatId, {
      type: 'production',
      step: 'batchName',
      data: {}
    });

    await ctx.reply('🏭 Registro de Producción\n\n¿Cuál es el nombre del lote?');
  });

  bot.command('reporte', async (ctx) => {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        console.error('No chatId in reporte command');
        return;
      }

      // Clear any existing state when starting a new report command
      clearState(chatId);

      // Extract command arguments (everything after /reporte)
      const commandText = ctx.message.text || '';
      const args = commandText.replace(/^\/reporte\s*/i, '').trim();

      console.log(`[reporte] Command received, args: "${args}"`);

      // Pass the arguments directly to handleReportConversation
      await handleReportConversation(ctx, args);
    } catch (error) {
      console.error('Error in reporte command:', error);
      try {
        await ctx.reply('❌ Error al procesar el comando /reporte. Por favor intenta de nuevo.');
      } catch (replyError) {
        console.error('Error sending error message:', replyError);
      }
    }
  });

  bot.command('cancelar', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const state = getState(chatId);
    if (state) {
      clearState(chatId);
      await ctx.reply('❌ Acción cancelada.');
    } else {
      await ctx.reply('ℹ️ No hay ninguna acción en curso para cancelar.');
    }
  });

  bot.command('undo', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const { undoLastOperation } = await import('../api/operations.api');
    const result = await undoLastOperation(chatId);

    if (result.success) {
      await ctx.reply('✅ Última operación deshecha correctamente.');
    } else {
      await ctx.reply(`❌ ${result.message || 'No se pudo deshacer la operación'}`);
    }
  });

  // Handle unknown commands using hears with negative lookahead
  // This will match any command that is NOT one of the known commands
  bot.hears(/^\/(?!start|recepcion|merma|produccion|reporte|cancelar|undo\b)\w+/, async (ctx) => {
    await ctx.reply(getUnknownMessage());
  });
}

