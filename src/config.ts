import dotenv from 'dotenv';

dotenv.config();

export interface BotConfig {
  // Bot settings
  botToken: string;
  
  // Channel configuration  
  channels: {
    general: string;
    submissions: string;
    confirmations: string;
    warnings: string;
    banned: string;
    admin: string;
  };
  
  // Topic thread IDs
  topics: {
    submissions: number;
    confirmations: number; 
    warnings: number;
    banned: number;
    admin: number;
  };
  
  // Session settings
  sessions: {
    morningTime: string;
    eveningTime: string;
    duration: number;
  };
  
  // Points system
  points: {
    submission: number;
    engagement: number;
    penalty: number;
  };
  
  // Enforcement rules
  enforcement: {
    warningsBeforeTempBan: number;
    tempBanDays: number;
    warningsBeforeMonthBan: number;
    monthBanDays: number;
    warningsBeforePermaBan: number;
  };
  
  // Testing configuration
  testing: {
    enabled: boolean;
    testUser: string;
  };
  
  // Admin settings
  admin: {
    port: number;
    password: string;
  };
}

export function loadConfig(): BotConfig {
  const requiredVars = [
    'BOT_TOKEN',
    'GENERAL_CHAT_ID',
    'SUBMISSIONS_CHANNEL_ID',
    'CONFIRMATIONS_CHANNEL_ID',
    'WARNINGS_CHANNEL_ID',
    'BANNED_CHANNEL_ID',
    'ADMIN_CHANNEL_ID'
  ];

  // Check required environment variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    botToken: process.env.BOT_TOKEN!,
    
    channels: {
      general: process.env.GENERAL_CHAT_ID!,
      submissions: process.env.SUBMISSIONS_CHANNEL_ID!,
      confirmations: process.env.CONFIRMATIONS_CHANNEL_ID!,
      warnings: process.env.WARNINGS_CHANNEL_ID!,
      banned: process.env.BANNED_CHANNEL_ID!,
      admin: process.env.ADMIN_CHANNEL_ID!,
    },
    
    topics: {
      submissions: parseInt(process.env.SUBMISSIONS_THREAD_ID || '2'),
      confirmations: parseInt(process.env.CONFIRMATIONS_THREAD_ID || '3'),
      warnings: parseInt(process.env.WARNINGS_THREAD_ID || '4'),
      banned: parseInt(process.env.BANNED_THREAD_ID || '5'),
      admin: parseInt(process.env.ADMIN_THREAD_ID || '1'),
    },
    
    sessions: {
      morningTime: '0 9 * * *',  // 9 AM UTC
      eveningTime: '0 18 * * *', // 6 PM UTC
      duration: 30, // minutes
    },
    
    points: {
      submission: 10,
      engagement: 5,
      penalty: -20,
    },
    
    enforcement: {
      warningsBeforeTempBan: 2,
      tempBanDays: 7,
      warningsBeforeMonthBan: 3,
      monthBanDays: 30,
      warningsBeforePermaBan: 4,
    },
    
    testing: {
      enabled: process.env.TESTING_MODE === 'true',
      testUser: process.env.TEST_USER_USERNAME || 'Julio15X',
    },
    
    admin: {
      port: parseInt(process.env.ADMIN_PORT || '3000'),
      password: process.env.ADMIN_PASSWORD || 'admin123',
    },
  };
}