const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🤖 Starting Full X Engagement Bot...');

// Enhanced in-memory database with daily tracking
class SimpleDB {
  constructor() {
    this.users = new Map();
    this.currentSession = null;
    this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.dataDir = path.join(__dirname, 'data');
    this.dbFile = path.join(this.dataDir, 'database.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Load existing data
    this.loadFromFile();
  }
  
  getOrCreateUser(userId, username) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        id: userId,
        username: username || 'Unknown',
        points: 0,
        warnings: 0,
        submissions: 0,
        engagements: 0,
        dailySubmissions: 0,
        lastSubmissionDate: null,
        currentSessionSubmitted: false,
        currentSessionConfirmed: false,
        sessionSubmissionId: null
      });
      this.saveToFile();
    } else {
      // Always update username if we have a better one
      const user = this.users.get(userId);
      if (username && username !== 'Unknown' && (user.username === 'Unknown' || user.username !== username)) {
        console.log(`🔄 Updating username for ${userId}: ${user.username} -> ${username}`);
        user.username = username;
        this.saveToFile();
      }
    }
    return this.users.get(userId);
  }
  
  resetDailyCounters() {
    const today = new Date().toISOString().split('T')[0];
    if (this.currentDate !== today) {
      console.log(`🔄 Resetting daily counters for new day: ${today}`);
      this.currentDate = today;
      for (const user of this.users.values()) {
        user.dailySubmissions = 0;
        user.currentSessionSubmitted = false;
        user.currentSessionConfirmed = false;
        user.sessionSubmissionId = null;
      }
    }
  }
  
  canUserSubmit(userId) {
    this.resetDailyCounters();
    const user = this.getOrCreateUser(userId, 'Unknown');
    return user.dailySubmissions < 2 && !user.currentSessionSubmitted;
  }
  
  recordSubmission(userId, messageId) {
    const user = this.users.get(userId);
    if (user) {
      user.dailySubmissions += 1;
      user.currentSessionSubmitted = true;
      user.sessionSubmissionId = messageId;
      user.lastSubmissionDate = new Date().toISOString();
      user.submissions += 1;
      this.saveToFile();
    }
  }
  
  recordConfirmation(userId) {
    const user = this.users.get(userId);
    if (user) {
      user.currentSessionConfirmed = true;
      user.engagements += 1;
      user.points += 10; // Award points for confirmation
      this.saveToFile();
    }
  }
  
  getIncompleteUsers() {
    return Array.from(this.users.values())
      .filter(user => user.currentSessionSubmitted && !user.currentSessionConfirmed);
  }
  
  newSessionStarted() {
    console.log('🔄 New session started - resetting session tracking');
    for (const user of this.users.values()) {
      user.currentSessionSubmitted = false;
      user.currentSessionConfirmed = false;
      user.sessionSubmissionId = null;
    }
    this.saveToFile();
  }
  
  loadFromFile() {
    try {
      if (fs.existsSync(this.dbFile)) {
        const data = JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
        
        // Load users
        if (data.users) {
          for (const [userId, userData] of Object.entries(data.users)) {
            this.users.set(parseInt(userId), {
              ...userData,
              // Preserve usernames and all existing data
              dailySubmissions: userData.dailySubmissions || 0, 
              currentSessionSubmitted: userData.currentSessionSubmitted || false,
              currentSessionConfirmed: userData.currentSessionConfirmed || false,
              sessionSubmissionId: userData.sessionSubmissionId || null
            });
          }
        }
        console.log(`✅ Loaded ${this.users.size} users from database`);
      }
    } catch (error) {
      console.log('⚠️ Could not load existing database:', error.message);
    }
  }
  
  saveToFile() {
    try {
      const data = {
        users: {},
        sessions: {},
        submissions: {},
        engagements: [],
        warnings: {},
        lastUpdated: new Date().toISOString()
      };
      
      // Convert users Map to object
      for (const [userId, user] of this.users.entries()) {
        data.users[userId] = {
          id: user.id,
          username: user.username,
          points: user.points,
          warnings: user.warnings,
          banStatus: 'active',
          joinDate: user.lastSubmissionDate || new Date().toISOString(),
          totalSubmissions: user.submissions,
          totalEngagements: user.engagements
        };
      }
      
      // Add current session
      if (this.currentSession) {
        data.sessions[this.currentSession.id] = {
          id: this.currentSession.id,
          type: this.currentSession.type,
          startTime: this.currentSession.startTime.toISOString(),
          endTime: this.currentSession.endTime.toISOString(),
          status: this.currentSession.active ? 'active' : 'ended',
          participants: Array.from(this.currentSession.participants),
          submissions: this.currentSession.submissions.map(s => s.submission)
        };
      }
      
      fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('⚠️ Could not save database:', error.message);
    }
  }
  
  getLeaderboard() {
    return Array.from(this.users.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }
  
  createSession(type) {
    const now = new Date();
    let endTime;
    
    if (type === 'day') {
      // Day session: 9 AM to 6 PM UTC (9 hours)
      endTime = new Date();
      endTime.setUTCHours(18, 0, 0, 0);
      if (endTime <= now) endTime.setUTCDate(endTime.getUTCDate() + 1);
    } else {
      // Night session: 6 PM to 9 AM UTC (15 hours)
      endTime = new Date();
      endTime.setUTCHours(9, 0, 0, 0);
      if (endTime <= now) endTime.setUTCDate(endTime.getUTCDate() + 1);
    }
    
    this.currentSession = {
      id: `${now.getTime()}_${type}`,
      type,
      active: true,
      startTime: now,
      endTime,
      participants: new Set(),
      submissions: []
    };
    
    this.newSessionStarted();
    this.resetDailyCounters();
    return this.currentSession;
  }
  
  endSession() {
    if (this.currentSession) {
      this.currentSession.active = false;
      console.log(`⏹️ Session ended: ${this.currentSession.id}`);
      return this.currentSession;
    }
    return null;
  }
  
  isSessionActive() {
    return this.currentSession && this.currentSession.active;
  }
  
  getCurrentSession() {
    return this.currentSession;
  }
  
  addSubmission(userId, submission) {
    if (this.currentSession && this.currentSession.active) {
      this.currentSession.submissions.push({ userId, submission, timestamp: new Date() });
      this.currentSession.participants.add(userId);
    }
  }
}

