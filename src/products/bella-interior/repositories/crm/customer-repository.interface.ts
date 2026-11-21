/**
 * Bella Interior OS — Customer Repository Contract
 * Phase B: Customer Domain Foundation
 *
 * @module src/products/bella-interior/repositories/crm/customer-repository.interface
 */

import type {
  CustomerProfile,
  CustomerContact,
  CustomerAddress,
  CustomerAlias,
  CustomerMergeLog,
  CustomerFinancialProjection,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerProfileStatus,
} from '../../domain/crm/customer.types';

export type CustomerMergeCommand = Pick<
  CustomerMergeLog,
  'sourceCustomerId' | 'targetCustomerId' | 'actorId' | 'reason'
>;

export interface ICustomerRepository {
  // Profiles
  findById(tenantId: string, id: string): Promise<CustomerProfile | null>;
  findByCode(tenantId: string, code: string): Promise<CustomerProfile | null>;
  list(
    tenantId: string,
    filter?: { profileStatus?: CustomerProfileStatus; search?: string }
  ): Promise<readonly CustomerProfile[]>;
  create(tenantId: string, input: CreateCustomerInput): Promise<CustomerProfile>;
  update(tenantId: string, id: string, input: UpdateCustomerInput): Promise<CustomerProfile>;
  archive(tenantId: string, id: string): Promise<CustomerProfile>;
  delete(tenantId: string, id: string): Promise<boolean>;

  // Contacts
  listContacts(tenantId: string, customerId: string): Promise<readonly CustomerContact[]>;
  addContact(
    tenantId: string,
    customerId: string,
    input: Omit<CustomerContact, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomerContact>;
  updateContact(
    tenantId: string,
    contactId: string,
    input: Partial<Omit<CustomerContact, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerContact>;
  removeContact(tenantId: string, contactId: string): Promise<boolean>;

  // Addresses
  listAddresses(tenantId: string, customerId: string): Promise<readonly CustomerAddress[]>;
  addAddress(
    tenantId: string,
    customerId: string,
    input: Omit<CustomerAddress, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomerAddress>;
  updateAddress(
    tenantId: string,
    addressId: string,
    input: Partial<Omit<CustomerAddress, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerAddress>;
  removeAddress(tenantId: string, addressId: string): Promise<boolean>;

  // Aliases & Merging
  resolveCanonicalId(tenantId: string, idOrAlias: string): Promise<string>;
  mergeAtomically(
    tenantId: string,
    merge: CustomerMergeCommand
  ): Promise<{
    contactsTransferred: number;
    addressesTransferred: number;
    mergeLog: CustomerMergeLog;
  }>;
  getMergeLogs(tenantId: string, customerId: string): Promise<readonly CustomerMergeLog[]>;
  getAliases(tenantId: string, canonicalId: string): Promise<readonly CustomerAlias[]>;

  // Financial Projection (Read-only query)
  getFinancialProjection(tenantId: string, customerId: string): Promise<CustomerFinancialProjection | null>;
}
