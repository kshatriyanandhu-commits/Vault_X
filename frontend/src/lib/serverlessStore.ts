/**
 * Argus Vault - Unified Persistent Storage Adapter
 * 
 * Supports:
 * 1. Cloud PostgreSQL (Neon, Vercel Postgres, Supabase, Railway, Render)
 *    Automatically activated when POSTGRES_URL or DATABASE_URL is set in environment.
 * 2. In-Memory Store (with default pre-seeded admin) for standalone zero-config demo runs.
 */

import { Pool } from 'pg';

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  vault_salt: string;
  passwordHash: string;
  created_at: string;
}

export interface MockCredential {
  id: string;
  user_email: string;
  title_hint: string;
  category: string;
  ciphertext: string;
  iv: string;
  tag: string;
  created_at: string;
  updated_at: string;
}

export interface MockSession {
  id: string;
  user_email: string;
  masked_session_key: string;
  ip_address: string;
  device_info: string;
  status: 'active' | 'revoked' | 'expired';
  login_time: string;
  last_activity: string;
}

// In-Memory Fallback Store (retained across hot reloads in same process)
const globalStore = global as unknown as {
  __argusUsers?: Map<string, MockUser>;
  __argusCredentials?: Map<string, MockCredential>;
  __argusSessions?: Map<string, MockSession>;
  __argusPgPool?: Pool;
};

if (!globalStore.__argusUsers) {
  globalStore.__argusUsers = new Map();
  // Pre-seed default administrator
  globalStore.__argusUsers.set('admin@argusvault.local', {
    id: '40e1756b-b7f6-4ab9-b5f1-d2933a973330',
    email: 'admin@argusvault.local',
    full_name: 'Argus Security Administrator',
    role: 'admin',
    vault_salt: '',
    passwordHash: 'ArgusAdmin2026!Secure',
    created_at: new Date().toISOString(),
  });
}

if (!globalStore.__argusCredentials) {
  globalStore.__argusCredentials = new Map();
}

if (!globalStore.__argusSessions) {
  globalStore.__argusSessions = new Map();
  globalStore.__argusSessions.set('sess_admin_default', {
    id: 'sess_admin_default',
    user_email: 'admin@argusvault.local',
    masked_session_key: 'argon2id$v=19$m=65536...4f9a',
    ip_address: '127.0.0.1',
    device_info: 'Desktop Chrome / Windows 11',
    status: 'active',
    login_time: new Date().toISOString(),
    last_activity: new Date().toISOString(),
  });
}

// PostgreSQL Connection Pool Setup
const dbConnectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;

