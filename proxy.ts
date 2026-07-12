import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('session')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const resp = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    resp.cookies.delete('session');
    return resp;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon\\.ico).*)'],
};
