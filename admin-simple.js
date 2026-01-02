const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

// Load sample data or create empty database
let sampleUsers = [
  { id: 1, username: "Julio15X", status: "active", warnings: 0, points: 150, submissions: 15, engagements: 45, lastActive: new Date().toLocaleDateString() },
  { id: 2, username: "user123", status: "temp_banned", warnings: 2, points: 50, submissions: 8, engagements: 12, lastActive: "2025-12-18" },
  { id: 3, username: "newbie", status: "active", warnings: 1, points: 75, submissions: 10, engagements: 18, lastActive: "2025-12-19" }
];

app.get('/', (req, res) => {
  const html = `
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
      .refresh-btn { background: #2196F3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
    <script>
      function takeAction(userId, action, username) {
        const reason = prompt('Enter reason for ' + action + ' on @' + username + ':');
        if (!reason) return;
        
        alert(action + ' would be applied to @' + username + ' with reason: ' + reason);
        // In real version, this would send to: /api/admin/action/' + userId
        console.log('Action:', action, 'User:', userId, 'Reason:', reason);
      }
    </script>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🤖 X Engagement Bot Admin Dashboard</h1>
        <p>Focused user management and session analysis (Demo)</p>
      </div>

      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value">${sampleUsers.length}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sampleUsers.filter(u => u.status === 'active').length}</div>
          <div class="stat-label">Active Users</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sampleUsers.filter(u => u.status !== 'active').length}</div>
          <div class="stat-label">Banned Users</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sampleUsers.filter(u => u.warnings > 0).length}</div>
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
            ${sampleUsers.map(user => `
              <tr class="${user.warnings >= 2 ? 'flag-missing' : user.warnings >= 1 ? 'flag-risk' : ''}">
                <td>${user.id}</td>
                <td>@${user.username}</td>
                <td class="status-${user.status}">${user.status.replace('_', ' ')}</td>
                <td>${user.warnings}</td>
                <td>${user.points}</td>
                <td>${user.submissions}</td>
                <td>${user.engagements}</td>
                <td>${user.lastActive}</td>
                <td>
                  ${user.status === 'active' ? `
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
        <div class="analysis-item">
          <h4>🚨 Session 2025-12-19_morning - 12/19/2025</h4>
          <ul>
            <li>@user123 - Did not press "done" after submission</li>
            <li>@newbie - May not have engaged with all posts (8/12)</li>
          </ul>
        </div>
        <p style="color: #666; font-style: italic;">This analysis shows users who may need attention based on recent session behavior.</p>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
      </div>

      <div style="text-align: center; color: #666; font-size: 0.9em;">
        Last updated: ${new Date().toLocaleString()} (Demo Version)
      </div>
    </div>
  </body>
  </html>
  `;
  res.send(html);
});

const port = 3000;
app.listen(port, () => {
  console.log(`🌐 Admin dashboard demo running at http://localhost:${port}`);
  console.log(`✨ This demonstrates the admin features you requested!`);
});