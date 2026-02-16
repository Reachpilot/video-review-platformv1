'use server';

import { cookies } from 'next/headers';
import { findUser } from '@/lib/server/authUsers';

export async function login(username: string, password: string) {
  const user = findUser(username, password);

  if (user) {
    const session = JSON.stringify({
      username: user.username,
      role: user.role,
      name: user.name
    });
    
    cookies().set('auth', session, { 
      path: '/', 
      httpOnly: true, 
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    return { 
      success: true,
      redirect: user.redirect
    };
  }
  
  return { 
    success: false, 
    error: 'Ungültige Anmeldedaten' 
  };
}

export async function getSession() {
  const session = cookies().get('auth')?.value;
  return session ? JSON.parse(session) : null;
}

export async function isAuthenticated() {
  return !!cookies().get('auth')?.value;
}

export async function logout() {
  cookies().set('auth', '', { 
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
  
  return { success: true };
}
