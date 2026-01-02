# Oracle Cloud Deployment Guide

## Prerequisites

1. **Oracle Cloud Account**: Sign up for Oracle Cloud Always Free tier
2. **VM Instance**: Create an Ubuntu 22.04 VM with:
   - Shape: VM.Standard.E2.1.Micro (Always Free eligible)
   - Memory: 1GB RAM
   - Storage: 47GB Boot Volume
3. **Security**: Configure security list to allow:
   - Port 22 (SSH)
   - Port 3001 (Admin dashboard - optional)

## Step 1: Create Oracle Cloud VM

1. Go to [Oracle Cloud Console](https://cloud.oracle.com)
2. Navigate to: Compute > Instances
3. Click "Create Instance"
4. Configure:
   - Name: `engagement-bot`
   - Image: `Ubuntu 22.04`
   - Shape: `VM.Standard.E2.1.Micro` (Always Free)
   - SSH Keys: Upload your public key or generate new ones
5. Click "Create"

## Step 2: Connect to Your VM

```bash
# Connect via SSH (replace with your VM's public IP)
ssh ubuntu@YOUR_VM_PUBLIC_IP
```

## Step 3: Upload Project Files

### Option A: Using SCP
```bash
# From your local machine
scp -r "/Users/xhuliqose/Desktop/Engagement Bot" ubuntu@YOUR_VM_IP:/home/ubuntu/
```

### Option B: Using Git (if you have a repository)
```bash
# On the VM
git clone your-repo-url
cd your-repo-name
```

## Step 4: Run Deployment Script

```bash
# On the VM
cd "/home/ubuntu/Engagement Bot"
chmod +x deploy.sh
./deploy.sh
```

## Step 5: Configure Environment

Edit the production environment file:

```bash
cd /opt/engagement-bot
nano .env.production
```

Update these values:
- `BOT_TOKEN`: Your Telegram bot token from @BotFather
- `SUBMISSIONS_CHANNEL_ID`: Your supergroup ID
- `GENERAL_CHANNEL_ID`: Your supergroup ID  
- Topic IDs (2, 3, 4, 5 for submissions, confirmations, warnings, banned)
- `ADMIN_PASSWORD`: Secure password for admin dashboard

## Step 6: Start the Bot

```bash
# Create logs directory
mkdir -p logs

# Start both bot and admin dashboard
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Follow the command it outputs (usually involves sudo)

# Check status
pm2 status
pm2 logs
```

## Step 7: Verify Deployment

1. Check bot is running: `pm2 status`
2. Check logs: `pm2 logs engagement-bot`
3. Test bot in Telegram
4. Access admin dashboard: `http://YOUR_VM_IP:3001`

## Common PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs engagement-bot
pm2 logs engagement-bot-admin

# Restart
pm2 restart engagement-bot

# Stop
pm2 stop engagement-bot

# Delete
pm2 delete engagement-bot

# Monitor resources
pm2 monit
```

## Security Recommendations

1. **Firewall**: Only open necessary ports
2. **Updates**: Keep system updated
3. **Backups**: Backup your data.json file regularly
4. **SSH Keys**: Use SSH keys instead of passwords
5. **Admin Access**: Restrict admin dashboard access

## Troubleshooting

### Bot not responding
```bash
pm2 logs engagement-bot
# Check for errors in logs
```

### Out of memory
```bash
# Check memory usage
free -h
pm2 monit
```

### Permission issues
```bash
# Fix ownership
sudo chown -R ubuntu:ubuntu /opt/engagement-bot
```

## Cost Optimization

- Oracle Always Free tier provides:
  - 2 VM instances (1/8 OCPU, 1GB RAM each)
  - 100GB block storage
  - 10GB object storage
  - This should be sufficient for the engagement bot

## Monitoring

Set up monitoring to ensure 24/7 operation:
- PM2 auto-restart on failure
- Oracle Cloud monitoring
- Set up alerts for high memory usage
- Regular backup schedule for data.json

Your bot will now run 24/7 on Oracle Cloud! 🚀