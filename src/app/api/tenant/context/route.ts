import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { combineChunks, createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { getSupabasePublicUrl, requireSupabasePublicEnv } from '@/lib/supabase-public-env';
import type { TenantContext } from '@/core/types/tenant';
import type { Database } from '@/types/database.types';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getTenantSettings } from '@/services/tenant-actions';
import {
  CURRENT_ACTOR_PROFILE_RPC,
  CURRENT_ACTOR_TENANT_PRESENTATION_RPC,
  reconcileCurrentActorProfile,
  reconcileCurrentActorTenantPresentation,
  type ActiveCurrentActorTenantPresentation,
  type PlatformActorDatabase,
} from '@/platform/security/current-actor.contract';

type TenantRow = Database['public']['Tables']['tenants']['Row'];

/**
 * Create a fresh Supabase server client for this Route Handler.
 * We do NOT use the cached `createClient` from supabase-server.ts because
 * React's cache() wrapper is incompatible with Next.js Route Handler context.
 */
async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  const { url, publicKey } = requireSupabasePublicEnv();

  return createSupabaseServerClient<Database>(
    url,
    publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // Route handlers cannot always set cookies after response work has started.
          }
        },
      },
    }
  );
}

function getProjectRefFromSupabaseUrl() {
  const url = getSupabasePublicUrl();
  if (!url) return null;

  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function decodeBase64UrlToUtf8(encoded: string) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(encoded, 'base64url').toString('utf8');
}

function readAccessTokenFromCookieValue(value: string | undefined) {
  if (!value) return null;

  try {
    const normalizedValue = decodeCookieValue(value);
    const encoded = normalizedValue.startsWith('base64-') ? normalizedValue.slice('base64-'.length) : null;
    if (!encoded) return null;

    const decoded = decodeBase64UrlToUtf8(encoded);
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const accessToken = (parsed as { access_token?: unknown }).access_token;
    return typeof accessToken === 'string' && accessToken.length > 0 ? accessToken : null;
  } catch {
    return null;
  }
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRawCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return [];

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex < 1) return null;

      return {
        name: part.slice(0, separatorIndex).trim(),
        value: part.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((cookie): cookie is { name: string; value: string } => Boolean(cookie?.name));
}

function getRequestCookies(request: NextRequest) {
  const cookiesByName = new Map<string, string>();

  for (const cookie of request.cookies.getAll()) {
    cookiesByName.set(cookie.name, cookie.value);
  }

  for (const cookie of parseRawCookieHeader(request.headers.get('cookie'))) {
    if (!cookiesByName.has(cookie.name)) {
      cookiesByName.set(cookie.name, cookie.value);
    }
  }

  return Array.from(cookiesByName, ([name, value]) => ({ name, value }));
}

async function readAccessTokenFromChunkedCookie(
  cookieName: string,
  requestCookies: ReturnType<NextRequest['cookies']['getAll']>,
) {
  const cookieValue = await combineChunks(cookieName, (chunkName) => {
    return requestCookies.find((cookie) => cookie.name === chunkName)?.value;
  });

  return readAccessTokenFromCookieValue(cookieValue ?? undefined);
}

async function getSupabaseAccessTokenFromRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }
  const requestCookies = getRequestCookies(request);
  const projectRef = getProjectRefFromSupabaseUrl();
  const preferredCookieName = projectRef ? `sb-${projectRef}-auth-token` : null;
  const preferredToken = preferredCookieName
    ? await readAccessTokenFromChunkedCookie(preferredCookieName, requestCookies)
    : null;

  if (preferredToken) return preferredToken;

  const authCookieNames = new Set<string>();

  for (const cookie of requestCookies) {
    const match = cookie.name.match(/^(sb-.+-auth-token)(?:\.\d+)?$/);
    if (!match?.[1]) continue;

    authCookieNames.add(match[1]);
  }

  if (preferredCookieName) {
    authCookieNames.delete(preferredCookieName);
  }

  for (const cookieName of authCookieNames) {
    const token = await readAccessTokenFromChunkedCookie(cookieName, requestCookies);
    if (token) return token;
  }

  return null;
}

