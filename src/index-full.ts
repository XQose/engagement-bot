import { Telegraf } from 'telegraf';
import { loadConfig } from './config.js';
import * as cron from 'node-cron';

console.log('🤖 Starting Full X Engagement Bot...');

// Simple in-memory database
interface User {
  id: number;
  username: string;
  points: number;
  warnings: number;
  submissions: number;
  engagements: number;
}

interface Session {
  id: string;
  type: 'morning' | 'evening';
  active: boolean;
  startTime: Date;
  endTime: Date;
  participants: Set<number>;
  submissions: string[];
}

class SimpleDB {
  users = new Map<number, User>();
  currentSession: Session | null = null;
  
  getOrCreateUser(userId: number, username: string): User {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        id: userId,
        username,
        points: 0,
        warnings: 0,
        submissions: 0,
        engagements: 0
      });
    }
    return this.users.get(userId)!;
  }
  
  getLeaderboard(): User[] {
    return Array.from(this.users.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }
  
  createSession(type: 'morning' | 'evening'): Session {
    const now = new Date();
    this.currentSession = {
      id: `${now.getTime()}_${type}`,
      type,
      active: true,
      startTime: now,
      endTime: new Date(now.getTime() + 30 * 60000), // 30 minutes
      participants: new Set(),
      submissions: []
    };
    return this.currentSession;
  }
  
  endSession() {
    if (this.currentSession) {
      this.currentSession.active = false;
      this.currentSession = null;
    }
  }
}

