import { Context } from 'telegraf';
import { getState, setState, clearState } from './conversation-state';
import { parseItemLine } from '../parsing/item-parser';
import { createReception } from '../api/receptions.api';
import { upsertUserByTelegramId } from '../api/users.api';
import { getRecentSuppliers } from '../api/operations.api';
import { createConfirmationKeyboard, createDateKeyboard, createRecentOptionsKeyboard } from '../utils/keyboards';
import { parseDateInput, dateToISO } from '../utils/date-helpers';
import { createUndoKeyboard } from '../utils/keyboards';

export async function handleReceptionConversation(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const state = getState(chatId);

  if (!state || state.type !== 'reception') {
    // Start reception flow - show recent suppliers
    try {
      const recentSuppliers = await getRecentSuppliers();
      if (recentSuppliers.length > 0) {
        await ctx.reply(
          '📦 Registro de Recepción\n\n¿Cuál es el nombre del proveedor?',
          {
            reply_markup: createRecentOptionsKeyboard(recentSuppliers, 'supplier', 'Otro...')
          }
        );
      } else {
        await ctx.reply('📦 Registro de Recepción\n\n¿Cuál es el nombre del proveedor?');
      }
      setState(chatId, {
        type: 'reception',
        step: 'supplier',
        data: {}
      });
    } catch (error) {
      console.error('[handleReceptionConversation] Error fetching suppliers:', error);
      await ctx.reply('📦 Registro de Recepción\n\n¿Cuál es el nombre del proveedor?');
      setState(chatId, {
        type: 'reception',
        step: 'supplier',
        data: {}
      });
    }
    return;
  }

  const text = 'text' in ctx.message ? ctx.message.text : '';

  switch (state.step) {
    case 'supplier':
      state.data.supplier = text;
      state.step = 'date';
      setState(chatId, state);
      await ctx.reply(
        '📅 ¿Cuál es la fecha de la recepción?\n\nEnvía "hoy" o la fecha en formato YYYY-MM-DD (ejemplo: 2024-01-15)'
      );
      break;

    case 'date':
      const parsedDate = parseDateInput(text);
      if (!parsedDate) {
        await ctx.reply(
          '❌ Formato de fecha inválido. Usa YYYY-MM-DD, "hoy" o "ayer".',
          { reply_markup: createDateKeyboard() }
        );
        return;
      }
      state.data.occurredAt = parsedDate;
      state.data.dateISO = dateToISO(parsedDate);
      state.step = 'items';
      setState(chatId, state);
      await ctx.reply(
        '📋 Envía los items de la recepción, uno por línea:\n\n' +
          'Formatos aceptados:\n' +
          '• "REF; nombre; cantidad; unidad" (ej: "ABC123; Tomate; 10; kg")\n' +
          '• "nombre cantidad unidad" (ej: "Tomate 10 kg")\n' +
          '• "cantidad unidad nombre" (ej: "10 kg Tomate")\n' +
          '• "REF nombre cantidad unidad" (ej: "ABC123 Tomate 10 kg")\n\n' +
          'Puedes enviar múltiples líneas.'
      );
      break;

    case 'items':
      const lines = text.split('\n').filter((l) => l.trim());
      const items: any[] = [];

      try {
        for (const line of lines) {
          const parsed = parseItemLine(line);
          items.push({
            ref: parsed.ref,
            product: parsed.product,
            quantity: parsed.quantity,
            unit: parsed.unit
          });
        }

        state.data.items = items;
        state.step = 'confirm';
        setState(chatId, state);

        const summary = `📋 Resumen de Recepción:\n\n` +
          `Proveedor: ${state.data.supplier}\n` +
          `Fecha: ${state.data.occurredAt}\n` +
          `Items (${items.length}):\n` +
          items.map((item, i) => 
            `${i + 1}. ${item.ref} - ${item.product} (${item.quantity} ${item.unit})`
          ).join('\n');

        await ctx.reply(summary, { reply_markup: createConfirmationKeyboard() });
      } catch (error: any) {
        await ctx.reply(
          `❌ Error al parsear los items:\n${error.message}\n\n` +
          `Por favor, envía los items nuevamente en el formato correcto.`
        );
      }
      break;

    case 'confirm':
      // Handle confirmation via button callback (handled in callbacks.ts)
      // But also support text confirmation for backward compatibility
      const confirm = text.trim().toLowerCase();
      if (confirm === 'si' || confirm === 'sí' || confirm === 'yes' || confirm === 'y') {
        try {
          const userId = await upsertUserByTelegramId(
            String(ctx.from?.id),
            ctx.from?.first_name || ctx.from?.username || 'Unknown'
          );

          await createReception({
            occurredAt: state.data.dateISO || state.data.occurredAt,
            supplier: state.data.supplier,
            registeredByTelegramId: String(ctx.from?.id),
            registeredByName: ctx.from?.first_name || ctx.from?.username || 'Unknown',
            createdByChatId: String(chatId),
            items: state.data.items
          });

          clearState(chatId);
          await ctx.reply('✅ Recepción registrada correctamente!', {
            reply_markup: createUndoKeyboard()
          });
        } catch (error: any) {
          console.error('Error creating reception:', error);
          await ctx.reply(
            `❌ Error al registrar la recepción: ${error.message || 'Error desconocido'}`
          );
        }
      } else if (confirm === 'no' || confirm === 'n') {
        clearState(chatId);
        await ctx.reply('❌ Registro cancelado.');
      }
      break;
  }
}

// Export save function for callbacks
export async function handleReceptionSave(ctx: Context, state: any): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  try {
    await upsertUserByTelegramId(
      String(ctx.from?.id),
      ctx.from?.first_name || ctx.from?.username || 'Unknown'
    );

    await createReception({
      occurredAt: state.data.dateISO || state.data.occurredAt,
      supplier: state.data.supplier,
      registeredByTelegramId: String(ctx.from?.id),
      registeredByName: ctx.from?.first_name || ctx.from?.username || 'Unknown',
      createdByChatId: String(chatId),
      items: state.data.items
    });

    clearState(chatId);
    await ctx.editMessageText('✅ Recepción registrada correctamente!', {
      reply_markup: createUndoKeyboard()
    });
  } catch (error: any) {
    console.error('Error creating reception:', error);
    await ctx.editMessageText(
      `❌ Error al registrar la recepción: ${error.message || 'Error desconocido'}`
    );
  }
}

