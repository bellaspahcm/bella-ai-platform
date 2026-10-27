/**
 * @fileoverview Org Unit Repository
 * 
 * Encapsulates all database access for org_units table.
 * Enforces tenant isolation via RLS.
 * 
 * @module platform/org-unit/repository
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase-generated';
import type {
  OrgUnit,
  OrgUnitType,
  CreateOrgUnitInput,
  UpdateOrgUnitInput,
  OrgUnitFilter,
  OrgUnitHierarchy
} from './index';

// Extend Database type to include org_unit RPC functions
// These functions exist in DB but not yet in generated types
type ExtendedDatabase = Database & {
  public: Database['public'] & {
    Functions: Database['public']['Functions'] & {
      get_org_unit_hierarchy: {
        Args: { p_root_id: string | null; p_tenant_id: string };
        Returns: Array<{
          id: string;
          tenant_id: string;
          unit_type: string;
          name: string;
          code: string | null;
          parent_id: string | null;
          is_active: boolean;
          metadata: Database['public']['Tables']['org_units']['Row']['metadata'];
          created_at: string;
          updated_at: string;
          depth: number;
          path: string[];
          path_names: string[];
        }>;
      };
      get_org_unit_descendants: {
        Args: { p_unit_id: string; p_tenant_id: string };
        Returns: Array<{ id: string }>;
      };
    };
  };
};

export type OrgUnitDatabase = ExtendedDatabase;

type OrgUnitsRow = Database['public']['Tables']['org_units']['Row'];
type OrgUnitsInsert = Database['public']['Tables']['org_units']['Insert'];
type OrgUnitsUpdate = Database['public']['Tables']['org_units']['Update'];

/**
 * Org Unit Repository Interface
 */
export interface IOrgUnitRepository {
  create(input: CreateOrgUnitInput): Promise<OrgUnit>;
  update(id: string, tenantId: string, updates: UpdateOrgUnitInput): Promise<OrgUnit>;
  archive(id: string, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<OrgUnit | null>;
  findMany(filter: OrgUnitFilter): Promise<OrgUnit[]>;
  findChildren(parentId: string, tenantId: string): Promise<OrgUnit[]>;
  findHierarchy(rootId: string | null, tenantId: string): Promise<OrgUnitHierarchy[]>;
  findDescendantIds(unitId: string, tenantId: string): Promise<string[]>;
  exists(id: string, tenantId: string): Promise<boolean>;
  codeExists(code: string, tenantId: string, excludeId?: string): Promise<boolean>;
}

/**
 * Supabase Org Unit Repository
 */
export class SupabaseOrgUnitRepository implements IOrgUnitRepository {
  private supabaseClient: SupabaseClient<OrgUnitDatabase> | undefined;

  constructor(client?: SupabaseClient<OrgUnitDatabase>) {
    this.supabaseClient = client;
  }

  private get supabase(): SupabaseClient<OrgUnitDatabase> {
    if (this.supabaseClient) return this.supabaseClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for trusted org-unit repository access.');
    }

    this.supabaseClient = createClient<OrgUnitDatabase>(supabaseUrl, supabaseKey);
    return this.supabaseClient;
  }

  /**
   * Create organization unit
   */
  async create(input: CreateOrgUnitInput): Promise<OrgUnit> {
    const insert: OrgUnitsInsert = {
      tenant_id: input.tenantId,
      unit_type: input.unitType,
      name: input.name,
      code: input.code ?? null,
      parent_id: input.parentId ?? null,
      is_active: true,
      metadata: input.metadata ?? null,
    };

    const { data, error } = await this.supabase
      .from('org_units')
      .insert(insert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create org unit: ${error.message}`);
    }

    return this.mapRow(data);
  }

  /**
   * Update organization unit
   */
  async update(id: string, tenantId: string, updates: UpdateOrgUnitInput): Promise<OrgUnit> {
    const update: OrgUnitsUpdate = {};
    if (updates.name !== undefined) update.name = updates.name;
    if (updates.code !== undefined) update.code = updates.code ?? null;
    if (updates.parentId !== undefined) update.parent_id = updates.parentId ?? null;
    if (updates.isActive !== undefined) update.is_active = updates.isActive;
    if (updates.metadata !== undefined) {
      update.metadata = updates.metadata;
    }

    const { data, error } = await this.supabase
      .from('org_units')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update org unit: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Org unit not found: ${id}`);
    }

