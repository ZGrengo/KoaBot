import { Context } from 'telegraf';
import { getState, setState, clearState } from './conversation-state';
import { parseItemLine } from '@koabot/shared';
import { createProduction } from '../api/productions.api';
import { upsertUserByTelegramId } from '../api/users.api';

export async function handleProductionConversation(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const state = getState(chatId);

  if (!state || state.type !== 'production') {
    // Start production flow
    setState(chatId, {
      type: 'production',
      step: 'batchName',
      data: {}
    });
    await ctx.reply('🏭 Registro de Producción\n\n¿Cuál es el nombre del lote?');
    return;
  }

  const text = 'text' in ctx.message ? ctx.message.text : '';

  switch (state.step) {
    case 'batchName':
      state.data.batchName = text;
      state.step = 'date';
      setState(chatId, state);
      await ctx.reply(
        '📅 ¿Cuál es la fecha de producción?\n\nEnvía "hoy" o la fecha en formato YYYY-MM-DD'
      );
      break;

    case 'date':
      let dateStr = text.trim().toLowerCase();
      if (dateStr === 'hoy' || dateStr === '' || dateStr === 'today') {
        const today = new Date();
        dateStr = today.toISOString().split('T')[0];
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          await ctx.reply(
            '❌ Formato de fecha inválido. Usa YYYY-MM-DD o envía "hoy".'
          );
          return;
        }
      }
      state.data.occurredAt = dateStr;
      state.step = 'outputs';
      setState(chatId, state);
      await ctx.reply(
        '📋 Envía los productos producidos, uno por línea:\n\n' +
          'Formato: REF; nombre; cantidad; unidad\n\n' +
          'Ejemplo:\n' +
          'ABC123; Pan integral; 50; ud\n' +
          'DEF456; Pan blanco; 30; ud\n\n' +
          'Puedes enviar múltiples líneas.'
      );
      break;

    case 'outputs':
      const lines = text.split('\n').filter((l) => l.trim());
      const outputs: any[] = [];

      try {
        for (const line of lines) {
          const parsed = parseItemLine(line);
          outputs.push({
            ref: parsed.ref,
            product: parsed.product,
            quantity: parsed.quantity,
            unit: parsed.unit
          });
        }

        state.data.outputs = outputs;
        state.step = 'confirm';
        setState(chatId, state);

        const summary = `📋 Resumen de Producción:\n\n` +
          `Lote: ${state.data.batchName}\n` +
          `Fecha: ${state.data.occurredAt}\n` +
          `Productos (${outputs.length}):\n` +
          outputs.map((out, i) => 
            `${i + 1}. ${out.ref} - ${out.product} (${out.quantity} ${out.unit})`
          ).join('\n') +
          `\n\n¿Confirmas el registro? Responde "si" o "no"`;

        await ctx.reply(summary);
      } catch (error: any) {
        await ctx.reply(
          `❌ Error al parsear los productos:\n${error.message}\n\n` +
          `Por favor, envía los productos nuevamente en el formato correcto.`
        );
      }
      break;

    case 'confirm':
      const confirm = text.trim().toLowerCase();
      if (confirm === 'si' || confirm === 'sí' || confirm === 'yes' || confirm === 'y') {
        try {
          await createProduction({
            occurredAt: state.data.occurredAt,
            batchName: state.data.batchName,
            producedByTelegramId: String(ctx.from?.id),
            producedByName: ctx.from?.first_name || ctx.from?.username || 'Unknown',
            outputs: state.data.outputs
          });

          clearState(chatId);
          await ctx.reply('✅ Producción registrada correctamente!');
        } catch (error: any) {
          console.error('Error creating production:', error);
          await ctx.reply(
            `❌ Error al registrar la producción: ${error.message || 'Error desconocido'}`
          );
        }
      } else {
        clearState(chatId);
        await ctx.reply('❌ Registro cancelado.');
      }
      break;
  }
}

