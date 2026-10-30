import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore, MockCredential } from '@/lib/serverlessStore';

export async function GET(req: NextRequest) {
  const email = req.cookies.get('argus_user_email')?.value || 'admin@argusvault.local';
  const url = new URL(req.url);
  const category = url.searchParams.get('category') || undefined;
  const search = url.searchParams.get('search') || undefined;

  const list = await serverlessStore.listCredentials(email, category, search);
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  try {
    const email = req.cookies.get('argus_user_email')?.value || 'admin@argusvault.local';
    const body = await req.json();

    const newCred: MockCredential = {
      id: body.id || 'cred_' + Math.random().toString(36).substring(2, 12),
      user_email: email,
      title_hint: body.title_hint || 'Encrypted Item',
      category: body.category || 'general',
      ciphertext: body.ciphertext || body.encrypted_payload || '',
      iv: body.iv || '',
      tag: body.tag || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saved = await serverlessStore.saveCredential(newCred);
    return NextResponse.json(saved, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Creation failed' }, { status: 400 });
  }
}
