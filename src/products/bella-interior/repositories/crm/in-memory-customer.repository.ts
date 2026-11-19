/**
 * Bella Interior OS — In-Memory Customer Repository
 * Phase B: Customer Domain Foundation
 *
 * Implements strict tenant isolation, alias resolution with cycle detection,
 * and comprehensive relationship tracking in pure memory.
 *
 * @module src/products/bella-interior/repositories/crm/in-memory-customer.repository
 */

import { randomUUID } from 'crypto';
import type { ICustomerRepository } from './customer-repository.interface';
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
import {
  TenantIsolationViolationError,
  CustomerNotFoundError,
  DuplicateCustomerCodeError,
  CustomerAlreadyMergedError,
  CustomerMergeCycleDetectedError,
  CustomerDeleteForbiddenError,
} from '../../domain/crm/customer-errors';

interface TenantCustomerStore {
  profiles: Map<string, CustomerProfile>;
  contacts: Map<string, CustomerContact>;
  addresses: Map<string, CustomerAddress>;
  aliases: Map<string, CustomerAlias>; // key: aliasCustomerId
  mergeLogs: CustomerMergeLog[];
  codeSequence: number;
}

export class InMemoryCustomerRepository implements ICustomerRepository {
  private readonly stores = new Map<string, TenantCustomerStore>();

