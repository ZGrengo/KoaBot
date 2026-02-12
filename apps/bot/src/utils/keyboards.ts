import { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Create confirmation keyboard with Save, Edit, Cancel buttons
 */
export function createConfirmationKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Guardar', callback_data: 'confirm:save' },
        { text: '✏️ Editar', callback_data: 'confirm:edit' }
      ],
      [
        { text: '❌ Cancelar', callback_data: 'confirm:cancel' }
      ]
    ]
  };
}

/**
 * Create date selection keyboard (Today, Yesterday, Other)
 */
export function createDateKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📅 Hoy', callback_data: 'date:today' },
        { text: '📅 Ayer', callback_data: 'date:yesterday' }
      ],
      [
        { text: '📅 Otra fecha', callback_data: 'date:other' }
      ]
    ]
  };
}

/**
 * Create keyboard with recent suppliers/batches
 */
export function createRecentOptionsKeyboard(
  options: string[],
  callbackPrefix: string,
  otherLabel: string = 'Otro...'
): InlineKeyboardMarkup {
  const buttons = options.map((option, index) => ({
    text: option,
    callback_data: `${callbackPrefix}:${index}`
  }));

  // Add "Other" button
  buttons.push({
    text: otherLabel,
    callback_data: `${callbackPrefix}:other`
  });

  // Arrange buttons in rows of 2
  const inline_keyboard: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    inline_keyboard.push(buttons.slice(i, i + 2));
  }

  return { inline_keyboard };
}

/**
 * Create edit options keyboard
 */
export function createEditOptionsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✏️ Editar proveedor/lote', callback_data: 'edit:supplier' },
        { text: '✏️ Editar fecha', callback_data: 'edit:date' }
      ],
      [
        { text: '✏️ Editar items', callback_data: 'edit:items' }
      ],
      [
        { text: '❌ Cancelar', callback_data: 'edit:cancel' }
      ]
    ]
  };
}

/**
 * Create quick report buttons
 */
export function createReportQuickButtons(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📊 Semana', callback_data: 'report:week' },
        { text: '📊 Últimos 7 días', callback_data: 'report:7days' }
      ],
      [
        { text: '📊 Mes actual', callback_data: 'report:month' }
      ]
    ]
  };
}

/**
 * Create undo button (to show after successful save)
 */
export function createUndoKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '↩️ Deshacer último', callback_data: 'undo:last' }
      ]
    ]
  };
}

