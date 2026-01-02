import { Telegraf } from 'telegraf';
import { loadConfig } from './config.js';

console.log('🤖 Starting Basic Engagement Bot...');

async function startBot() {
  try {
    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');

    // Create bot instance
    const bot = new Telegraf(config.botToken);
    console.log('✅ Bot instance created');

    // Basic commands
    bot.start((ctx) => {
      console.log('📩 Start command received');
      ctx.reply(`✅ Welcome to X Engagement Bot!
      
🎯 Commands:
/start - Show this welcome message
/rules - View engagement rules
/session - Check current session status
/mystats - View your stats
/leaderboard - Top users

⏰ Sessions run daily at:
• Morning: 9:00 AM UTC
• Evening: 6:00 PM UTC`);
    });

    bot.command('rules', (ctx) => {
      console.log('📩 Rules command received');
      ctx.reply(`📋 Engagement Rules:

1. Submit valid X/Twitter posts during sessions
2. Engage with other members' posts
3. Confirm your engagement after sessions
4. Earn 10 points per submission + 5 per engagement
5. Penalties for non-participation: -20 points

⚠️ Warning System:
• 2 warnings = 7-day ban
• 3 warnings = 30-day ban  
• 4 warnings = Permanent ban`);
    });

    bot.command('session', (ctx) => {
      console.log('📩 Session command received');
      const now = new Date();
      const utcHour = now.getUTCHours();
      
      let sessionStatus = '❌ No active session';
      let nextSession = '';
      
      if (utcHour >= 9 && utcHour < 9.5) {
        sessionStatus = '🌅 Morning session active!';
      } else if (utcHour >= 18 && utcHour < 18.5) {
        sessionStatus = '🌆 Evening session active!';
      } else if (utcHour < 9) {
        nextSession = `Next: Morning session at 9:00 AM UTC`;
      } else if (utcHour < 18) {
        nextSession = `Next: Evening session at 6:00 PM UTC`;
      } else {
        nextSession = `Next: Morning session tomorrow at 9:00 AM UTC`;
      }
      
      ctx.reply(`⏰ Session Status: ${sessionStatus}
${nextSession ? nextSession : ''}

📊 Session times:
🌅 Morning: 9:00 AM UTC (30 mins)
🌆 Evening: 6:00 PM UTC (30 mins)`);
    });

    bot.command('mystats', (ctx) => {
      console.log('📩 Stats command received');
      ctx.reply(`📊 Your Stats:

👤 User: @${ctx.from?.username || 'Unknown'}
🎯 Points: 0
⚠️ Warnings: 0
📤 Submissions: 0
💬 Engagements: 0

🏆 Rank: New Member`);
    });

    bot.command('leaderboard', (ctx) => {
      console.log('📩 Leaderboard command received');
      ctx.reply(`🏆 Top Users:

1. No users yet
2. Join sessions to appear here!
3. 
4. 
5. 

Submit posts during sessions to earn points!`);
    });

    // Error handling
    bot.catch((err) => {
      console.error('❌ Bot error:', err);
    });

    // Start bot
    await bot.launch();
    console.log('🚀 Bot launched successfully');
    
    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    console.log('✅ Basic Engagement Bot ready!');
    
  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();