const fs = require('fs');
const path = require('path');

// Load database
const dbPath = path.join(__dirname, 'data', 'database.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('🔧 Adding missing session tracking fields...');

// Add missing fields to all users
for (const userId in data.users) {
  const user = data.users[userId];
  
  // Only add fields if they don't exist (safe approach)
  if (!user.hasOwnProperty('currentSessionSubmitted')) {
    user.currentSessionSubmitted = false;
  }
  if (!user.hasOwnProperty('currentSessionConfirmed')) {
    user.currentSessionConfirmed = false;
  }
  if (!user.hasOwnProperty('sessionSubmissionId')) {
    user.sessionSubmissionId = null;
  }
  if (!user.hasOwnProperty('dailySubmissions')) {
    user.dailySubmissions = 0;
  }
  if (!user.hasOwnProperty('lastSubmissionDate')) {
    user.lastSubmissionDate = null;
  }
  
  console.log(`✅ Updated user ${user.username || userId} with session tracking`);
}

// Save updated database
fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
console.log('✅ Database updated with session tracking fields!');
console.log('📋 Users can now be tracked for incomplete submissions');