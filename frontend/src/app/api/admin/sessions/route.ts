import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;

  const list = await serverlessStore.listSessions(statusFilter, search);
  return NextResponse.json(list);
}
