import { Telegraf } from 'telegraf';
import { config } from 'dotenv';
import { setupCommands } from './commands';
import { setupConversations } from './conversations';
import { setupCallbacks } from './handlers/callbacks';

config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Telegraf(botToken);

// Setup commands, conversations, and callbacks
setupCommands(bot);
setupConversations(bot);
setupCallbacks(bot);

// Error handling
bot.catch((err, ctx) => {
  console.error('Error in bot:', err);
  ctx.reply('❌ Ocurrió un error. Por favor, intenta de nuevo.');
});

// Start bot
bot.launch().then(() => {
  console.log('🤖 Telegram bot is running...');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

