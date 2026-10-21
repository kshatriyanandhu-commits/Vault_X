import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ detail: 'Successfully logged out.' });
  response.cookies.delete('sessionid');
  response.cookies.delete('argus_user_email');
  return response;
}
