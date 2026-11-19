/**
 * Bella Interior OS — Customer Validation Domain Service
 * Phase B: Customer Domain Foundation
 *
 * Enforces business rules and invariants for customer profile inputs.
 *
 * @module src/products/bella-interior/services/crm/customer-validation.service
 */

import {
  InvalidCustomerDataError,
  DirectFinancialMutationError,
} from '../../domain/crm/customer-errors';
import type { CreateCustomerInput, UpdateCustomerInput } from '../../domain/crm/customer.types';

export class CustomerValidationService {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly PHONE_REGEX = /^[+0-9\s().-]{7,25}$/;

  /**
   * Validate customer creation payload.
   */
  public static validateCreateInput(input: CreateCustomerInput): void {
    this.assertNoFinancialFields(input as unknown as Record<string, unknown>);

    if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 2) {
      throw new InvalidCustomerDataError('Customer name must be at least 2 characters long.');
    }

    if (input.primaryEmail && !this.EMAIL_REGEX.test(input.primaryEmail.trim())) {
      throw new InvalidCustomerDataError(`Invalid primary email address: ${input.primaryEmail}`);
    }

    if (input.primaryPhone && !this.PHONE_REGEX.test(input.primaryPhone.trim())) {
      throw new InvalidCustomerDataError(`Invalid primary phone number: ${input.primaryPhone}`);
    }

    if (input.taxCode && input.taxCode.trim().length < 10) {
      throw new InvalidCustomerDataError(`Tax code must be at least 10 characters long: ${input.taxCode}`);
    }
  }

  /**
   * Validate customer update payload.
   */
  public static validateUpdateInput(input: UpdateCustomerInput): void {
    this.assertNoFinancialFields(input as unknown as Record<string, unknown>);

    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim().length < 2) {
        throw new InvalidCustomerDataError('Updated customer name must be at least 2 characters long.');
      }
    }

    if (input.profileStatus === ('merged' as unknown)) {
      throw new InvalidCustomerDataError(
        "Cannot set profileStatus to 'merged' directly via update. Customer merging must be executed via CustomerMergeService."
      );
    }

    if (input.primaryEmail && !this.EMAIL_REGEX.test(input.primaryEmail.trim())) {
      throw new InvalidCustomerDataError(`Invalid primary email address: ${input.primaryEmail}`);
    }

    if (input.primaryPhone && !this.PHONE_REGEX.test(input.primaryPhone.trim())) {
      throw new InvalidCustomerDataError(`Invalid primary phone number: ${input.primaryPhone}`);
    }

    if (input.taxCode && input.taxCode.trim().length < 10) {
      throw new InvalidCustomerDataError(`Tax code must be at least 10 characters long: ${input.taxCode}`);
    }
  }

  /**
   * Guard against CRM attempting to write to financial projections.
   */
  private static assertNoFinancialFields(raw: Record<string, unknown>): void {
    const forbiddenFields = [
      'totalContractValue',
      'totalPaidAmount',
      'receivableDebt',
      'financialSummary',
      'debt',
    ];

    for (const field of forbiddenFields) {
      if (raw[field] !== undefined) {
        throw new DirectFinancialMutationError(field);
      }
    }
  }
}
