import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface User {
  id: number;
  username: string;
  points: number;
  warnings: number;
  banStatus: 'active' | 'temp_banned' | 'permanently_banned';
  banUntil?: Date;
  joinDate: Date;
  totalSubmissions: number;
  totalEngagements: number;
  lastActive?: Date;
}

export interface Session {
  id: string;
  type: 'morning' | 'evening';
  date: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'active' | 'ended';
  participants: number[];
  submissions: string[];
}

export interface Submission {
  id: string;
  userId: number;
  sessionId: string;
  link: string;
  timestamp: Date;
  reactionsReceived: number[];
}

export interface Engagement {
  userId: number;
  submissionId: string;
  sessionId: string;
  timestamp: Date;
  type: 'reaction' | 'confirmation';
}

export interface Warning {
  id: string;
  userId: number;
  reason: string;
  sessionId?: string;
  timestamp: Date;
}

interface DatabaseData {
  users: Record<string, User>;
  sessions: Record<string, Session>;
  submissions: Record<string, Submission>;
  engagements: Engagement[];
  warnings: Record<string, Warning>;
  lastUpdated: string;
}

export class Database {
  private data!: DatabaseData;
  private dbPath: string;

  constructor(dataDir = 'data') {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    this.dbPath = join(dataDir, 'database.json');
    this.loadData();
  }

  private loadData(): void {
    if (existsSync(this.dbPath)) {
      try {
        const rawData = readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(rawData);
        
        // Convert date strings back to Date objects
        this.convertStringsToDates();
      } catch (error) {
        console.error('Error loading database, creating new one:', error);
        this.data = this.getEmptyDatabase();
      }
    } else {
      this.data = this.getEmptyDatabase();
    }
  }

  private convertStringsToDates(): void {
    // Convert user dates
    for (const user of Object.values(this.data.users)) {
      user.joinDate = new Date(user.joinDate);
      if (user.banUntil) user.banUntil = new Date(user.banUntil);
    }

    // Convert session dates
    for (const session of Object.values(this.data.sessions)) {
      session.startTime = new Date(session.startTime);
      session.endTime = new Date(session.endTime);
    }

    // Convert submission dates
    for (const submission of Object.values(this.data.submissions)) {
      submission.timestamp = new Date(submission.timestamp);
    }

    // Convert engagement dates
    for (const engagement of this.data.engagements) {
      engagement.timestamp = new Date(engagement.timestamp);
    }

    // Convert warning dates
    for (const warning of Object.values(this.data.warnings)) {
      warning.timestamp = new Date(warning.timestamp);
    }
  }

  private getEmptyDatabase(): DatabaseData {
    return {
      users: {},
      sessions: {},
      submissions: {},
      engagements: [],
      warnings: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  private save(): void {
    try {
      this.data.lastUpdated = new Date().toISOString();
      const jsonData = JSON.stringify(this.data, null, 2);
      writeFileSync(this.dbPath, jsonData, 'utf8');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // User operations
  getUser(userId: number): User | undefined {
    return this.data.users[userId.toString()];
  }

  createUser(userId: number, username: string): User {
    const user: User = {
      id: userId,
      username,
      points: 0,
      warnings: 0,
      banStatus: 'active',
      joinDate: new Date(),
      totalSubmissions: 0,
      totalEngagements: 0,
    };

    this.data.users[userId.toString()] = user;
    this.save();
    return user;
  }

  updateUser(userId: number, updates: Partial<User>): void {
    const user = this.getUser(userId);
    if (user) {
      Object.assign(user, updates);
      this.save();
    }
  }

  getAllUsers(): User[] {
    return Object.values(this.data.users);
  }

  getLeaderboard(limit = 10): User[] {
    return this.getAllUsers()
      .filter(user => user.banStatus === 'active')
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  }

  // Session operations
  getSession(sessionId: string): Session | undefined {
    return this.data.sessions[sessionId];
  }

  createSession(type: 'morning' | 'evening', date: string): Session {
    const sessionId = `${date}_${type}`;
    const now = new Date();
    
    const session: Session = {
      id: sessionId,
      type,
      date,
      startTime: now,
      endTime: new Date(now.getTime() + 30 * 60000), // 30 minutes
      status: 'active',
      participants: [],
      submissions: [],
    };

    this.data.sessions[sessionId] = session;
    this.save();
    return session;
  }

  getCurrentSession(): Session | undefined {
    return Object.values(this.data.sessions).find(s => s.status === 'active');
  }

  endSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.status = 'ended';
      session.endTime = new Date();
      this.save();
    }
  }

  // Submission operations
  createSubmission(userId: number, sessionId: string, link: string): Submission {
    const submissionId = `${sessionId}_${userId}_${Date.now()}`;
    
    const submission: Submission = {
      id: submissionId,
      userId,
      sessionId,
      link,
      timestamp: new Date(),
      reactionsReceived: [],
    };

    this.data.submissions[submissionId] = submission;
    
    // Add to session
    const session = this.getSession(sessionId);
    if (session) {
      if (!session.participants.includes(userId)) {
        session.participants.push(userId);
      }
      session.submissions.push(submissionId);
    }

    // Update user stats
    const user = this.getUser(userId);
    if (user) {
      user.totalSubmissions++;
    }

    this.save();
    return submission;
  }

  getUserSubmissions(userId: number, sessionId: string): Submission[] {
    return Object.values(this.data.submissions).filter(
      s => s.userId === userId && s.sessionId === sessionId
    );
  }

  getSessionSubmissions(sessionId: string): Submission[] {
    return Object.values(this.data.submissions).filter(
      s => s.sessionId === sessionId
    );
  }

  // Engagement operations
  addEngagement(userId: number, submissionId: string, sessionId: string, type: 'reaction' | 'confirmation'): void {
    const engagement: Engagement = {
      userId,
      submissionId,
      sessionId,
      timestamp: new Date(),
      type,
    };

    this.data.engagements.push(engagement);
    this.save();
  }

  hasUserConfirmedEngagement(userId: number, sessionId: string): boolean {
    return this.data.engagements.some(
      e => e.userId === userId && e.sessionId === sessionId && e.type === 'confirmation'
    );
  }

  getUserReactionsForSession(userId: number, sessionId: string): number {
    return this.data.engagements.filter(
      e => e.userId === userId && e.sessionId === sessionId && e.type === 'reaction'
    ).length;
  }

  // Warning operations
  addWarning(userId: number, reason: string, sessionId?: string): Warning {
    const warningId = `warn_${userId}_${Date.now()}`;
    
    const warning: Warning = {
      id: warningId,
      userId,
      reason,
      sessionId,
      timestamp: new Date(),
    };

    this.data.warnings[warningId] = warning;
    
    // Update user warning count
    const user = this.getUser(userId);
    if (user) {
      user.warnings++;
    }

    this.save();
    return warning;
  }

  // Utility methods
  isValidXLink(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const validDomains = ['x.com', 'twitter.com'];
      return validDomains.includes(parsedUrl.hostname) && 
             parsedUrl.pathname.includes('/status/');
    } catch {
      return false;
    }
  }

  getAllSessions(): Session[] {
    return Object.values(this.data.sessions);
  }

  getStats() {
    return {
      totalUsers: Object.keys(this.data.users).length,
      totalSessions: Object.keys(this.data.sessions).length,
      totalSubmissions: Object.keys(this.data.submissions).length,
      totalEngagements: this.data.engagements.length,
      lastUpdated: this.data.lastUpdated,
    };
  }
}