// Configuration
const config = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  CHANNEL_ID: process.env.SUBMISSIONS_CHANNEL_ID || '-1003632119102',
  SUBMISSIONS_TOPIC_ID: parseInt(process.env.SUBMISSIONS_THREAD_ID) || 2,
  CONFIRMATIONS_TOPIC_ID: parseInt(process.env.CONFIRMATIONS_THREAD_ID) || 3,
  GENERAL_TOPIC_ID: parseInt(process.env.ADMIN_THREAD_ID) || 1,
  ADMIN_USERNAME: process.env.TEST_USER_USERNAME || 'Julio15X',
  X_LINK_PATTERN: /https?:\/\/(www\.)?(twitter\.com|x\.com)\/\S+/gi
};

console.log('✅ Configuration loaded');

const db = new SimpleDB();
const bot = new Telegraf(config.BOT_TOKEN);

console.log('✅ Bot instance and database created');

// Check if we should have an active session based on current time
function initializeSessionOnStartup() {
  const now = new Date();
  const hour = now.getUTCHours();
  
  if ((hour >= 9 && hour < 18)) {
    // Day session time (9 AM - 6 PM UTC)
    console.log('🌅 Starting day session (detected on startup)');
    db.createSession('day');
  } else if (hour >= 18 || hour < 9) {
    // Night session time (6 PM - 9 AM UTC)  
    console.log('🌙 Starting night session (detected on startup)');
    db.createSession('night');
  }
}

initializeSessionOnStartup();

// Welcome message with new session info
bot.start((ctx) => {
  ctx.reply(`✅ Welcome to the X Engagement Bot! 🎯

🎯 Commands:
/start - Show this message
/rules - View engagement rules
/session - Check current session
/mystats - View your stats
/leaderboard - Top users

👑 Admin Commands:
/start_session - 🧪 Start test session (manual)
/end_session - 🧪 End current session (manual)

⏰ Daily Sessions:
• Day Session: 9:00 AM - 6:00 PM UTC (9 hours)
• Night Session: 6:00 PM - 9:00 AM UTC (15 hours)
• Max: 2 submissions per day (1 per session)`);
});

bot.command('rules', (ctx) => {
  ctx.reply(`📋 ENGAGEMENT RULES:

⏰ SESSION TIMES:
• Day Session: 9:00 AM - 6:00 PM UTC (9 hours)
• Night Session: 6:00 PM - 9:00 AM UTC (15 hours)

📝 SUBMISSION RULES:
• Maximum 2 posts per day (1 per session)
• Only X/Twitter links allowed
• Must post in submissions topic during active sessions
• Must type "done" in confirmations topic after engaging

🎯 HOW TO PARTICIPATE:
1. Wait for session to start
2. Submit your X/Twitter post in submissions topic
3. Engage with others' posts
4. Type "done" in confirmations topic when finished

❌ VIOLATIONS:
• Posting outside sessions
• Posting more than 1 link per session
• Posting more than 2 links per day`);
});

