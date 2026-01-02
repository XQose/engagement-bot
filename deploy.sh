#!/bin/bash

# Oracle Cloud Deployment Script for Engagement Bot
# Run this script on your Oracle Cloud VM

echo "🚀 Starting Engagement Bot deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create app directory
sudo mkdir -p /opt/engagement-bot
sudo chown $USER:$USER /opt/engagement-bot

# Copy files (you'll need to upload your project first)
# rsync -av --exclude node_modules --exclude dist ./ /opt/engagement-bot/

cd /opt/engagement-bot

# Install dependencies
npm install

# Build the project
npm run build

# Create production environment file
cat > .env.production << EOF
# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_admin_chat_id
TESTING_USER=Julio15X

# Channel/Group Configuration
SUBMISSIONS_CHANNEL_ID=your_supergroup_id
GENERAL_CHANNEL_ID=your_supergroup_id

# Topic IDs (get these from your supergroup)
SUBMISSIONS_TOPIC_ID=2
CONFIRMATIONS_TOPIC_ID=3
WARNINGS_TOPIC_ID=4
BANNED_TOPIC_ID=5

# Session Configuration
MORNING_TIME=0 9 * * *
EVENING_TIME=0 18 * * *
SESSION_DURATION=30

# Points System
SUBMISSION_POINTS=10
ENGAGEMENT_POINTS=5
VIOLATION_PENALTY=-20

# Enforcement Settings
WARNINGS_BEFORE_TEMP_BAN=2
WARNINGS_BEFORE_MONTH_BAN=4
WARNINGS_BEFORE_PERMA_BAN=6
TEMP_BAN_DAYS=3
MONTH_BAN_DAYS=30

# Admin Dashboard
ADMIN_PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password_here
EOF

echo "📝 Created .env.production template"
echo "⚠️  IMPORTANT: Edit .env.production with your actual values!"
echo ""
echo "Next steps:"
echo "1. Edit .env.production with your bot token and channel IDs"
echo "2. Run: pm2 start ecosystem.config.js"
echo "3. Run: pm2 save && pm2 startup"

echo "✅ Deployment setup complete!"