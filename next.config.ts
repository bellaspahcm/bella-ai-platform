import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

function developmentSupabaseConnectSource(): string {
  if (process.env.NODE_ENV !== 'development'
    || ['production', 'staging'].includes(process.env.DEPLOYMENT_ENV ?? '')) return '';
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
      || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
    return ` ${url.origin}`;
  } catch {
    return '';
  }
}

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://vercel.live", // unsafe-eval and blob required by Next.js dev, Sentry, and Vercel Live Workers
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io https://o4511424569868288.ingest.us.sentry.io https://vercel.live wss://vercel.live" + developmentSupabaseConnectSource(),
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "manifest-src 'self'",
      "media-src 'self'",
    ].join('; '),
  },
];

const userManualsHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
    ].join('; '),
  },
];

const apiNoStoreHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
];

const nextConfig: NextConfig = {
  // Enable strict type checking during build for production safety
  // TEMPORARILY DISABLED for Vercel build timeout - run type check in CI instead
  typescript: {
    ignoreBuildErrors: true, // ⚠️ Type checking moved to CI pipeline to prevent build timeout
  },
  // Strip console.log/info/debug in production builds. Keeps console.error/warn
  // so real errors still surface in Sentry. Saves bundle size + runtime cost.
  // TEMPORARILY DISABLED for performance profiling
  compiler: {
    removeConsole: false, // TODO: Re-enable after performance profiling complete
  },
  // Transpile workspace packages for Next.js (mobile + web code sharing)
  transpilePackages: ['@bella/shared'],
  // Tree-shake heavy barrel imports. lucide-react / date-fns / recharts are
  // already optimized by default in Next 16; framer-motion is not, so add it.
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: apiNoStoreHeaders,
      },
      {
        source: '/api/tenant/context',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=300, stale-while-revalidate=60' },
        ],
      },
      {
        source: '/user-manuals/:path*',
        headers: userManualsHeaders,
      },
      {
        source: '/((?!user-manuals).*)',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard/admin/rules',
        destination: '/dashboard/rules',
        permanent: true,
      },
      {
        source: '/dashboard/admin/rules/:path*',
        destination: '/dashboard/rules/:path*',
        permanent: true,
      },
    ];
  },
  // Allow next/image to load from Unsplash (used in demo/placeholder UI components)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "bella-spa",
  project: "bella-spa-erp",
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: true },
});
