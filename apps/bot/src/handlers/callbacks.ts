import { Telegraf, Context } from 'telegraf';
import { getState, setState, clearState } from '../conversations/conversation-state';
import { createConfirmationKeyboard, createDateKeyboard, createEditOptionsKeyboard, createReportQuickButtons, createUndoKeyboard } from '../utils/keyboards';
import { parseDateInput, dateToISO, getTodayDate, getYesterdayDate } from '../utils/date-helpers';
import { undoLastOperation } from '../api/operations.api';

export function setupCallbacks(bot: Telegraf): void {
  // Handle confirmation callbacks
  bot.action(/^confirm:(save|edit|cancel)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const match = ctx.match[1];
    const state = getState(chatId);

    if (!state || state.type === null) {
      await ctx.answerCbQuery('No hay acción en curso');
      return;
    }

    if (match === 'cancel') {
      clearState(chatId);
      await ctx.answerCbQuery('Cancelado');
      await ctx.editMessageText('❌ Acción cancelada.');
      return;
    }

    if (match === 'edit') {
      // Show edit options
      await ctx.editMessageReplyMarkup(createEditOptionsKeyboard());
      await ctx.answerCbQuery();
      return;
    }

    // match === 'save' - execute save
    await ctx.answerCbQuery('Guardando...');
    
    // Import conversation handlers to execute save
    if (state.type === 'reception') {
      const { handleReceptionSave } = await import('../conversations/reception.conversation');
      await handleReceptionSave(ctx, state);
    } else if (state.type === 'wastage') {
      // TODO: Implement handleWastageSave
      await ctx.editMessageText('❌ Guardado de merma no implementado aún');
    } else if (state.type === 'production') {
      // TODO: Implement handleProductionSave
      await ctx.editMessageText('❌ Guardado de producción no implementado aún');
    }
  });

  // Handle supplier selection callbacks
  bot.action(/^supplier:(\d+|other)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const match = ctx.match[1];
    const state = getState(chatId);

    if (!state || state.type !== 'reception') {
      await ctx.answerCbQuery('No hay acción en curso');
      return;
    }

    if (match === 'other') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('📦 ¿Cuál es el nombre del proveedor?');
      return;
    }

    // Get supplier from recent list
    const { getRecentSuppliers } = await import('../api/operations.api');
    const suppliers = await getRecentSuppliers();
    const index = parseInt(match, 10);
    
    if (index >= 0 && index < suppliers.length) {
      state.data.supplier = suppliers[index];
      state.step = 'date';
      setState(chatId, state);
      await ctx.answerCbQuery(`Proveedor: ${suppliers[index]}`);
      await ctx.editMessageText(
        `📦 Proveedor: ${suppliers[index]}\n\n📅 Selecciona la fecha:`,
        { reply_markup: createDateKeyboard() }
      );
    } else {
      await ctx.answerCbQuery('Proveedor no encontrado');
    }
  });

  // Handle batch selection callbacks
  bot.action(/^batch:(\d+|other)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const match = ctx.match[1];
    const state = getState(chatId);

    if (!state || state.type !== 'production') {
      await ctx.answerCbQuery('No hay acción en curso');
      return;
    }

    if (match === 'other') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('🏭 ¿Cuál es el nombre del lote?');
      return;
    }

    // Get batch from recent list
    const { getRecentBatches } = await import('../api/operations.api');
    const batches = await getRecentBatches();
    const index = parseInt(match, 10);
    
    if (index >= 0 && index < batches.length) {
      state.data.batchName = batches[index];
      state.step = 'date';
      setState(chatId, state);
      await ctx.answerCbQuery(`Lote: ${batches[index]}`);
      await ctx.editMessageText(
        `🏭 Lote: ${batches[index]}\n\n📅 Selecciona la fecha:`,
        { reply_markup: createDateKeyboard() }
      );
    } else {
      await ctx.answerCbQuery('Lote no encontrado');
    }
  });

  // Handle date callbacks
  bot.action(/^date:(today|yesterday|other)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const match = ctx.match[1];
    const state = getState(chatId);

    if (!state || (state.type !== 'reception' && state.type !== 'production')) {
      await ctx.answerCbQuery('No hay acción en curso');
      return;
    }

    let dateStr: string;
    if (match === 'today') {
      dateStr = getTodayDate();
    } else if (match === 'yesterday') {
      dateStr = getYesterdayDate();
    } else {
      // "other" - ask for date input
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        '📅 Envía la fecha en formato YYYY-MM-DD (ejemplo: 2024-01-15)'
      );
      return;
    }

    state.data.date = dateStr;
    state.data.dateISO = dateToISO(dateStr);
    setState(chatId, state);
    await ctx.answerCbQuery(`Fecha seleccionada: ${dateStr}`);
    
    // Continue conversation flow
    if (state.type === 'reception') {
      await ctx.editMessageText(
        `📅 Fecha: ${dateStr}\n\n📦 Envía los items, uno por línea:\n` +
        `Formato: "REF; nombre; cantidad; unidad"\n` +
        `Ejemplo: "ABC123; Tomate; 10; kg"\n\n` +
        `También puedes usar formatos naturales:\n` +
        `• "Tomate 10 kg"\n` +
        `• "10 kg Tomate"\n` +
        `• "ABC123 Tomate 10 kg"`
      );
      state.step = 'items';
      setState(chatId, state);
    } else if (state.type === 'production') {
      await ctx.editMessageText(
        `📅 Fecha: ${dateStr}\n\n🏭 Envía los outputs, uno por línea:\n` +
        `Formato: "REF; nombre; cantidad; unidad"\n` +
        `Ejemplo: "ABC123; Pan; 12; ud"`
      );
      state.step = 'outputs';
      setState(chatId, state);
    }
  });

  // Handle edit callbacks
  bot.action(/^edit:(supplier|date|items|cancel)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const match = ctx.match[1];
    const state = getState(chatId);

    if (!state || state.type === null) {
      await ctx.answerCbQuery('No hay acción en curso');
      return;
    }

    if (match === 'cancel') {
      // Show confirmation again
      await ctx.editMessageReplyMarkup(createConfirmationKeyboard());
      await ctx.answerCbQuery();
      return;
    }

    await ctx.answerCbQuery();

    if (match === 'supplier') {
      if (state.type === 'reception') {
        state.step = 'supplier';
        setState(chatId, state);
        await ctx.editMessageText('📦 ¿Cuál es el nombre del proveedor?');
      } else if (state.type === 'production') {
        state.step = 'batch';
        setState(chatId, state);
        await ctx.editMessageText('🏭 ¿Cuál es el nombre del lote?');
      }
    } else if (match === 'date') {
      state.step = 'date';
      setState(chatId, state);
      await ctx.editMessageReplyMarkup(createDateKeyboard());
      await ctx.editMessageText('📅 Selecciona la fecha:');
    } else if (match === 'items') {
      if (state.type === 'reception') {
        state.step = 'items';
        setState(chatId, state);
        await ctx.editMessageText(
          '📦 Envía los items, uno por línea:\n' +
          `Formato: "REF; nombre; cantidad; unidad"\n` +
          `Ejemplo: "ABC123; Tomate; 10; kg"`
        );
      } else if (state.type === 'production') {
        state.step = 'outputs';
        setState(chatId, state);
        await ctx.editMessageText(
          '🏭 Envía los outputs, uno por línea:\n' +
          `Formato: "REF; nombre; cantidad; unidad"\n` +
          `Ejemplo: "ABC123; Pan; 12; ud"`
        );
      } else if (state.type === 'wastage') {
        state.step = 'items';
        setState(chatId, state);
        await ctx.editMessageText(
          '🗑️ Envía los items de merma, uno por línea:\n' +
          `Formato: "REF; nombre; cantidad; unidad" o "nombre cantidad unidad motivo"\n` +
          `Ejemplo: "ABC123; Tomate; 10; kg; caducado" o "Tomate 10 kg caducado"`
        );
      }
    }
  });

  // Handle report quick buttons
  bot.action(/^report:(week|7days|month)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const match = ctx.match[1];
    let from: string;
    let to: string = getTodayDate();

    const today = new Date();
    
    if (match === 'week') {
      // Current week (Monday to Sunday)
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      from = monday.toISOString().split('T')[0];
    } else if (match === '7days') {
      // Last 7 days
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      from = sevenDaysAgo.toISOString().split('T')[0];
    } else {
      // Current month
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      from = firstDay.toISOString().split('T')[0];
    }

    await ctx.answerCbQuery('Generando reporte...');
    
    // Import and call report handler
    const { handleReportConversation } = await import('../conversations/report.conversation');
    await handleReportConversation(ctx, `${from} a ${to}`);
  });

  // Handle undo callback
  bot.action('undo:last', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await ctx.answerCbQuery('Deshaciendo...');
    
    const result = await undoLastOperation(chatId);
    
    if (result.success) {
      await ctx.editMessageText('✅ Última operación deshecha correctamente.');
    } else {
      await ctx.reply(`❌ ${result.message || 'No se pudo deshacer la operación'}`);
    }
  });
}

