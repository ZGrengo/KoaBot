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
    const { getRecentSuppliers, getSupplierProducts } = await import('../api/operations.api');
    const suppliers = await getRecentSuppliers();
    const index = parseInt(match, 10);
    
    if (index >= 0 && index < suppliers.length) {
      const supplierName = suppliers[index];
      state.data.supplier = supplierName;
      state.data.selectedItems = state.data.selectedItems || [];
      state.step = 'products';
      setState(chatId, state);
      
      await ctx.answerCbQuery(`Proveedor: ${supplierName}`);
      
      // Fetch products for this supplier
      try {
        const products = await getSupplierProducts(supplierName);
        if (products.length > 0) {
          const { formatProductTable, createProductKeyboard } = await import('../utils/product-table');
          const tableText = formatProductTable(products);
          const keyboard = createProductKeyboard(products, state.data.selectedItems || [], 'reception:product');
          state.data.availableProducts = products;
          setState(chatId, state);
          
          await ctx.editMessageText(tableText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        } else {
          // No products found, allow manual input
          await ctx.editMessageText(
            `📦 Proveedor: ${supplierName}\n\n` +
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
        console.error('[supplier callback] Error fetching products:', error);
        // Fallback to manual input
        await ctx.editMessageText(
          `📦 Proveedor: ${supplierName}\n\n` +
          '📋 Envía los items de la recepción, uno por línea:\n\n' +
          'Formatos aceptados:\n' +
          '• "REF; nombre; cantidad; unidad" (ej: "ABC123; Tomate; 10; kg")\n' +
          '• "nombre cantidad unidad" (ej: "Tomate 10 kg")\n' +
          '• "cantidad unidad nombre" (ej: "10 kg Tomate")\n' +
          '• "REF nombre cantidad unidad" (ej: "ABC123 Tomate 10 kg")\n\n' +
          'Puedes enviar múltiples líneas.'
        );
      }
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
    state.data.occurredAt = dateStr;
    state.data.dateISO = dateToISO(dateStr);
    setState(chatId, state);
    await ctx.answerCbQuery(`Fecha seleccionada: ${dateStr}`);
    
    // Continue conversation flow
    if (state.type === 'reception') {
      // Items should already be set from product table or manual input
      const items = state.data.items || [];
      if (items.length === 0) {
        // Fallback: ask for items
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
      } else {
        // Show confirmation
        state.step = 'confirm';
        const summary = `📋 *Resumen de Recepción:*\n\n` +
          `*Proveedor:* ${state.data.supplier}\n` +
          `*Fecha:* ${dateStr}\n` +
          `*Items (${items.length}):*\n` +
          items.map((item: any, i: number) => 
            `${i + 1}. ${item.ref} - ${item.product} (${item.quantity} ${item.unit})`
          ).join('\n');
        
        await ctx.editMessageText(summary, {
          parse_mode: 'Markdown',
          reply_markup: createConfirmationKeyboard()
        });
      }
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

  // Handle product table interactions for reception
  bot.action(/^reception:product:(add|edit|clear|finish|manual|back|qty):(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const action = ctx.match[1];
    const param = ctx.match[2];
    const state = getState(chatId);

    if (!state || state.type !== 'reception') {
      await ctx.answerCbQuery('No hay acción en curso');
      return;
    }

    const { formatProductTable, createProductKeyboard, createQuantityKeyboard, formatSelectedItemsSummary, SelectedItem } = await import('../utils/product-table');
    const products = state.data.availableProducts || [];
    let selectedItems: SelectedItem[] = state.data.selectedItems || [];

    if (action === 'add') {
      const index = parseInt(param, 10);
      if (index >= 0 && index < products.length) {
        const product = products[index];
        // Check if already selected
        const existing = selectedItems.find(
          (item) => item.ref === product.ref && item.product === product.product
        );
        
        if (existing) {
          // Show quantity editor
          const keyboard = createQuantityKeyboard(index, existing.quantity, existing.unit, 'reception:product');
          await ctx.editMessageReplyMarkup(keyboard);
          await ctx.answerCbQuery(`Editando: ${product.product}`);
        } else {
          // Add with default quantity 1
          selectedItems.push({
            ref: product.ref,
            product: product.product,
            quantity: 1,
            unit: product.default_unit
          });
          state.data.selectedItems = selectedItems;
          setState(chatId, state);
          
          // Update keyboard
          const keyboard = createProductKeyboard(products, selectedItems, 'reception:product');
          await ctx.editMessageReplyMarkup(keyboard);
          await ctx.answerCbQuery(`✅ ${product.product} agregado`);
        }
      }
    } else if (action === 'qty') {
      // Format: qty:index:quantity or qty:index:custom
      const parts = param.split(':');
      const productIndex = parseInt(parts[0], 10);
      const qtyStr = parts[1];
      
      if (qtyStr === 'custom') {
        await ctx.answerCbQuery();
        await ctx.editMessageText(
          `✏️ Envía la cantidad para "${products[productIndex]?.product}":\n\n` +
          `Ejemplo: "2.5 kg" o "10 ud"`
        );
        state.data.editingProductIndex = productIndex;
        state.step = 'edit_quantity';
        setState(chatId, state);
      } else {
        const quantity = parseFloat(qtyStr);
        if (productIndex >= 0 && productIndex < products.length && !isNaN(quantity)) {
          const product = products[productIndex];
          const existingIndex = selectedItems.findIndex(
            (item) => item.ref === product.ref && item.product === product.product
          );
          
          if (existingIndex >= 0) {
            selectedItems[existingIndex].quantity = quantity;
          } else {
            selectedItems.push({
              ref: product.ref,
              product: product.product,
              quantity: quantity,
              unit: product.default_unit
            });
          }
          
          state.data.selectedItems = selectedItems;
          setState(chatId, state);
          
          // Update keyboard
          const keyboard = createProductKeyboard(products, selectedItems, 'reception:product');
          const tableText = formatProductTable(products);
          await ctx.editMessageText(tableText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
          await ctx.answerCbQuery(`✅ Cantidad actualizada: ${quantity} ${product.default_unit}`);
        }
      }
    } else if (action === 'clear') {
      selectedItems = [];
      state.data.selectedItems = selectedItems;
      setState(chatId, state);
      
      const keyboard = createProductKeyboard(products, selectedItems, 'reception:product');
      await ctx.editMessageReplyMarkup(keyboard);
      await ctx.answerCbQuery('🗑️ Items limpiados');
    } else if (action === 'finish') {
      if (selectedItems.length === 0) {
        await ctx.answerCbQuery('Agrega al menos un producto');
        return;
      }
      
      state.data.items = selectedItems.map(item => ({
        ref: item.ref,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit
      }));
      state.step = 'date';
      setState(chatId, state);
      
      const summary = formatSelectedItemsSummary(selectedItems);
      await ctx.editMessageText(
        summary + '\n\n📅 Selecciona la fecha de la recepción:',
        { parse_mode: 'Markdown', reply_markup: createDateKeyboard() }
      );
      await ctx.answerCbQuery('✅ Items seleccionados');
    } else if (action === 'manual') {
      state.step = 'products';
      setState(chatId, state);
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        '📋 Envía los items de la recepción, uno por línea:\n\n' +
        'Formatos aceptados:\n' +
        '• "REF; nombre; cantidad; unidad" (ej: "ABC123; Tomate; 10; kg")\n' +
        '• "nombre cantidad unidad" (ej: "Tomate 10 kg")\n' +
        '• "cantidad unidad nombre" (ej: "10 kg Tomate")\n' +
        '• "REF nombre cantidad unidad" (ej: "ABC123 Tomate 10 kg")\n\n' +
        'Puedes enviar múltiples líneas.'
      );
    } else if (action === 'back') {
      const keyboard = createProductKeyboard(products, selectedItems, 'reception:product');
      const tableText = formatProductTable(products);
      await ctx.editMessageText(tableText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      await ctx.answerCbQuery();
    } else if (action === 'edit') {
      // Show summary and allow editing
      const summary = formatSelectedItemsSummary(selectedItems);
      await ctx.editMessageText(
        summary + '\n\n💡 Haz clic en un producto para editar su cantidad.',
        { parse_mode: 'Markdown' }
      );
      await ctx.answerCbQuery();
    }
  });
}

