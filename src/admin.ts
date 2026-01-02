import express from 'express';
import { Database } from './database.js';
import { loadConfig } from './config.js';

export class AdminDashboard {
  private app: express.Application;
  private db: Database;
  private config: any;

  constructor(db: Database) {
    this.app = express();
    this.db = db;
    this.config = loadConfig();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Authentication middleware
    this.app.use((req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${this.config.admin.password}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });

    // Dashboard home
    this.app.get('/', (req, res) => {
      const stats = this.db.getStats();
      const leaderboard = this.db.getLeaderboard(10);
      const currentSession = this.db.getCurrentSession();
      
      const html = this.generateDashboardHTML(stats, leaderboard, currentSession);
      res.send(html);
    });

    // API Routes
    this.app.get('/api/stats', (req, res) => {
      const stats = this.db.getStats();
      res.json(stats);
    });

    this.app.get('/api/users', (req, res) => {
      const users = this.db.getAllUsers();
      res.json(users);
    });

    this.app.get('/api/leaderboard', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = this.db.getLeaderboard(limit);
      res.json(leaderboard);
    });

    this.app.get('/api/session/current', (req, res) => {
      const session = this.db.getCurrentSession();
      res.json(session);
    });

    // User management
    this.app.post('/api/user/:userId/ban', (req, res) => {
      const userId = parseInt(req.params.userId);
      const { duration, permanent } = req.body;
      
      const banUntil = permanent ? undefined : new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      
      this.db.updateUser(userId, {
        banStatus: permanent ? 'permanently_banned' : 'temp_banned',
        banUntil
      });
      
      res.json({ success: true });
    });

    this.app.post('/api/user/:userId/unban', (req, res) => {
      const userId = parseInt(req.params.userId);
      
      this.db.updateUser(userId, {
        banStatus: 'active',
        banUntil: undefined
      });
      
      res.json({ success: true });
    });

