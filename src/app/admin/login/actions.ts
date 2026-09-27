'use server';
import { cookies } from 'next/headers';
import { createAdminSession } from '@/lib/admin-session';

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminPassword && password === adminPassword) {
    const session = await createAdminSession().catch(() => null);
    if (!session) return { error: 'Admin session security is not configured.' };
    const cookieStore = await cookies();
    cookieStore.set('admin_session', session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.maxAge,
      path: '/',
    });
    return { success: true };
  }
  
  return { error: 'Invalid password' };
}