  private getStore(tenantId: string): TenantCustomerStore {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError('tenantId is required for customer repository operations');
    }
    let store = this.stores.get(tenantId);
    if (!store) {
      store = {
        profiles: new Map(),
        contacts: new Map(),
        addresses: new Map(),
        aliases: new Map(),
        mergeLogs: [],
        codeSequence: 1,
      };
      this.stores.set(tenantId, store);
    }
    return store;
  }

  // ─── Customer Profiles ────────────────────────────────────────────────────────

  async findById(tenantId: string, id: string): Promise<CustomerProfile | null> {
    const store = this.getStore(tenantId);
    return store.profiles.get(id) ?? null;
  }

  async findByCode(tenantId: string, code: string): Promise<CustomerProfile | null> {
    const store = this.getStore(tenantId);
    for (const profile of store.profiles.values()) {
      if (profile.code.toLowerCase() === code.trim().toLowerCase()) {
        return profile;
      }
    }
    return null;
  }

  async list(
    tenantId: string,
    filter?: { profileStatus?: CustomerProfileStatus; search?: string }
  ): Promise<readonly CustomerProfile[]> {
    const store = this.getStore(tenantId);
    let list = Array.from(store.profiles.values());

    if (filter?.profileStatus) {
      list = list.filter((p) => p.profileStatus === filter.profileStatus);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.primaryPhone && p.primaryPhone.includes(q)) ||
          (p.primaryEmail && p.primaryEmail.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(tenantId: string, input: CreateCustomerInput): Promise<CustomerProfile> {
    const store = this.getStore(tenantId);
    const now = new Date().toISOString();

    const code = input.code
      ? input.code.trim().toUpperCase()
      : `KH-${String(store.codeSequence++).padStart(6, '0')}`;

    // Verify code uniqueness in this tenant
    for (const existing of store.profiles.values()) {
      if (existing.code.toLowerCase() === code.toLowerCase()) {
        throw new DuplicateCustomerCodeError(code, tenantId);
      }
    }

    const profile: CustomerProfile = {
      id: randomUUID(),
      tenantId,
      code,
      name: input.name.trim(),
      legalName: input.legalName?.trim(),
      taxCode: input.taxCode?.trim(),
      type: input.type ?? 'individual',
      tier: input.tier ?? 'standard',
      profileStatus: 'active',
      primaryPhone: input.primaryPhone?.trim(),
      primaryEmail: input.primaryEmail?.trim(),
      notes: input.notes?.trim(),
      assignedStaffId: input.assignedStaffId,
      createdAt: now,
      updatedAt: now,
    };

    store.profiles.set(profile.id, profile);
    return profile;
  }

  async update(tenantId: string, id: string, input: UpdateCustomerInput): Promise<CustomerProfile> {
    const store = this.getStore(tenantId);
    const existing = store.profiles.get(id);

    if (!existing) {
      throw new CustomerNotFoundError(id);
    }

    if (existing.profileStatus === 'merged') {
      throw new CustomerAlreadyMergedError(id, existing.mergedIntoId ?? 'unknown');
    }

    const now = new Date().toISOString();
    const updated: CustomerProfile = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      legalName: input.legalName !== undefined ? input.legalName.trim() : existing.legalName,
      taxCode: input.taxCode !== undefined ? input.taxCode.trim() : existing.taxCode,
      type: input.type ?? existing.type,
      tier: input.tier ?? existing.tier,
      profileStatus: input.profileStatus ?? existing.profileStatus,
      primaryPhone: input.primaryPhone !== undefined ? input.primaryPhone.trim() : existing.primaryPhone,
      primaryEmail: input.primaryEmail !== undefined ? input.primaryEmail.trim() : existing.primaryEmail,
      notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
      assignedStaffId: input.assignedStaffId !== undefined ? input.assignedStaffId : existing.assignedStaffId,
      updatedAt: now,
    };

    store.profiles.set(id, updated);
    return updated;
  }

  async archive(tenantId: string, id: string): Promise<CustomerProfile> {
    return this.update(tenantId, id, { profileStatus: 'inactive' });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const store = this.getStore(tenantId);
    const existing = store.profiles.get(id);
    if (!existing) {
      throw new CustomerNotFoundError(id);
    }

    const hasAliases = store.aliases.has(id) || Array.from(store.aliases.values()).some((a) => a.canonicalCustomerId === id);
    const hasMerges = store.mergeLogs.some((m) => m.sourceCustomerId === id || m.targetCustomerId === id);
    if (hasAliases || hasMerges) {
      throw new CustomerDeleteForbiddenError(id, 'Customer has associated merge audit history. Set profile_status to inactive or merged instead.');
    }

    store.profiles.delete(id);
    for (const [cId, contact] of store.contacts.entries()) {
      if (contact.customerId === id) store.contacts.delete(cId);
    }
    for (const [aId, address] of store.addresses.entries()) {
      if (address.customerId === id) store.addresses.delete(aId);
    }
    return true;
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────────

  async listContacts(tenantId: string, customerId: string): Promise<readonly CustomerContact[]> {
    const store = this.getStore(tenantId);
    return Array.from(store.contacts.values())
      .filter((c) => c.customerId === customerId)
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  }

  async addContact(
    tenantId: string,
    customerId: string,
    input: Omit<CustomerContact, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomerContact> {
    const store = this.getStore(tenantId);
    const customer = store.profiles.get(customerId);
    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    const now = new Date().toISOString();
    const contact: CustomerContact = {
      id: randomUUID(),
      tenantId,
      customerId,
      name: input.name.trim(),
      role: input.role,
      phone: input.phone.trim(),
      email: input.email?.trim(),
      position: input.position?.trim(),
      isPrimary: input.isPrimary ?? false,
      createdAt: now,
      updatedAt: now,
    };

    // If marked primary, unmark other primary contacts for this customer
    if (contact.isPrimary) {
      for (const existing of store.contacts.values()) {
        if (existing.customerId === customerId && existing.isPrimary) {
          store.contacts.set(existing.id, { ...existing, isPrimary: false, updatedAt: now });
        }
      }
    }

    store.contacts.set(contact.id, contact);
    return contact;
  }

  async updateContact(
    tenantId: string,
    contactId: string,
    input: Partial<Omit<CustomerContact, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerContact> {
    const store = this.getStore(tenantId);
    const existing = store.contacts.get(contactId);
    if (!existing) {
      throw new Error(`Customer contact not found: ${contactId}`);
    }

    const now = new Date().toISOString();
    const updated: CustomerContact = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      role: input.role ?? existing.role,
      phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
      email: input.email !== undefined ? input.email.trim() : existing.email,
      position: input.position !== undefined ? input.position.trim() : existing.position,
      isPrimary: input.isPrimary !== undefined ? input.isPrimary : existing.isPrimary,
      updatedAt: now,
    };

    if (updated.isPrimary && !existing.isPrimary) {
      for (const item of store.contacts.values()) {
        if (item.customerId === existing.customerId && item.id !== contactId && item.isPrimary) {
          store.contacts.set(item.id, { ...item, isPrimary: false, updatedAt: now });
        }
      }
    }

    store.contacts.set(contactId, updated);
    return updated;
  }

  async removeContact(tenantId: string, contactId: string): Promise<boolean> {
    const store = this.getStore(tenantId);
    return store.contacts.delete(contactId);
  }

  // ─── Addresses ────────────────────────────────────────────────────────────────

  async listAddresses(tenantId: string, customerId: string): Promise<readonly CustomerAddress[]> {
    const store = this.getStore(tenantId);
    return Array.from(store.addresses.values())
      .filter((a) => a.customerId === customerId)
      .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }

  async addAddress(
    tenantId: string,
    customerId: string,
    input: Omit<CustomerAddress, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomerAddress> {
    const store = this.getStore(tenantId);
    const customer = store.profiles.get(customerId);
    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    const now = new Date().toISOString();
    const address: CustomerAddress = {
      id: randomUUID(),
      tenantId,
      customerId,
      addressType: input.addressType,
      fullAddress: input.fullAddress.trim(),
      ward: input.ward?.trim(),
      district: input.district?.trim(),
      city: input.city.trim(),
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };

    if (address.isDefault) {
      for (const existing of store.addresses.values()) {
        if (existing.customerId === customerId && existing.isDefault) {
          store.addresses.set(existing.id, { ...existing, isDefault: false, updatedAt: now });
        }
      }
    }

    store.addresses.set(address.id, address);
    return address;
  }

  async updateAddress(
    tenantId: string,
    addressId: string,
    input: Partial<Omit<CustomerAddress, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerAddress> {
    const store = this.getStore(tenantId);
    const existing = store.addresses.get(addressId);
    if (!existing) {
      throw new Error(`Customer address not found: ${addressId}`);
    }

    const now = new Date().toISOString();
    const updated: CustomerAddress = {
      ...existing,
      addressType: input.addressType ?? existing.addressType,
      fullAddress: input.fullAddress !== undefined ? input.fullAddress.trim() : existing.fullAddress,
      ward: input.ward !== undefined ? input.ward.trim() : existing.ward,
      district: input.district !== undefined ? input.district.trim() : existing.district,
      city: input.city !== undefined ? input.city.trim() : existing.city,
      isDefault: input.isDefault !== undefined ? input.isDefault : existing.isDefault,
      updatedAt: now,
    };

    if (updated.isDefault && !existing.isDefault) {
      for (const item of store.addresses.values()) {
        if (item.customerId === existing.customerId && item.id !== addressId && item.isDefault) {
          store.addresses.set(item.id, { ...item, isDefault: false, updatedAt: now });
        }
      }
    }

    store.addresses.set(addressId, updated);
    return updated;
  }

  async removeAddress(tenantId: string, addressId: string): Promise<boolean> {
    const store = this.getStore(tenantId);
    return store.addresses.delete(addressId);
  }

  // ─── Aliases & Merge Resolution ───────────────────────────────────────────────

  async resolveCanonicalId(tenantId: string, idOrAlias: string): Promise<string> {
    const store = this.getStore(tenantId);
    let currentId = idOrAlias;
    const visited = new Set<string>();

    while (store.aliases.has(currentId)) {
      if (visited.has(currentId)) {
        throw new CustomerMergeCycleDetectedError(idOrAlias, currentId);
      }
      visited.add(currentId);
      const alias = store.aliases.get(currentId)!;
      currentId = alias.canonicalCustomerId;
    }

    return currentId;
  }

  async transferRelationships(
    tenantId: string,
    sourceCustomerId: string,
    targetCustomerId: string
  ): Promise<{ contactsTransferred: number; addressesTransferred: number }> {
    const store = this.getStore(tenantId);
    const now = new Date().toISOString();

    let contactsTransferred = 0;
    for (const [id, contact] of store.contacts.entries()) {
      if (contact.customerId === sourceCustomerId) {
        store.contacts.set(id, {
          ...contact,
          customerId: targetCustomerId,
          isPrimary: false,
          updatedAt: now,
        });
        contactsTransferred++;
      }
    }

    let addressesTransferred = 0;
    for (const [id, address] of store.addresses.entries()) {
      if (address.customerId === sourceCustomerId) {
        store.addresses.set(id, {
          ...address,
          customerId: targetCustomerId,
          isDefault: false,
          updatedAt: now,
        });
        addressesTransferred++;
      }
    }

    return { contactsTransferred, addressesTransferred };
  }

  async recordMerge(
    tenantId: string,
    mergeInput: Omit<CustomerMergeLog, 'id' | 'mergedAt'>
  ): Promise<CustomerMergeLog> {
    const store = this.getStore(tenantId);
    const now = new Date().toISOString();

    const mergeLog: CustomerMergeLog = {
      id: randomUUID(),
      tenantId,
      sourceCustomerId: mergeInput.sourceCustomerId,
      targetCustomerId: mergeInput.targetCustomerId,
      actorId: mergeInput.actorId,
      reason: mergeInput.reason,
      contactsTransferredCount: mergeInput.contactsTransferredCount,
      addressesTransferredCount: mergeInput.addressesTransferredCount,
      mergedAt: now,
    };

    // 1. Create Alias mapping
    const alias: CustomerAlias = {
      id: randomUUID(),
      tenantId,
      aliasCustomerId: mergeInput.sourceCustomerId,
      canonicalCustomerId: mergeInput.targetCustomerId,
      createdAt: now,
    };
    store.aliases.set(alias.aliasCustomerId, alias);

    // 2. Re-point any previous aliases that mapped to sourceCustomerId to now point to targetCustomerId
    for (const [key, existingAlias] of store.aliases.entries()) {
      if (existingAlias.canonicalCustomerId === mergeInput.sourceCustomerId) {
        store.aliases.set(key, {
          ...existingAlias,
          canonicalCustomerId: mergeInput.targetCustomerId,
        });
      }
    }

    store.mergeLogs.push(mergeLog);
    return mergeLog;
  }

  async getMergeLogs(tenantId: string, customerId: string): Promise<readonly CustomerMergeLog[]> {
    const store = this.getStore(tenantId);
    return store.mergeLogs.filter(
      (log) => log.sourceCustomerId === customerId || log.targetCustomerId === customerId
    );
  }

  async getAliases(tenantId: string, canonicalId: string): Promise<readonly CustomerAlias[]> {
    const store = this.getStore(tenantId);
    return Array.from(store.aliases.values()).filter(
      (alias) => alias.canonicalCustomerId === canonicalId
    );
  }

  // ─── Financial Projection ─────────────────────────────────────────────────────

  async getFinancialProjection(
    tenantId: string,
    customerId: string
  ): Promise<CustomerFinancialProjection | null> {
    const store = this.getStore(tenantId);
    const customer = store.profiles.get(customerId);
    if (!customer) return null;

    // Projected stub from Commercial / Finance
    return {
      customerId,
      tenantId,
      totalContractValue: 0,
      totalPaidAmount: 0,
      receivableDebt: 0,
      asOfDate: new Date().toISOString(),
    };
  }
}
