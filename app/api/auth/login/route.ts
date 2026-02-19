import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { findUser } from '@/lib/server/authUsers';

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function POST(request: NextRequest) {
  try {
    const { username = '', password = '' } = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json({ error: 'Benutzername und Passwort sind erforderlich.' }, { status: 400 });
    }

    const user = findUser(username, password);
    if (!user) {
      return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
    }

    const session = JSON.stringify({
      username: user.username,
      role: user.role,
      name: user.name,
    });

    cookies().set('auth', session, cookieOptions);
    return NextResponse.json({ success: true, redirect: user.redirect });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
