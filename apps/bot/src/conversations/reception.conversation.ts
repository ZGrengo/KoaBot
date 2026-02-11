import { Context } from 'telegraf';
import { getState, setState, clearState } from './conversation-state';
import { parseItemLine } from '@koabot/shared';
import { createReception } from '../api/receptions.api';
import { upsertUserByTelegramId } from '../api/users.api';

export async function handleReceptionConversation(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const state = getState(chatId);

  if (!state || state.type !== 'reception') {
    // Start reception flow
    setState(chatId, {
      type: 'reception',
      step: 'supplier',
      data: {}
    });
    await ctx.reply('📦 Registro de Recepción\n\n¿Cuál es el nombre del proveedor?');
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
      let dateStr = text.trim().toLowerCase();
      if (dateStr === 'hoy' || dateStr === '' || dateStr === 'today') {
        const today = new Date();
        dateStr = today.toISOString().split('T')[0];
      } else {
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          await ctx.reply(
            '❌ Formato de fecha inválido. Usa YYYY-MM-DD o envía "hoy".'
          );
          return;
        }
      }
      state.data.occurredAt = dateStr;
      state.step = 'items';
      setState(chatId, state);
      await ctx.reply(
        '📋 Envía los items de la recepción, uno por línea:\n\n' +
          'Formato: REF; nombre; cantidad; unidad\n\n' +
          'Ejemplo:\n' +
          'ABC123; Tomate; 10; kg\n' +
          'DEF456; Lechuga; 5; ud\n\n' +
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
          ).join('\n') +
          `\n\n¿Confirmas el registro? Responde "si" o "no"`;

        await ctx.reply(summary);
      } catch (error: any) {
        await ctx.reply(
          `❌ Error al parsear los items:\n${error.message}\n\n` +
          `Por favor, envía los items nuevamente en el formato correcto.`
        );
      }
      break;

    case 'confirm':
      const confirm = text.trim().toLowerCase();
      if (confirm === 'si' || confirm === 'sí' || confirm === 'yes' || confirm === 'y') {
        try {
          const userId = await upsertUserByTelegramId(
            String(ctx.from?.id),
            ctx.from?.first_name || ctx.from?.username || 'Unknown'
          );

          await createReception({
            occurredAt: state.data.occurredAt,
            supplier: state.data.supplier,
            registeredByTelegramId: String(ctx.from?.id),
            registeredByName: ctx.from?.first_name || ctx.from?.username || 'Unknown',
            items: state.data.items
          });

          clearState(chatId);
          await ctx.reply('✅ Recepción registrada correctamente!');
        } catch (error: any) {
          console.error('Error creating reception:', error);
          await ctx.reply(
            `❌ Error al registrar la recepción: ${error.message || 'Error desconocido'}`
          );
        }
      } else {
        clearState(chatId);
        await ctx.reply('❌ Registro cancelado.');
      }
      break;
  }
}

