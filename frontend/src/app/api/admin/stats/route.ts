import { NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function GET() {
  const users = Array.from(serverlessStore.users.values());
  const sessions = Array.from(serverlessStore.sessions.values());

  return NextResponse.json({
    total_users: users.length,
    standard_users: users.filter((u) => u.role === 'user').length,
    admin_users: users.filter((u) => u.role === 'admin').length,
    active_sessions: sessions.filter((s) => s.status === 'active').length,
    revoked_sessions: sessions.filter((s) => s.status === 'revoked').length,
    total_vault_items: serverlessStore.credentials.size,
  });
}
