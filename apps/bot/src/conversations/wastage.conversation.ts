import { Context } from 'telegraf';
import { getState, setState, clearState } from './conversation-state';
import { parseItemLine } from '@koabot/shared';
import { createWastageBatch } from '../api/wastages.api';
import { upsertUserByTelegramId } from '../api/users.api';

export async function handleWastageConversation(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const state = getState(chatId);

  if (!state || state.type !== 'wastage') {
    // Start wastage flow
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
    return;
  }

  const text = 'text' in ctx.message ? ctx.message.text : '';

  switch (state.step) {
    case 'items':
      const lines = text.split('\n').filter((l) => l.trim());
      const items: any[] = [];

      // Check if text contains "motivo:" prefix
      const motivoMatch = text.match(/motivo:\s*(.+)/i);
      if (motivoMatch) {
        state.data.reason = motivoMatch[1].trim();
        // Remove motivo line from items
        const itemLines = lines.filter((l) => !l.toLowerCase().includes('motivo:'));
        for (const line of itemLines) {
          try {
            const parsed = parseItemLine(line);
            items.push({
              ref: parsed.ref,
              product: parsed.product,
              quantity: parsed.quantity,
              unit: parsed.unit
            });
          } catch (error: any) {
            await ctx.reply(
              `❌ Error al parsear la línea: "${line}"\n${error.message}`
            );
            return;
          }
        }
      } else {
        // Parse items normally
        for (const line of lines) {
          try {
            const parsed = parseItemLine(line);
            items.push({
              ref: parsed.ref,
              product: parsed.product,
              quantity: parsed.quantity,
              unit: parsed.unit
            });
          } catch (error: any) {
            await ctx.reply(
              `❌ Error al parsear la línea: "${line}"\n${error.message}`
            );
            return;
          }
        }
      }

      if (items.length === 0) {
        await ctx.reply('❌ No se encontraron items válidos. Intenta de nuevo.');
        return;
      }

      state.data.items = items;
      if (!state.data.reason) {
        state.step = 'reason';
        setState(chatId, state);
        await ctx.reply(
          `📋 Items registrados (${items.length}):\n` +
            items.map((item, i) => 
              `${i + 1}. ${item.ref} - ${item.product} (${item.quantity} ${item.unit})`
            ).join('\n') +
            `\n\n¿Cuál es el motivo de la merma? (opcional, puedes escribir "ninguno" o "-")`
        );
      } else {
        state.step = 'confirm';
        setState(chatId, state);
        await confirmWastage(ctx, state);
      }
      break;

    case 'reason':
      const reason = text.trim();
      if (reason.toLowerCase() === 'ninguno' || reason === '-') {
        state.data.reason = null;
      } else {
        state.data.reason = reason;
      }
      state.step = 'confirm';
      setState(chatId, state);
      await confirmWastage(ctx, state);
      break;

    case 'confirm':
      const confirm = text.trim().toLowerCase();
      if (confirm === 'si' || confirm === 'sí' || confirm === 'yes' || confirm === 'y') {
        try {
          const today = new Date().toISOString().split('T')[0];
          await createWastageBatch({
            occurredAt: today,
            registeredByTelegramId: String(ctx.from?.id),
            registeredByName: ctx.from?.first_name || ctx.from?.username || 'Unknown',
            reason: state.data.reason || undefined,
            items: state.data.items
          });

          clearState(chatId);
          await ctx.reply('✅ Merma registrada correctamente!');
        } catch (error: any) {
          console.error('Error creating wastage:', error);
          await ctx.reply(
            `❌ Error al registrar la merma: ${error.message || 'Error desconocido'}`
          );
        }
      } else {
        clearState(chatId);
        await ctx.reply('❌ Registro cancelado.');
      }
      break;
  }
}

async function confirmWastage(ctx: Context, state: any): Promise<void> {
  const summary = `📋 Resumen de Merma:\n\n` +
    `Fecha: ${new Date().toISOString().split('T')[0]}\n` +
    `Items (${state.data.items.length}):\n` +
    state.data.items.map((item: any, i: number) => 
      `${i + 1}. ${item.ref} - ${item.product} (${item.quantity} ${item.unit})`
    ).join('\n') +
    `\nMotivo: ${state.data.reason || 'No especificado'}` +
    `\n\n¿Confirmas el registro? Responde "si" o "no"`;

  await ctx.reply(summary);
}

