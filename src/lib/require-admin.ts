import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/admin-session';

export async function requireAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get('admin_session')?.value);
}
