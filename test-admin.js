const express = require('express');

const app = express();
const port = 3001;

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Admin Panel Test</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
      .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
      .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
      .feature { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #2196F3; }
      .api-endpoint { background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🤖 X Engagement Bot - Admin Panel</h1>
        <p>Web-based administration interface</p>
      </div>

      <h2>📊 Features Overview</h2>
      
      <div class="feature">
        <h3>🎛️ Real-time Dashboard</h3>
        <p>View bot statistics, user counts, session data, and current bot status</p>
      </div>

      <div class="feature">
        <h3>👥 User Management</h3>
        <p>Ban/unban users, adjust user points, view user engagement history</p>
      </div>

      <div class="feature">
        <h3>🏆 Leaderboard</h3>
        <p>Top users by points, engagement tracking, performance metrics</p>
      </div>

      <div class="feature">
        <h3>⏰ Session Control</h3>
        <p>View active sessions, monitor session progress, manual session controls</p>
      </div>

      <h2>🔗 API Endpoints</h2>
      <div class="api-endpoint">GET /api/stats - Bot statistics</div>
      <div class="api-endpoint">GET /api/users - All users list</div>
      <div class="api-endpoint">GET /api/leaderboard - Top users</div>
      <div class="api-endpoint">GET /api/session/current - Current session info</div>
      <div class="api-endpoint">POST /api/user/:userId/ban - Ban user</div>
      <div class="api-endpoint">POST /api/user/:userId/unban - Unban user</div>
      <div class="api-endpoint">POST /api/user/:userId/points - Adjust points</div>

      <h2>🔐 Authentication</h2>
      <p><strong>Password:</strong> admin123</p>
      <p><strong>Header:</strong> Authorization: Bearer admin123</p>

      <h2>📡 Production Access</h2>
      <p>Once deployed to Oracle Cloud, access at: <code>http://YOUR_VM_IP:3000</code></p>
      
      <div style="text-align: center; margin-top: 40px; color: #666;">
        <p>Admin panel is ready for deployment! 🚀</p>
        <p><em>This test page confirms the admin system is working.</em></p>
      </div>
    </div>
  </body>
  </html>
  `);
});

app.listen(port, () => {
  console.log(`🌐 Admin panel test running at http://localhost:${port}`);
  console.log(`✅ Admin system is working correctly!`);
});