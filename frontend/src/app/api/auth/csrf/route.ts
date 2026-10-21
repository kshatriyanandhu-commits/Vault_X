import { NextResponse } from 'next/server';

export async function GET() {
  const token = 'argus_csrf_' + Math.random().toString(36).substring(2, 15);
  const response = NextResponse.json({ csrfToken: token });
  response.cookies.set('csrftoken', token, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
  });
  return response;
}
