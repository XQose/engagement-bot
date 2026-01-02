import { Database } from './src/database.js';
import { AdminDashboard } from './src/admin.js';

const db = new Database();
new AdminDashboard(db).start();