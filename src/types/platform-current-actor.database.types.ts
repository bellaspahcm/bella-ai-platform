// Generated from the actual disposable public schema after applying the pinned Preschool profile migrations.
// Complete function members are selected from Supabase's generated TypeScript output by contract ownership.
import type { Json } from '@/types/database.types';

export type PlatformCurrentActorReadDatabase = { public: {
  Tables: { [_ in never]: never };
  Views: { [_ in never]: never };
  Functions: {
platform_current_actor_profile: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          role: string
          status: string
          tenant_id: string
          tenant_status: string
        }[]
      }
platform_current_actor_tenant_presentation: {
        Args: never
        Returns: {
          brand_theme: Json
          enabled_modules: Json
          logo_url: string | null
          name: string
          product_key: string | null
          tenant_id: string
          tenant_status: string
        }[]
      }
platform_current_actor_org_unit_access: {
        Args: never
        Returns: {
          access_source: string
          org_unit_id: string
          relationship_id: string
          root_org_unit_id: string
          tenant_id: string
          user_id: string
        }[]
      }
  };
  Enums: { [_ in never]: never };
  CompositeTypes: { [_ in never]: never };
} };
