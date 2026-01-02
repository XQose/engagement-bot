import { Context, Telegraf } from 'telegraf';
import { Database } from './database.js';
import { BotConfig } from './config.js';

export class MessageHandler {
  private bot: Telegraf;
  private db: Database;
  private config: BotConfig;
  private autoDeleteTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(bot: Telegraf, db: Database, config: BotConfig) {
    this.bot = bot;
    this.db = db;
    this.config = config;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle submissions in submissions topic
    this.bot.on('message', async (ctx) => {
      try {
        await this.handleMessage(ctx);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Handle reactions
    this.bot.on('message_reaction', async (ctx) => {
      try {
        await this.handleReaction(ctx);
      } catch (error) {
        console.error('Error handling reaction:', error);
      }
    });
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const message = ctx.message;
    if (!message || !('text' in message)) return;

    const chatId = ctx.chat?.id.toString();
    const threadId = 'message_thread_id' in message ? message.message_thread_id : undefined;
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const text = message.text;

    if (!userId || !username || !chatId) return;

    // Ensure user exists in database
    let user = this.db.getUser(userId);
    if (!user) {
      user = this.db.createUser(userId, username);
      console.log(`New user registered: ${username} (${userId})`);
    }

    // Check if user is banned
    if (user.banStatus !== 'active') {
      if (user.banStatus === 'temp_banned' && user.banUntil && new Date() > user.banUntil) {
        // Lift temporary ban
        this.db.updateUser(userId, { banStatus: 'active', banUntil: undefined });
        console.log(`Temporary ban lifted for ${username}`);
      } else {
        // User is still banned, ignore message
        return;
      }
    }

    // Handle submissions topic
    if (chatId === this.config.channels.submissions && threadId === this.config.topics.submissions) {
      await this.handleSubmission(ctx, userId, username, text);
    }

    // Handle confirmations topic  
    if (chatId === this.config.channels.confirmations && threadId === this.config.topics.confirmations) {
      await this.handleConfirmation(ctx, userId, username, text);
    }

    // Handle admin commands (allow in general chat for convenience)
    if ((chatId === this.config.channels.admin && threadId === this.config.topics.admin) || 
        chatId === this.config.channels.general) {
      if (text.startsWith('/')) {
        await this.handleAdminCommand(ctx, userId, username, text);
      }
    }
  }

  private async handleSubmission(ctx: Context, userId: number, username: string, text: string): Promise<void> {
    const isTestUser = this.config.testing.enabled && username === this.config.testing.testUser;
    let currentSession = this.db.getCurrentSession();
    
    // Check if we're within session window OR have an active session (manual start)
    if (!isTestUser && !this.isWithinSessionWindow() && !currentSession) {
      // Delete the invalid submission
      try {
        await ctx.deleteMessage();
        console.log(`Deleted invalid submission from ${username} (outside session window)`);
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
      
      // Send educational auto-delete message
      const nextSession = this.getNextSessionInfo();
      const educationalMessage = 
        `⏰ SUBMISSIONS CURRENTLY CLOSED\n\n` +
        `Next ${nextSession.type} Session: ${nextSession.time}\n` +
        `Starts in: ${nextSession.countdown}\n\n` +
        `📋 ENGAGEMENT RULES:\n` +
        `• Submit X links only during 30-min sessions\n` +
        `• Morning: 9:00-9:30 AM UTC\n` +
        `• Evening: 6:00-6:30 PM UTC\n` +
        `• Must engage with ALL other posts\n` +
        `• Type "done" in confirmations after engaging\n\n` +
        `⚠️ This message auto-deletes in 60 seconds`;
        
      await this.sendAutoDeleteMessage(
        this.config.channels.submissions,
        this.config.topics.submissions,
        educationalMessage
      );
      return;
    }

    // Get existing session or auto-create if in time window
    if (!currentSession) {
      // Auto-create session if we're in the time window
      const now = new Date();
      const utcHours = now.getUTCHours();
      const sessionType = utcHours >= 9 && utcHours < 10 ? 'morning' : 'evening';
      const today = now.toISOString().split('T')[0];
      const timestamp = now.getTime();
      // Create unique session ID for auto-created sessions
      const sessionDateString = `${today}_${timestamp}`;
      currentSession = this.db.createSession(sessionType, sessionDateString);
      console.log(`Auto-created ${sessionType} session: ${currentSession.id}`);
    }

    // Check if user already submitted in this session (except for test user)
    if (!isTestUser) {
      const existingSubmissions = this.db.getUserSubmissions(userId, currentSession.id);
      if (existingSubmissions.length > 0) {
        // Delete duplicate submission
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.error('Failed to delete duplicate submission:', error);
        }
        
        await this.sendAutoDeleteMessage(
          this.config.channels.submissions,
          this.config.topics.submissions,
          `❌ You already submitted a link for this session!\n\nOnly one submission per user per session.\n\n⚠️ This message auto-deletes in 10 seconds`,
          10000
        );
        return;
      }
    }

    // Extract X links from message
    const xLinks = this.extractXLinks(text);
    
    if (xLinks.length === 0) {
      // Delete invalid submission
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.error('Failed to delete invalid submission:', error);
      }
      
      await this.sendAutoDeleteMessage(
        this.config.channels.submissions,
        this.config.topics.submissions,
        `❌ Please submit a valid X (Twitter) link!\n\nExample: https://x.com/user/status/123456789\n\n⚠️ This message auto-deletes in 60 seconds`
      );
      return;
    }

    // Process valid X links
    let validSubmissions = 0;
    for (const link of xLinks) {
      if (this.db.isValidXLink(link)) {
        const submission = this.db.createSubmission(userId, currentSession.id, link);
        
        // Award submission points
        const user = this.db.getUser(userId);
        if (user) {
          user.points += this.config.points.submission;
          this.db.updateUser(userId, { points: user.points });
        }

        console.log(`Valid submission: ${username} -> ${link}`);
        validSubmissions++;
      }
    }

    if (validSubmissions > 0) {
      // Simple confirmation for valid submissions (auto-delete after 10 seconds)
      let confirmationMessage = `✅ Submission received!`;
      
      if (isTestUser) {
        confirmationMessage += '\n\n🧪 TEST MODE: You have special testing privileges.';
      }
      
      const sentMessage = await ctx.reply(confirmationMessage);
      
      // Auto-delete confirmation after 10 seconds
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(sentMessage.message_id);
        } catch (error) {
          console.error('Failed to auto-delete confirmation message:', error);
        }
      }, 10000); // 10 seconds
    } else {
      // Delete message with invalid links
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.error('Failed to delete invalid submission:', error);
      }
      
