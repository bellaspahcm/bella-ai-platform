/**
 * Real Estate Kernel — PropertyUnit Repository
 *
 * Repository pattern for loading and saving PropertyUnit entities.
 * Restricts all direct database access (supabase.from('real_estate_products')) to the Kernel repository layer.
 *
 * @module platform/real-estate/repositories/property-unit.repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { PropertyUnit, PropertyUnitStatus } from '../domain/property-unit.entity';
import type { Database } from '@/types/database.types';

type RealEstateProductStatus = Database['public']['Enums']['re_product_status'];

/**
 * Maps database re_product_status enum to domain PropertyUnitStatus.
 * 
 * Inverse of mapDomainStatusToDb - reconstructs domain state from database.
 */
function mapDbStatusToDomain(dbStatus: RealEstateProductStatus): PropertyUnitStatus {
  switch (dbStatus) {
    case 'held':
      return 'held';
    case 'booked':
      return 'held';  // Database booked maps back to domain held
    case 'handed_over':
      return 'completed';  // Database handed_over maps to domain completed
    // Direct mappings
    case 'available':
    case 'deposited':
    case 'contracted':
      return dbStatus;
    case 'paid':
    case 'cancelled':
      // These database states don't have domain equivalents yet
      // Map to closest semantic match
      return dbStatus === 'paid' ? 'deposited' : 'available';
    default:
      const _exhaustive: never = dbStatus;
      throw new Error(`Unknown database status: ${_exhaustive}`);
  }
}

/**
 * Maps domain PropertyUnitStatus to database re_product_status enum.
 * 
 * Domain model uses richer state machine; database uses operational states.
 * This mapping preserves domain logic while conforming to database constraints.
 */
function mapDomainStatusToDb(
  domainStatus: PropertyUnitStatus
): 'available' | 'booked' | 'deposited' | 'contracted' | 'paid' | 'handed_over' | 'cancelled' {
  switch (domainStatus) {
    case 'held':
      return 'booked';  // Temporary reservation maps to booked
    case 'completed':
      return 'handed_over';  // Final handover state
    // Direct mappings (domain matches database)
    case 'available':
    case 'booked':
    case 'deposited':
    case 'contracted':
      return domainStatus;
    default:
      // Exhaustive check - TypeScript will error if we miss a status
      const _exhaustive: never = domainStatus;
      throw new Error(`Unknown domain status: ${_exhaustive}`);
  }
}

export class PropertyUnitRepository {
  /**
   * Loads a PropertyUnit by ID and Tenant ID.
   */
  async findById(supabase: SupabaseClient<Database>, tenantId: string, id: string): Promise<PropertyUnit | null> {
    const { data, error } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`DATABASE_ERROR: Failed to load property unit: ${error.message}`);
    }

    return new PropertyUnit({
      id: data.id,
      tenantId: data.tenant_id,
      projectId: data.project_id,
      productCode: data.product_code || '',
      productType: (data.product_type as 'apartment' | 'townhouse' | 'shophouse' | 'villa') || 'apartment',
      unitCode: data.product_code || '',
      area: Number(data.area || 0),
      unitPrice: Number(data.unit_price || 0),
      status: mapDbStatusToDomain(data.status) || 'available',
      ownerName: data.owner_name || null
    });
  }

  /**
   * Saves the state of a PropertyUnit back to the database.
   */
  async save(supabase: SupabaseClient<Database>, unit: PropertyUnit): Promise<void> {
    // Map domain status to database enum
    const dbStatus = mapDomainStatusToDb(unit.status);

    const { error } = await supabase
      .from('real_estate_products')
      .update({
        status: dbStatus,
        owner_name: unit.ownerName,
        updated_at: new Date().toISOString()
      })
      .eq('id', unit.id)
      .eq('tenant_id', unit.tenantId);

    if (error) {
      throw new Error(`DATABASE_ERROR: Failed to save property unit ${unit.id}: ${error.message}`);
    }
  }

  /**
   * Retrieves all product units by project.
   */
  async findByProject(supabase: SupabaseClient<Database>, tenantId: string, projectId: string): Promise<PropertyUnit[]> {
    const { data, error } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('product_code', { ascending: true });

    if (error) {
      throw new Error(`DATABASE_ERROR: Failed to fetch products for project: ${error.message}`);
    }

    return data.map(item => new PropertyUnit({
      id: item.id,
      tenantId: item.tenant_id,
      projectId: item.project_id,
      productCode: item.product_code || '',
      productType: (item.product_type as 'apartment' | 'townhouse' | 'shophouse' | 'villa') || 'apartment',
      unitCode: item.product_code || '',
      area: Number(item.area || 0),
      unitPrice: Number(item.unit_price || 0),
      status: mapDbStatusToDomain(item.status) || 'available',
      ownerName: item.owner_name || null
    }));
  }
}
