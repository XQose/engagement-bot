# X Engagement Bot

A Telegram bot that manages X (Twitter) engagement sessions with automated tracking, points system, and enforcement.

## 🚀 Features

- **Scheduled Sessions**: Automatic morning (9 AM UTC) and evening (6 PM UTC) engagement sessions
- **X Link Validation**: Only allows valid X/Twitter links
- **Engagement Tracking**: Tracks reactions and confirmations automatically  
- **Points System**: Rewards engagement with points and leaderboard
- **Progressive Enforcement**: Warning system leading to temporary and permanent bans
- **Admin Dashboard**: Web-based dashboard for monitoring and management
- **Multi-Channel Structure**: Organized channels for different purposes

## 📋 How It Works

### For Users:
1. **Post X Link**: Submit your X link during active sessions (30-minute windows)
2. **Engage**: Comment on ALL other X posts from the same session
3. **React**: Click 👍 on ALL other submissions in the Telegram channel  
4. **Confirm**: Type "done" in confirmations channel when finished
5. **Earn Points**: Get rewarded for participation and engagement

### Enforcement Rules:
- **1st & 2nd violations**: Warning issued
- **3rd violation**: 1 week ban
- **4th violation**: 1 month ban  
- **5th violation**: Permanent ban

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Telegram channels for each purpose (see channel setup below)

### 1. Clone and Install
```bash
git clone <your-repo>
cd Engagement\ Bot
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Required: Get from @BotFather
BOT_TOKEN=your_telegram_bot_token

# Required: Your Telegram user ID (admin access)
ADMIN_USER_ID=your_telegram_user_id

# Required: Channel IDs (see setup below)
GENERAL_CHAT_ID=-1001234567890
SUBMISSIONS_CHANNEL_ID=-1001234567890
CONFIRMATIONS_CHANNEL_ID=-1001234567890
WARNINGS_CHANNEL_ID=-1001234567890
BANNED_CHANNEL_ID=-1001234567890
ADMIN_CHANNEL_ID=-1001234567890
```

### 3. Telegram Channel Setup

Create 6 channels/groups and get their IDs:

1. **General Chat** - Main community discussion
2. **Submissions** - X link submissions during sessions
3. **Confirmations** - Users type "done" here
4. **Warnings** - Public warning announcements  
5. **Banned** - Ban announcements
6. **Admin** - Private admin notifications

**Getting Channel IDs:**
1. Add your bot to each channel as admin
2. Send a message mentioning the bot: `/start @yourbotname`
3. Forward that message to [@userinfobot](https://t.me/userinfobot)
4. Copy the channel ID (including the minus sign)

### 4. Development

```bash
# Development mode (auto-restart)
npm run dev

# Build for production
npm run build

# Start production
npm start

# Run admin dashboard only
npm run admin
```

### 5. Production Deployment

#### Option A: Docker (Recommended)
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

#### Option B: Oracle Cloud (Free Forever)

1. **Create Oracle Cloud Account**
   - Sign up at [oracle.com/cloud/free](https://oracle.com/cloud/free)
   - Complete identity verification

2. **Create Compute Instance**
   - Go to Compute > Instances
   - Click "Create Instance"
   - Select "Always Free Eligible" shape (ARM-based)
   - Choose Ubuntu 20.04 
   - Generate/upload SSH key
   - Note the public IP

3. **Setup Instance**
   ```bash
   # SSH to your instance
   ssh ubuntu@<your-instance-ip>
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Clone your repository
   git clone <your-repo-url>
   cd engagement-bot
   npm install
   npm run build
   ```

4. **Configure Environment**
   ```bash
   # Copy and edit environment file
   cp .env.example .env
   nano .env
   # Add all your bot tokens and channel IDs
   ```

5. **Start with PM2**
   ```bash
   # Start bot
   pm2 start dist/index.js --name "engagement-bot"
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   # Run the command it gives you
   
   # Monitor
   pm2 status
   pm2 logs engagement-bot
   ```

## 🎮 Bot Commands

### User Commands
- `/start` - Register and get welcome message
- `/mystats` - View personal statistics
- `/leaderboard` - Top 10 users by points
- `/rules` - Display engagement rules
- `/session` - Current session information

### Admin Commands
- `/adminstats` - Admin dashboard overview
- `/warn <user_id> <reason>` - Issue warning to user
- `/unban <user_id>` - Remove ban from user
- `/startsession <morning|evening>` - Manually start session
- `/endsession <morning|evening>` - Manually end session
- `/forcecheck` - Run engagement enforcement check

## 📊 Admin Dashboard

Access the web dashboard at `http://localhost:3000` (or your server IP):

- **Live Statistics**: Users, sessions, submissions, engagements
- **User Management**: Search users, view details, issue warnings
- **Top Users**: Leaderboard with engagement metrics
- **Recent Warnings**: Latest violations and actions taken
- **Quick Actions**: Warn, unban, and search functionality

## 🔧 Configuration

### Session Times (UTC)
- **Morning**: 9:00-9:30 AM UTC
- **Evening**: 6:00-6:30 PM UTC

To change times, modify the cron expressions in `.env`:
```bash
MORNING_SESSION_TIME=0 9 * * *     # 9 AM UTC
EVENING_SESSION_TIME=0 18 * * *    # 6 PM UTC
```

### Points System
```bash
POINTS_FOR_SUBMISSION=10    # Points for posting link
POINTS_FOR_ENGAGEMENT=5     # Points per engagement completed  
POINTS_PENALTY=-20          # Penalty for violations
```

### Enforcement Rules
Modify in `src/types/index.ts`:
```typescript
enforcement: {
  warningsBeforeTempBan: 2,     // 2 warnings then temp ban
  tempBanDuration: 7,           // 7 days
  warningsBeforeMonthBan: 3,    // 3 warnings then month ban  
  monthBanDuration: 30,         // 30 days
  warningsBeforePermaBan: 4     // 4 warnings then permanent
}
```

## 📝 Database

Uses JSON file storage (`data/database.json`) with automatic backups. Contains:

- **Users**: Registration, points, warnings, ban status
- **Sessions**: Session history and participants
- **Submissions**: All X links submitted  
- **Engagements**: Reaction and confirmation tracking
- **Warnings/Bans**: Moderation history

## 🚨 Troubleshooting

### Bot Not Responding
```bash
# Check if bot is running
pm2 status

# View logs
pm2 logs engagement-bot

# Restart bot  
pm2 restart engagement-bot
```

### Channel Issues
1. Verify bot is admin in all channels
2. Check channel IDs are correct (include minus sign)
3. Test with `/start` command in each channel

### Environment Variables
```bash
# Verify all required variables are set
cat .env | grep -v "^#"
```

### Database Issues
```bash
# Check database file exists and has data
ls -la data/
cat data/database.json | jq '.stats'
```

## 🔒 Security Notes

- Store `.env` file securely (never commit to git)
- Use a dedicated Telegram account for the bot
- Regularly backup the `data/` directory
- Monitor the admin dashboard for unusual activity
- Keep the bot token private

## 📚 API Reference

The bot exposes these endpoints for the admin dashboard:

- `GET /` - Dashboard interface
- `GET /api/stats` - Bot statistics
- `GET /api/users` - All users list
- `GET /api/leaderboard` - Top users
- `POST /api/warn` - Issue warning
- `POST /api/unban` - Remove ban
- `GET /api/user/:id` - User details

## 🤝 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review logs: `pm2 logs engagement-bot`
3. Check admin dashboard for user activity
4. Verify all environment variables are set correctly

## 📄 License

MIT License - Feel free to modify and distribute as needed.