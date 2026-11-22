/**
 * Bella Interior OS — Supabase Customer Repository Implementation
 * Phase C1: Customer Persistence Design & Simulation
 *
 * Implements ICustomerRepository for PostgreSQL persistence via Supabase client.
 * Enforces Gate 0 Tenant Isolation on every query, atomic customer code generation,
 * and database-level merge transaction atomicity.
 *
 * @module src/products/bella-interior/repositories/crm/supabase-customer.repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
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
  CustomerTier,
  CustomerType,
  ContactRole,
  AddressType,
} from '../../domain/crm/customer.types';
import type { CustomerMergeCommand, ICustomerRepository } from './customer-repository.interface';
import {
  TenantIsolationViolationError,
  CustomerNotFoundError,
  CustomerMergeCycleDetectedError,
  DirectFinancialMutationError,
  CustomerDeleteForbiddenError,
  CustomerPrimaryContactConflictError,
  CustomerDefaultAddressConflictError,
  CustomerMergeRelationshipConflictError,
} from '../../domain/crm/customer-errors';

// Raw Database Row Interfaces
interface CustomerRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  legal_name: string | null;
  tax_code: string | null;
  type: CustomerType;
  tier: CustomerTier;
  profile_status: CustomerProfileStatus;
  merged_into_id: string | null;
  primary_phone: string | null;
  primary_email: string | null;
  notes: string | null;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string;
  role: ContactRole;
  phone: string;
  email: string | null;
  position: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface AddressRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  address_type: AddressType;
  full_address: string;
  ward: string | null;
  district: string | null;
  city: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface AliasRow {
  id: string;
  tenant_id: string;
  source_customer_id: string;
  target_customer_id: string;
  created_at: string;
}

interface MergeLogRow {
  id: string;
  tenant_id: string;
  source_customer_id: string;
  target_customer_id: string;
  actor_id: string | null;
  reason: string;
  contacts_transferred_count: number;
  addresses_transferred_count: number;
  merged_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueConstraint(error: unknown, constraint: string): boolean {
  if (!isRecord(error)) return false;
  return error.code === '23505' &&
    [error.message, error.details].some((value) => typeof value === 'string' && value.includes(constraint));
}

export class SupabaseCustomerRepository implements ICustomerRepository {
  constructor(private readonly client: SupabaseClient) {}

  private assertTenant(tenantId: string): void {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError('Tenant ID is required for all customer repository operations');
    }
  }

  // ─── Row Mappers ─────────────────────────────────────────────────────────────

  private mapCustomer(row: CustomerRow): CustomerProfile {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      legalName: row.legal_name ?? undefined,
      taxCode: row.tax_code ?? undefined,
      type: row.type,
      tier: row.tier,
      profileStatus: row.profile_status,
      mergedIntoId: row.merged_into_id ?? undefined,
      primaryPhone: row.primary_phone ?? undefined,
      primaryEmail: row.primary_email ?? undefined,
      notes: row.notes ?? undefined,
      assignedStaffId: row.assigned_staff_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapContact(row: ContactRow): CustomerContact {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      name: row.name,
      role: row.role,
      phone: row.phone,
      email: row.email ?? undefined,
      position: row.position ?? undefined,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAddress(row: AddressRow): CustomerAddress {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      addressType: row.address_type,
      fullAddress: row.full_address,
      ward: row.ward ?? undefined,
      district: row.district ?? undefined,
      city: row.city,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAlias(row: AliasRow): CustomerAlias {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      aliasCustomerId: row.source_customer_id,
      canonicalCustomerId: row.target_customer_id,
      createdAt: row.created_at,
    };
  }

  private mapMergeLog(row: MergeLogRow): CustomerMergeLog {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sourceCustomerId: row.source_customer_id,
      targetCustomerId: row.target_customer_id,
      actorId: row.actor_id ?? 'system',
      reason: row.reason,
      contactsTransferredCount: row.contacts_transferred_count,
      addressesTransferredCount: row.addresses_transferred_count,
      mergedAt: row.merged_at,
    };
  }

  // ─── Profiles ────────────────────────────────────────────────────────────────

  async findById(tenantId: string, id: string): Promise<CustomerProfile | null> {
    this.assertTenant(tenantId);

    const { data, error } = await this.client
      .from('interior_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.mapCustomer(data as CustomerRow);
  }

  async findByCode(tenantId: string, code: string): Promise<CustomerProfile | null> {
    this.assertTenant(tenantId);

    const { data, error } = await this.client
      .from('interior_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('code', code)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.mapCustomer(data as CustomerRow);
  }

  async list(
    tenantId: string,
    filter?: { profileStatus?: CustomerProfileStatus; search?: string }
  ): Promise<readonly CustomerProfile[]> {
    this.assertTenant(tenantId);

    let query = this.client
      .from('interior_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filter?.profileStatus) {
      query = query.eq('profile_status', filter.profileStatus);
    }

    if (filter?.search && filter.search.trim() !== '') {
      const term = `%${filter.search.trim()}%`;
      query = query.or(`name.ilike.${term},code.ilike.${term},primary_phone.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data as CustomerRow[]).map((r) => this.mapCustomer(r));
  }

  async create(tenantId: string, input: CreateCustomerInput): Promise<CustomerProfile> {
    this.assertTenant(tenantId);

    // Chặn tuyệt đối ghi dữ liệu tài chính
    const raw = input as unknown as Record<string, unknown>;
    const financialKeys = ['totalContractValue', 'totalPaidAmount', 'receivableDebt', 'debt'];
    for (const key of financialKeys) {
      if (key in raw) {
        throw new DirectFinancialMutationError(key);
      }
    }

    // Sinh mã an toàn theo sequence nếu input không cấp
    let code = input.code;
    if (!code || code.trim() === '') {
      const { data: codeData, error: codeErr } = await this.client.rpc('interior_generate_customer_code', {
        p_tenant_id: tenantId,
      });
      if (codeErr) throw codeErr;
      code = codeData as string;
    }

    const insertPayload = {
      tenant_id: tenantId,
      code,
      name: input.name,
      legal_name: input.legalName ?? null,
      tax_code: input.taxCode ?? null,
      type: input.type ?? 'individual',
      tier: input.tier ?? 'standard',
      primary_phone: input.primaryPhone ?? null,
      primary_email: input.primaryEmail ?? null,
      notes: input.notes ?? null,
      assigned_staff_id: input.assignedStaffId ?? null,
    };

    const { data, error } = await this.client
      .from('interior_customers')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;

    return this.mapCustomer(data as CustomerRow);
  }

  async update(tenantId: string, id: string, input: UpdateCustomerInput): Promise<CustomerProfile> {
    this.assertTenant(tenantId);

    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new CustomerNotFoundError(id);
    }

    // Chặn tuyệt đối ghi dữ liệu tài chính
    const raw = input as unknown as Record<string, unknown>;
    const financialKeys = ['totalContractValue', 'totalPaidAmount', 'receivableDebt', 'debt'];
    for (const key of financialKeys) {
      if (key in raw) {
        throw new DirectFinancialMutationError(key);
      }
    }

    const updatePayload: Record<string, unknown> = {};

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.legalName !== undefined) updatePayload.legal_name = input.legalName;
    if (input.taxCode !== undefined) updatePayload.tax_code = input.taxCode;
    if (input.type !== undefined) updatePayload.type = input.type;
    if (input.tier !== undefined) updatePayload.tier = input.tier;
    if (input.profileStatus !== undefined) updatePayload.profile_status = input.profileStatus;
    if (input.primaryPhone !== undefined) updatePayload.primary_phone = input.primaryPhone;
    if (input.primaryEmail !== undefined) updatePayload.primary_email = input.primaryEmail;
    if (input.notes !== undefined) updatePayload.notes = input.notes;
    if (input.assignedStaffId !== undefined) updatePayload.assigned_staff_id = input.assignedStaffId;

    if (Object.keys(updatePayload).length === 0) return existing;

    const { data, error } = await this.client
      .from('interior_customers')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return this.mapCustomer(data as CustomerRow);
  }

  async archive(tenantId: string, id: string): Promise<CustomerProfile> {
    this.assertTenant(tenantId);
    return this.update(tenantId, id, { profileStatus: 'inactive' });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    this.assertTenant(tenantId);
    throw new CustomerDeleteForbiddenError(
      id,
      'CUSTOMER_HARD_DELETE_PROHIBITED: Bella Interior preserves all customer historical data. Use archive instead.'
    );
  }

  // ─── Contacts ────────────────────────────────────────────────────────────────

  async listContacts(tenantId: string, customerId: string): Promise<readonly CustomerContact[]> {
    this.assertTenant(tenantId);

    const { data, error } = await this.client
      .from('interior_customer_contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false });

    if (error) throw error;

    return (data as ContactRow[]).map((r) => this.mapContact(r));
  }

  async addContact(
    tenantId: string,
    customerId: string,
    input: Omit<CustomerContact, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomerContact> {
    this.assertTenant(tenantId);

    const payload = {
      tenant_id: tenantId,
      customer_id: customerId,
      name: input.name,
      role: input.role,
      phone: input.phone,
      email: input.email ?? null,
      position: input.position ?? null,
      is_primary: input.isPrimary ?? false,
    };

    const { data, error } = await this.client
      .from('interior_customer_contacts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (isUniqueConstraint(error, 'uq_interior_customer_contacts_one_primary')) {
        throw new CustomerPrimaryContactConflictError();
      }
      throw error;
    }

    return this.mapContact(data as ContactRow);
  }

  async updateContact(
    tenantId: string,
    contactId: string,
    input: Partial<Omit<CustomerContact, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerContact> {
    this.assertTenant(tenantId);

    const { data: existing, error: getErr } = await this.client
      .from('interior_customer_contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', contactId)
      .maybeSingle();

    if (getErr) throw getErr;
    if (!existing) {
      throw new Error(`Contact ${contactId} not found in tenant ${tenantId}`);
    }

    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.role !== undefined) payload.role = input.role;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.email !== undefined) payload.email = input.email;
    if (input.position !== undefined) payload.position = input.position;
    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from('interior_customer_contacts')
        .update(payload)
        .eq('tenant_id', tenantId)
        .eq('id', contactId);
      if (error) throw error;
    }

    if (input.isPrimary === true || (input.isPrimary === false && (existing as ContactRow).is_primary)) {
      const { error } = await this.client.rpc('interior_set_primary_contact', {
        p_customer_id: existing.customer_id,
        p_contact_id: input.isPrimary ? contactId : null,
      });
      if (error) {
        if (isUniqueConstraint(error, 'uq_interior_customer_contacts_one_primary')) {
          throw new CustomerPrimaryContactConflictError();
        }
        throw error;
      }
    }

    const { data, error } = await this.client
      .from('interior_customer_contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', contactId)
      .single();
    if (error) throw error;
    return this.mapContact(data as ContactRow);
  }

  async removeContact(tenantId: string, contactId: string): Promise<boolean> {
    this.assertTenant(tenantId);

    const { error } = await this.client
      .from('interior_customer_contacts')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', contactId);

    if (error) throw error;
    return true;
  }

  // ─── Addresses ───────────────────────────────────────────────────────────────

  async listAddresses(tenantId: string, customerId: string): Promise<readonly CustomerAddress[]> {
    this.assertTenant(tenantId);

    const { data, error } = await this.client
      .from('interior_customer_addresses')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false });

    if (error) throw error;

    return (data as AddressRow[]).map((r) => this.mapAddress(r));
  }

  async addAddress(
    tenantId: string,
    customerId: string,
    input: Omit<CustomerAddress, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomerAddress> {
    this.assertTenant(tenantId);

    const payload = {
      tenant_id: tenantId,
      customer_id: customerId,
      address_type: input.addressType,
      full_address: input.fullAddress,
      ward: input.ward ?? null,
      district: input.district ?? null,
      city: input.city,
      is_default: input.isDefault ?? false,
    };

    const { data, error } = await this.client
      .from('interior_customer_addresses')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (isUniqueConstraint(error, 'uq_interior_customer_addresses_one_default')) {
        throw new CustomerDefaultAddressConflictError();
      }
      throw error;
    }

    return this.mapAddress(data as AddressRow);
  }

  async updateAddress(
    tenantId: string,
    addressId: string,
    input: Partial<Omit<CustomerAddress, 'id' | 'tenantId' | 'customerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerAddress> {
    this.assertTenant(tenantId);

    const { data: existing, error: getErr } = await this.client
      .from('interior_customer_addresses')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', addressId)
      .maybeSingle();

    if (getErr) throw getErr;
    if (!existing) {
      throw new Error(`Address ${addressId} not found in tenant ${tenantId}`);
    }

    const payload: Record<string, unknown> = {};
    if (input.addressType !== undefined) payload.address_type = input.addressType;
    if (input.fullAddress !== undefined) payload.full_address = input.fullAddress;
    if (input.ward !== undefined) payload.ward = input.ward;
    if (input.district !== undefined) payload.district = input.district;
    if (input.city !== undefined) payload.city = input.city;
    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from('interior_customer_addresses')
        .update(payload)
        .eq('tenant_id', tenantId)
        .eq('id', addressId);
      if (error) throw error;
    }

    if (input.isDefault === true || (input.isDefault === false && (existing as AddressRow).is_default)) {
      const { error } = await this.client.rpc('interior_set_default_address', {
        p_customer_id: existing.customer_id,
        p_address_id: input.isDefault ? addressId : null,
      });
      if (error) {
        if (isUniqueConstraint(error, 'uq_interior_customer_addresses_one_default')) {
          throw new CustomerDefaultAddressConflictError();
        }
        throw error;
      }
    }

    const { data, error } = await this.client
      .from('interior_customer_addresses')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', addressId)
      .single();
    if (error) throw error;
    return this.mapAddress(data as AddressRow);
  }

  async removeAddress(tenantId: string, addressId: string): Promise<boolean> {
    this.assertTenant(tenantId);

    const { error } = await this.client
      .from('interior_customer_addresses')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', addressId);

    if (error) throw error;
    return true;
  }

  // ─── Aliases & Merging ───────────────────────────────────────────────────────

  async resolveCanonicalId(tenantId: string, idOrAlias: string): Promise<string> {
    this.assertTenant(tenantId);

    let current = idOrAlias;
    const visited = new Set<string>();

    while (true) {
      if (visited.has(current)) {
        throw new CustomerMergeCycleDetectedError(idOrAlias, current);
      }
      visited.add(current);

      const { data, error } = await this.client
        .from('interior_customer_aliases')
        .select('target_customer_id')
        .eq('tenant_id', tenantId)
        .eq('source_customer_id', current)
        .maybeSingle();

      if (error) throw error;
      if (!data) break;

      current = data.target_customer_id;
    }

    return current;
  }

  async mergeAtomically(
    tenantId: string,
    merge: CustomerMergeCommand
  ): Promise<{ contactsTransferred: number; addressesTransferred: number; mergeLog: CustomerMergeLog }> {
    this.assertTenant(tenantId);
    const { data, error } = await this.client.rpc('interior_execute_customer_merge', {
      p_tenant_id: tenantId,
      p_source_customer_id: merge.sourceCustomerId,
      p_target_customer_id: merge.targetCustomerId,
      p_reason: merge.reason,
      p_actor_id: merge.actorId,
    });
    if (error) {
      if (error.message?.includes('CUSTOMER_MERGE_PRIMARY_CONTACT_CONFLICT')) {
        throw new CustomerMergeRelationshipConflictError('primary contact');
      }
      if (error.message?.includes('CUSTOMER_MERGE_DEFAULT_ADDRESS_CONFLICT')) {
        throw new CustomerMergeRelationshipConflictError('default address');
      }
      throw error;
    }
    if (!isRecord(data) || data.success !== true || !isRecord(data.mergeLog) ||
        typeof data.contactsTransferred !== 'number' || typeof data.addressesTransferred !== 'number') {
      throw new Error('CUSTOMER_MERGE_RPC_RETURNED_INVALID_RESULT');
    }

    return {
      contactsTransferred: data.contactsTransferred,
      addressesTransferred: data.addressesTransferred,
      mergeLog: this.mapMergeLog(data.mergeLog as unknown as MergeLogRow),
    };
  }

  async getMergeLogs(tenantId: string, customerId: string): Promise<readonly CustomerMergeLog[]> {
    this.assertTenant(tenantId);

    const { data, error } = await this.client
      .from('interior_customer_merge_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`source_customer_id.eq.${customerId},target_customer_id.eq.${customerId}`)
      .order('merged_at', { ascending: false });

    if (error) throw error;

    return (data as MergeLogRow[]).map((r) => this.mapMergeLog(r));
  }

  async getAliases(tenantId: string, canonicalId: string): Promise<readonly CustomerAlias[]> {
    this.assertTenant(tenantId);

    const { data, error } = await this.client
      .from('interior_customer_aliases')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('target_customer_id', canonicalId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data as AliasRow[]).map((r) => this.mapAlias(r));
  }

  // ─── Financial Projection (Read-Only) ────────────────────────────────────────

  async getFinancialProjection(
    tenantId: string,
    customerId: string
  ): Promise<CustomerFinancialProjection | null> {
    this.assertTenant(tenantId);

    // 1. Kiểm tra tồn tại customer
    const customer = await this.findById(tenantId, customerId);
    if (!customer) return null;

    // 2. Tìm tất cả projects liên kết (thông qua customer_profile_id hoặc customer_id text cũ)
    const { data: projects, error: pErr } = await this.client
      .from('interior_projects')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .or(`customer_profile_id.eq.${customerId},customer_id.eq.${customerId}`);

    if (pErr) throw pErr;

    const projectIds = (projects ?? []).map((p: { id: string }) => p.id);

    if (projectIds.length === 0) {
      return {
        customerId,
        tenantId,
        totalContractValue: 0,
        totalPaidAmount: 0,
        receivableDebt: 0,
        asOfDate: new Date().toISOString(),
      };
    }

    // 3. Query contracts để lấy tổng giá trị hợp đồng thương mại
    const { data: contracts, error: cErr } = await this.client
      .from('interior_contracts')
      .select('id, contract_value')
      .eq('tenant_id', tenantId)
      .in('project_id', projectIds);

    if (cErr) throw cErr;

    const totalContractValue = (contracts ?? []).reduce(
      (acc: number, c: { contract_value: number }) => acc + Number(c.contract_value || 0),
      0
    );

    // 4. Query payments để lấy số tiền đã thanh toán thực tế
    const contractIds = (contracts ?? []).map((c: { id: string }) => c.id);
    let totalPaidAmount = 0;

    if (contractIds.length > 0) {
      const { data: payments, error: payErr } = await this.client
        .from('interior_contract_payment_transactions')
        .select('amount, status')
        .eq('tenant_id', tenantId)
        .in('contract_id', contractIds)
        .eq('status', 'confirmed');

      if (payErr) throw payErr;

      totalPaidAmount = (payments ?? []).reduce(
        (acc: number, p: { amount: number }) => acc + Number(p.amount || 0),
        0
      );
    }

    const receivableDebt = Math.max(0, totalContractValue - totalPaidAmount);

    return {
      customerId,
      tenantId,
      totalContractValue,
      totalPaidAmount,
      receivableDebt,
      asOfDate: new Date().toISOString(),
    };
  }
}
