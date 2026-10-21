import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  let list = Array.from(serverlessStore.sessions.values());

  if (statusFilter && statusFilter !== 'all') {
    list = list.filter((s) => s.status === statusFilter);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (s) =>
        s.user_email.toLowerCase().includes(q) ||
        s.ip_address.toLowerCase().includes(q)
    );
  }

  return NextResponse.json(list);
}
