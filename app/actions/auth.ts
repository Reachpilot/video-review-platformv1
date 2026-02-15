'use server';

import { cookies } from 'next/headers';

// User database
const users = [
  {
    username: 'TNT STUDIO',
    password: 'Tiagoistjarispapa23!!',
    role: 'superadmin',
    name: 'TNT STUDIO',
    redirect: '/admin'
  },
  {
    username: 'LACKMANN',
    password: 'Redakteur123!',
    role: 'admin',
    name: 'LACKMANN',
    redirect: '/'
  },
  {
    username: 'MPU DEIN PARTNER',
    password: 'hamed2025!',
    role: 'mpu',
    name: 'MPU DEIN PARTNER',
    redirect: '/mpu-partner'
  }
];

export async function login(username: string, password: string) {
  const normalizedUsername = username.trim().toUpperCase();
  const normalizedPassword = password.trim();
  const user = users.find(
    u => u.username.toUpperCase() === normalizedUsername && u.password === normalizedPassword
  );
  
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
