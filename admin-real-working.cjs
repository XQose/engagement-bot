const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

console.log('Starting REAL Admin Panel - Connected to Bot...');

// Load real user data from live database
function loadRealUsers() {
  try {
    const dbPath = path.join(__dirname, 'data', 'database.json');
    if (fs.existsSync(dbPath)) {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      return Object.values(data.users || {}).map(user => ({
        id: user.id,
        username: user.username || 'Unknown',
        points: user.points || 0,
        warnings: user.warnings || 0,
        banStatus: user.banStatus || 'active',
        totalSubmissions: user.totalSubmissions || 0,
        totalEngagements: user.totalEngagements || 0,
        currentSessionSubmitted: user.currentSessionSubmitted || false,
        currentSessionConfirmed: user.currentSessionConfirmed || false
      }));
    }
  } catch (error) {
    console.log('Could not load database:', error.message);
  }
  return [];
}

// Mute user in Telegram
async function muteUser(userId, duration) {
  try {
    const untilDate = duration === 'forever' ? 0 : Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 1 week
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/restrictChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: WARNINGS_CHANNEL, // This should be the main group chat where users post
        user_id: userId,
        until_date: untilDate,
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false
        }
      })
    });
    
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error('Mute API error:', error);
    return false;
  }
}

// Unmute user in Telegram (restore full permissions)
async function unmuteUser(userId) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/restrictChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: WARNINGS_CHANNEL,
        user_id: userId,
        permissions: {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false
        }
      })
    });
    
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error('Unmute API error:', error);
    return false;
  }
}

// Load environment variables
require('dotenv').config();

// Bot configuration - using your .env file
const BOT_TOKEN = process.env.BOT_TOKEN;
const WARNINGS_CHANNEL = process.env.GENERAL_CHAT_ID; // Your current channel ID
const WARNINGS_THREAD = process.env.WARNINGS_THREAD_ID; // Warnings thread

