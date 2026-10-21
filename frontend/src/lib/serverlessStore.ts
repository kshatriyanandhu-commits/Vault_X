/**
 * Argus Vault - Serverless In-Memory Data Store for Vercel Production
 * Enables 1-click standalone Vercel deployment when a separate Django instance is not connected.
 * If BACKEND_API_URL is configured, Next.js rewrites directly to Django instead.
 */

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  vault_salt: string;
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

// Global persistent storage in serverless instance
const globalStore = global as unknown as {
  __argusUsers?: Map<string, MockUser & { passwordHash: string }>;
  __argusCredentials?: Map<string, MockCredential>;
  __argusSessions?: Map<string, MockSession>;
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

export const serverlessStore = {
  users: globalStore.__argusUsers,
  credentials: globalStore.__argusCredentials,
  sessions: globalStore.__argusSessions,
};