bot.command('session', (ctx) => {
  const session = db.getCurrentSession();
  if (!session || !session.active) {
    ctx.reply('❌ NO ACTIVE SESSION\n\n⏰ Next sessions:\n• Day: 9:00 AM UTC\n• Night: 6:00 PM UTC');
  } else {
    const now = new Date();
    const timeLeft = Math.max(0, session.endTime - now);
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    const sessionName = session.type === 'day' ? 'Day Session' : 'Night Session';
    const timeRange = session.type === 'day' ? '9 AM - 6 PM UTC' : '6 PM - 9 AM UTC';
    
    ctx.reply(`🟢 ACTIVE SESSION: ${sessionName}
⏰ Duration: ${timeRange}
⏳ Time remaining: ${hoursLeft}h ${minutesLeft}m
👥 Participants: ${session.participants.size}
📊 Submissions: ${session.submissions.length}

🎯 Submit your X posts now!`);
  }
});

bot.command('mystats', (ctx) => {
  const user = db.getOrCreateUser(ctx.from.id, ctx.from.username);
  ctx.reply(`📊 YOUR STATS:

🎯 Total Points: ${user.points}
📝 Submissions: ${user.submissions}
✅ Engagements: ${user.engagements}
⚠️ Warnings: ${user.warnings}
📅 Today's Submissions: ${user.dailySubmissions}/2
🎪 Current Session: ${user.currentSessionSubmitted ? '✅ Submitted' : '❌ Not submitted'}`);
});

bot.command('leaderboard', (ctx) => {
  const leaderboard = db.getLeaderboard();
  if (leaderboard.length === 0) {
    ctx.reply('📊 No users yet! Be the first to participate! 🚀');
    return;
  }

  let message = '🏆 TOP USERS:\n\n';
  leaderboard.forEach((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    message += `${medal} @${user.username}: ${user.points} points\n`;
  });
  ctx.reply(message);
});

// Admin commands
bot.command('start_session', async (ctx) => {
  if (ctx.from.username !== config.ADMIN_USERNAME) {
    return ctx.reply('❌ Admin only command');
  }

  if (db.isSessionActive()) {
    return ctx.reply('⚠️ A session is already active!');
  }

  // Determine which session type to start based on current time
  const now = new Date();
  const hour = now.getUTCHours();
  const sessionType = (hour >= 9 && hour < 18) ? 'day' : 'night';
  
  const session = db.createSession(sessionType);
  const sessionName = session.type === 'day' ? 'Day Session' : 'Night Session';
  const timeRange = session.type === 'day' ? '9:00 AM - 6:00 PM UTC' : '6:00 PM - 9:00 AM UTC';
  
  ctx.reply(`🔥 ADMIN MANUAL SESSION STARTED!

⏰ Type: ${sessionName}
⏰ Duration: ${timeRange}
🧪 Type: Test Session
👥 Participants: 0

🎯 Submit your X/Twitter posts now!`);

  // Announce in submissions topic
  await bot.telegram.sendMessage(config.CHANNEL_ID, 
    `🚀 ${sessionName.toUpperCase()} STARTED! 

⏰ Duration: ${timeRange}
📝 Submit your X/Twitter posts here
✅ Max 1 post per session, 2 per day
🎯 Remember to type "done" in confirmations when finished!`, 
    { message_thread_id: config.SUBMISSIONS_TOPIC_ID }
  );

  // Announce in general
  await bot.telegram.sendMessage(config.CHANNEL_ID, 
    `🔥 ${sessionName} is now LIVE! 🚀\n\n📝 Submit your posts in submissions topic!\n⏰ ${timeRange}`, 
    { message_thread_id: config.GENERAL_TOPIC_ID }
  );
});

