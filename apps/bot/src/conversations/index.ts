import { Telegraf } from 'telegraf';
import { getState } from './conversation-state';
import { handleReceptionConversation } from './reception.conversation';
import { handleWastageConversation } from './wastage.conversation';
import { handleProductionConversation } from './production.conversation';
import { handleReportConversation } from './report.conversation';

export function setupConversations(bot: Telegraf): void {
  // Handle text messages that might be part of conversations
  bot.on('text', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const state = getState(chatId);
    if (!state) return; // No active conversation

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

