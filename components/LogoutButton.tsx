'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions/auth';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2"
    >
      Abmelden
    </button>
  );
}