bot.command('end_session', async (ctx) => {
  if (ctx.from.username !== config.ADMIN_USERNAME) {
    return ctx.reply('❌ Admin only command');
  }

  const session = db.endSession();
  if (!session) {
    return ctx.reply('❌ No active session to end');
  }

  const sessionName = session.type === 'day' ? 'Day Session' : 'Night Session';
  
  ctx.reply(`⏹️ SESSION ENDED!

📊 Final Stats:
👥 Participants: ${session.participants.size}
📝 Submissions: ${session.submissions.length}
⏰ Next session starts automatically`);

  // Announce end in submissions topic
  await bot.telegram.sendMessage(config.CHANNEL_ID, 
    `⏹️ ${sessionName.toUpperCase()} ENDED!

📊 Results:
👥 Participants: ${session.participants.size}  
📝 Submissions: ${session.submissions.length}

⏰ Next session starts automatically!`, 
    { message_thread_id: config.SUBMISSIONS_TOPIC_ID }
  );

  // Check for incomplete users
  const incompleteUsers = db.getIncompleteUsers();
  if (incompleteUsers.length > 0) {
    console.log(`⚠️ ${incompleteUsers.length} users submitted but didn't confirm "done"`);
  }
});

// Message processing
bot.on('message', async (ctx) => {
  if (!ctx.message) return;
  
  const chatId = ctx.chat.id;
  const messageThreadId = ctx.message?.message_thread_id;
  const text = ctx.message.text || '';
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name || 'Unknown';

  console.log(`📍 Message from chatId: ${chatId}, threadId: ${messageThreadId}, text: ${text?.substring(0, 100)}...`);

  // Only process messages from our channel
  if (chatId.toString() !== config.CHANNEL_ID) {
    console.log('❌ Message not from target channel, ignoring');
    return;
  }

  try {
    // Handle submissions topic
    if (messageThreadId === config.SUBMISSIONS_TOPIC_ID) {
      await handleSubmissionMessage(ctx, text, userId, username);
    }
    
    // Handle confirmations topic  
    if (messageThreadId === config.CONFIRMATIONS_TOPIC_ID) {
      await handleConfirmationMessage(ctx, text, userId, username);
    }
    
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

async function handleSubmissionMessage(ctx, text, userId, username) {
  const xLinks = text.match(config.X_LINK_PATTERN);
  
  if (xLinks && xLinks.length > 0) {
    console.log('🔍 Detected X link:', xLinks[0]);
    
    if (!db.isSessionActive()) {
      console.log('❌ No active session - deleting message');
      
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        console.log('Failed to delete message:', deleteError.message);
      }
      
      // Send violation message and delete after 10 seconds
      try {
        const violationMsg = await ctx.reply(
          `❌ @${username} SUBMISSIONS CURRENTLY CLOSED! ❌\n\n` +
          `⏰ Next Sessions:\n` +
          `• Day Session: 9:00 AM - 6:00 PM UTC\n` +
          `• Night Session: 6:00 PM - 9:00 AM UTC\n\n` +
          `🔄 This message will delete in 10 seconds.`,
          { message_thread_id: config.SUBMISSIONS_TOPIC_ID }
        );
        
        setTimeout(async () => {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, violationMsg.message_id);
          } catch (e) {
            console.log('Failed to delete violation message:', e.message);
          }
        }, 10000);
        
      } catch (replyError) {
        console.log('Failed to send violation message:', replyError.message);
      }
      
      return;
    }
    
    // Check if user can submit
    if (!db.canUserSubmit(userId)) {
      const user = db.getOrCreateUser(userId, username);
      console.log(`❌ User ${username} cannot submit - daily: ${user.dailySubmissions}/2, session: ${user.currentSessionSubmitted}`);
      
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        console.log('Failed to delete message:', deleteError.message);
      }
      
      let reason = '';
      if (user.currentSessionSubmitted) {
        reason = '🚫 You already submitted in this session!\n⏰ Wait for the next session to submit again.';
      } else {
        reason = '🚫 You reached the daily limit of 2 submissions!\n📅 Try again tomorrow.';
      }
      
      try {
        const violationMsg = await ctx.reply(
          `❌ @${username} SUBMISSION BLOCKED! ❌\n\n` +
          `${reason}\n\n` +
          `📊 Your Status: ${user.dailySubmissions}/2 daily submissions\n` +
          `🔄 This message will delete in 15 seconds.`,
          { message_thread_id: config.SUBMISSIONS_TOPIC_ID }
        );
        
        setTimeout(async () => {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, violationMsg.message_id);
          } catch (e) {
            console.log('Failed to delete violation message:', e.message);
          }
        }, 15000);
        
      } catch (replyError) {
        console.log('Failed to send violation message:', replyError.message);
      }
      
      return;
    }
    
    // Valid submission during active session
    console.log(`✅ Valid submission from ${username}`);
    db.recordSubmission(userId, ctx.message.message_id);
    db.addSubmission(userId, { text, xLinks });
    
    const user = db.getOrCreateUser(userId, username);
    console.log(`📊 User ${username} stats: daily ${user.dailySubmissions}/2, session submitted: ${user.currentSessionSubmitted}`);
  }
}

