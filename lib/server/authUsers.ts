export interface AuthUser {
  username: string;
  password: string;
  role: 'superadmin' | 'admin' | 'mpu';
  name: string;
  redirect: string;
}

export const AUTH_USERS: AuthUser[] = [
  {
    username: 'TNT STUDIO',
    password: 'Tiagoistjarispapa23!!',
    role: 'superadmin',
    name: 'TNT STUDIO',
    redirect: '/admin',
  },
  {
    username: 'LACKMANN',
    password: 'Redakteur123!',
    role: 'admin',
    name: 'LACKMANN',
    redirect: '/',
  },
  {
    username: 'MPU DEIN PARTNER',
    password: 'hamed2025!',
    role: 'mpu',
    name: 'MPU DEIN PARTNER',
    redirect: '/mpu-partner',
  },
];

const normalizeUsername = (value: string) => value.trim().toUpperCase();
const normalizePassword = (value: string) => value.trim();

export const findUser = (username: string, password: string): AuthUser | null => {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = normalizePassword(password);
  return (
    AUTH_USERS.find(
      user => user.username.toUpperCase() === normalizedUsername && user.password === normalizedPassword
    ) || null
  );
};
