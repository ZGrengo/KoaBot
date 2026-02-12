import { Telegraf } from 'telegraf';
import { getState, clearState } from './conversation-state';
import { handleReceptionConversation } from './reception.conversation';
import { handleWastageConversation } from './wastage.conversation';
import { handleProductionConversation } from './production.conversation';
import { handleReportConversation } from './report.conversation';
import { getUnknownMessage } from '../utils/help-message';

export function setupConversations(bot: Telegraf): void {
  // Handle text messages that might be part of conversations
  // Note: Commands are handled separately and have priority
  bot.on('text', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text.trim();

    // Ignore commands (they start with /)
    if (text.startsWith('/')) {
      return;
    }

    const textLower = text.toLowerCase();

    // Check if user wants to cancel
    if (textLower === 'cancelar' || textLower === 'cancel') {
      const state = getState(chatId);
      if (state) {
        clearState(chatId);
        await ctx.reply('❌ Acción cancelada.');
        return;
      }
    }

    const state = getState(chatId);
    if (!state) {
      // No active conversation and not a command - show help message
      await ctx.reply(getUnknownMessage());
      return;
    }

    switch (state.type) {
      case 'reception':
        await handleReceptionConversation(ctx);
        break;
      case 'wastage':
        await handleWastageConversation(ctx);
        break;
      case 'production':
        await handleProductionConversation(ctx);
        break;
      case 'report':
        await handleReportConversation(ctx);
        break;
    }
  });
}

