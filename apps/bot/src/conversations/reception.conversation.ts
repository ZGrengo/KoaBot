import { Context } from 'telegraf';
import { getState, setState, clearState } from './conversation-state';
import { parseItemLine } from '../parsing/item-parser';
import { createReception } from '../api/receptions.api';
import { upsertUserByTelegramId } from '../api/users.api';
import { getRecentSuppliers, getSupplierProducts } from '../api/operations.api';
import { createConfirmationKeyboard, createDateKeyboard, createRecentOptionsKeyboard } from '../utils/keyboards';
import { parseDateInput, dateToISO } from '../utils/date-helpers';
import { createUndoKeyboard } from '../utils/keyboards';
import { formatProductTable, createProductKeyboard, formatSelectedItemsSummary, SelectedItem } from '../utils/product-table';

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
    case 'supplier': {
      state.data.supplier = text;
      state.data.selectedItems = state.data.selectedItems || [];
      state.step = 'products';
      setState(chatId, state);
      
      // Fetch products for this supplier
      try {
        const products = await getSupplierProducts(text);
        if (products.length > 0) {
          const tableText = formatProductTable(products);
          const keyboard = createProductKeyboard(products, state.data.selectedItems || [], 'reception:product');
          state.data.availableProducts = products;
          setState(chatId, state);
          
          await ctx.reply(tableText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        } else {
          // No products found, allow manual input
          await ctx.reply(
            '📋 No se encontraron productos predefinidos para este proveedor.\n\n' +
            'Envía los items de la recepción, uno por línea:\n\n' +
            'Formatos aceptados:\n' +
            '• "REF; nombre; cantidad; unidad" (ej: "ABC123; Tomate; 10; kg")\n' +
            '• "nombre cantidad unidad" (ej: "Tomate 10 kg")\n' +
            '• "cantidad unidad nombre" (ej: "10 kg Tomate")\n' +
            '• "REF nombre cantidad unidad" (ej: "ABC123 Tomate 10 kg")\n\n' +
            'Puedes enviar múltiples líneas.'
          );
        }
      } catch (error) {
        console.error('[handleReceptionConversation] Error fetching products:', error);
        // Fallback to manual input
        await ctx.reply(
          '📋 Envía los items de la recepción, uno por línea:\n\n' +
          'Formatos aceptados:\n' +
          '• "REF; nombre; cantidad; unidad" (ej: "ABC123; Tomate; 10; kg")\n' +
          '• "nombre cantidad unidad" (ej: "Tomate 10 kg")\n' +
          '• "cantidad unidad nombre" (ej: "10 kg Tomate")\n' +
          '• "REF nombre cantidad unidad" (ej: "ABC123 Tomate 10 kg")\n\n' +
          'Puedes enviar múltiples líneas.'
        );
      }
      break;
    }

    case 'date': {
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
      state.step = 'confirm';
      setState(chatId, state);
      
      // Show summary with confirmation
      const items = state.data.items || [];
      const summary = `📋 *Resumen de Recepción:*\n\n` +
        `*Proveedor:* ${state.data.supplier}\n` +
        `*Fecha:* ${parsedDate}\n` +
        `*Items (${items.length}):*\n` +
        items.map((item: any, i: number) => 
          `${i + 1}. ${item.ref} - ${item.product} (${item.quantity} ${item.unit})`
        ).join('\n');

      await ctx.reply(summary, { 
        parse_mode: 'Markdown',
        reply_markup: createConfirmationKeyboard() 
      });
      break;
    }

    case 'edit_quantity': {
      // Handle custom quantity input
      try {
        const productIndex = state.data.editingProductIndex;
        const products = state.data.availableProducts || [];
        if (productIndex === undefined || productIndex < 0 || productIndex >= products.length) {
          await ctx.reply('❌ Error: producto no encontrado');
          state.step = 'products';
          setState(chatId, state);
          return;
        }

        const product = products[productIndex];
        // Try to parse quantity and unit from text (e.g., "2.5 kg" or "10 ud")
        const qtyMatch = text.match(/^([\d,\.]+)\s*([a-zA-Z]+)?$/);
        if (!qtyMatch) {
          await ctx.reply('❌ Formato inválido. Ejemplo: "2.5 kg" o "10 ud"');
          return;
        }

        const quantity = parseFloat(qtyMatch[1].replace(',', '.'));
        const unit = qtyMatch[2] || product.default_unit;

        if (isNaN(quantity) || quantity <= 0) {
          await ctx.reply('❌ La cantidad debe ser un número positivo');
          return;
        }

        let selectedItems: SelectedItem[] = state.data.selectedItems || [];
        const existingIndex = selectedItems.findIndex(
          (item) => item.ref === product.ref && item.product === product.product
        );

        if (existingIndex >= 0) {
          selectedItems[existingIndex].quantity = quantity;
          selectedItems[existingIndex].unit = unit;
        } else {
          selectedItems.push({
            ref: product.ref,
            product: product.product,
            quantity: quantity,
            unit: unit
          });
        }

        state.data.selectedItems = selectedItems;
        state.step = 'products';
        delete state.data.editingProductIndex;
        setState(chatId, state);

        // Show updated table
        const tableText = formatProductTable(products);
        const keyboard = createProductKeyboard(products, selectedItems, 'reception:product');
        await ctx.reply(tableText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } catch (error: any) {
        await ctx.reply(`❌ Error: ${error.message}`);
        state.step = 'products';
        setState(chatId, state);
      }
      break;
    }

    case 'products': {
      // Handle manual item input (fallback when no products table or user chooses manual)
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

        // Merge with selected items from table
        const selectedItems: SelectedItem[] = state.data.selectedItems || [];
        const allItems = [
          ...selectedItems.map(item => ({
            ref: item.ref,
            product: item.product,
            quantity: item.quantity,
            unit: item.unit
          })),
          ...items
        ];

        state.data.items = allItems;
        state.step = 'date';
        setState(chatId, state);

        await ctx.reply(
          `✅ ${items.length} item(s) agregado(s).\n\n` +
          `📋 Total de items: ${allItems.length}\n\n` +
          `📅 Selecciona la fecha de la recepción:`,
          { reply_markup: createDateKeyboard() }
        );
      } catch (error: any) {
        await ctx.reply(
          `❌ Error al parsear los items:\n${error.message}\n\n` +
          `Por favor, envía los items nuevamente en el formato correcto.`
        );
      }
      break;
    }

    case 'items': {
      // Legacy step - handle manual input
      const legacyLines = text.split('\n').filter((l) => l.trim());
      const legacyItems: any[] = [];

      try {
        for (const line of legacyLines) {
          const parsed = parseItemLine(line);
          legacyItems.push({
            ref: parsed.ref,
            product: parsed.product,
            quantity: parsed.quantity,
            unit: parsed.unit
          });
        }

        state.data.items = legacyItems;
        state.step = 'confirm';
        setState(chatId, state);

        const summary = `📋 Resumen de Recepción:\n\n` +
          `Proveedor: ${state.data.supplier}\n` +
          `Fecha: ${state.data.occurredAt}\n` +
          `Items (${legacyItems.length}):\n` +
          legacyItems.map((item, i) => 
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
    }

    case 'confirm': {
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

