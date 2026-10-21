import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore, MockCredential } from '@/lib/serverlessStore';

export async function GET(req: NextRequest) {
  const email = req.cookies.get('argus_user_email')?.value || 'admin@argusvault.local';
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');

  let list = Array.from(serverlessStore.credentials.values()).filter(
    (c) => c.user_email === email
  );

  if (category && category !== 'all') {
    list = list.filter((c) => c.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter((c) => c.title_hint.toLowerCase().includes(q));
  }

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  try {
    const email = req.cookies.get('argus_user_email')?.value || 'admin@argusvault.local';
    const body = await req.json();

    const newCred: MockCredential = {
      id: 'cred_' + Math.random().toString(36).substring(2, 12),
      user_email: email,
      title_hint: body.title_hint || 'Encrypted Item',
      category: body.category || 'general',
      ciphertext: body.ciphertext || '',
      iv: body.iv || '',
      tag: body.tag || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    serverlessStore.credentials.set(newCred.id, newCred);
    return NextResponse.json(newCred, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Creation failed' }, { status: 400 });
  }
}
