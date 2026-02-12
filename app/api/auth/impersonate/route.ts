import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { username, role, redirect } = await request.json();
    
    // In a real app, you would verify the current user is an admin here
    // and validate the target user exists
    
    const session = JSON.stringify({
      username,
      role,
      name: username, // In a real app, you'd fetch the actual name
      isImpersonated: true // Flag to indicate this is an impersonated session
    });
    
    // Set the session cookie
    cookies().set('auth', session, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    return NextResponse.json({ 
      success: true,
      redirect: redirect || '/'
    });
    
  } catch (error) {
    console.error('Error in impersonation:', error);
    return NextResponse.json(
      { success: false, error: 'Impersonation failed' },
      { status: 500 }
    );
  }
}
