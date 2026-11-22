/**
 * Bella Interior OS — Customer Merge Domain Service
 * Phase B: Customer Domain Foundation
 *
 * Implements atomic customer merge with complete relationship preservation,
 * alias registration, cycle detection, and audit logging.
 *
 * @module src/products/bella-interior/services/crm/customer-merge.service
 */

import type { ICustomerRepository } from '../../repositories/crm/customer-repository.interface';
import type { CustomerMergeLog } from '../../domain/crm/customer.types';
import {
  CustomerNotFoundError,
  CustomerMergeSelfError,
  CustomerAlreadyMergedError,
  CustomerMergeCrossTenantError,
  CustomerMergeCycleDetectedError,
  TenantIsolationViolationError,
} from '../../domain/crm/customer-errors';

export interface MergeCustomerResult {
  readonly success: boolean;
  readonly sourceCustomerId: string;
  readonly targetCustomerId: string;
  readonly contactsTransferred: number;
  readonly addressesTransferred: number;
  readonly mergeLog: CustomerMergeLog;
}

export class CustomerMergeService {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  /**
   * Execute an atomic merge of source customer into target customer.
   */
  async mergeCustomers(params: {
    tenantId: string;
    sourceCustomerId: string;
    targetCustomerId: string;
    reason: string;
    actorId: string;
  }): Promise<MergeCustomerResult> {
    const { tenantId, sourceCustomerId, targetCustomerId, reason, actorId } = params;

    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError('tenantId is required for customer merge operations.');
    }

    if (sourceCustomerId === targetCustomerId) {
      throw new CustomerMergeSelfError(sourceCustomerId);
    }

    // 1. Fetch both customer profiles
    const source = await this.customerRepo.findById(tenantId, sourceCustomerId);
    if (!source) {
      throw new CustomerNotFoundError(sourceCustomerId);
    }

    const target = await this.customerRepo.findById(tenantId, targetCustomerId);
    if (!target) {
      throw new CustomerNotFoundError(targetCustomerId);
    }

    // 2. Validate tenant consistency
    if (source.tenantId !== tenantId || target.tenantId !== tenantId) {
      throw new CustomerMergeCrossTenantError(source.tenantId, target.tenantId);
    }

    // 3. Validate merged status
    if (source.profileStatus === 'merged') {
      throw new CustomerAlreadyMergedError(sourceCustomerId, source.mergedIntoId ?? 'unknown');
    }

    if (target.profileStatus === 'merged') {
      throw new CustomerAlreadyMergedError(targetCustomerId, target.mergedIntoId ?? 'unknown');
    }

    // 4. Validate cycle prevention: Ensure target does not already alias to source
    const canonicalOfTarget = await this.customerRepo.resolveCanonicalId(tenantId, targetCustomerId);
    if (canonicalOfTarget === sourceCustomerId) {
      throw new CustomerMergeCycleDetectedError(sourceCustomerId, targetCustomerId);
    }

    // 5. All persistent changes are committed by one database operation.
    const { contactsTransferred, addressesTransferred, mergeLog } = await this.customerRepo.mergeAtomically(tenantId, {
        sourceCustomerId,
        targetCustomerId,
        actorId,
        reason,
    });

    return {
      success: true,
      sourceCustomerId,
      targetCustomerId,
      contactsTransferred,
      addressesTransferred,
      mergeLog,
    };
  }
}
