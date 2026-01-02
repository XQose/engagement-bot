# X Engagement Bot - Requirements & Specifications

## 🎯 **Core Purpose**
Create a Telegram bot that manages X (Twitter) engagement sessions with automated tracking and enforcement to ensure fair participation.

## 📋 **Key Requirements**

### **Session Structure**
- **2 Daily Sessions**: Morning (9 AM UTC) & Evening (6 PM UTC)
- **Session Duration**: 30 minutes each
- **Optional Participation**: Users choose which sessions to join
- **Platform**: X (Twitter) links ONLY

### **Engagement Flow**
1. **User posts X link** in submissions topic during session
2. **User comments** on ALL other X posts from that session
3. **User reacts 👍** to ALL other submissions in Telegram  
4. **User types "done"** in confirmations topic
5. **Bot tracks completion** and awards points

### **Telegram Structure** (Supergroup with Topics)
- **General Chat**: Main discussion (topic 1)
- **Submissions**: X link submissions (topic 2) 
- **Confirmations**: Users type "done" (topic 3)
- **Warnings**: Public violation notices (topic 4)
- **Banned**: Ban announcements (topic 5)

### **Enforcement Rules**
- **Rule**: If you post a link, you MUST engage with ALL other posts
- **Progressive Penalties**:
  - 1st violation: Warning
  - 2nd violation: Warning  
  - 3rd violation: 1 week ban
  - 4th violation: 1 month ban
  - 5th violation: Permanent ban

### **Points System**
- **+10 points**: For posting a link
- **+5 points**: Per engagement completed
- **-20 points**: For violations
- **Leaderboard**: Posted twice daily after evening sessions

### **Testing Mode**
- **Test User**: @Julio15X
- **Special Privileges**: 
  - Can submit multiple links per session
  - Gets testing notifications
  - Bypasses normal restrictions

## 🔧 **Technical Specifications**

### **Bot Configuration**
- **Platform**: Telegram using Telegraf.js
- **Database**: JSON file storage (simple & reliable)
- **Hosting**: Oracle Cloud (free tier)
- **Admin Dashboard**: Local web interface (password protected)

### **Environment Variables**
```
BOT_TOKEN=7948304959:AAFg99TE0AS2ZYlYOj5pMUk5cKdVbWa39gA
GENERAL_CHAT_ID=-1003632119102
SUBMISSIONS_CHANNEL_ID=-1003632119102  
CONFIRMATIONS_CHANNEL_ID=-1003632119102
WARNINGS_CHANNEL_ID=-1003632119102
BANNED_CHANNEL_ID=-1003632119102
ADMIN_CHANNEL_ID=-1003632119102

SUBMISSIONS_THREAD_ID=2
CONFIRMATIONS_THREAD_ID=3
WARNINGS_THREAD_ID=4
BANNED_THREAD_ID=5
ADMIN_THREAD_ID=1

TEST_USER_USERNAME=Julio15X
TESTING_MODE=true
ADMIN_PASSWORD=admin123
```

### **Key Features**
1. **Automated Session Management**: Cron jobs start/end sessions
2. **X Link Validation**: Only accepts valid X/Twitter URLs
3. **Engagement Tracking**: Monitors reactions and confirmations
4. **Progressive Enforcement**: Automatic warning/ban system
5. **Points & Leaderboard**: Gamification and rankings
6. **Testing Exceptions**: Special privileges for testing account

## 🚨 **Critical Requirements**
- **No Markdown Parsing Errors**: Use simple text formatting
- **Reliable Restart**: Handle crashes gracefully  
- **Topic Thread Support**: Messages sent to correct topics
- **Error Handling**: Comprehensive error logging
- **Testing Mode**: @Julio15X can test without restrictions

## ✅ **Success Criteria**
- Bot starts without errors
- Sessions auto-start at correct times
- X links are validated and processed
- Testing user can submit multiple times
- Enforcement system works correctly
- Admin dashboard accessible at localhost:3000