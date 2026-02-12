'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/app/actions/auth';

interface User {
  username: string;
  name: string;
  role: string;
  redirect: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  // Get all users (in a real app, this would be an API call)
  const allUsers = [
    {
      username: 'TNT STUDIO',
      name: 'TNT STUDIO',
      role: 'superadmin',
      redirect: '/admin'
    },
    {
      username: 'LACKMANN',
      name: 'LACKMANN',
      role: 'admin',
      redirect: '/'
    },
    {
      username: 'MPU DEIN PARTNER',
      name: 'MPU DEIN PARTNER',
      role: 'mpu',
      redirect: '/mpu-partner'
    }
  ];

  useEffect(() => {
    const checkAuth = async () => {
      const session = await getSession();
      if (!session || session.role !== 'superadmin') {
        router.push('/login');
        return;
      }
      setUsers(allUsers);
      setIsLoading(false);
    };
    
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleImpersonate = async (user: User) => {
    try {
      // In a real app, you'd make an API call to set the session
      const response = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: user.username,
          role: user.role,
          redirect: user.redirect
        }),
      });

      if (response.ok) {
        // Redirect to the user's page
        window.location.href = user.redirect || '/';
      } else {
        const error = await response.json();
        console.error('Failed to switch user:', error);
        alert('Fehler beim Wechseln des Benutzers');
      }
    } catch (error) {
      console.error('Error switching user:', error);
      // Fallback to direct redirect if API call fails
      window.location.href = user.redirect || '/';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Admin-Bereich...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-28">
            <div className="flex items-center">
              <img 
                src="/images/tnt-studio-logo.png" 
                alt="TNT Studio Logo" 
                className="h-24 w-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = document.createElement('h1');
                  fallback.className = 'text-xl font-semibold text-gray-900';
                  fallback.textContent = 'TNT Studio';
                  target.parentNode?.insertBefore(fallback, target.nextSibling);
                }}
              />
              <h1 className="ml-4 text-2xl font-bold text-gray-700">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Verfügbare Konten</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Wählen Sie ein Konto aus, um darauf zuzugreifen</p>
            </div>
            <div className="border-t border-gray-200">
              <ul className="divide-y divide-gray-200">
                {users.map((user) => (
                  <li key={user.username}>
                    <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-blue-600 truncate">{user.name}</p>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {user.role}
                              </span>
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              <span className="text-gray-700">Benutzername: </span>
                              <span className="ml-1 font-medium">{user.username}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex-shrink-0 sm:mt-0">
                        <button
                          onClick={() => handleImpersonate(user)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Öffnen
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
