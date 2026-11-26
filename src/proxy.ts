import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionTimeoutSeconds,
  clientIp,
  isAdminAuthBypassed,
  isAdminIpPermitted,
  isAdminSessionExpired,
  sessionSigningSecret,
  signAdminSession,
  verifyAdminSession,
} from '@/lib/admin-security';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';

const IDLE_SESSION_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

function isNextServerAction(request: NextRequest): boolean {
  return request.method === 'POST' && Boolean(request.headers.get('next-action'));
}

/**
 * Auth denials for document navigations use redirects.
 * Redirecting a Server Action POST breaks the action protocol and surfaces
 * "An unexpected response was received from the server" in the browser.
 */
function denyAccess(request: NextRequest, path: '/login' | '/unauthorized') {
  if (isNextServerAction(request)) {
    return NextResponse.json(
      { error: path === '/login' ? 'Unauthenticated' : 'Forbidden' },
      { status: path === '/login' ? 401 : 403 }
    );
  }
  return NextResponse.redirect(new URL(path, request.url));
}

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
    const gate = isAdminIpPermitted(ip, process.env.ADMIN_IP_WHITELIST);
    if (!gate.allowed) {
      return denyAccess(request, '/unauthorized');
    }
    if (gate.reason === 'unknown_ip' && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[proxy] ADMIN_IP_WHITELIST is set but client IP is unknown; allowing in development'
      );
    }
  }

  if (!hasSupabasePublicEnv()) {
    console.error(
      '[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
    return new NextResponse(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
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
    return denyAccess(request, '/login');
  }

  if (user && request.nextUrl.pathname === '/login') {
    if (isNextServerAction(request)) {
      // Allow login-page actions (e.g. stampAdminSession) to finish; the
      // client navigates after the action resolves.
      return response;
    }
    return NextResponse.redirect(new URL('/overview', request.url));
  }

  if (user && !isPublicPath) {
    const timeoutSec = adminSessionTimeoutSeconds();
    if (timeoutSec > 0) {
      const secret = sessionSigningSecret();
      if (!secret) {
        // Misconfigured production: do not bounce a valid Supabase session.
        console.error(
          '[proxy] ADMIN_SESSION_SECRET missing; idle timeout is inactive'
        );
      } else {
        const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
        const startedAt = await verifyAdminSession(raw, secret);

        if (raw && startedAt == null) {
          // Present but forged/tampered — force re-login.
          await supabase.auth.signOut();
          if (isNextServerAction(request)) {
            const cleared = NextResponse.json(
              { error: 'Session expired' },
              { status: 401 }
            );
            cleared.cookies.delete(ADMIN_SESSION_COOKIE);
            return cleared;
          }
          const login = NextResponse.redirect(new URL('/login', request.url));
          login.cookies.delete(ADMIN_SESSION_COOKIE);
          return login;
        }

        if (startedAt == null) {
          // Missing idle cookie (common right after login / soft nav). Mint one
          // instead of signing the user out — that caused login→overview→login loops.
          response.cookies.set(
            ADMIN_SESSION_COOKIE,
            await signAdminSession(Date.now(), secret),
            IDLE_SESSION_COOKIE
          );
        } else if (isAdminSessionExpired(startedAt, timeoutSec)) {
          await supabase.auth.signOut();
          if (isNextServerAction(request)) {
            const cleared = NextResponse.json(
              { error: 'Session expired' },
              { status: 401 }
            );
            cleared.cookies.delete(ADMIN_SESSION_COOKIE);
            return cleared;
          }
          const login = NextResponse.redirect(new URL('/login', request.url));
          login.cookies.delete(ADMIN_SESSION_COOKIE);
          return login;
        }
      }
    }

    const { data: admin, error } = await supabase
      .from('super_admins')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return denyAccess(request, '/unauthorized');
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
