import { NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function GET() {
  const stats = await serverlessStore.getStats();
  return NextResponse.json(stats);
}
