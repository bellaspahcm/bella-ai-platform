/**
 * @fileoverview Org Unit Engine
 * 
 * Implements IOrgUnitContract with business logic:
 * - Tenant boundary enforcement
 * - Hierarchy validation
 * - Circular reference prevention
 * - Archive safety
 * 
 * @module platform/org-unit/engine
 */

import type {
  IOrgUnitContract,
  OrgUnit,
  OrgUnitType,
  CreateOrgUnitInput,
  UpdateOrgUnitInput,
  OrgUnitFilter,
  OrgUnitHierarchy
} from './index';
import {
  OrgUnitNotFoundError,
  OrgUnitParentNotFoundError,
  OrgUnitCodeConflictError,
  OrgUnitCircularReferenceError,
  OrgUnitTenantMismatchError
} from './index';
import type { IOrgUnitRepository } from './org-unit.repository';
import { createOrgUnitRepository, type OrgUnitDatabase } from './org-unit.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Org Unit Engine
 * 
 * Platform Core service for organizational hierarchy management.
 */
export class OrgUnitEngine implements IOrgUnitContract {
  constructor(private repository: IOrgUnitRepository) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create organization unit
   */
  async createOrgUnit(input: CreateOrgUnitInput): Promise<OrgUnit> {
    // Validate parent (if specified)
    if (input.parentId) {
      const parent = await this.repository.findById(input.parentId, input.tenantId);
      
      if (!parent) {
        throw new OrgUnitParentNotFoundError(input.parentId);
      }
      
      if (parent.tenantId !== input.tenantId) {
        throw new OrgUnitTenantMismatchError('new-unit', input.parentId);
      }
    }

    // Validate code uniqueness (if specified)
    if (input.code) {
      const codeExists = await this.repository.codeExists(input.code, input.tenantId);
      if (codeExists) {
        throw new OrgUnitCodeConflictError(input.code, input.tenantId);
      }
    }

    // Create org unit
    const orgUnit = await this.repository.create(input);

    // TODO: Emit OrgUnitCreated event

    return orgUnit;
  }

  /**
   * Update organization unit
   */
  async updateOrgUnit(id: string, tenantId: string, updates: UpdateOrgUnitInput): Promise<OrgUnit> {
    // Verify unit exists
    const existing = await this.repository.findById(id, tenantId);
    if (!existing) {
      throw new OrgUnitNotFoundError(id);
    }

    // Validate parent change (if specified)
    if (updates.parentId !== undefined) {
      await this._validateParentChange(id, updates.parentId, tenantId);
    }

    // Validate code change (if specified)
    if (updates.code !== undefined && updates.code !== existing.code) {
      const codeExists = await this.repository.codeExists(updates.code, tenantId, id);
      if (codeExists) {
        throw new OrgUnitCodeConflictError(updates.code, tenantId);
      }
    }

    // Update org unit
    const updated = await this.repository.update(id, tenantId, updates);

    // TODO: Emit OrgUnitUpdated event

    return updated;
  }

