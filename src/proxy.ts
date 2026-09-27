import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-session';

export async function proxy(request: NextRequest) {
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  if (isAdminPath && !isLoginPage) {
    const adminCookie = request.cookies.get('admin_session')?.value;
    if (!await verifyAdminSession(adminCookie)) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If they are on login page but already authenticated, send to admin
  if (isLoginPage) {
    const adminCookie = request.cookies.get('admin_session')?.value;
    if (await verifyAdminSession(adminCookie)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
