import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await serverlessStore.revokeSession(id);
  return NextResponse.json({ detail: 'Session terminated successfully.' });
}
