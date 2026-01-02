// Simple test to see if bot token works
import { Telegraf } from 'telegraf';

console.log('🤖 Testing bot connection...');

const bot = new Telegraf('7948304959:AAFg99TE0AS2ZYlYOj5pMUk5cKdVbWa39gA');

bot.on('message', (ctx) => {
  console.log('📩 Received message:', ctx.message);
  ctx.reply('Bot is working!');
});

bot.catch((err) => {
  console.error('❌ Bot error:', err);
});

try {
  await bot.launch();
  console.log('✅ Bot started successfully!');
} catch (error) {
  console.error('💥 Failed to start bot:', error);
}