let pgPool: Pool | null = null;
if (dbConnectionString) {
  if (!globalStore.__argusPgPool) {
    globalStore.__argusPgPool = new Pool({
      connectionString: dbConnectionString,
      ssl: dbConnectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  pgPool = globalStore.__argusPgPool;
}

let dbTablesReady = false;

async function ensureTables() {
  if (!pgPool || dbTablesReady) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS argus_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(32) DEFAULT 'user',
        vault_salt TEXT DEFAULT '',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS argus_credentials (
        id VARCHAR(64) PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        title_hint VARCHAR(255) DEFAULT 'Encrypted Item',
        category VARCHAR(64) DEFAULT 'general',
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        tag TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS argus_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        masked_session_key TEXT,
        ip_address VARCHAR(128),
        device_info TEXT,
        status VARCHAR(32) DEFAULT 'active',
        login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_argus_cred_user ON argus_credentials(user_email);
      CREATE INDEX IF NOT EXISTS idx_argus_sess_user ON argus_sessions(user_email);
    `);

    // Ensure default admin user is seeded into PostgreSQL
    const res = await pgPool.query('SELECT id FROM argus_users WHERE email = $1', ['admin@argusvault.local']);
    if (res.rowCount === 0) {
      await pgPool.query(
        `INSERT INTO argus_users (id, email, full_name, role, vault_salt, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          '40e1756b-b7f6-4ab9-b5f1-d2933a973330',
          'admin@argusvault.local',
          'Argus Security Administrator',
          'admin',
          '',
          'ArgusAdmin2026!Secure',
        ]
      );
    }
    dbTablesReady = true;
  } catch (err) {
    console.warn('Database initialization notice:', err);
  }
}

// Unified Storage API
export const serverlessStore = {
  // Direct Map access for synchronous fallback
  users: globalStore.__argusUsers!,
  credentials: globalStore.__argusCredentials!,
  sessions: globalStore.__argusSessions!,

  // Async User Methods
  async findUser(email: string): Promise<MockUser | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (pgPool) {
      await ensureTables();
      const res = await pgPool.query(
        'SELECT id, email, full_name, role, vault_salt, password_hash, created_at FROM argus_users WHERE LOWER(email) = LOWER($1)',
        [cleanEmail]
      );
      if (res.rowCount && res.rows[0]) {
        const row = res.rows[0];
        return {
          id: row.id,
          email: row.email,
          full_name: row.full_name || '',
          role: row.role as 'user' | 'admin',
          vault_salt: row.vault_salt || '',
          passwordHash: row.password_hash,
          created_at: new Date(row.created_at).toISOString(),
        };
      }
    }
    return globalStore.__argusUsers!.get(cleanEmail) || null;
  },

  async hasUser(email: string): Promise<boolean> {
    const u = await this.findUser(email);
    return !!u;
  },

  async saveUser(user: MockUser): Promise<MockUser> {
    const cleanEmail = user.email.trim().toLowerCase();
    globalStore.__argusUsers!.set(cleanEmail, user);

    if (pgPool) {
      await ensureTables();
      await pgPool.query(
        `INSERT INTO argus_users (id, email, full_name, role, vault_salt, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           vault_salt = EXCLUDED.vault_salt,
           password_hash = EXCLUDED.password_hash`,
        [user.id, cleanEmail, user.full_name, user.role, user.vault_salt, user.passwordHash, user.created_at]
      );
    }
    return user;
  },

  // Async Credential Methods
  async listCredentials(userEmail: string, category?: string, search?: string): Promise<MockCredential[]> {
    const cleanEmail = userEmail.trim().toLowerCase();

    if (pgPool) {
      await ensureTables();
      let query = 'SELECT * FROM argus_credentials WHERE LOWER(user_email) = LOWER($1)';
      const params: any[] = [cleanEmail];

      if (category && category !== 'all') {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }

      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        query += ` AND LOWER(title_hint) LIKE $${params.length}`;
      }

      query += ' ORDER BY created_at DESC';

      const res = await pgPool.query(query, params);
      return res.rows.map((row) => ({
        id: row.id,
        user_email: row.user_email,
        title_hint: row.title_hint,
        category: row.category,
        ciphertext: row.ciphertext,
        iv: row.iv,
        tag: row.tag || '',
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
      }));
    }

    // Fallback: in-memory
    let list = Array.from(globalStore.__argusCredentials!.values()).filter(
      (c) => c.user_email.toLowerCase() === cleanEmail
    );
    if (category && category !== 'all') {
      list = list.filter((c) => c.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title_hint.toLowerCase().includes(q));
    }
    return list;
  },

  async findCredential(id: string): Promise<MockCredential | null> {
    if (pgPool) {
      await ensureTables();
      const res = await pgPool.query('SELECT * FROM argus_credentials WHERE id = $1', [id]);
      if (res.rowCount && res.rows[0]) {
        const row = res.rows[0];
        return {
          id: row.id,
          user_email: row.user_email,
          title_hint: row.title_hint,
          category: row.category,
          ciphertext: row.ciphertext,
          iv: row.iv,
          tag: row.tag || '',
          created_at: new Date(row.created_at).toISOString(),
          updated_at: new Date(row.updated_at).toISOString(),
        };
      }
    }
    return globalStore.__argusCredentials!.get(id) || null;
  },

  async saveCredential(cred: MockCredential): Promise<MockCredential> {
    globalStore.__argusCredentials!.set(cred.id, cred);

    if (pgPool) {
      await ensureTables();
      await pgPool.query(
        `INSERT INTO argus_credentials (id, user_email, title_hint, category, ciphertext, iv, tag, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           title_hint = EXCLUDED.title_hint,
           category = EXCLUDED.category,
           ciphertext = EXCLUDED.ciphertext,
           iv = EXCLUDED.iv,
           tag = EXCLUDED.tag,
           updated_at = EXCLUDED.updated_at`,
        [
          cred.id,
          cred.user_email.toLowerCase(),
          cred.title_hint,
          cred.category,
          cred.ciphertext,
          cred.iv,
          cred.tag,
          cred.created_at,
          cred.updated_at,
        ]
      );
    }
    return cred;
  },

  async removeCredential(id: string): Promise<boolean> {
    globalStore.__argusCredentials!.delete(id);

    if (pgPool) {
      await ensureTables();
      await pgPool.query('DELETE FROM argus_credentials WHERE id = $1', [id]);
    }
    return true;
  },

  // Async Session Methods
  async listSessions(status?: string, search?: string): Promise<MockSession[]> {
    if (pgPool) {
      await ensureTables();
      let query = 'SELECT * FROM argus_sessions WHERE 1=1';
      const params: any[] = [];

      if (status && status !== 'all') {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        query += ` AND (LOWER(user_email) LIKE $${params.length} OR LOWER(ip_address) LIKE $${params.length})`;
      }

      query += ' ORDER BY login_time DESC';

      const res = await pgPool.query(query, params);
      return res.rows.map((row) => ({
        id: row.id,
        user_email: row.user_email,
        masked_session_key: row.masked_session_key || '',
        ip_address: row.ip_address || '',
        device_info: row.device_info || '',
        status: row.status as 'active' | 'revoked' | 'expired',
        login_time: new Date(row.login_time).toISOString(),
        last_activity: new Date(row.last_activity).toISOString(),
      }));
    }

    let list = Array.from(globalStore.__argusSessions!.values());
    if (status && status !== 'all') {
      list = list.filter((s) => s.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.user_email.toLowerCase().includes(q) || s.ip_address.includes(q));
    }
    return list;
  },

  async saveSession(sess: MockSession): Promise<MockSession> {
    globalStore.__argusSessions!.set(sess.id, sess);

    if (pgPool) {
      await ensureTables();
      await pgPool.query(
        `INSERT INTO argus_sessions (id, user_email, masked_session_key, ip_address, device_info, status, login_time, last_activity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           last_activity = EXCLUDED.last_activity`,
        [
          sess.id,
          sess.user_email.toLowerCase(),
          sess.masked_session_key,
          sess.ip_address,
          sess.device_info,
          sess.status,
          sess.login_time,
          sess.last_activity,
        ]
      );
    }
    return sess;
  },

  async revokeSession(id: string): Promise<boolean> {
    const s = globalStore.__argusSessions!.get(id);
    if (s) {
      s.status = 'revoked';
      s.last_activity = new Date().toISOString();
    }

    if (pgPool) {
      await ensureTables();
      await pgPool.query("UPDATE argus_sessions SET status = 'revoked', last_activity = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    }
    return true;
  },

  async getStats() {
    if (pgPool) {
      await ensureTables();
      const [usersRes, sessRes, credRes] = await Promise.all([
        pgPool.query('SELECT role, COUNT(*)::int as count FROM argus_users GROUP BY role'),
        pgPool.query('SELECT status, COUNT(*)::int as count FROM argus_sessions GROUP BY status'),
        pgPool.query('SELECT COUNT(*)::int as total FROM argus_credentials'),
      ]);

      let totalUsers = 0;
      let standardUsers = 0;
      let adminUsers = 0;
      usersRes.rows.forEach((r) => {
        const c = r.count;
        totalUsers += c;
        if (r.role === 'admin') adminUsers += c;
        else standardUsers += c;
      });

      let activeSessions = 0;
      let revokedSessions = 0;
      sessRes.rows.forEach((r) => {
        if (r.status === 'active') activeSessions += r.count;
        if (r.status === 'revoked') revokedSessions += r.count;
      });

      return {
        total_users: totalUsers,
        standard_users: standardUsers,
        admin_users: adminUsers,
        active_sessions: activeSessions,
        revoked_sessions: revokedSessions,
        total_vault_items: credRes.rows[0]?.total || 0,
      };
    }

    const users = Array.from(globalStore.__argusUsers!.values());
    const sessions = Array.from(globalStore.__argusSessions!.values());

    return {
      total_users: users.length,
      standard_users: users.filter((u) => u.role === 'user').length,
      admin_users: users.filter((u) => u.role === 'admin').length,
      active_sessions: sessions.filter((s) => s.status === 'active').length,
      revoked_sessions: sessions.filter((s) => s.status === 'revoked').length,
      total_vault_items: globalStore.__argusCredentials!.size,
    };
  },
};
