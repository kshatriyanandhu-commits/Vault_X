import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function GET(req: NextRequest) {
  const email = req.cookies.get('argus_user_email')?.value;
  if (!email || !serverlessStore.users.has(email)) {
    return NextResponse.json({ detail: 'Authentication credentials were not provided.' }, { status: 401 });
  }

  const u = serverlessStore.users.get(email)!;
  return NextResponse.json({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    vault_salt: u.vault_salt,
    created_at: u.created_at,
  });
}