function createBearerClient(accessToken: string): SupabaseClient<Database> {
  const { url, publicKey } = requireSupabasePublicEnv();

  return createSupabaseJsClient<Database>(
    url,
    publicKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

async function resolveAuthenticatedUser(
  request: NextRequest,
  supabase: SupabaseClient<Database>,
): Promise<{ user: User | null; authError: unknown; queryClient: SupabaseClient<Database> }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (user && !authError) {
    return { user, authError: null, queryClient: supabase };
  }

  const accessToken = await getSupabaseAccessTokenFromRequest(request);
  if (!accessToken) {
    return { user: null, authError, queryClient: supabase };
  }

  const bearerClient = createBearerClient(accessToken);
  const {
    data: { user: tokenUser },
    error: tokenAuthError,
  } = await bearerClient.auth.getUser(accessToken);

  return {
    user: tokenUser,
    authError: tokenAuthError,
    queryClient: tokenUser && !tokenAuthError ? bearerClient : supabase,
  };
}

/**
/**
 * API route to fetch tenant configuration for the authenticated user.
 * 
 * @remarks
 * This route extracts the tenant ID from the authenticated user's session,
 * queries the database for tenant configuration, and returns a properly
 * typed TenantContext object.
 * 
 * **Authentication**: Requires valid Supabase session. Returns 401 if not authenticated.
 * 
 * **Authorization**: Users can only access their own tenant's configuration.
 * The tenant_id comes from the authenticated user's profile.
 * 
 * **Caching**: Consider adding HTTP caching headers in production for performance.
 * Tenant configuration rarely changes during a user session.
 * 
 * **Error Handling**:
 * - 401: User not authenticated
 * - 403: User has no tenant assigned
 * - 404: Tenant not found in database
 * - 500: Database query error
 * 
 * @param request - Next.js request object
 * @returns JSON response with TenantContext or error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { user, authError, queryClient } = await resolveAuthenticatedUser(request, supabase);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to access tenant configuration' },
        { status: 401 },
      );
    }

    // Identity is read through the installed signed-in Platform contract. Do not
    // restore direct table grants or treat caller tenant IDs as authority.
    const actorClient = queryClient as unknown as SupabaseClient<PlatformActorDatabase>;
    const { data: profiles, error: profileError } = await actorClient.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: profileError.code === '42501' ? 403 : 500 },
      );
    }
    const actor = reconcileCurrentActorProfile(user.id, profiles);
    if (!actor?.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden: Active user profile and tenant assignment required.' },
        { status: 403 },
      );
    }

    // Read only the authenticated actor's approved tenant projection. Do not
    // query the tenant table or use a service-role fallback for this context.
    const { data: tenantRows, error: tenantError } = await actorClient.rpc(CURRENT_ACTOR_TENANT_PRESENTATION_RPC);
    if (tenantError) {
      return NextResponse.json(
        { error: 'Failed to fetch tenant presentation' },
        { status: tenantError.code === '42501' ? 403 : 500 },
      );
    }
    const tenant = reconcileCurrentActorTenantPresentation(actor.tenant_id, tenantRows);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Forbidden: Active tenant presentation required.' },
        { status: 403 },
      );
    }

    if (tenant.product_key === 'bella_preschool') {
      return NextResponse.json(transformTenantPresentationToContext(tenant), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Keep the established full settings mapping for other products. Preschool
    // must use the signed-in Platform projection above and never fall back to a
    // direct tenants-table read.
    const tenantSettings = await getTenantSettings();
    if (!tenantSettings) {
      return NextResponse.json(
        { error: 'Failed to fetch tenant configuration' },
        { status: 500 },
      );
    }
    if (tenantSettings.id !== actor.tenant_id || tenantSettings.status !== 'active') {
      return NextResponse.json(
        { error: 'Forbidden: Tenant configuration does not match current actor.' },
        { status: 403 },
      );
    }

    return NextResponse.json(transformTenantRowToContext(tenantSettings), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[GET /api/tenant/context] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant configuration' }, { status: 500 });
  }
}

/** Transform an established full tenant settings row for legacy product consumers. */
function transformTenantRowToContext(tenant: TenantRow): TenantContext {
  let enabledModules: string[] = ['spa'];
  if (tenant.enabled_modules) {
    if (Array.isArray(tenant.enabled_modules)) {
      enabledModules = tenant.enabled_modules.filter((item): item is string => typeof item === 'string');
    } else if (typeof tenant.enabled_modules === 'object' && tenant.enabled_modules !== null) {
      enabledModules = Object.entries(tenant.enabled_modules)
        .filter(([, value]) => value === true)
        .map(([key]) => key);
      if (enabledModules.length === 0) enabledModules = ['spa'];
    } else if (typeof tenant.enabled_modules === 'string') {
      enabledModules = [tenant.enabled_modules];
    }
  }

  const subscriptionPlan = (tenant.subscription_tier as TenantContext['subscriptionPlan']) || 'basic';
  const featureFlags: Record<string, boolean> = {};
  if (tenant.role_permissions && typeof tenant.role_permissions === 'object') {
    const rolePermissions = tenant.role_permissions as Record<string, unknown>;
    if (rolePermissions.feature_flags && typeof rolePermissions.feature_flags === 'object') {
      Object.assign(featureFlags, rolePermissions.feature_flags);
    }
  }

  const settings: Record<string, unknown> = {
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    companyName: tenant.name,
    productKey: tenant.product_key ?? null,
  };
  const brand = tenant.brand_theme;
  if (brand && typeof brand === 'object' && !Array.isArray(brand)) {
    const keys = ['brandName', 'logoUrl', 'primaryColor', 'accentColor', 'portalDisplayName',
      'invoiceDisplayName', 'stylePreset', 'radiusStyle', 'buttonStyle', 'menuStyle', 'fontHeading'];
    settings.brandTheme = Object.fromEntries(keys.filter(key => typeof brand[key] === 'string').map(key => [key, brand[key]]));
  }
  if (tenant.brand_theme && typeof tenant.brand_theme === 'object' && !Array.isArray(tenant.brand_theme)) {
    const theme = tenant.brand_theme as Record<string, unknown>;
    Object.assign(settings, {
      logoUrl: theme.logoUrl || tenant.logo_url,
      primaryColor: theme.primaryColor,
    });
  } else if (tenant.logo_url) {
    settings.logoUrl = tenant.logo_url;
  }
  if (tenant.salary_config && typeof tenant.salary_config === 'object') settings.salaryConfig = tenant.salary_config;
  if (tenant.qr_bank_code) {
    settings.qrPayment = {
      bankCode: tenant.qr_bank_code,
      accountNumber: tenant.qr_account_number,
      accountName: tenant.qr_account_name,
    };
  }
  if (tenant.contact_phone || tenant.email || tenant.address) {
    settings.contact = { phone: tenant.contact_phone, email: tenant.email, address: tenant.address };
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name || 'Unnamed Tenant',
    enabledModules: enabledModules as TenantContext['enabledModules'],
    subscriptionPlan,
    featureFlags,
    settings,
  };
}

/** Map the approved self-scoped tenant presentation to the client context. */
function transformTenantPresentationToContext(tenant: ActiveCurrentActorTenantPresentation): TenantContext {
  let enabledModules: string[] = [];
  if (Array.isArray(tenant.enabled_modules)) {
    enabledModules = tenant.enabled_modules.filter((item): item is string => typeof item === 'string');
  } else if (typeof tenant.enabled_modules === 'object' && tenant.enabled_modules !== null) {
    enabledModules = Object.entries(tenant.enabled_modules)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  } else if (typeof tenant.enabled_modules === 'string' && tenant.enabled_modules.trim()) {
    enabledModules = [tenant.enabled_modules];
  }

  // The presentation contract does not expose billing entitlements or caller
  // feature grants. Use the lowest context tier and no client feature grants;
  // action authorization remains server-side.
  const subscriptionPlan: TenantContext['subscriptionPlan'] = 'basic';
  const featureFlags: Record<string, boolean> = {};

  const settings: Record<string, unknown> = {
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    companyName: tenant.name,
    productKey: tenant.product_key ?? null,
  };

  const brand = tenant.brand_theme;
  if (brand && typeof brand === 'object' && !Array.isArray(brand)) {
    const keys = ['brandName', 'logoUrl', 'primaryColor', 'accentColor', 'portalDisplayName',
      'invoiceDisplayName', 'stylePreset', 'radiusStyle', 'buttonStyle', 'menuStyle', 'fontHeading'];
    settings.brandTheme = Object.fromEntries(keys.filter(key => typeof brand[key] === 'string').map(key => [key, brand[key]]));
  }

  if (tenant.brand_theme && typeof tenant.brand_theme === 'object' && !Array.isArray(tenant.brand_theme)) {
    const theme = tenant.brand_theme as Record<string, unknown>;
    Object.assign(settings, {
      logoUrl: typeof theme.logoUrl === 'string' ? theme.logoUrl : tenant.logo_url,
      ...(typeof theme.primaryColor === 'string' ? { primaryColor: theme.primaryColor } : {}),
    });
  } else if (tenant.logo_url !== null) {
    settings.logoUrl = tenant.logo_url;
  }

  // Construct and return TenantContext
  const context: TenantContext = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    enabledModules: enabledModules as TenantContext['enabledModules'],
    subscriptionPlan,
    featureFlags,
    settings,
  };

  return context;
}
