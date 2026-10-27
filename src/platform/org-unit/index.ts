/**
 * @fileoverview Platform Org Unit Contract
 * 
 * Generic organizational hierarchy capability for ALL verticals.
 * Supports Company → Region → Branch → Department → Team hierarchy.
 * 
 * Design Principles:
 * 1. Platform-generic (reusable by English Center, Preschool, Spa, Clinic, etc.)
 * 2. Minimal API surface (no ERP Organization module)
 * 3. Tenant-isolated (RLS + contract enforcement)
 * 4. Hierarchy validation (circular reference prevention)
 * 5. Contract-first (Products consume via public API only)
 * 
 * @module platform/org-unit
 * @owner Platform Core
 * @version 1.0.0
 * @since 2026-09-12
 */

import type { Json } from '@/types/supabase-generated';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Organization unit type enumeration
 * 
 * Supports flexible org hierarchy across all verticals:
 * - Healthcare: Hospital → Department → Team
 * - Education: Chain → Region → Branch (Center)
 * - Spa/Salon: Company → Region → Branch
 * - Real Estate: Company → Region → Project
 */
export type OrgUnitType =
  | 'company'      // Root organization (legal entity)
  | 'region'       // Geographic region
  | 'branch'       // Branch/facility/center/clinic
  | 'department'   // Functional department
  | 'team'         // Operational team
  | 'project'      // Project/task force (temporary)
  | 'task_force'   // Cross-functional temporary unit
  | 'committee';   // Governance committee

/**
 * Organization unit entity
 * 
 * Represents a node in organizational hierarchy.
 * Parent-child relationship forms tree structure.
 */
export interface OrgUnit {
  readonly id: string;
  readonly tenantId: string;
  readonly unitType: OrgUnitType;
  readonly name: string;
  readonly code?: string;
  readonly parentId?: string;
  readonly isActive: boolean;
  readonly metadata: Json;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Create organization unit input
 */
export interface CreateOrgUnitInput {
  readonly tenantId: string;
  readonly unitType: OrgUnitType;
  readonly name: string;
  readonly code?: string;
  readonly parentId?: string;
  readonly metadata?: Json;
}

/**
 * Update organization unit input
 */
export interface UpdateOrgUnitInput {
  readonly name?: string;
  readonly code?: string;
  readonly parentId?: string;
  readonly isActive?: boolean;
  readonly metadata?: Json;
}

/**
 * Org unit hierarchy query result
 * 
 * Returns org unit with ancestor path and depth.
 * Used for hierarchy traversal and breadcrumb display.
 */
export interface OrgUnitHierarchy {
  readonly unit: OrgUnit;
  readonly depth: number;
  readonly path: string[];  // Array of ancestor IDs from root to unit
  readonly pathNames: string[];  // Array of ancestor names
}

/**
 * Org unit filter for queries
 */
export interface OrgUnitFilter {
  readonly tenantId: string;
  readonly unitType?: OrgUnitType;
  readonly parentId?: string;
  readonly isActive?: boolean;
  readonly searchTerm?: string;  // Search by name or code
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Org Unit Contract
 * 
 * Public API for organizational hierarchy management.
 * Products MUST use this contract (NOT direct DB access).
 * 
 * Capabilities:
 * 1. Lifecycle: Create, update, archive org units
 * 2. Query: Get unit, children, hierarchy
 * 3. Validation: Prevent circular references, enforce rules
 * 4. Scope: Get available units for user/tenant
 * 
 * NOT included (by design):
 * - Membership management (deferred to org_relationships)
 * - Branch switching (deferred to PlatformContext)
 * - Permission checks (use IAM Matrix)
 * - Org chart UI (Product responsibility)
 */
export interface IOrgUnitContract {
  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create new organization unit
   * 
   * Validates:
   * - Tenant exists
   * - Parent (if specified) belongs to same tenant
   * - Code unique within tenant
   * - No circular reference
   * 
   * @throws {OrgUnitParentNotFoundError} if parent does not exist
   * @throws {OrgUnitCodeConflictError} if code already exists in tenant
   * @throws {OrgUnitCircularReferenceError} if parent creates circular reference
   */
  createOrgUnit(input: CreateOrgUnitInput): Promise<OrgUnit>;

  /**
   * Update existing organization unit
   * 
   * Validates:
   * - Unit exists
   * - Caller has permission (enforced by RLS)
   * - Parent change does not create circular reference
   * - Code change does not conflict
   * 
   * @throws {OrgUnitNotFoundError} if unit does not exist
   * @throws {OrgUnitCircularReferenceError} if parent change creates circular reference
   * @throws {OrgUnitCodeConflictError} if code conflicts
   */
  updateOrgUnit(id: string, tenantId: string, updates: UpdateOrgUnitInput): Promise<OrgUnit>;

