import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await destroySession(token);
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' }, { status: 200 });

    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout error';
    console.error('[POST /api/auth/logout Error]:', message);
    return NextResponse.json({ error: 'Failed to log out' }, { status: 500 });
  }
}