async function handleConfirmationMessage(ctx, text, userId, username) {
  if (text.toLowerCase().includes('done')) {
    console.log('🔍 Detected "done" confirmation in confirmations topic');
    
    const user = db.getOrCreateUser(userId, username);
    
    if (!db.isSessionActive()) {
      console.log('❌ No active session for confirmation');
      return;
    }
    
    if (!user.currentSessionSubmitted) {
      console.log(`❌ User ${username} tried to confirm but hasn't submitted in current session`);
      return;
    }
    
    if (user.currentSessionConfirmed) {
      console.log(`⚠️ User ${username} already confirmed for current session`);
      return;
    }
    
    // Valid confirmation
    console.log(`✅ Valid confirmation from ${username}`);
    db.recordConfirmation(userId);
    
    console.log(`🎉 ${username} earned 10 points! Total: ${user.points}`);
  }
}

// Automatic session scheduling
console.log('⏰ Setting up automatic session scheduling...');

// Day session start: 9:00 AM UTC
cron.schedule('0 9 * * *', async () => {
  console.log('🌅 Starting automatic day session at 9:00 AM UTC');
  
  if (db.isSessionActive()) {
    console.log('⚠️ Session already active, ending current session first');
    db.endSession();
  }
  
  const session = db.createSession('day');
  
  try {
    await bot.telegram.sendMessage(config.CHANNEL_ID, 
      `🌅 DAY SESSION STARTED! 

⏰ Duration: 9:00 AM - 6:00 PM UTC (9 hours)
📝 Submit your X/Twitter posts here
✅ Max 1 post per session, 2 per day
🎯 Remember to type "done" in confirmations when finished!`, 
      { message_thread_id: config.SUBMISSIONS_TOPIC_ID }
    );

    await bot.telegram.sendMessage(config.CHANNEL_ID, 
      `🌅 Day Session is now LIVE! 🚀\n\n📝 Submit your posts in submissions topic!\n⏰ 9:00 AM - 6:00 PM UTC`, 
      { message_thread_id: config.GENERAL_TOPIC_ID }
    );
  } catch (error) {
    console.error('Error announcing day session:', error);
  }
}, {
  scheduled: true,
  timezone: 'UTC'
});

// Night session start: 6:00 PM UTC
cron.schedule('0 18 * * *', async () => {
  console.log('🌙 Starting automatic night session at 6:00 PM UTC');
  
  if (db.isSessionActive()) {
    console.log('⚠️ Session already active, ending current session first');
    db.endSession();
  }
  
  const session = db.createSession('night');
  
  try {
    await bot.telegram.sendMessage(config.CHANNEL_ID, 
      `🌙 NIGHT SESSION STARTED! 

⏰ Duration: 6:00 PM - 9:00 AM UTC (15 hours)
📝 Submit your X/Twitter posts here
✅ Max 1 post per session, 2 per day
🎯 Remember to type "done" in confirmations when finished!`, 
      { message_thread_id: config.SUBMISSIONS_TOPIC_ID }
    );

    await bot.telegram.sendMessage(config.CHANNEL_ID, 
      `🌙 Night Session is now LIVE! 🚀\n\n📝 Submit your posts in submissions topic!\n⏰ 6:00 PM - 9:00 AM UTC`, 
      { message_thread_id: config.GENERAL_TOPIC_ID }
    );
  } catch (error) {
    console.error('Error announcing night session:', error);
  }
}, {
  scheduled: true,
  timezone: 'UTC'
});

// Set up Express server for health checks (keeps Render alive)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  const session = db.getCurrentSession();
  const sessionInfo = session && session.active 
    ? `Active ${session.type} session (${session.participants.size} participants, ${session.submissions.length} submissions)`
    : 'No active session';
  
  res.json({
    status: 'Bot is running! 🤖',
    uptime: process.uptime(),
    session: sessionInfo,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
});

// Launch bot
bot.launch().then(() => {
  console.log('🚀 Bot launched successfully with new session system!');
  console.log('📅 Day sessions: 9 AM - 6 PM UTC (9 hours)');
  console.log('🌙 Night sessions: 6 PM - 9 AM UTC (15 hours)');
  console.log('📝 Max 2 submissions per day (1 per session)');
}).catch(error => {
  console.error('❌ Failed to launch bot:', error);
});

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));