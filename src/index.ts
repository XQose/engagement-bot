import { Telegraf } from 'telegraf';
import { Database } from './database.js';
import { loadConfig } from './config.js';
import { SessionScheduler } from './scheduler.js';
import { MessageHandler } from './handlers.js';

async function startBot(): Promise<void> {
  console.log('🤖 Starting X Engagement Bot...');

  try {
    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');

    // Initialize database
    const db = new Database();
    console.log('✅ Database initialized');

    // Create bot instance
    const bot = new Telegraf(config.botToken);
    console.log('✅ Bot instance created');

    // Initialize components
    const scheduler = new SessionScheduler(bot, db, config);
    const handlers = new MessageHandler(bot, db, config);

    // Error handling
    bot.catch((err, ctx) => {
      console.error('❌ Bot error:', err);
      console.error('Context:', ctx.update);
    });

    // Graceful shutdown
    process.once('SIGINT', () => gracefulShutdown(bot, scheduler));
    process.once('SIGTERM', () => gracefulShutdown(bot, scheduler));

    // Start bot
    await bot.launch();
    console.log('🚀 Bot launched successfully');

    // Start session scheduler
    scheduler.start();
    
    // Log startup success
    const stats = db.getStats();
    console.log(`📊 Bot ready! Users: ${stats.totalUsers}, Sessions: ${stats.totalSessions}`);
    
    if (config.testing.enabled) {
      console.log(`🧪 Testing mode enabled for @${config.testing.testUser}`);
    }

  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(bot: Telegraf, scheduler: SessionScheduler): Promise<void> {
  console.log('🔄 Graceful shutdown initiated...');
  
  try {
    scheduler.stop();
    bot.stop();
    console.log('✅ Bot stopped gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the bot
startBot().catch(error => {
  console.error('💥 Critical startup error:', error);
  process.exit(1);
});