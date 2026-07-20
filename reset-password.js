import Database from 'better-sqlite3';
import { createHash } from 'crypto';

const db = new Database('data/aura-salon.db');
const h = createHash('sha256').update('Salon@123').digest('hex');
db.prepare('UPDATE users SET password=? WHERE tenantId=?').run(h, 'tenant_salonist');
console.log('Password reset ho gaya — ab Salon@123 se login karo');
db.close();
