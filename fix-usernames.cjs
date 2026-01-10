const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.GENERAL_CHAT_ID;

// Load database
const dbPath = path.join(__dirname, 'data', 'database.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Function to get user info from Telegram
async function getUserInfo(userId) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        user_id: userId
      })
    });
    
    const result = await response.json();
    if (result.ok) {
      const user = result.result.user;
      return user.username || user.first_name || 'Unknown';
    }
  } catch (error) {
    console.log(`Error fetching user ${userId}:`, error.message);
  }
  return null;
}

// Main function to update usernames
async function fixUsernames() {
  console.log('🔄 Fetching real usernames from Telegram...');
  
  const unknownUsers = Object.values(data.users).filter(user => user.username === 'Unknown');
  console.log(`Found ${unknownUsers.length} users with "Unknown" usernames`);
  
  for (const user of unknownUsers) {
    console.log(`Checking user ID: ${user.id}`);
    const realUsername = await getUserInfo(user.id);
    
    if (realUsername && realUsername !== 'Unknown') {
      console.log(`✅ Updated ${user.id}: Unknown -> ${realUsername}`);
      data.users[user.id].username = realUsername;
    } else {
      console.log(`❌ No username found for ${user.id}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Save updated database
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  console.log('✅ Database updated with real usernames!');
}

fixUsernames().catch(console.error);