      await this.sendAutoDeleteMessage(
        this.config.channels.submissions,
        this.config.topics.submissions,
        `❌ Invalid X links detected!\n\nMust be from x.com or twitter.com with /status/ in URL\n\n⚠️ This message auto-deletes in 60 seconds`
      );
    }
  }

  private async handleConfirmation(ctx: Context, userId: number, username: string, text: string): Promise<void> {
    if (text.toLowerCase().trim() !== 'done') return;

    const currentSession = this.db.getCurrentSession();
    if (!currentSession) {
      await ctx.reply('No active session to confirm for.');
      return;
    }

    // Check if user has submissions in this session
    const userSubmissions = this.db.getUserSubmissions(userId, currentSession.id);
    if (userSubmissions.length === 0) {
      await ctx.reply('You have not submitted any links in this session.');
      return;
    }

    // Check if already confirmed
    const hasConfirmed = this.db.hasUserConfirmedEngagement(userId, currentSession.id);
    if (hasConfirmed) {
      await ctx.reply('You have already confirmed completion for this session.');
      return;
    }

    // Record confirmation
    this.db.addEngagement(userId, userSubmissions[0]!.id, currentSession!.id, 'confirmation');
    
    // Award engagement points
    const user = this.db.getUser(userId);
    if (user) {
      user.points += this.config.points.engagement;
      user.totalEngagements++;
      this.db.updateUser(userId, { 
        points: user.points,
        totalEngagements: user.totalEngagements
      });
    }

    await ctx.reply(`Engagement confirmed! You earned ${this.config.points.engagement} points.`);
    console.log(`Engagement confirmed: ${username} for session ${currentSession.id}`);
  }

  private async handleReaction(ctx: any): Promise<void> {
    // Handle 👍 reactions on submissions
    const reaction = ctx.messageReaction;
    if (!reaction) return;

    const userId = reaction.user?.id;
    const messageId = reaction.message_id;
    
    if (!userId) return;

    // Check if it's a 👍 reaction being added
    const newEmoji = reaction.new_reaction?.find((r: any) => r.emoji === '👍');
    if (!newEmoji) return;

    // Find submission by message context and record reaction
    const currentSession = this.db.getCurrentSession();
    if (currentSession) {
      // This is simplified - in practice you'd need to track message IDs
      this.db.addEngagement(userId, 'reaction_placeholder', currentSession.id, 'reaction');
      console.log(`Reaction recorded: User ${userId} on message ${messageId}`);
    }
  }

  private async handleAdminCommand(ctx: Context, userId: number, username: string, text: string): Promise<void> {
    // Basic admin commands
    if (text.startsWith('/stats')) {
      const stats = this.db.getStats();
      const message = `Bot Statistics:\nUsers: ${stats.totalUsers}\nSessions: ${stats.totalSessions}\nSubmissions: ${stats.totalSubmissions}\nEngagements: ${stats.totalEngagements}`;
      await ctx.reply(message);
    }

    if (text.startsWith('/leaderboard')) {
      const leaderboard = this.db.getLeaderboard(10);
      let message = 'Top 10 Users:\n';
      leaderboard.forEach((user, index) => {
        message += `${index + 1}. @${user.username} - ${user.points} points\n`;
      });
      await ctx.reply(message);
    }

    if (text.startsWith('/session')) {
      const currentSession = this.db.getCurrentSession();
      if (currentSession) {
        await ctx.reply(`Active Session: ${currentSession.id} (${currentSession.type})`);
      } else {
        await ctx.reply('No active session');
      }
    }

    // Manual session controls
    if (text.startsWith('/start_morning')) {
      await this.startManualSession('morning');
      await ctx.reply('Morning session started manually!');
    }

    if (text.startsWith('/start_evening')) {
      await this.startManualSession('evening');
      await ctx.reply('Evening session started manually!');
    }

    if (text.startsWith('/end_session')) {
      const currentSession = this.db.getCurrentSession();
      if (currentSession) {
        await this.endManualSession(currentSession.id);
        await ctx.reply(`${currentSession.type} session ended manually!`);
      } else {
        await ctx.reply('No active session to end');
      }
    }
  }

  private async startManualSession(type: 'morning' | 'evening'): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timestamp = now.getTime();
    // Create unique session ID for manual sessions  
    const sessionDateString = `${today}_${timestamp}`;
    const session = this.db.createSession(type, sessionDateString);
    
    console.log(`🌅 Starting ${type} session manually: ${session.id}`);

    const sessionEmoji = type === 'morning' ? '🌅' : '🌙';
    const message = 
      `${sessionEmoji} ${type.toUpperCase()} SESSION STARTED ${sessionEmoji}\n\n` +
      `Duration: ${this.config.sessions.duration} minutes\n` +
      `Submit your X links here!\n\n` +
      `ENGAGEMENT REQUIREMENTS:\n` +
      `1. Comment on ALL other X posts from this session\n` +
      `2. React 👍 to ALL other submissions in this topic\n` +
      `3. Type "done" in confirmations topic AFTER completing all engagement\n\n` +
      `⚠️ Failure to engage with all posts = Warning/Ban`;

    // Send to submissions topic
    await this.bot.telegram.sendMessage(
      this.config.channels.submissions,
      message,
      { message_thread_id: this.config.topics.submissions }
    );

    // Announce in general chat
    await this.bot.telegram.sendMessage(
      this.config.channels.general,
      `${sessionEmoji} ${type.charAt(0).toUpperCase() + type.slice(1)} engagement session is now LIVE! Check submissions topic.`
    );
  }

  private async endManualSession(sessionId: string): Promise<void> {
    this.db.endSession(sessionId);
    
    const session = this.db.getSession(sessionId);
    if (!session) return;
    
    const sessionEmoji = session.type === 'morning' ? '🌅' : '🌙';
    const submissions = this.db.getSessionSubmissions(sessionId);

    const message = 
      `${sessionEmoji} ${session.type.toUpperCase()} SESSION ENDED ${sessionEmoji}\n\n` +
      `Final Stats:\n` +
      `• ${submissions.length} submissions received\n` +
      `• ${session?.participants.length || 0} participants\n\n` +
      `Engagement deadline: Before next session starts\n` +
      `Don't forget to confirm completion!`;

    await this.bot.telegram.sendMessage(
      this.config.channels.submissions,
      message,
      { message_thread_id: this.config.topics.submissions }
    );
  }

  private extractXLinks(text: string): string[] {
    const urlRegex = /https?:\/\/(?:www\.)?(x\.com|twitter\.com)\/\S+/gi;
    return text.match(urlRegex) || [];
  }

  private isWithinSessionWindow(): boolean {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    
    // Morning session: 9:00-9:30 UTC
    const morningStart = 9 * 60; // 9:00 in minutes
    const morningEnd = 9 * 60 + 30; // 9:30 in minutes
    
    // Evening session: 18:00-18:30 UTC  
    const eveningStart = 18 * 60; // 18:00 in minutes
    const eveningEnd = 18 * 60 + 30; // 18:30 in minutes
    
    const currentMinutes = utcHours * 60 + utcMinutes;
    
    return (currentMinutes >= morningStart && currentMinutes <= morningEnd) ||
           (currentMinutes >= eveningStart && currentMinutes <= eveningEnd);
  }

  private getNextSessionInfo(): { type: string; time: string; countdown: string } {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const currentMinutes = utcHours * 60 + utcMinutes;
    
    // Session times in minutes
    const morningStart = 9 * 60; // 9:00
    const eveningStart = 18 * 60; // 18:00
    
    let nextSession: { type: string; time: string; minutes: number };
    
    if (currentMinutes < morningStart) {
      // Before morning session today
      nextSession = { type: 'Morning', time: '9:00 AM UTC', minutes: morningStart };
    } else if (currentMinutes < eveningStart) {
      // Before evening session today  
      nextSession = { type: 'Evening', time: '6:00 PM UTC', minutes: eveningStart };
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

  private async sendAutoDeleteMessage(chatId: string, threadId: number, message: string, deleteAfterMs: number = 60000): Promise<void> {
    try {
      const sentMessage = await this.bot.telegram.sendMessage(chatId, message, {
        message_thread_id: threadId
      });
      
      // Auto-delete after specified time
      setTimeout(async () => {
        try {
          await this.bot.telegram.deleteMessage(chatId, sentMessage.message_id);
        } catch (error) {
          console.error('Failed to auto-delete message:', error);
        }
      }, deleteAfterMs);
      
    } catch (error) {
      console.error('Failed to send auto-delete message:', error);
    }
  }
}