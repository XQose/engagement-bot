import * as cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { Database } from './database.js';
import { BotConfig } from './config.js';

export class SessionScheduler {
  private bot: Telegraf;
  private db: Database;
  private config: BotConfig;
  private jobs: cron.ScheduledTask[] = [];

  constructor(bot: Telegraf, db: Database, config: BotConfig) {
    this.bot = bot;
    this.db = db;
    this.config = config;
  }

  start(): void {
    console.log('Starting session scheduler...');

    // Morning session start
    const morningStartJob = cron.schedule(
      this.config.sessions.morningTime,
      () => this.startSession('morning'),
      { scheduled: true, timezone: 'UTC' }
    );

    // Evening session start  
    const eveningStartJob = cron.schedule(
      this.config.sessions.eveningTime,
      () => this.startSession('evening'),
      { scheduled: true, timezone: 'UTC' }
    );

    // Session end jobs (30 minutes after start)
    const morningEndTime = this.addMinutesToCronTime(this.config.sessions.morningTime, this.config.sessions.duration);
    const morningEndJob = cron.schedule(
      morningEndTime,
      () => this.endCurrentSession('morning'),
      { scheduled: true, timezone: 'UTC' }
    );

    const eveningEndTime = this.addMinutesToCronTime(this.config.sessions.eveningTime, this.config.sessions.duration);
    const eveningEndJob = cron.schedule(
      eveningEndTime,
      () => this.endCurrentSession('evening'),
      { scheduled: true, timezone: 'UTC' }
    );

    // Daily enforcement check (1 hour after evening session)
    const enforcementTime = this.addMinutesToCronTime(this.config.sessions.eveningTime, this.config.sessions.duration + 60);
    const enforcementJob = cron.schedule(
      enforcementTime,
      () => this.runEnforcement(),
      { scheduled: true, timezone: 'UTC' }
    );

    this.jobs = [morningStartJob, eveningStartJob, morningEndJob, eveningEndJob, enforcementJob];
    console.log('✅ Session scheduler started with 5 cron jobs');
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    console.log('📥 Session scheduler stopped');
  }

  private addMinutesToCronTime(cronTime: string, minutes: number): string {
    const parts = cronTime.split(' ');
    const minute = parseInt(parts[0] || '0');
    const hour = parseInt(parts[1] || '0');
    
    const totalMinutes = hour * 60 + minute + minutes;
    const newHour = Math.floor(totalMinutes / 60) % 24;
    const newMinute = totalMinutes % 60;
    
    return `${newMinute} ${newHour} ${parts[2]} ${parts[3]} ${parts[4]}`;
  }

  async startSession(type: 'morning' | 'evening'): Promise<void> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timestamp = now.getTime();
      // Create unique session ID for automatic sessions
      const sessionDateString = `${today}_${timestamp}`;
      const session = this.db.createSession(type, sessionDateString);
      
      console.log(`🌅 Starting ${type} session: ${session.id}`);

      const sessionEmoji = type === 'morning' ? '🌅' : '🌙';
      const message = 
        `${sessionEmoji} ${type.toUpperCase()} SESSION LIVE ${sessionEmoji}\n\n` +
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

      // Send instructions to confirmations topic
      const confirmationsMessage = 
        `📋 ENGAGEMENT CONFIRMATIONS TOPIC 📋\n\n` +
        `After you complete ALL engagement requirements:\n` +
        `1. ✅ Comment on ALL other X posts from this session\n` +
        `2. ✅ React 👍 to ALL other submissions in submissions topic\n` +
        `3. ✅ Type "done" here to confirm completion\n\n` +
        `⚠️ Only type "done" AFTER completing all engagement!\n` +
        `❌ Failure to engage with all posts = Warning/Ban`;