  /**
   * Archive organization unit
   * 
   * Sets is_active = false (soft delete).
   * Does NOT cascade to children (children become orphaned, must be handled separately).
   * 
   * @throws {OrgUnitNotFoundError} if unit does not exist
   */
  archiveOrgUnit(id: string, tenantId: string): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get organization unit by ID
   * 
   * Returns null if unit does not exist or does not belong to tenant.
   * RLS enforces tenant isolation.
   */
  getOrgUnit(id: string, tenantId: string): Promise<OrgUnit | null>;

  /**
   * Get organization units by filter
   * 
   * Filters:
   * - unitType: Filter by type (branch, region, etc.)
   * - parentId: Get direct children of parent
   * - isActive: Filter active/inactive units
   * - searchTerm: Search by name or code (fuzzy match)
   * 
   * Tenant isolation enforced by RLS.
   */
  getOrgUnits(filter: OrgUnitFilter): Promise<OrgUnit[]>;

  /**
   * Get direct children of organization unit
   * 
   * Returns units where parent_id = parentId.
   * Tenant isolation enforced.
   */
  getChildren(parentId: string, tenantId: string): Promise<OrgUnit[]>;

  /**
   * Get full hierarchy from root to leaf
   * 
   * Returns org units with depth and path information.
   * Useful for:
   * - Breadcrumb navigation
   * - Org tree rendering
   * - Access control (user can access branch + all children)
   * 
   * @param rootId Starting point (null = tenant root units)
   * @param tenantId Tenant identifier
   * @returns Hierarchy array ordered by depth (root first)
   */
  getHierarchy(rootId: string | null, tenantId: string): Promise<OrgUnitHierarchy[]>;

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate parent-child relationship
   * 
   * Checks:
   * 1. Parent exists
   * 2. Parent belongs to same tenant as child
   * 3. No circular reference (parent is not descendant of child)
   * 4. No self-reference (parent !== child)
   * 
   * @returns true if valid, false otherwise
   */
  validateParent(childId: string, parentId: string, tenantId: string): Promise<boolean>;

  /**
   * Check if assigning parentId to unitId would create circular reference
   * 
   * Example circular reference:
   * - Unit A parent = B
   * - Unit B parent = C
   * - Unit C parent = A (CIRCULAR!)
   * 
   * @returns true if circular reference detected
   */
  detectCircularReference(unitId: string, parentId: string, tenantId: string): Promise<boolean>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCOPE (User-accessible units)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get organization units accessible by user
   * 
   * Returns units based on user's role/scope:
   * - HQ Admin: ALL units in tenant
   * - Regional Manager: Region + all child branches
   * - Branch Manager: Own branch only
   * 
   * NOTE: Actual permission check done by IAM Matrix.
   * This method only returns candidate units.
   * 
   * @param userId User identifier (party_id)
   * @param tenantId Tenant identifier
   * @param unitType Optional filter by type (e.g., only branches)
   * @returns Array of accessible org units
   */
  getUserAccessibleUnits(userId: string, tenantId: string, unitType?: OrgUnitType): Promise<OrgUnit[]>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════

export class OrgUnitError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'OrgUnitError';
  }
}

export class OrgUnitNotFoundError extends OrgUnitError {
  constructor(id: string) {
    super(`Organization unit not found: ${id}`, 'ORG_UNIT_NOT_FOUND');
  }
}

export class OrgUnitParentNotFoundError extends OrgUnitError {
  constructor(parentId: string) {
    super(`Parent organization unit not found: ${parentId}`, 'ORG_UNIT_PARENT_NOT_FOUND');
  }
}

export class OrgUnitCodeConflictError extends OrgUnitError {
  constructor(code: string, tenantId: string) {
    super(`Organization unit code already exists: ${code} in tenant ${tenantId}`, 'ORG_UNIT_CODE_CONFLICT');
  }
}

export class OrgUnitCircularReferenceError extends OrgUnitError {
  constructor(unitId: string, parentId: string) {
    super(`Circular reference detected: unit ${unitId} cannot have parent ${parentId}`, 'ORG_UNIT_CIRCULAR_REFERENCE');
  }
}

export class OrgUnitTenantMismatchError extends OrgUnitError {
  constructor(unitId: string, parentId: string) {
    super(`Tenant mismatch: unit ${unitId} and parent ${parentId} belong to different tenants`, 'ORG_UNIT_TENANT_MISMATCH');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export { orgUnitEngine, createOrgUnitEngine, createOrgUnitEngineForClient } from './org-unit.engine';
export type { IOrgUnitRepository, OrgUnitDatabase } from './org-unit.repository';