  /**
   * Archive organization unit
   */
  async archiveOrgUnit(id: string, tenantId: string): Promise<void> {
    // Verify unit exists
    const exists = await this.repository.exists(id, tenantId);
    if (!exists) {
      throw new OrgUnitNotFoundError(id);
    }

    // Archive (soft delete)
    await this.repository.archive(id, tenantId);

    // TODO: Emit OrgUnitArchived event
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get organization unit by ID
   */
  async getOrgUnit(id: string, tenantId: string): Promise<OrgUnit | null> {
    return this.repository.findById(id, tenantId);
  }

  /**
   * Get organization units by filter
   */
  async getOrgUnits(filter: OrgUnitFilter): Promise<OrgUnit[]> {
    return this.repository.findMany(filter);
  }

  /**
   * Get direct children of organization unit
   */
  async getChildren(parentId: string, tenantId: string): Promise<OrgUnit[]> {
    // Verify parent exists
    const parent = await this.repository.findById(parentId, tenantId);
    if (!parent) {
      throw new OrgUnitNotFoundError(parentId);
    }

    return this.repository.findChildren(parentId, tenantId);
  }

  /**
   * Get full hierarchy from root to leaves
   */
  async getHierarchy(rootId: string | null, tenantId: string): Promise<OrgUnitHierarchy[]> {
    // If rootId specified, verify it exists
    if (rootId) {
      const root = await this.repository.findById(rootId, tenantId);
      if (!root) {
        throw new OrgUnitNotFoundError(rootId);
      }
    }

    return this.repository.findHierarchy(rootId, tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate parent-child relationship
   */
  async validateParent(childId: string, parentId: string, tenantId: string): Promise<boolean> {
    // Self-reference check
    if (childId === parentId) {
      return false;
    }

    // Parent existence check
    const parent = await this.repository.findById(parentId, tenantId);
    if (!parent) {
      return false;
    }

    // Tenant consistency check
    const child = await this.repository.findById(childId, tenantId);
    if (!child) {
      return false;
    }

    if (parent.tenantId !== child.tenantId) {
      return false;
    }

    // Circular reference check
    const isCircular = await this.detectCircularReference(childId, parentId, tenantId);
    if (isCircular) {
      return false;
    }

    return true;
  }

  /**
   * Detect circular reference
   */
  async detectCircularReference(unitId: string, parentId: string, tenantId: string): Promise<boolean> {
    // Self-reference is circular
    if (unitId === parentId) {
      return true;
    }

    // Get all descendants of unitId
    const descendantIds = await this.repository.findDescendantIds(unitId, tenantId);

    // If parentId is a descendant, assigning it as parent would create circular reference
    return descendantIds.includes(parentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCOPE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get organization units accessible by user
   * 
   * CURRENT IMPLEMENTATION: Returns all units in tenant (filtered by type if specified).
   * 
   * FUTURE: Integrate with org_relationships to determine user's assigned units.
   * For now, IAM Matrix handles permission checks at application layer.
   */
  async getUserAccessibleUnits(
    userId: string,
    tenantId: string,
    unitType?: OrgUnitType
  ): Promise<OrgUnit[]> {
    // TODO: Query org_relationships to find user's assigned org units
    // For now, return all active units in tenant (permission check done by IAM Matrix)
    
    return this.repository.findMany({
      tenantId,
      unitType,
      isActive: true
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate parent change during update
   */
  private async _validateParentChange(
    unitId: string,
    newParentId: string | null | undefined,
    tenantId: string
  ): Promise<void> {
    // If setting parent to null (orphan), no validation needed
    if (newParentId === null || newParentId === undefined) {
      return;
    }

    // Self-reference check
    if (unitId === newParentId) {
      throw new OrgUnitCircularReferenceError(unitId, newParentId);
    }

    // Parent existence check
    const parent = await this.repository.findById(newParentId, tenantId);
    if (!parent) {
      throw new OrgUnitParentNotFoundError(newParentId);
    }

    // Tenant consistency check
    if (parent.tenantId !== tenantId) {
      throw new OrgUnitTenantMismatchError(unitId, newParentId);
    }

    // Circular reference check
    const isCircular = await this.detectCircularReference(unitId, newParentId, tenantId);
    if (isCircular) {
      throw new OrgUnitCircularReferenceError(unitId, newParentId);
    }
  }
}

/**
 * Create Org Unit Engine
 * 
 * Factory for the existing trusted server-side Org Unit contract.
 */
export function createOrgUnitEngine(): IOrgUnitContract {
  return new OrgUnitEngine(createOrgUnitRepository());
}

/** Creates the same public contract with an authenticated caller-scoped client. */
export function createOrgUnitEngineForClient(client: SupabaseClient<OrgUnitDatabase>): IOrgUnitContract {
  return new OrgUnitEngine(createOrgUnitRepository(client));
}

/**
 * Singleton instance
 */
export const orgUnitEngine = createOrgUnitEngine();
