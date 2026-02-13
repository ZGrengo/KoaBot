import { InlineKeyboardMarkup } from 'telegraf/types';
import { Product } from '../api/operations.api';

export interface SelectedItem {
  ref: string;
  product: string;
  quantity: number;
  unit: string;
}

/**
 * Format a product table as a text message
 */
export function formatProductTable(products: Product[]): string {
  if (products.length === 0) {
    return '📋 No hay productos disponibles.';
  }

  let table = '📋 *Productos disponibles:*\n\n';
  table += '```\n';
  table += 'REF      | Producto          | Unidad\n';
  table += '─────────┼───────────────────┼────────\n';
  
  products.forEach((p, index) => {
    const ref = (p.ref || 'UNKNOWN').padEnd(9);
    const product = (p.product || '').substring(0, 17).padEnd(17);
    const unit = (p.default_unit || 'kg').padEnd(8);
    table += `${ref}| ${product}| ${unit}\n`;
  });
  
  table += '```\n\n';
  table += '💡 Haz clic en los botones para agregar productos.';
  
  return table;
}

/**
 * Create inline keyboard for product selection
 */
export function createProductKeyboard(
  products: Product[],
  selectedItems: SelectedItem[],
  callbackPrefix: string
): InlineKeyboardMarkup {
  const inline_keyboard: any[][] = [];

  // Add buttons for each product
  products.forEach((product, index) => {
    const selected = selectedItems.find(
      (item) => item.ref === product.ref && item.product === product.product
    );
    
    const buttonText = selected
      ? `✅ ${product.product} (${selected.quantity} ${selected.unit})`
      : `➕ ${product.product}`;
    
    inline_keyboard.push([
      {
        text: buttonText,
        callback_data: `${callbackPrefix}:add:${index}`
      }
    ]);
  });

  // Add action buttons
  if (selectedItems.length > 0) {
    inline_keyboard.push([
      { text: '📝 Editar cantidades', callback_data: `${callbackPrefix}:edit` },
      { text: '🗑️ Limpiar todo', callback_data: `${callbackPrefix}:clear` }
    ]);
  }

  inline_keyboard.push([
    { text: '✅ Finalizar', callback_data: `${callbackPrefix}:finish` },
    { text: '➕ Agregar manual', callback_data: `${callbackPrefix}:manual` }
  ]);

  return { inline_keyboard };
}

/**
 * Create keyboard for editing quantity of a specific item
 */
export function createQuantityKeyboard(
  productIndex: number,
  currentQuantity: number,
  unit: string,
  callbackPrefix: string
): InlineKeyboardMarkup {
  const inline_keyboard: any[][] = [];

  // Quick quantity buttons
  const quickQuantities = [0.25, 0.5, 1, 2, 5, 10];
  const quickButtons = quickQuantities.map((qty) => ({
    text: `${qty} ${unit}`,
    callback_data: `${callbackPrefix}:qty:${productIndex}:${qty}`
  }));

  // Arrange in rows of 3
  for (let i = 0; i < quickButtons.length; i += 3) {
    inline_keyboard.push(quickButtons.slice(i, i + 3));
  }

  // Custom quantity input
  inline_keyboard.push([
    { text: '✏️ Cantidad personalizada', callback_data: `${callbackPrefix}:qty:${productIndex}:custom` }
  ]);

  // Back button
  inline_keyboard.push([
    { text: '🔙 Volver', callback_data: `${callbackPrefix}:back` }
  ]);

  return { inline_keyboard };
}

/**
 * Format selected items summary
 */
export function formatSelectedItemsSummary(items: SelectedItem[]): string {
  if (items.length === 0) {
    return '📋 No hay items seleccionados.';
  }

  let summary = `📋 *Items seleccionados (${items.length}):*\n\n`;
  items.forEach((item, index) => {
    summary += `${index + 1}. *${item.product}*\n`;
    summary += `   REF: ${item.ref} | Cantidad: ${item.quantity} ${item.unit}\n\n`;
  });

  return summary;
}

