import { Telegraf } from 'telegraf';

console.log('🤖 Starting Simple Bot...');

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.start((ctx) => {
  console.log('📩 Start command received');
  ctx.reply('✅ Bot is working! This is a test response.');
});

bot.command('test', (ctx) => {
  console.log('📩 Test command received');
  ctx.reply('🔧 Test command successful!');
});

bot.on('message', (ctx) => {
  console.log('📩 Message received:', ctx.message);
});

bot.catch((err) => {
  console.error('❌ Bot error:', err);
});

async function startBot() {
  try {
    await bot.launch();
    console.log('✅ Simple bot started successfully!');
    
    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();