async function startBot() {
  try {
    const config = loadConfig();
    console.log('✅ Configuration loaded');
    
    const bot = new Telegraf(config.botToken);
    const db = new SimpleDB();
    console.log('✅ Bot instance and database created');

    // Commands
    bot.start((ctx) => {
      const user = db.getOrCreateUser(ctx.from!.id, ctx.from!.username || 'Unknown');
      console.log(`📩 Start command from @${user.username}`);
      
      ctx.reply(`✅ Welcome to X Engagement Bot!

🎯 Commands:
/start - Show this message
/rules - View engagement rules  
/session - Check current session
/mystats - View your stats
/leaderboard - Top users
/start_session - 🧪 Start test session (manual)
/end_session - 🧪 End current session (manual)

⏰ Auto Sessions:
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
• 4 warnings = Permanent ban

🧪 Test Commands:
/start_session - Start manual test session
/end_session - End current session`);
    });

    bot.command('session', (ctx) => {
      console.log('📩 Session command received');
      
      if (db.currentSession && db.currentSession.active) {
        const timeLeft = Math.max(0, db.currentSession.endTime.getTime() - Date.now());
        const minutesLeft = Math.ceil(timeLeft / 60000);
        
        ctx.reply(`🔥 ${db.currentSession.type.toUpperCase()} SESSION ACTIVE!

⏰ Time left: ${minutesLeft} minutes
👥 Participants: ${db.currentSession.participants.size}
📤 Submissions: ${db.currentSession.submissions.length}

🎯 Submit your X posts now!`);
      } else {
        const now = new Date();
        const utcHour = now.getUTCHours();
        let nextSession = '';
        
        if (utcHour < 9) {
          nextSession = 'Next: Morning session at 9:00 AM UTC';
        } else if (utcHour < 18) {
          nextSession = 'Next: Evening session at 6:00 PM UTC';
        } else {
          nextSession = 'Next: Morning session tomorrow at 9:00 AM UTC';
        }
        
        ctx.reply(`❌ No active session

${nextSession}

🧪 Test: Use /start_session to start manual session`);
      }
    });

    bot.command('mystats', (ctx) => {
      const user = db.getOrCreateUser(ctx.from!.id, ctx.from!.username || 'Unknown');
      console.log(`📩 Stats command from @${user.username}`);
      
      ctx.reply(`📊 Your Stats:

👤 User: @${user.username}
🎯 Points: ${user.points}
⚠️ Warnings: ${user.warnings}
📤 Submissions: ${user.submissions}
💬 Engagements: ${user.engagements}

🏆 Rank: ${user.points > 50 ? 'Active' : 'New'} Member`);
    });

    bot.command('leaderboard', (ctx) => {
      console.log('📩 Leaderboard command received');
      
      const leaders = db.getLeaderboard();
      let leaderText = '🏆 Top Users:\n\n';
      
      if (leaders.length === 0) {
        leaderText += '1. No users yet\n2. Join sessions to appear here!';
      } else {
        leaders.forEach((user, index) => {
          leaderText += `${index + 1}. @${user.username} - ${user.points} pts\n`;
        });
      }
      
      ctx.reply(leaderText);
    });

    // MANUAL SESSION COMMANDS FOR TESTING
    bot.command('start_session', (ctx) => {
      if (db.currentSession && db.currentSession.active) {
        ctx.reply('❌ Session already active! Use /session to check status.');
        return;
      }
      
      const session = db.createSession('morning');
      console.log(`🧪 Manual session started by @${ctx.from!.username}`);
      
      ctx.reply(`🔥 MANUAL TEST SESSION STARTED!

⏰ Duration: 30 minutes
🧪 Type: Test Session
👥 Participants: 0

🎯 Submit your X/Twitter posts now!
Format: Just paste your X link

Commands:
/session - Check status
/end_session - End session`);
    });

    bot.command('end_session', (ctx) => {
      if (!db.currentSession || !db.currentSession.active) {
        ctx.reply('❌ No active session to end.');
        return;
      }
      
      db.endSession();
      console.log(`🧪 Session ended by @${ctx.from!.username}`);
      
      ctx.reply(`✅ Session ended!

📊 Final Stats:
👥 Participants: ${db.currentSession?.participants.size || 0}
📤 Total submissions: ${db.currentSession?.submissions.length || 0}

🎯 Points have been awarded!`);
    });

    // Handle X link submissions
    bot.on('message', (ctx) => {
      if (!('text' in ctx.message)) return;
      
      const text = ctx.message.text;
      const user = db.getOrCreateUser(ctx.from.id, ctx.from.username || 'Unknown');
      
      // Check if it's an X/Twitter link
      if (text.includes('x.com/') || text.includes('twitter.com/')) {
        if (!db.currentSession || !db.currentSession.active) {
          ctx.reply('❌ No active session! Wait for next session or use /start_session for testing.');
          return;
        }
        
        // Award points
        user.points += 10;
        user.submissions += 1;
        db.currentSession.participants.add(user.id);
        db.currentSession.submissions.push(text);
        
        console.log(`📤 Submission from @${user.username}: ${text}`);
        
        ctx.reply(`✅ Submission received!

🎯 +10 points awarded
📤 Total submissions: ${user.submissions}
💰 Your points: ${user.points}

👥 Session participants: ${db.currentSession.participants.size}`);
      }
    });

    // AUTOMATIC SCHEDULING
    console.log('⏰ Setting up automatic session scheduling...');
    
    // Morning session: 9:00 AM UTC
    cron.schedule('0 9 * * *', () => {
      console.log('🌅 Starting automatic morning session...');
      
      if (db.currentSession && db.currentSession.active) {
        console.log('⚠️ Session already active, skipping...');
        return;
      }
      
      const session = db.createSession('morning');
      
      // Send to general chat
      bot.telegram.sendMessage(config.channels.general, `🌅 MORNING SESSION STARTED!

⏰ Duration: 30 minutes
🎯 Submit your X/Twitter posts now!

📋 Rules:
1. Post valid X/Twitter links
2. Engage with others' posts  
3. Earn 10 points per submission + 5 per engagement

💰 Points system active!`).catch(console.error);
      
      // Auto-end after 30 minutes
      setTimeout(() => {
        if (db.currentSession && db.currentSession.id === session.id) {
          db.endSession();
          console.log('🌅 Morning session auto-ended');
          
          bot.telegram.sendMessage(config.channels.general, `✅ Morning session ended!

📊 Final stats:
👥 Participants: ${session.participants.size}
📤 Submissions: ${session.submissions.length}

🎯 Next session: 6:00 PM UTC`).catch(console.error);
        }
      }, 30 * 60 * 1000);
    });
    
    // Evening session: 6:00 PM UTC
    cron.schedule('0 18 * * *', () => {
      console.log('🌆 Starting automatic evening session...');
      
      if (db.currentSession && db.currentSession.active) {
        console.log('⚠️ Session already active, skipping...');
        return;
      }
      
      const session = db.createSession('evening');
      
      bot.telegram.sendMessage(config.channels.general, `🌆 EVENING SESSION STARTED!

⏰ Duration: 30 minutes
🎯 Submit your X/Twitter posts now!

📋 Rules:
1. Post valid X/Twitter links
2. Engage with others' posts
3. Earn 10 points per submission + 5 per engagement

💰 Points system active!`).catch(console.error);
      
      // Auto-end after 30 minutes
      setTimeout(() => {
        if (db.currentSession && db.currentSession.id === session.id) {
          db.endSession();
          console.log('🌆 Evening session auto-ended');
          
          bot.telegram.sendMessage(config.channels.general, `✅ Evening session ended!

📊 Final stats:
👥 Participants: ${session.participants.size}
📤 Submissions: ${session.submissions.length}

🎯 Next session: 9:00 AM UTC tomorrow`).catch(console.error);
        }
      }, 30 * 60 * 1000);
    });

    // Error handling
    bot.catch((err) => {
      console.error('❌ Bot error:', err);
    });

    // Start bot
    await bot.launch();
    console.log('🚀 Bot launched successfully');
    
    // Graceful shutdown
    process.once('SIGINT', () => {
      console.log('🔄 Stopping bot...');
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      console.log('🔄 Stopping bot...');
      bot.stop('SIGTERM');
    });
    
    console.log('✅ Full X Engagement Bot ready!');
    console.log('🧪 Manual testing: /start_session');
    console.log('⏰ Auto sessions: 9:00 AM & 6:00 PM UTC');
    
  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();