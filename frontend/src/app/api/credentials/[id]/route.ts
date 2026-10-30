import { NextRequest, NextResponse } from 'next/server';
import { serverlessStore } from '@/lib/serverlessStore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await serverlessStore.findCredential(id);
  if (!item) {
    return NextResponse.json({ detail: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await serverlessStore.findCredential(id);
  if (!item) {
    return NextResponse.json({ detail: 'Not found.' }, { status: 404 });
  }

  const body = await req.json();
  const updated = {
    ...item,
    title_hint: body.title_hint ?? item.title_hint,
    category: body.category ?? item.category,
    ciphertext: body.ciphertext ?? body.encrypted_payload ?? item.ciphertext,
    iv: body.iv ?? item.iv,
    tag: body.tag ?? item.tag,
    updated_at: new Date().toISOString(),
  };

  const saved = await serverlessStore.saveCredential(updated);
  return NextResponse.json(saved);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await serverlessStore.removeCredential(id);
  return new NextResponse(null, { status: 204 });
}
