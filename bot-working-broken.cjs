const { Telegraf } = require('telegraf');
const cron = require('node-cron');
require('dotenv').config();

console.log('🤖 Starting Full X Engagement Bot...');

// Simple in-memory database
class SimpleDB {
  constructor() {
    this.users = new Map();
    this.currentSession = null;
  }
  
  getOrCreateUser(userId, username) {
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
    return this.users.get(userId);
  }
  
  getLeaderboard() {
    return Array.from(this.users.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }
  
  createSession(type) {
    const now = new Date();
    this.currentSession = {
      id: `${now.getTime()}_${type}`,
      type,
      active: true,
      startTime: now,
      endTime: new Date(now.getTime() + 60 * 60000), // FIXED: 60 minutes (1 hour)
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
    // Load configuration directly
    const config = {
      botToken: process.env.BOT_TOKEN,
      channels: {
        general: process.env.GENERAL_CHAT_ID,
        submissions: process.env.SUBMISSIONS_CHANNEL_ID,
      },
      topics: {
        submissions: parseInt(process.env.SUBMISSIONS_THREAD_ID || '2'),
        confirmations: parseInt(process.env.CONFIRMATIONS_THREAD_ID || '3'),
      }
    };
    console.log('✅ Configuration loaded');
    
    const bot = new Telegraf(config.botToken);
    const db = new SimpleDB();
    console.log('✅ Bot instance and database created');

    // Commands
    bot.start((ctx) => {
      const user = db.getOrCreateUser(ctx.from.id, ctx.from.username || 'Unknown');
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

1. Submit valid X links in the SUBMISSIONS channel during sessions
2. Comment and like ALL other submissions in that session
3. Type "done" in the CONFIRMATIONS channel AFTER you've commented and liked ALL other posts
4. Earn 10 points per submission + 5 per engagement
5. Penalties for non-participation: -20 points

⚠️ Warning System:
• 2 warnings = 7-day ban
• 3 warnings = 30-day ban
• 4 warnings = Permanent ban

🧪 Test Commands:
/start_session - Start manual test session (Admin only)
/end_session - End current session (Admin only)`);
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
        } else if (utcHour < 19) { // FIXED: Updated for 1-hour sessions
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
      const user = db.getOrCreateUser(ctx.from.id, ctx.from.username || 'Unknown');
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

    // ADMIN-ONLY MANUAL SESSION COMMANDS 
    bot.command('start_session', async (ctx) => {
      // Check if user is admin (@Julio15X)
      if (ctx.from.username !== 'Julio15X') {
        ctx.reply('❌ Access denied. Only @Julio15X can manually start sessions.');
        return;
      }
      
      if (db.currentSession && db.currentSession.active) {
        ctx.reply('❌ Session already active! Use /session to check status.');
        return;
      }
      
      const session = db.createSession('morning');
      console.log(`🧪 Manual session started by admin @${ctx.from.username}`);
      
      // Send session messages to topics
      const sessionMessage = 
        `🟢 MORNING SESSION IS LIVE! 🟢\n\n` +
        `Duration: 60 minutes (1 hour)\n` + // FIXED: Updated duration
        `Submit your X links NOW!\n\n` +
        `📋 ENGAGEMENT REQUIREMENTS:\n` +
        `1. Comment on ALL other X posts from this session\n` +
        `2. Like ALL other X posts from this session\n` +
        `3. Type "done" in CONFIRMATIONS topic AFTER completing all engagement\n\n` +
        `⚠️ Failure to engage with all posts = Warning/Ban\n` +
        `🚨 Session ends in 1 hour`;

      try {
        // Send to submissions topic
        await bot.telegram.sendMessage(
          config.channels.submissions,
          sessionMessage,
          { message_thread_id: config.topics.submissions }
        );

        // Send to confirmations topic
        await bot.telegram.sendMessage(
          config.channels.submissions,
          sessionMessage,
          { message_thread_id: config.topics.confirmations }
        );

        // Announce in general chat
        await bot.telegram.sendMessage(
          config.channels.general,
          `🌅 Morning engagement session is now LIVE! Check SUBMISSIONS topic.`
        );
      } catch (error) {
        console.error('Error sending session messages:', error);
      }
      
      ctx.reply(`🔥 ADMIN MANUAL SESSION STARTED!

⏰ Duration: 60 minutes (1 hour)
🧪 Type: Test Session
👥 Participants: 0

🎯 Submit your X/Twitter posts now!
Format: Just paste your X link

Commands:
/session - Check status
/end_session - End session`);
    });

    bot.command('end_session', async (ctx) => {
      // Check if user is admin (@Julio15X)
      if (ctx.from.username !== 'Julio15X') {
        ctx.reply('❌ Access denied. Only @Julio15X can manually end sessions.');
        return;
      }
      
      if (!db.currentSession || !db.currentSession.active) {
        ctx.reply('❌ No active session to end.');
        return;
      }
      
      const finalParticipants = db.currentSession?.participants.size || 0;
      
      // Send session end messages to topics
      const sessionEndMessage = 
        `🔴 MORNING SESSION CLOSED 🔴\n\n` +
        `Final Stats:\n` +
        `• ${finalParticipants} participants\n\n` +
        `⏰ ENGAGEMENT DEADLINE: Before next session starts\n` +
        `✅ Don't forget to confirm completion in CONFIRMATIONS topic!\n\n` +
        `🔔 Next session: Evening at 6:00 PM UTC`;

      try {
        // Send to submissions topic
        await bot.telegram.sendMessage(
          config.channels.submissions,
          sessionEndMessage,
          { message_thread_id: config.topics.submissions }
        );

        // Send to confirmations topic
        await bot.telegram.sendMessage(
          config.channels.submissions,
          sessionEndMessage,
          { message_thread_id: config.topics.confirmations }
        );
      } catch (error) {
        console.error('Error sending session end messages:', error);
      }
      
      db.endSession();
      console.log(`🧪 Session ended by admin @${ctx.from.username}`);
      
      ctx.reply(`✅ Admin session ended!

📊 Final Stats:
👥 Participants: ${finalParticipants}

🎯 Points have been awarded!`);
    });

    // Handle messages with proper channel routing
    bot.on('message', async (ctx) => {
      if (!('text' in ctx.message)) return;
      
      const text = ctx.message.text;
      const chatId = ctx.chat?.id.toString();
      const threadId = 'message_thread_id' in ctx.message ? ctx.message.message_thread_id : undefined;
      const userId = ctx.from?.id;
      const username = ctx.from?.username || 'Unknown';
      
      if (!userId || !chatId) return;
      
      const user = db.getOrCreateUser(userId, username);
      
      // DEBUG: Log channel info
      console.log(`📍 Message from chatId: ${chatId}, threadId: ${threadId}, text: ${text.substring(0, 50)}...`);
      console.log(`📍 Config channels - general: ${config.channels.general}, submissions: ${config.channels.submissions}`);
      
      // FIXED: Handle submissions topic - block ALL messages unless X links
      if (chatId === config.channels.submissions && threadId === config.topics.submissions) {
        console.log(`📍 Message in submissions topic: ${text.substring(0, 50)}...`);
        const isXLink = text.includes('x.com') || text.includes('twitter.com');
        if (isXLink) {
          console.log(`🔍 Detected X link: ${text}`);
          await handleSubmission(ctx, user, text, db, config);
        } else {
          // FIXED: Block ALL non-X-link messages in submissions topic
          try {
            await ctx.deleteMessage();
            console.log(`Deleted non-X-link message from @${user.username} in submissions topic`);
          } catch (error) {
            console.error('Failed to delete non-X-link message:', error);
          }
          
          const educationalMessage = `❌ SUBMISSIONS TOPIC - X LINKS ONLY\n\nThis topic is for X/Twitter links during sessions only.\n\nUse other channels for general chat.\n\n⚠️ This message auto-deletes in 10 seconds`;
          const sentMessage = await ctx.reply(educationalMessage);
          setTimeout(async () => {
            try {
              await ctx.deleteMessage(sentMessage.message_id);
            } catch (e) {
              console.error('Failed to auto-delete educational message:', e);
            }
          }, 10000);
          return;
        }
      }
      
      // FIXED: Handle confirmations topic - allow anytime
      if (chatId === config.channels.submissions && threadId === config.topics.confirmations) {
        if (text.toLowerCase().trim() === 'done' || text.toLowerCase().trim() === 'done!' || text.toLowerCase().trim() === 'done.') {
          console.log(`🔍 Detected 'done' confirmation in confirmations topic`);
          await handleConfirmation(ctx, user, text, db, config);
        } else {
          // FIXED: Allow other messages in confirmations topic but clean them up after 30 seconds
          setTimeout(async () => {
            try {
              await ctx.deleteMessage();
            } catch (error) {
              console.error('Failed to auto-delete confirmation message:', error);
            }
          }, 30000); // 30 seconds
        }
      }
    });

    // Handler functions
    async function handleSubmission(ctx, user, text, db, config) {
      // Check if session is active
      if (!db.currentSession || !db.currentSession.active) {
        // Delete invalid submission immediately
        try {
          await ctx.deleteMessage();
          console.log(`Deleted submission from @${user.username} (no active session)`);
        } catch (error) {
          console.error('Failed to delete message:', error);
        }
        
        // Send educational message that auto-deletes
        const nextSessionInfo = getNextSessionInfo();
        const educationalMessage = `⚠️ SUBMISSIONS CURRENTLY CLOSED\n\n` +
          `Next ${nextSessionInfo.type} Session: ${nextSessionInfo.time}\n` +
          `Starts in: ${nextSessionInfo.countdown}\n\n` +
          `📋 ENGAGEMENT RULES:\n` +
          `• Submit X links in the SUBMISSIONS channel during 1-hour sessions\n` + // FIXED
          `• Morning: 9:00-10:00 AM UTC\n` + // FIXED
          `• Evening: 6:00-7:00 PM UTC\n` + // FIXED
          `• Comment and like ALL other submissions in that session\n` +
          `• Type "done" in CONFIRMATIONS channel AFTER you've commented and liked ALL other posts\n\n` +
          `⚠️ This message auto-deletes in 60 seconds`;
        
        const sentMessage = await ctx.reply(educationalMessage);
        setTimeout(async () => {
          try {
            await ctx.deleteMessage(sentMessage.message_id);
          } catch (e) {
            console.error('Failed to auto-delete educational message:', e);
          }
        }, 60000);
        return;
      }
      
      // Check if it's a valid X link
      const xLinks = extractXLinks(text);
      if (xLinks.length === 0) {
        // Delete invalid submission
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.error('Failed to delete invalid submission:', error);
        }
        
        const sentMessage = await ctx.reply(`❌ Please submit a valid X link in the SUBMISSIONS channel!\n\nExample: https://x.com/user/status/123456789\n\n⚠️ This message auto-deletes in 60 seconds`);
        setTimeout(async () => {
          try {
            await ctx.deleteMessage(sentMessage.message_id);
          } catch (e) {
            console.error('Failed to auto-delete invalid link message:', e);
          }
        }, 60000);
        return;
      }
      
      // Check for duplicate submissions
      if (db.currentSession.submissions.some(sub => sub.includes(user.username))) {
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.error('Failed to delete duplicate submission:', error);
        }
        
        const sentMessage = await ctx.reply(`❌ You already submitted a link for this session!\n\nOnly one submission per user per session.\n\n⚠️ This message auto-deletes in 10 seconds`);
        setTimeout(async () => {
          try {
            await ctx.deleteMessage(sentMessage.message_id);
          } catch (e) {
            console.error('Failed to auto-delete duplicate message:', e);
          }
        }, 10000);
        return;
      }
      
      // Valid submission - award points
      user.points += 10;
      user.submissions += 1;
      db.currentSession.participants.add(user.id);
      db.currentSession.submissions.push(`@${user.username}: ${text}`);
      
      console.log(`📤 Valid submission from @${user.username}: ${xLinks[0]}`);
      
      // Send confirmation that auto-deletes after 10 seconds
      const sentMessage = await ctx.reply(`✅ Submission received!\n\n🎯 +10 points awarded\n💰 Your points: ${user.points}`);
      
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(sentMessage.message_id);
        } catch (error) {
          console.error('Failed to auto-delete confirmation message:', error);
        }
      }, 10000); // 10 seconds
    }
    
    async function handleConfirmation(ctx, user, text, db, config) {
      // FIXED: Allow confirmations even without active session - users can confirm hours later
      let targetSession = db.currentSession;
      if (!targetSession || !targetSession.active) {
        // Check if user has any submissions at all
        if (user.submissions === 0) {
          const sentMessage = await ctx.reply('❌ No recent session found where you participated.');
          setTimeout(async () => {
            try {
              await ctx.deleteMessage(sentMessage.message_id);
            } catch (error) {
              console.error('Failed to auto-delete message:', error);
            }
          }, 10000);
          return;
        }
        
        // Create a virtual session for confirmation tracking
        targetSession = {
          id: `confirmation_${Date.now()}`,
          type: 'morning',
          active: false,
          startTime: new Date(),
          endTime: new Date(),
          participants: new Set([user.id]),
          submissions: [`@${user.username}: confirmation`]
        };
      }
      
      // Check if user participated in the target session
      if (!targetSession.participants.has(user.id)) {
        const sentMessage = await ctx.reply('❌ You must submit a link first before confirming.');
        setTimeout(async () => {
          try {
            await ctx.deleteMessage(sentMessage.message_id);
          } catch (error) {
            console.error('Failed to auto-delete message:', error);
          }
        }, 10000);
        return;
      }
      
      // Award engagement points
      user.points += 5;
      user.engagements += 1;
      
      console.log(`✅ Engagement confirmed by @${user.username} for session ${targetSession.id}`);
      
      const sentMessage = await ctx.reply(`✅ Engagement confirmed!\n\n🎯 +5 points awarded\n💰 Your points: ${user.points}`);
      
      // Auto-delete after 10 seconds
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(sentMessage.message_id);
        } catch (error) {
          console.error('Failed to auto-delete confirmation:', error);
        }
      }, 10000);
    }
    
    function extractXLinks(text) {
      const urlRegex = /https?:\/\/(?:www\.)?(x\.com|twitter\.com)\/\S+/gi;
      return text.match(urlRegex) || [];
    }
    
    function getNextSessionInfo() {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const currentMinutes = utcHours * 60 + utcMinutes;
      
      // FIXED: Session times in minutes with 1-hour durations
      const morningStart = 9 * 60; // 9:00
      const morningEnd = 10 * 60; // 10:00 (1 hour later)
      const eveningStart = 18 * 60; // 18:00
      const eveningEnd = 19 * 60; // 19:00 (1 hour later)
      
      let nextSession;
      
      if (currentMinutes < morningStart) {
        // Before morning session today
        nextSession = { type: 'Morning', time: '9:00 AM UTC', minutes: morningStart };
      } else if (currentMinutes < morningEnd) {
        // During morning session - next is evening
        nextSession = { type: 'Evening', time: '6:00 PM UTC', minutes: eveningStart };
      } else if (currentMinutes < eveningStart) {
        // Between sessions - next is evening
        nextSession = { type: 'Evening', time: '6:00 PM UTC', minutes: eveningStart };
      } else if (currentMinutes < eveningEnd) {
        // During evening session - next is tomorrow morning
        nextSession = { type: 'Morning', time: '9:00 AM UTC (tomorrow)', minutes: morningStart + 24 * 60 };
      } else {
        // After evening session, next is tomorrow morning
        nextSession = { type: 'Morning', time: '9:00 AM UTC (tomorrow)', minutes: morningStart + 24 * 60 };
      }
      
      const minutesUntil = nextSession.minutes > currentMinutes ? 
        nextSession.minutes - currentMinutes : 
        nextSession.minutes - currentMinutes + 24 * 60;
      
      const hoursUntil = Math.floor(minutesUntil / 60);
      const minsUntil = minutesUntil % 60;
      
      let countdown = '';
      if (hoursUntil > 0) countdown += `${hoursUntil}h `;
      countdown += `${minsUntil}m`;
      
      return {
        type: nextSession.type,
        time: nextSession.time,
        countdown: countdown.trim()
      };
    }

    // FIXED: Add 10-minute reminders
    async function sendSessionReminder(sessionType, startTime, bot, config) {
      try {
        const message = 
          `⏰ SESSION STARTING SOON ⏰\n\n` +
          `${sessionType} engagement session begins in 10 minutes!\n\n` +
          `📅 Start Time: ${startTime} UTC\n` +
          `⏱️ Duration: 60 minutes (1 hour)\n` + // FIXED
          `📝 Submit X links in SUBMISSIONS topic\n\n` +
          `🔔 GET READY:\n` +
          `• Have your X post ready to share\n` +
          `• Remember: Must comment and like ALL other X posts\n` +
          `• Type "done" in CONFIRMATIONS topic after engaging\n\n` +
          `⚠️ Late submissions will be deleted!`;

        // Send to submissions topic
        await bot.telegram.sendMessage(
          config.channels.submissions,
          message,
          { message_thread_id: config.topics.submissions }
        );

        // Send to confirmations topic
        await bot.telegram.sendMessage(
          config.channels.submissions,
          message,
          { message_thread_id: config.topics.confirmations }
        );

        // Announce in general chat
        await bot.telegram.sendMessage(
          config.channels.general,
          `⏰ ${sessionType} session starting in 10 minutes! Get ready.`
        );

        console.log(`📢 Sent 10-minute reminder for ${sessionType} session`);
      } catch (error) {
        console.error(`❌ Error sending ${sessionType} session reminder:`, error);
      }
    }

    // AUTOMATIC SCHEDULING
    console.log('⏰ Setting up automatic session scheduling...');
    
    // FIXED: Morning session reminder: 8:50 AM UTC (10 minutes before)
    cron.schedule('50 8 * * *', async () => {
      console.log('⏰ Sending morning session reminder...');
      await sendSessionReminder('Morning', '9:00 AM', bot, config);
    });
    
    // FIXED: Evening session reminder: 5:50 PM UTC (10 minutes before)
    cron.schedule('50 17 * * *', async () => {
      console.log('⏰ Sending evening session reminder...');
      await sendSessionReminder('Evening', '6:00 PM', bot, config);
    });
    
    // Morning session: 9:00 AM UTC
    cron.schedule('0 9 * * *', () => {
      console.log('🌅 Starting automatic morning session...');
      
      if (db.currentSession && db.currentSession.active) {
        console.log('⚠️ Session already active, skipping...');
        return;
      }
      
      const session = db.createSession('morning');
      
      // Send to submissions topic
      bot.telegram.sendMessage(config.channels.submissions, `🌅 MORNING SESSION STARTED!

⏰ Duration: 60 minutes (1 hour)
🎯 Submit your X/Twitter posts here!

📋 Rules:
1. Submit X links in the SUBMISSIONS channel
2. Comment and like ALL other submissions in that session
3. Type "done" in CONFIRMATIONS channel AFTER you've commented and liked ALL other posts
4. Earn 10 points per submission + 5 per engagement

💰 Points system active!`, {
        message_thread_id: config.topics.submissions
      }).catch(console.error);
      
      // Announce in general chat
      bot.telegram.sendMessage(config.channels.general, `🌅 Morning engagement session is now LIVE! Check submissions topic.`).catch(console.error);
      
      // FIXED: Auto-end after 60 minutes (1 hour)
      setTimeout(() => {
        if (db.currentSession && db.currentSession.id === session.id) {
          db.endSession();
          console.log('🌅 Morning session auto-ended');
          
          // Send end message to submissions topic
          bot.telegram.sendMessage(config.channels.submissions, `✅ MORNING SESSION ENDED!

📊 Final stats:
👥 Participants: ${session.participants.size}

⚠️ Don't forget to confirm your engagement in the confirmations topic!
🎯 Next session: 6:00 PM UTC`, {
            message_thread_id: config.topics.submissions
          }).catch(console.error);
          
          // Announce in general chat
          bot.telegram.sendMessage(config.channels.general, `✅ Morning session ended! Next session: 6:00 PM UTC`).catch(console.error);
        }
      }, 60 * 60 * 1000); // FIXED: 1 hour
    });
    
    // Evening session: 6:00 PM UTC
    cron.schedule('0 18 * * *', () => {
      console.log('🌆 Starting automatic evening session...');
      
      if (db.currentSession && db.currentSession.active) {
        console.log('⚠️ Session already active, skipping...');
        return;
      }
      
      const session = db.createSession('evening');
      
      // Send to submissions topic
      bot.telegram.sendMessage(config.channels.submissions, `🌆 EVENING SESSION STARTED!

⏰ Duration: 60 minutes (1 hour)
🎯 Submit your X/Twitter posts here!

📋 Rules:
1. Submit X links in the SUBMISSIONS channel
2. Comment and like ALL other submissions in that session
3. Type "done" in CONFIRMATIONS channel AFTER you've commented and liked ALL other posts
4. Earn 10 points per submission + 5 per engagement

💰 Points system active!`, {
        message_thread_id: config.topics.submissions
      }).catch(console.error);
      
      // Announce in general chat
      bot.telegram.sendMessage(config.channels.general, `🌆 Evening engagement session is now LIVE! Check submissions topic.`).catch(console.error);
      
      // FIXED: Auto-end after 60 minutes (1 hour)
      setTimeout(() => {
        if (db.currentSession && db.currentSession.id === session.id) {
          db.endSession();
          console.log('🌆 Evening session auto-ended');
          
          // Send end message to submissions topic
          bot.telegram.sendMessage(config.channels.submissions, `✅ EVENING SESSION ENDED!

📊 Final stats:
👥 Participants: ${session.participants.size}

⚠️ Don't forget to confirm your engagement in the confirmations topic!
🎯 Next session: 9:00 AM UTC tomorrow`, {
            message_thread_id: config.topics.submissions
          }).catch(console.error);
          
          // Announce in general chat
          bot.telegram.sendMessage(config.channels.general, `✅ Evening session ended! Next session: 9:00 AM UTC tomorrow`).catch(console.error);
        }
      }, 60 * 60 * 1000); // FIXED: 1 hour
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
    
    console.log('✅ Full X Engagement Bot ready - RESTORED WITH FIXES!');
    console.log('🧪 Manual testing: /start_session');
    console.log('⏰ Auto sessions: 9:00-10:00 AM & 6:00-7:00 PM UTC (1 hour each)');
    console.log('📢 10-minute reminders: 8:50 AM & 5:50 PM UTC');
    console.log('🚫 Submissions channel: X-links only during sessions');
    console.log('✅ Confirmations: Available anytime, auto-cleanup after 30s');
    
  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();