    return this.mapRow(data);
  }

  /**
   * Archive organization unit (soft delete)
   */
  async archive(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('org_units')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to archive org unit: ${error.message}`);
    }
  }

  /**
   * Find organization unit by ID
   */
  async findById(id: string, tenantId: string): Promise<OrgUnit | null> {
    const { data, error } = await this.supabase
      .from('org_units')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find org unit: ${error.message}`);
    }

    return data ? this.mapRow(data) : null;
  }

  /**
   * Find organization units by filter
   */
  async findMany(filter: OrgUnitFilter): Promise<OrgUnit[]> {
    let query = this.supabase
      .from('org_units')
      .select('*')
      .eq('tenant_id', filter.tenantId);

    if (filter.unitType) {
      query = query.eq('unit_type', filter.unitType);
    }

    if (filter.parentId !== undefined) {
      if (filter.parentId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', filter.parentId);
      }
    }

    if (filter.isActive !== undefined) {
      query = query.eq('is_active', filter.isActive);
    }

    if (filter.searchTerm) {
      query = query.or(`name.ilike.%${filter.searchTerm}%,code.ilike.%${filter.searchTerm}%`);
    }

    const { data, error } = await query.order('name');

    if (error) {
      throw new Error(`Failed to find org units: ${error.message}`);
    }

    return data.map(row => this.mapRow(row));
  }

  /**
   * Find direct children of organization unit
   */
  async findChildren(parentId: string, tenantId: string): Promise<OrgUnit[]> {
    const { data, error } = await this.supabase
      .from('org_units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('parent_id', parentId)
      .order('name');

    if (error) {
      throw new Error(`Failed to find children: ${error.message}`);
    }

    return data.map(row => this.mapRow(row));
  }

  /**
   * Find full hierarchy from root to leaves
   * 
   * Uses recursive CTE to traverse org tree.
   */
  async findHierarchy(rootId: string | null, tenantId: string): Promise<OrgUnitHierarchy[]> {
    // Recursive CTE query
    const { data, error } = await this.supabase.rpc('get_org_unit_hierarchy', {
      p_root_id: rootId,
      p_tenant_id: tenantId
    });

    if (error) {
      throw new Error(`Failed to get hierarchy: ${error.message}`);
    }

    // Map RPC result to OrgUnitHierarchy - types from ExtendedDatabase
    return (data || []).map((row) => ({
      unit: {
        id: row.id,
        tenantId: row.tenant_id,
        unitType: row.unit_type as OrgUnitType,
        name: row.name,
        code: row.code ?? undefined,
        parentId: row.parent_id ?? undefined,
        isActive: row.is_active,
        metadata: row.metadata ?? null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      depth: row.depth,
      path: row.path,
      pathNames: row.path_names
    }));
  }

  /**
   * Find all descendant IDs (recursive)
   * 
   * Used for circular reference detection.
   */
  async findDescendantIds(unitId: string, tenantId: string): Promise<string[]> {
    const { data, error } = await this.supabase.rpc('get_org_unit_descendants', {
      p_unit_id: unitId,
      p_tenant_id: tenantId
    });

    if (error) {
      throw new Error(`Failed to get descendants: ${error.message}`);
    }

    return (data || []).map((row) => row.id);
  }

  /**
   * Check if organization unit exists
   */
  async exists(id: string, tenantId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('org_units')
      .select('id', { count: 'exact', head: true })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to check org unit existence: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Check if code exists in tenant
   */
  async codeExists(code: string, tenantId: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase
      .from('org_units')
      .select('id', { count: 'exact', head: true })
      .eq('code', code)
      .eq('tenant_id', tenantId);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check code existence: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Map database row to domain entity
   */
  private mapRow(row: OrgUnitsRow): OrgUnit {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      unitType: row.unit_type as OrgUnitType,
      name: row.name,
      code: row.code ?? undefined,
      parentId: row.parent_id ?? undefined,
      isActive: row.is_active,
      metadata: row.metadata ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

/**
 * Create Org Unit Repository
 * 
 * Pass an authenticated caller-scoped client when the caller's RLS policies
 * must govern the operation. Omitting it retains the existing service-role
 * repository behavior for trusted server-side consumers.
 */
export function createOrgUnitRepository(client?: SupabaseClient<OrgUnitDatabase>): IOrgUnitRepository {
  return new SupabaseOrgUnitRepository(client);
}
