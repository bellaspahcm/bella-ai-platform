// Generated from actual isolated public schema; complete function members selected by TypeScript AST.
// Full actual schema SHA256 e4542aaed6ea728e22fd8b0798da263ac08058594632a282788bbca137f3b824
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