      await this.bot.telegram.sendMessage(
        this.config.channels.submissions,
        confirmationsMessage,
        { message_thread_id: this.config.topics.confirmations }
      );

    } catch (error) {
      console.error(`❌ Error starting ${type} session:`, error);
    }
  }

  async endCurrentSession(type: 'morning' | 'evening'): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sessionId = `${today}_${type}`;
      
      this.db.endSession(sessionId);
      
      const sessionEmoji = type === 'morning' ? '🌅' : '🌙';
      const submissions = this.db.getSessionSubmissions(sessionId);
      const session = this.db.getSession(sessionId);

      const message = 
        `${sessionEmoji} ${type.toUpperCase()} SESSION ENDED ${sessionEmoji}\n\n` +
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

      // Post leaderboard after evening session
      if (type === 'evening') {
        await this.postLeaderboard();
      }

      console.log(`📝 Ended ${type} session: ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error ending ${type} session:`, error);
    }
  }

  private async postLeaderboard(): Promise<void> {
    try {
      const leaderboard = this.db.getLeaderboard(10);
      
      if (leaderboard.length === 0) return;

      let message = '🏆 DAILY LEADERBOARD 🏆\n\n';
      
      leaderboard.forEach((user, index) => {
        const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
        const points = user.points > 0 ? `+${user.points}` : user.points.toString();
        message += `${medal} @${user.username} - ${points} points\n`;
      });

      message += '\n📈 Keep engaging to climb the ranks!';

      await this.bot.telegram.sendMessage(this.config.channels.general, message);
      
      console.log('📊 Posted daily leaderboard');
    } catch (error) {
      console.error('❌ Error posting leaderboard:', error);
    }
  }

  private async runEnforcement(): Promise<void> {
    try {
      console.log('🔍 Running daily enforcement check...');
      
      const today = new Date().toISOString().split('T')[0];
      const morningSession = this.db.getSession(`${today}_morning`);
      const eveningSession = this.db.getSession(`${today}_evening`);
      
      const sessions = [morningSession, eveningSession].filter(Boolean);
      
      for (const session of sessions) {
        if (!session) continue;
        
        const submissions = this.db.getSessionSubmissions(session.id);
        
        for (const submission of submissions) {
          const hasConfirmed = this.db.hasUserConfirmedEngagement(submission.userId, session.id);
          
          if (!hasConfirmed) {
            await this.handleViolation(submission.userId, session.id);
          }
        }
      }

      console.log('✅ Daily enforcement completed');
    } catch (error) {
      console.error('❌ Error during enforcement:', error);
    }
  }

  private async handleViolation(userId: number, sessionId: string): Promise<void> {
    const user = this.db.getUser(userId);
    if (!user || user.banStatus !== 'active') return;

    const warning = this.db.addWarning(userId, `Failed to complete engagement for session ${sessionId}`, sessionId);
    
    // Determine punishment based on warning count
    let message = '';
    let shouldBan = false;
    let banDays = 0;
    let permanent = false;

    if (user.warnings <= this.config.enforcement.warningsBeforeTempBan) {
      // Issue warning
      message = 
        `⚠️ WARNING ISSUED ⚠️\n\n` +
        `User: @${user.username}\n` +
        `Reason: ${warning.reason}\n` +
        `Warning Count: ${user.warnings}\n\n` +
        `Next violation may result in a ban!`;

      await this.bot.telegram.sendMessage(
        this.config.channels.warnings,
        message,
        { message_thread_id: this.config.topics.warnings }
      );

    } else if (user.warnings <= this.config.enforcement.warningsBeforeMonthBan) {
      // Temporary ban
      shouldBan = true;
      banDays = this.config.enforcement.tempBanDays;
      
    } else if (user.warnings <= this.config.enforcement.warningsBeforePermaBan) {
      // Month ban
      shouldBan = true;
      banDays = this.config.enforcement.monthBanDays;
      
    } else {
      // Permanent ban
      shouldBan = true;
      permanent = true;
    }

    if (shouldBan) {
      const banUntil = permanent ? undefined : new Date(Date.now() + banDays * 24 * 60 * 60 * 1000);
      
      this.db.updateUser(userId, {
        banStatus: permanent ? 'permanently_banned' : 'temp_banned',
        banUntil,
      });

      const banType = permanent ? 'PERMANENT BAN' : `${banDays} DAY BAN`;
      message = 
        `🚫 ${banType} 🚫\n\n` +
        `User: @${user.username}\n` +
        `Duration: ${permanent ? 'Permanent' : `${banDays} days`}\n` +
        `Reason: Too many engagement violations`;

      await this.bot.telegram.sendMessage(
        this.config.channels.banned,
        message,
        { message_thread_id: this.config.topics.banned }
      );
    }

    console.log(`📝 Processed violation for user ${userId}: ${user.warnings} warnings`);
  }

  // Manual controls
  async manualStartSession(type: 'morning' | 'evening'): Promise<void> {
    await this.startSession(type);
  }

  async manualEndSession(type: 'morning' | 'evening'): Promise<void> {
    await this.endCurrentSession(type);
  }
}