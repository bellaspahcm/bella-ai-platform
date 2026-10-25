/**
 * Supabase Server Client
 * 
 * Server-side Supabase client for use in:
 * - Server Components
 * - Server Actions
 * - Route Handlers
 * 
 * This client uses cookies for authentication and should only be used server-side.
 * 
 * TEST ENVIRONMENT: Uses service role client without cookies to avoid Next.js request context issues
 */

import { cookies } from 'next/headers';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { PlatformActorDatabase as Database } from '@/platform/security/current-actor.contract';
import type { User } from '@supabase/supabase-js';
import { cache } from 'react';
import { requireSupabasePublicEnv } from './supabase-public-env';

export const createServerClient = cache(() => {
  // TEST ENVIRONMENT: Use service role client (no cookies needed)
  if (process.env.NODE_ENV === 'test') {
    console.log('[createServerClient] Test environment detected - using service role client');
    const client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Mock getUser to bypass authentication in tests
    client.auth.getUser = async () => {
      return {
        data: {
          user: {
            id: 'mock-user-admin',
            email: 'admin@test.com',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          } as unknown as User,
        },
        error: null,
      };
    };

    return client;
  }

  // PRODUCTION: Use SSR client with cookies
  const { url, publicKey } = requireSupabasePublicEnv();
  const client = createSupabaseServerClient<Database>(
    url,
    publicKey,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookies();
          return cookieStore.get(name)?.value;
        },
        async set(name: string, value: string, options) {
          try {
            const cookieStore = await cookies();
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookie setting errors in middleware
          }
        },
        async remove(name: string, options) {
          try {
            const cookieStore = await cookies();
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookie removal errors in middleware
          }
        },
      },
    }
  );

  // Memoize client.auth.getUser at the request level to avoid redundant network roundtrips.
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = cache(async (jwt?: string) => {
    const restClient = (client as unknown as { rest?: { headers: { set: (k: string, v: string) => void } } }).rest;
    if (jwt) {
      if (restClient) {
        restClient.headers.set('Authorization', `Bearer ${jwt}`);
      }
      return await originalGetUser(jwt);
    }
    try {
      const { headers: nextHeaders } = await import('next/headers');
      const reqHeaders = await nextHeaders();
      const authHeader = reqHeaders.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        if (restClient) {
          restClient.headers.set('Authorization', `Bearer ${token}`);
        }
        return await originalGetUser(token);
      }
    } catch (e) {
      // headers() may throw outside request context
    }
    return await originalGetUser();
  });

  return client;
});

// Backward compatibility alias
export const createClient = createServerClient;