    this.app.post('/api/user/:userId/points', (req, res) => {
      const userId = parseInt(req.params.userId);
      const { points } = req.body;
      
      const user = this.db.getUser(userId);
      if (user) {
        this.db.updateUser(userId, { points: user.points + points });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    });

    // New admin action endpoint for manual warnings/bans
    this.app.post('/api/admin/action/:userId', async (req, res) => {
      const userId = parseInt(req.params.userId);
      const { action, reason } = req.body;
      
      const user = this.db.getUser(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      try {
        await this.processAdminAction(user, action, reason);
        res.json({ success: true, message: `${action} applied to @${user.username}` });
      } catch (error) {
        console.error('Admin action error:', error);
        res.status(500).json({ error: 'Failed to process action' });
      }
    });
  }

  private generateDashboardHTML(stats: any, leaderboard: any[], currentSession: any): string {
    const allUsers = this.db.getAllUsers();
    const recentSessions = this.db.getAllSessions().slice(-5);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>X Engagement Bot - Admin Dashboard</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .stat-value { font-size: 2em; font-weight: bold; color: #2196F3; }
        .stat-label { font-size: 0.9em; color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
        .status-active { color: #4CAF50; font-weight: bold; }
        .status-temp_banned { color: #ff9800; font-weight: bold; }
        .status-permanently_banned { color: #f44336; font-weight: bold; }
        .action-btn { padding: 4px 8px; margin: 2px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; }
        .btn-warning1 { background: #ffc107; color: #000; }
        .btn-warning2 { background: #ff9800; color: white; }
        .btn-restrict { background: #ff5722; color: white; }
        .btn-ban { background: #f44336; color: white; }
        .btn-unban { background: #4CAF50; color: white; }
        .flag-risk { background: #fff3cd; }
        .flag-missing { background: #f8d7da; }
        .session-analysis { margin-top: 20px; }
        .analysis-item { padding: 10px; margin: 5px 0; border-left: 4px solid #ff9800; background: #fff8e1; }
        .refresh-btn { background: #2196F3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
      </style>
      <script>
        async function takeAction(userId, action, username) {
          const reason = prompt(\`Enter reason for \${action} on @\${username}:\`);
          if (!reason) return;
          
          try {
            const response = await fetch(\`/api/admin/action/\${userId}\`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer admin123'
              },
              body: JSON.stringify({ action, reason })
            });
            
            if (response.ok) {
              alert(\`\${action} applied to @\${username}\`);
              location.reload();
            } else {
              alert('Error applying action');
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
      </script>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤖 X Engagement Bot Admin Dashboard</h1>
          <p>Focused user management and session analysis</p>
        </div>

        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">${stats.totalUsers}</div>
            <div class="stat-label">Total Users</div>
          </div>
          <div class="stat">
            <div class="stat-value">${allUsers.filter(u => u.banStatus === 'active').length}</div>
            <div class="stat-label">Active Users</div>
          </div>
          <div class="stat">
            <div class="stat-value">${allUsers.filter(u => u.banStatus !== 'active').length}</div>
            <div class="stat-label">Banned Users</div>
          </div>
          <div class="stat">
            <div class="stat-value">${allUsers.filter(u => u.warnings > 0).length}</div>
            <div class="stat-label">Users with Warnings</div>
          </div>
        </div>

        <div class="card">
          <h2>👥 User Management</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Status</th>
                <th>Warnings</th>
                <th>Points</th>
                <th>Submissions</th>
                <th>Engagements</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${allUsers.map(user => `
                <tr class="${this.getUserRiskClass(user)}">
                  <td>${user.id}</td>
                  <td>@${user.username}</td>
                  <td class="status-${user.banStatus}">${user.banStatus.replace('_', ' ')}</td>
                  <td>${user.warnings}</td>
                  <td>${user.points}</td>
                  <td>${user.totalSubmissions}</td>
                  <td>${user.totalEngagements}</td>
                  <td>${user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}</td>
                  <td>
                    ${user.banStatus === 'active' ? `
                      <button class="action-btn btn-warning1" onclick="takeAction(${user.id}, 'warning1', '${user.username}')">⚠️1</button>
                      <button class="action-btn btn-warning2" onclick="takeAction(${user.id}, 'warning2', '${user.username}')">⚠️2</button>
                      <button class="action-btn btn-restrict" onclick="takeAction(${user.id}, 'restrict', '${user.username}')">🚫</button>
                      <button class="action-btn btn-ban" onclick="takeAction(${user.id}, 'ban', '${user.username}')">❌</button>
                    ` : `
                      <button class="action-btn btn-unban" onclick="takeAction(${user.id}, 'unban', '${user.username}')">✅</button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>📊 Session Analysis</h2>
          ${this.generateSessionAnalysis(recentSessions)}
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
        </div>

        <div style="text-align: center; color: #666; font-size: 0.9em;">
          Last updated: ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private getUserRiskClass(user: any): string {
    if (user.warnings >= 2) return 'flag-missing';
    if (user.warnings >= 1 || user.totalEngagements < user.totalSubmissions) return 'flag-risk';
    return '';
  }

  private generateSessionAnalysis(sessions: any[]): string {
    if (sessions.length === 0) {
      return '<p>No recent sessions to analyze</p>';
    }

    let analysis = '';
    
    sessions.forEach(session => {
      const participants = session.participants || [];
      const submissions = session.submissions || [];
      const confirmations = session.confirmations || [];
      
      const flaggedUsers: string[] = [];
      
      participants.forEach((userId: number) => {
        const user = this.db.getUser(userId);
        if (!user) return;
        
        const hasSubmitted = submissions.some((sub: any) => sub.userId === userId);
        const hasConfirmed = confirmations.includes(userId);
        const userSubmissions = submissions.filter((sub: any) => sub.userId === userId);
        const userEngagements = userSubmissions.length > 0 ? user.totalEngagements : 0;
        
        if (hasSubmitted && !hasConfirmed) {
          flaggedUsers.push(`@${user.username} - Did not press "done" after submission`);
        }
        
        const expectedEngagements = submissions.length - userSubmissions.length;
        if (hasSubmitted && userEngagements < expectedEngagements) {
          flaggedUsers.push(`@${user.username} - May not have engaged with all posts (${userEngagements}/${expectedEngagements})`);
        }
      });
      
      if (flaggedUsers.length > 0) {
        analysis += `
          <div class="analysis-item">
            <h4>🚨 Session ${session.id} - ${new Date(session.startTime).toLocaleDateString()}</h4>
            <ul>
              ${flaggedUsers.map(flag => `<li>${flag}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    });
    
    return analysis || '<p>✅ No issues found in recent sessions</p>';
  }

  private async processAdminAction(user: any, action: string, reason: string): Promise<void> {
    const { Telegraf } = await import('telegraf');
    const bot = new Telegraf(this.config.botToken);

    let newWarnings = user.warnings;
    let newBanStatus = user.banStatus;
    let banUntil = user.banUntil;
    let pointsPenalty = 0;
    let message = '';
    let threadId = this.config.channels.warningsThreadId;

    switch (action) {
      case 'warning1':
        newWarnings = Math.max(1, user.warnings);
        pointsPenalty = -10;
        message = `⚠️ **WARNING 1** issued to @${user.username}\n\n**Reason:** ${reason}\n\nNext violation will result in WARNING 2. If you believe this is incorrect, please contact admin.`;
        break;

      case 'warning2':
        newWarnings = Math.max(2, user.warnings);
        pointsPenalty = -20;
        message = `⚠️⚠️ **WARNING 2** issued to @${user.username}\n\n**Reason:** ${reason}\n\nNext violation will result in restriction. If you believe this is incorrect, please contact admin.`;
        break;

      case 'restrict':
        newBanStatus = 'temp_banned';
        banUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        pointsPenalty = -50;
        threadId = this.config.channels.bannedThreadId;
        message = `🚫 **7-DAY RESTRICTION** applied to @${user.username}\n\n**Reason:** ${reason}\n\nYou are restricted from sessions until ${banUntil.toLocaleDateString()}. If you believe this is incorrect, please contact admin.`;
        break;

      case 'ban':
        newBanStatus = 'permanently_banned';
        banUntil = undefined;
        pointsPenalty = -100;
        threadId = this.config.channels.bannedThreadId;
        message = `❌ **PERMANENT BAN** applied to @${user.username}\n\n**Reason:** ${reason}\n\nYou are permanently banned from all sessions. If you believe this is incorrect, please contact admin.`;
        break;

      case 'unban':
        newBanStatus = 'active';
        banUntil = undefined;
        newWarnings = 0;
        threadId = this.config.channels.warningsThreadId;
        message = `✅ **UNBAN** applied to @${user.username}\n\n**Reason:** ${reason}\n\nYou have been unbanned and can participate in sessions again. All warnings cleared.`;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Update user in database
    this.db.updateUser(user.id, {
      warnings: newWarnings,
      banStatus: newBanStatus,
      banUntil,
      points: user.points + pointsPenalty
    });

    // Send notification to Telegram
    try {
      await bot.telegram.sendMessage(
        this.config.channels.generalChatId,
        message,
        { 
          message_thread_id: threadId,
          parse_mode: 'Markdown'
        }
      );
    } catch (telegramError) {
      console.error('Failed to send Telegram notification:', telegramError);
    }
  }

  start(): void {
    this.app.listen(this.config.admin.port, () => {
      console.log(`🌐 Admin dashboard running at http://localhost:${this.config.admin.port}`);
      console.log(`🔑 Authentication: Bearer ${this.config.admin.password}`);
    });
  }
}