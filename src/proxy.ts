import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  ADMIN_SESSION_COOKIE,
  clientIp,
  isAdminAuthBypassed,
  isAdminSessionExpired,
  isIpAllowed,
  sessionSigningSecret,
  verifyAdminSession,
} from '@/lib/admin-security';

/** Next.js 16+ proxy (replaces deprecated middleware.ts convention). */
export async function proxy(request: NextRequest) {
  if (isAdminAuthBypassed()) {
    if (request.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/overview', request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const publicPaths = ['/login', '/unauthorized'];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // IP allowlist (empty env = allow all for local dev)
  if (!isPublicPath) {
    const ip = clientIp(request.headers);
    if (!isIpAllowed(ip, process.env.ADMIN_IP_WHITELIST)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/overview', request.url));
  }

  if (user && !isPublicPath) {
    const timeoutSec = Number(process.env.ADMIN_SESSION_TIMEOUT || 0);
    const startedAt = await verifyAdminSession(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
      sessionSigningSecret()
    );
    if (isAdminSessionExpired(startedAt, timeoutSec)) {
      await supabase.auth.signOut();
      const login = NextResponse.redirect(new URL('/login', request.url));
      login.cookies.delete(ADMIN_SESSION_COOKIE);
      return login;
    }

    const { data: admin, error } = await supabase
      .from('super_admins')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