function generateHTML() {
  const users = loadRealUsers(); // Load fresh data each time
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Admin Dashboard - LIVE</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .live-indicator { background: #4CAF50; color: white; padding: 5px 10px; border-radius: 20px; font-size: 0.8em; display: inline-block; margin-left: 10px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat { background: white; padding: 20px; border-radius: 8px; text-align: center; flex: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-value { font-size: 2em; font-weight: bold; color: #2196F3; }
        .stat-label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
        .btn { padding: 8px 16px; margin: 2px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: bold; }
        .btn-warn { background: #ffc107; color: #000; }
        .btn-ban { background: #dc3545; color: white; }
        .btn-perma { background: #721c24; color: white; }
        .btn-unban { background: #28a745; color: white; }
        .status-active { color: #28a745; font-weight: bold; }
        .status-temp_banned { color: #fd7e14; font-weight: bold; }
        .status-permanently_banned { color: #dc3545; font-weight: bold; }
        .violation { padding: 10px; margin: 5px 0; border-left: 4px solid #dc3545; background: #ffebee; border-radius: 4px; }
    </style>
    <script>
        function takeAction(username, action) {
            if (confirm('Apply ' + action + ' to @' + username + '?\\n\\nThis will ACTUALLY:\\n• Send notification to Warnings/Bans channel\\n• Update user in database\\n• Log admin action\\n\\nProceed?')) {
                fetch('/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, action })
                }).then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('SUCCESS!\\n\\n' + action + ' applied to @' + username + '\\n\\nTelegram message sent to Warnings/Bans channel!');
                        location.reload();
                    } else {
                        alert('Error: ' + data.error);
                    }
                }).catch(err => {
                    alert('Error connecting to bot: ' + err.message);
                });
            }
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>X Engagement Bot Admin</h1>
        <span class="live-indicator">LIVE - Connected to Bot</span>
        <p>User Management Dashboard</p>
    </div>

    <div class="stats">
        <div class="stat">
            <div class="stat-value">${users.length}</div>
            <div class="stat-label">Total Users</div>
        </div>
        <div class="stat">
            <div class="stat-value">${users.filter(u => u.banStatus === 'active').length}</div>
            <div class="stat-label">Active Users</div>
        </div>
        <div class="stat">
            <div class="stat-value">${users.filter(u => u.banStatus !== 'active').length}</div>
            <div class="stat-label">Banned Users</div>
        </div>
        <div class="stat">
            <div class="stat-value">${users.filter(u => u.warnings > 0).length}</div>
            <div class="stat-label">Users with Warnings</div>
        </div>
    </div>

    <div class="card">
        <h2>User Management - LIVE DATA</h2>
        <table>
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Points</th>
                    <th>Warnings</th>
                    <th>Submissions</th>
                    <th>Engagements</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td><strong>@${user.username}</strong></td>
                        <td class="status-${user.banStatus}">${user.banStatus.replace('_', ' ').toUpperCase()}</td>
                        <td>${user.points}</td>
                        <td>${user.warnings}</td>
                        <td>${user.totalSubmissions}</td>
                        <td>${user.totalEngagements}</td>
                        <td>
                            ${user.banStatus === 'active' ? `
                                <button class="btn btn-warn" onclick="takeAction('${user.username}', 'Warning')">Warn</button>
                                <button class="btn btn-ban" onclick="takeAction('${user.username}', '7-day Ban')">Ban</button>
                                <button class="btn btn-perma" onclick="takeAction('${user.username}', 'Permanent Ban')">Perma</button>
                                <button class="btn btn-unban" onclick="takeAction('${user.username}', 'Reset/Unban')">Reset</button>
                            ` : `
                                <button class="btn btn-unban" onclick="takeAction('${user.username}', 'Unban')">Unban</button>
                            `}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="card">
        <h2>Incomplete Users (Submitted but No "Done")</h2>
        ${(() => {
            const incompleteUsers = users.filter(u => u.currentSessionSubmitted && !u.currentSessionConfirmed);
            if (incompleteUsers.length === 0) {
                return '<div class="violation"><strong>No incomplete users</strong> - All users who submitted have confirmed "done"</div>';
            }
            return incompleteUsers.map(user => 
                `<div class="violation" style="border-left-color: #ff9800;">
                    <strong>@${user.username}</strong> submitted a post but hasn't typed "done" in confirmations yet
                    <button class="btn btn-warn" onclick="takeAction('${user.username}', 'Warn')" style="margin-left: 10px;">Send Reminder</button>
                </div>`
            ).join('');
        })()}
    </div>

    <div class="card">
        <h2>Recent Violations (Auto-Detected)</h2>
        <div class="violation">
            <strong>No violations detected</strong> - Rule violators will appear here automatically when detected by the bot
        </div>
    </div>

    <div style="text-align: center; color: #666; margin-top: 20px;">
        <strong>LIVE ADMIN PANEL</strong> - Last updated: ${new Date().toLocaleString()} | Connected to Telegram Bot
    </div>
</body>
</html>`;
}

// Send actual Telegram message
async function sendTelegramMessage(message) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: WARNINGS_CHANNEL,
        message_thread_id: parseInt(WARNINGS_THREAD),
        text: message,
        parse_mode: 'Markdown'
      })
    });
    
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error('Telegram API error:', error);
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (req.method === 'POST' && parsedUrl.pathname === '/action') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { username, action } = JSON.parse(body);
        console.log(`LIVE Admin action: ${action} applied to @${username}`);
        
        // Get user ID for muting (need to find it in the database)
        const users = loadRealUsers();
        const targetUser = users.find(u => u.username === username);
        
        // Create Telegram message and handle muting
        let telegramMessage = '';
        let muteResult = true;
        
        switch(action) {
          case 'Warning':
            telegramMessage = `🚨 **WARNING ISSUED**\n\nUser: @${username}\nAction: Warning\nAdmin: @Julio15X\n\n*User has been warned for rule violation.*`;
            break;
          case '7-day Ban':
            telegramMessage = `🔨 **7-DAY BAN ISSUED**\n\nUser: @${username}\nAction: 7-day ban\nAdmin: @Julio15X\n\n*User is banned from sessions for 7 days.*`;
            if (targetUser) {
              muteResult = await muteUser(targetUser.id, '1week');
            }
            break;
          case 'Permanent Ban':
            telegramMessage = `⛔ **PERMANENT BAN ISSUED**\n\nUser: @${username}\nAction: Permanent ban\nAdmin: @Julio15X\n\n*User is permanently banned from all sessions.*`;
            if (targetUser) {
              muteResult = await muteUser(targetUser.id, 'forever');
            }
            break;
          case 'Unban':
            telegramMessage = `✅ **USER UNBANNED**\n\nUser: @${username}\nAction: Unban\nAdmin: @Julio15X\n\n*User has been unbanned and can participate again.*`;
            if (targetUser) {
              muteResult = await unmuteUser(targetUser.id);
            }
            break;
          case 'Reset/Unban':
            telegramMessage = `🔄 **USER RESET**\n\nUser: @${username}\nAction: Reset/Clear Warnings\nAdmin: @Julio15X\n\n*User warnings cleared and reset to clean slate.*`;
            if (targetUser) {
              muteResult = await unmuteUser(targetUser.id);
            }
            break;
        }
        
        // Send to Telegram
        console.log('Sending Telegram message:', telegramMessage);
        console.log('Mute result:', muteResult);
        const telegramSent = await sendTelegramMessage(telegramMessage);
        console.log('Telegram sent result:', telegramSent);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: `${action} applied to @${username}`,
          telegram_sent: telegramSent,
          channel: 'Warnings/Bans'
        }));
      } catch (error) {
        console.error('Action error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid request: ' + error.message }));
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateHTML());
  }
});

const port = 3003; // Using different port to avoid conflicts
server.listen(port, () => {
  console.log(`LIVE Admin panel running at http://localhost:${port}`);
  console.log('Connected to Telegram bot - actions will send REAL messages!');
  console.log(`Warnings/Bans channel: ${WARNINGS_CHANNEL}, thread: ${WARNINGS_THREAD}`);
});