import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore, MockSession } from '@/lib/serverlessStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const fullName = body.full_name || '';

    if (!email || !password) {
      return NextResponse.json({ detail: 'Email and password are required.' }, { status: 400 });
    }

    if (serverlessStore.users.has(email)) {
      return NextResponse.json({ detail: 'A user with that email already exists.' }, { status: 400 });
    }

    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 12),
      email,
      full_name: fullName,
      role: 'user' as const,
      vault_salt: Math.random().toString(16).substring(2, 34),
      passwordHash: password,
      created_at: new Date().toISOString(),
    };
    serverlessStore.users.set(email, newUser);

    const sessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
    const newSession: MockSession = {
      id: sessionId,
      user_email: email,
      masked_session_key: 'argon2id$v=19$m=65536...' + Math.random().toString(36).substring(2, 6),
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
      device_info: req.headers.get('user-agent')?.slice(0, 40) || 'Desktop Web Browser',
      status: 'active',
      login_time: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    };
    serverlessStore.sessions.set(sessionId, newSession);

    const profile = {
      id: newUser.id,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      vault_salt: newUser.vault_salt,
      created_at: newUser.created_at,
    };

    const response = NextResponse.json(profile, { status: 201 });
    response.cookies.set('sessionid', sessionId, { path: '/', httpOnly: true, sameSite: 'lax' });
    response.cookies.set('argus_user_email', email, { path: '/', httpOnly: false, sameSite: 'lax' });

    return response;
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Registration failed' }, { status: 400 });
  }
}
