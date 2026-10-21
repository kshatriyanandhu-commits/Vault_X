import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = serverlessStore.sessions.get(id);
  if (!session) {
    return NextResponse.json({ detail: 'Session not found.' }, { status: 404 });
  }

  session.status = 'revoked';
  serverlessStore.sessions.set(id, session);

  return NextResponse.json({ detail: 'Session terminated successfully.' });
}
