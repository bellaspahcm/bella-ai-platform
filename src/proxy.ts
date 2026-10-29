import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getSupabasePublicKey, getSupabasePublicUrl, requireSupabasePublicEnv } from '@/lib/supabase-public-env';

function developmentSupabaseConnectSource(): string {
  if (process.env.NODE_ENV !== 'development'
    || ['production', 'staging'].includes(process.env.DEPLOYMENT_ENV ?? '')) return '';
  try {
    const url = new URL(getSupabasePublicUrl());
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
      || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
    return ` ${url.origin}`;
  } catch {
    return '';
  }
}

/**
 * Bella ERP Proxy (Next.js 16 Middleware)
 * 
 * Handles:
 * - Supabase auth session refresh
 * - Server-side authorization & role-based redirects
 * - CDN caching headers for API endpoints
 * - Security headers (CSP, HSTS, etc.)
 * - Mock user bypass in development
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isKtvRoute = pathname.startsWith('/ktv');
  const isStudentRoute = pathname.startsWith('/student');
  const isLoginRoute = pathname === '/login';
  const isApiRoute = pathname.startsWith('/api/');
  const isPrivateCareRoute = pathname === '/api/education/care/bulk' || pathname === '/api/education/care/classes';
  // Cache classification only; catalog handlers retain their own authorization.
  const isCourseCatalogRead = request.method === 'GET'
    && /^\/api\/education\/courses(?:\/[^/]+)?\/?$/.test(pathname)
    && request.nextUrl.searchParams.getAll('view').includes('catalog');
  const isPrivateReadRoute = isPrivateCareRoute || isCourseCatalogRead
    || /^\/api\/education\/portal\/[^/]+(?:\/(?:chat|copilot))?$/.test(pathname)
    || pathname === '/api/education/attendance' || pathname === '/api/education/enrollments'
    || pathname === '/api/education/announcements'
    || pathname === '/api/education/analytics' || pathname === '/api/education/finance';

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ============================================================================
  // PART 1: CDN CACHING & SECURITY HEADERS
  // ============================================================================

  // API Gateway endpoints - Cache public data
  if (pathname.startsWith('/api/v1/public')) {
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    response.headers.set('CDN-Cache-Control', 'max-age=300');
    response.headers.set('Vercel-CDN-Cache-Control', 'max-age=300');
  }
  // API Gateway partner webhooks - No cache
  else if (pathname.startsWith('/api/v1/webhooks')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  // Internal API routes - No cache (dynamic data)
  else if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', isPrivateReadRoute ? 'private, no-store' : 'no-store, must-revalidate');
  }

  // Static assets - Long cache
  if (pathname.startsWith('/_next/static') || pathname.match(/\.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CSP - Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live wss://vercel.live" + developmentSupabaseConnectSource(),
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(self)'
  );

  // HSTS - Only in production
  if (process.env.DEPLOYMENT_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  // Environment indicator
  response.headers.set('X-Environment', process.env.DEPLOYMENT_ENV || 'development');

  // Robots - Block staging from search engines
  if (process.env.DEPLOYMENT_ENV === 'staging') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  const publicSupabaseUrl = getSupabasePublicUrl();
  const publicSupabaseKey = getSupabasePublicKey();

  if (!publicSupabaseUrl || !publicSupabaseKey) {
    if (isDashboardRoute || isKtvRoute || isStudentRoute || isApiRoute) {
      requireSupabasePublicEnv();
    }

    return response;
  }

  const url = publicSupabaseUrl;
  const publicKey = publicSupabaseKey;

  // ============================================================================
  // PART 2: SUPABASE AUTH SESSION REFRESH
  // ============================================================================

  const supabase = createServerClient(
    url,
    publicKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          if (isPrivateReadRoute) response.headers.set('Cache-Control', 'private, no-store');
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          if (isPrivateReadRoute) response.headers.set('Cache-Control', 'private, no-store');
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // 1. Khởi tạo & Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  const mockUserEmail = request.cookies.get('mock_user_email')?.value;
  const isMockDev = process.env.NODE_ENV === 'development' && !!mockUserEmail;

  // 2. Security Redirects: Chưa đăng nhập truy cập trang cần bảo vệ
  if (!user && !isMockDev) {
    if (isDashboardRoute || isKtvRoute || isStudentRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // 3. Đã đăng nhập: Lấy vai trò (role) của người dùng từ database
  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    role = profile?.role?.toLowerCase() || null;
  } else if (isMockDev && mockUserEmail && getSupabaseAdminKey()) {
    // Development bypass: sử dụng service_role_key để truy cập thông tin vai trò từ DB
    const { createClient: createAdmin } = await import('@supabase/supabase-js');
    const adminClient = createAdmin(
      getSupabaseAdminUrl(),
      getSupabaseAdminKey(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('email', mockUserEmail)
      .single();
    role = profile?.role?.toLowerCase() || null;
  }

  // 4. Kiểm tra phân quyền và điều hướng an toàn (Server-side Redirect)
  if (isDashboardRoute) {
    if (role === 'student') {
      const studentDashboardUrl = new URL('/student/dashboard', request.url);
      return NextResponse.redirect(studentDashboardUrl);
    }

    if (role === 'ktv') {
      const ktvDashboardUrl = new URL('/ktv/dashboard', request.url);
      return NextResponse.redirect(ktvDashboardUrl);
    }
  }

  if (isKtvRoute) {
    if (role === 'student') {
      const studentDashboardUrl = new URL('/student/dashboard', request.url);
      return NextResponse.redirect(studentDashboardUrl);
    }

    if (role && role !== 'ktv') {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (isStudentRoute) {
    if (role && role !== 'student') {
      const targetUrl = new URL(role === 'ktv' ? '/ktv/dashboard' : '/dashboard', request.url);
      return NextResponse.redirect(targetUrl);
    }
  }

  if (isLoginRoute) {
    if (request.nextUrl.searchParams.get('logout') === 'true' || request.nextUrl.searchParams.get('reset') === 'true') {
      const res = NextResponse.next();
      res.cookies.delete('mock_user_email');
      return res;
    }
    const targetUrl = new URL(
      role === 'student' ? '/student/dashboard' : role === 'ktv' ? '/ktv/dashboard' : '/dashboard',
      request.url,
    );
    return NextResponse.redirect(targetUrl);
  }

  // 5. Đang ở dev mock bypass, truyền header email giả lập cho server actions
  if (isMockDev && mockUserEmail) {
    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set('x-mock-user-email', mockUserEmail);
    return NextResponse.next({ request: { headers: modifiedHeaders } });
  }

  return response;
}

export const config = {
  // Chỉ chạy trên các route được bảo vệ + API routes
  // Loại trừ trang Portal (/portal/[token]) của khách hàng vì truy cập qua magic links token.
  matcher: [
    '/dashboard/:path*', 
    '/ktv/:path*', 
    '/student/:path*', 
    '/login',
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
