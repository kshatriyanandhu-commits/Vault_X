import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore, MockSession } from '@/lib/serverlessStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    const userRecord = await serverlessStore.findUser(email);
    if (!userRecord || userRecord.passwordHash !== password) {
      return NextResponse.json(
        { detail: 'Invalid email or master password combination.' },
        { status: 401 }
      );
    }

    const sessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
    const newSession: MockSession = {
      id: sessionId,
      user_email: userRecord.email,
      masked_session_key: 'argon2id$v=19$m=65536...' + Math.random().toString(36).substring(2, 6),
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
      device_info: req.headers.get('user-agent')?.slice(0, 40) || 'Desktop Web Browser',
      status: 'active',
      login_time: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    };
    await serverlessStore.saveSession(newSession);

    const profile = {
      id: userRecord.id,
      email: userRecord.email,
      full_name: userRecord.full_name,
      role: userRecord.role,
      vault_salt: userRecord.vault_salt,
      created_at: userRecord.created_at,
    };

    const response = NextResponse.json(profile);
    response.cookies.set('sessionid', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    response.cookies.set('argus_user_email', userRecord.email, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Login failed' }, { status: 400 });
  }
}
