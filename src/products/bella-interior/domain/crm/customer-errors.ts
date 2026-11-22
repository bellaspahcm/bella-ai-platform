/**
 * Bella Interior OS — Customer Domain Errors
 * Phase B: Customer Domain Foundation
 *
 * @module src/products/bella-interior/domain/crm/customer-errors
 */

import { TenantIsolationViolationError } from '../errors';

export { TenantIsolationViolationError };

export class CustomerNotFoundError extends Error {
  constructor(id: string) {
    super(`Customer not found: ${id}`);
    this.name = 'CustomerNotFoundError';
  }
}

export class DuplicateCustomerCodeError extends Error {
  constructor(code: string, tenantId: string) {
    super(`Customer code '${code}' already exists in tenant ${tenantId}`);
    this.name = 'DuplicateCustomerCodeError';
  }
}

export class CustomerAlreadyMergedError extends Error {
  constructor(id: string, mergedIntoId: string) {
    super(`Customer ${id} is already merged into ${mergedIntoId} and cannot be modified or re-merged.`);
    this.name = 'CustomerAlreadyMergedError';
  }
}

export class CustomerMergeSelfError extends Error {
  constructor(id: string) {
    super(`Cannot merge customer ${id} into itself.`);
    this.name = 'CustomerMergeSelfError';
  }
}

export class CustomerMergeCycleDetectedError extends Error {
  constructor(sourceId: string, targetId: string) {
    super(`Circular merge detected: Merging ${sourceId} into ${targetId} would create an alias loop.`);
    this.name = 'CustomerMergeCycleDetectedError';
  }
}

export class CustomerMergeCrossTenantError extends Error {
  constructor(sourceTenant: string, targetTenant: string) {
    super(`Cannot merge customers across tenants: source tenant ${sourceTenant} != target tenant ${targetTenant}.`);
    this.name = 'CustomerMergeCrossTenantError';
  }
}

export class DirectFinancialMutationError extends Error {
  constructor(field: string) {
    super(`Direct mutation of financial aggregate '${field}' is strictly prohibited in CRM domain. Financial data must be projected from Commercial and Finance.`);
    this.name = 'DirectFinancialMutationError';
  }
}

export class InvalidCustomerDataError extends Error {
  constructor(message: string) {
    super(`Invalid customer data: ${message}`);
    this.name = 'InvalidCustomerDataError';
  }
}

export class CustomerPrimaryContactConflictError extends Error {
  constructor() {
    super('A customer can have only one primary contact. Switch the existing contact instead of creating another primary contact.');
    this.name = 'CustomerPrimaryContactConflictError';
  }
}

export class CustomerDefaultAddressConflictError extends Error {
  constructor() {
    super('A customer can have only one default address. Switch the existing address instead of creating another default address.');
    this.name = 'CustomerDefaultAddressConflictError';
  }
}

export class CustomerMergeRelationshipConflictError extends Error {
  constructor(relationship: 'primary contact' | 'default address') {
    super(`Cannot merge customers while both have a ${relationship}; resolve the conflict first.`);
    this.name = 'CustomerMergeRelationshipConflictError';
  }
}

export class CustomerDeleteForbiddenError extends Error {
  constructor(id: string, reason?: string) {
    super(`CUSTOMER_DELETE_FORBIDDEN: Customer ${id} cannot be hard deleted. ${reason ?? 'Set profile_status to inactive or merged instead.'}`);
    this.name = 'CustomerDeleteForbiddenError';
  }
}

