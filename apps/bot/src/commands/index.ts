import { Telegraf } from 'telegraf';
import { setState } from './../conversations/conversation-state';
import { upsertUserByTelegramId } from '../api/users.api';
import { handleReportConversation } from '../conversations/report.conversation';

export function setupCommands(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const name = ctx.from?.first_name || ctx.from?.username || 'Usuario';

    try {
      await upsertUserByTelegramId(telegramId, name);
    } catch (error) {
      console.error('Error registering user:', error);
    }

    await ctx.reply(
      '👋 ¡Hola! Soy el bot de gestión del restaurante.\n\n' +
        'Comandos disponibles:\n' +
        '/recepcion - Registrar una recepción (albarán)\n' +
        '/merma - Registrar merma\n' +
        '/produccion - Registrar producción\n' +
        '/reporte - Generar reporte semanal en PDF\n\n' +
        'Usa los comandos para comenzar a registrar operaciones.'
    );
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
    await handleReportConversation(ctx);
  });
}

