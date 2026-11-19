/**
 * Bella Interior OS — Customer Relationship Management (CRM) Domain Types
 * Phase B: Customer Domain Foundation
 *
 * Single Source of Truth for Customer Profile, Contacts, Addresses,
 * Duplicate Detection, and Merge Records.
 *
 * Architectural Invariants:
 * 1. CustomerProfileStatus represents ONLY administrative profile status ('active' | 'inactive' | 'merged').
 * 2. Relationship states (prospect, active_project, etc.) are independent projections.
 * 3. Financial metrics are strictly read-only projections from Commercial/Finance.
 * 4. Phone numbers are NOT unique identifiers.
 *
 * @module src/products/bella-interior/domain/crm/customer.types
 */

export type CustomerType = 'individual' | 'enterprise' | 'organization';
export type CustomerTier = 'standard' | 'silver' | 'gold' | 'vip';
export type CustomerProfileStatus = 'active' | 'inactive' | 'merged';

export type ContactRole = 
  | 'primary_contact' 
  | 'legal_representative' 
  | 'decision_maker' 
  | 'payer' 
  | 'site_manager' 
  | 'occupant';

export type AddressType = 
  | 'site_location' 
  | 'billing' 
  | 'headquarters' 
  | 'private_residence';

/**
 * CustomerProfile
 * Immutable keys: id, tenantId.
 * Unique within tenant: code (e.g. KH-000128).
 * Pure CRM Identity representation.
 */
export interface CustomerProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly legalName?: string;
  readonly taxCode?: string;
  readonly type: CustomerType;
  readonly tier: CustomerTier;
  readonly profileStatus: CustomerProfileStatus;
  readonly mergedIntoId?: string; // Set when profileStatus === 'merged'
  readonly primaryPhone?: string;
  readonly primaryEmail?: string;
  readonly notes?: string;
  readonly assignedStaffId?: string;
  readonly createdAt: string; // ISO-8601
  readonly updatedAt: string; // ISO-8601
}

/**
 * CustomerFinancialProjection
 * STRICTLY READ-ONLY projection from Commercial O1 and Finance F2.
 * CRM Domain cannot directly mutate or persist these fields.
 */
export interface CustomerFinancialProjection {
  readonly customerId: string;
  readonly tenantId: string;
  readonly totalContractValue: number;
  readonly totalPaidAmount: number;
  readonly receivableDebt: number;
  readonly asOfDate: string;
}

/**
 * CustomerContact
 * 1:N multi-relationship contact person under a Customer.
 */
export interface CustomerContact {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly name: string;
  readonly role: ContactRole;
  readonly phone: string;
  readonly email?: string;
  readonly position?: string;
  readonly isPrimary: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * CustomerAddress
 * 1:N physical/legal address book under a Customer.
 */
export interface CustomerAddress {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly addressType: AddressType;
  readonly fullAddress: string;
  readonly ward?: string;
  readonly district?: string;
  readonly city: string;
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * CustomerAlias
 * Maps merged/historical customer IDs to their canonical surviving target.
 */
export interface CustomerAlias {
  readonly id: string;
  readonly tenantId: string;
  readonly aliasCustomerId: string;
  readonly canonicalCustomerId: string;
  readonly createdAt: string;
}

/**
 * CustomerMergeLog
 * Immutable audit trace for customer merge operations.
 */
export interface CustomerMergeLog {
  readonly id: string;
  readonly tenantId: string;
  readonly sourceCustomerId: string;
  readonly targetCustomerId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly contactsTransferredCount: number;
  readonly addressesTransferredCount: number;
  readonly mergedAt: string;
}

/**
 * DuplicateCandidate
 * Suggested potential duplicate detected by scoring algorithm.
 */
export interface DuplicateCandidate {
  readonly candidateCustomerId: string;
  readonly matchScore: number; // 0 - 100
  readonly matchedCriteria: readonly string[];
}

/**
 * DTO: Input for creating a customer.
 * Disallows direct input of financial values and 'merged' status.
 */
export interface CreateCustomerInput {
  readonly code?: string;
  readonly name: string;
  readonly legalName?: string;
  readonly taxCode?: string;
  readonly type?: CustomerType;
  readonly tier?: CustomerTier;
  readonly primaryPhone?: string;
  readonly primaryEmail?: string;
  readonly notes?: string;
  readonly assignedStaffId?: string;
}

/**
 * DTO: Input for updating a customer.
 * Disallows direct mutation of id, tenantId, code, and financial values.
 */
export interface UpdateCustomerInput {
  readonly name?: string;
  readonly legalName?: string;
  readonly taxCode?: string;
  readonly type?: CustomerType;
  readonly tier?: CustomerTier;
  readonly profileStatus?: 'active' | 'inactive'; // 'merged' can only be set via CustomerMergeService
  readonly primaryPhone?: string;
  readonly primaryEmail?: string;
  readonly notes?: string;
  readonly assignedStaffId?: string;
}
