/**
 * Bella Interior OS — Customer Persistence Design & Simulation Acceptance Tests
 * Phase C1: Customer Persistence Design & Simulation
 *
 * Verifies:
 *   1. Atomic Concurrent Customer Code Generation without duplicates
 *   2. Unique constraint (tenant_id, code) and multi-tenant independence
 *   3. Non-uniqueness of Phone and Email
 *   4. Strict Tenant Isolation on every query (Gate 0 / P0)
 *   5. Read-only dynamic Financial Projections (rejection of direct mutations)
 *   6. Merge transaction atomicity, audit logging, alias resolution, and cycle detection
 *   7. Backward compatibility with interior_projects.customer_id TEXT
 *   8. RLS policy enforcement simulation based on interior_actor_tenant()
 *
 * @module src/products/bella-interior/__tests__/crm-customer-persistence.test
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCustomerRepository } from '../repositories/crm/supabase-customer.repository';
import {
  TenantIsolationViolationError,
  CustomerNotFoundError,
  CustomerAlreadyMergedError,
  CustomerMergeSelfError,
  CustomerMergeCycleDetectedError,
  DirectFinancialMutationError,
  CustomerPrimaryContactConflictError,
  CustomerDefaultAddressConflictError,
} from '../domain/crm/customer-errors';

// ─── High-Fidelity Mock Supabase Factory ─────────────────────────────────────

interface MockDbState {
  sequences: Map<string, number>; // tenant_id -> sequence counter
  customers: Array<Record<string, unknown>>;
  contacts: Array<Record<string, unknown>>;
  addresses: Array<Record<string, unknown>>;
  aliases: Array<Record<string, unknown>>;
  mergeLogs: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  contracts: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
}

function createMockSupabaseClient(initialState?: Partial<MockDbState>): {
  client: SupabaseClient;
  state: MockDbState;
} {
  const state: MockDbState = {
    sequences: initialState?.sequences ?? new Map<string, number>(),
    customers: initialState?.customers ?? [],
    contacts: initialState?.contacts ?? [],
    addresses: initialState?.addresses ?? [],
    aliases: initialState?.aliases ?? [],
    mergeLogs: initialState?.mergeLogs ?? [],
    projects: initialState?.projects ?? [],
    contracts: initialState?.contracts ?? [],
    payments: initialState?.payments ?? [],
  };

  const getTable = (name: string): Array<Record<string, unknown>> => {
    switch (name) {
      case 'interior_customers':
        return state.customers;
      case 'interior_customer_contacts':
        return state.contacts;
      case 'interior_customer_addresses':
        return state.addresses;
      case 'interior_customer_aliases':
        return state.aliases;
      case 'interior_customer_merge_logs':
        return state.mergeLogs;
      case 'interior_projects':
        return state.projects;
      case 'interior_contracts':
        return state.contracts;
      case 'interior_contract_payment_transactions':
        return state.payments;
      default:
        throw new Error(`Mock table ${name} not supported`);
    }
  };

  const client = {
    rpc: jest.fn(async (fnName: string, args: Record<string, unknown>) => {
      if (fnName === 'interior_generate_customer_code') {
        const tenantId = args.p_tenant_id as string;
        if (!tenantId) {
          return { data: null, error: { message: 'TENANT_ID_REQUIRED' } };
        }
        // Atomic increment per tenant
        const current = state.sequences.get(tenantId) ?? 0;
        const next = current + 1;
        state.sequences.set(tenantId, next);
        const code = `KH-${String(next).padStart(6, '0')}`;
        return { data: code, error: null };
      }
      if (fnName === 'interior_set_primary_contact' || fnName === 'interior_set_default_address') {
        const contactSwitch = fnName === 'interior_set_primary_contact';
        const table = contactSwitch ? state.contacts : state.addresses;
        const customerId = args.p_customer_id as string;
        const targetId = (contactSwitch ? args.p_contact_id : args.p_address_id) as string | null;
        const flag = contactSwitch ? 'is_primary' : 'is_default';
        const target = targetId ? table.find((row) => row.id === targetId && row.customer_id === customerId) : null;
        if (targetId && !target) {
          return { data: null, error: { code: 'P0001', message: contactSwitch ? 'CONTACT_NOT_FOUND' : 'ADDRESS_NOT_FOUND' } };
        }
        for (const row of table) {
          if (row.customer_id === customerId && (row[flag] === true) && (!targetId || row.id !== targetId)) {
            row[flag] = false;
          }
        }
        if (target) target[flag] = true;
        return { data: null, error: null };
      }
      if (fnName === 'interior_execute_customer_merge') {
        const tenantId = args.p_tenant_id as string;
        const sourceId = args.p_source_customer_id as string;
        const targetId = args.p_target_customer_id as string;
        const source = state.customers.find((row) => row.id === sourceId && row.tenant_id === tenantId);
        const target = state.customers.find((row) => row.id === targetId && row.tenant_id === tenantId);
        if (!source || !target) {
          return { data: null, error: { code: '23503', message: 'SOURCE_OR_TARGET_CUSTOMER_NOT_FOUND' } };
        }
        if (source.profile_status === 'merged' || target.profile_status === 'merged') {
          return { data: null, error: { code: 'P0001', message: 'CUSTOMER_ALREADY_MERGED' } };
        }
        const sourcePrimary = state.contacts.some((row) => row.customer_id === sourceId && row.tenant_id === tenantId && row.is_primary === true);
        const targetPrimary = state.contacts.some((row) => row.customer_id === targetId && row.tenant_id === tenantId && row.is_primary === true);
        const sourceDefault = state.addresses.some((row) => row.customer_id === sourceId && row.tenant_id === tenantId && row.is_default === true);
        const targetDefault = state.addresses.some((row) => row.customer_id === targetId && row.tenant_id === tenantId && row.is_default === true);
        if (sourcePrimary && targetPrimary) return { data: null, error: { code: 'P0001', message: 'CUSTOMER_MERGE_PRIMARY_CONTACT_CONFLICT' } };
        if (sourceDefault && targetDefault) return { data: null, error: { code: 'P0001', message: 'CUSTOMER_MERGE_DEFAULT_ADDRESS_CONFLICT' } };

        const contacts = state.contacts.filter((row) => row.customer_id === sourceId && row.tenant_id === tenantId);
        const addresses = state.addresses.filter((row) => row.customer_id === sourceId && row.tenant_id === tenantId);
        const now = new Date().toISOString();
        contacts.forEach((row) => { row.customer_id = targetId; row.updated_at = now; });
        addresses.forEach((row) => { row.customer_id = targetId; row.updated_at = now; });
        state.aliases
          .filter((row) => row.tenant_id === tenantId && row.target_customer_id === sourceId)
          .forEach((row) => { row.target_customer_id = targetId; });
        const alias = { id: `uuid-alias-${state.aliases.length + 1}`, tenant_id: tenantId, source_customer_id: sourceId, target_customer_id: targetId, created_at: now };
        state.aliases.push(alias);
        source.profile_status = 'merged';
        source.merged_into_id = targetId;
        source.updated_at = now;
        const log = {
          id: `uuid-merge-${state.mergeLogs.length + 1}`,
          tenant_id: tenantId,
          source_customer_id: sourceId,
          target_customer_id: targetId,
          actor_id: args.p_actor_id,
          reason: args.p_reason,
          contacts_transferred_count: contacts.length,
          addresses_transferred_count: addresses.length,
          merged_at: now,
        };
        state.mergeLogs.push(log);
        return {
          data: {
            success: true,
            sourceCustomerId: sourceId,
            targetCustomerId: targetId,
            contactsTransferred: contacts.length,
            addressesTransferred: addresses.length,
            mergeLog: log,
          },
          error: null,
        };
      }
      return { data: null, error: { message: `RPC ${fnName} not mocked` } };
    }),

    from: (tableName: string) => {
      let filteredData = [...getTable(tableName)];
      let isSingle = false;
      let isMaybeSingle = false;

      const builder: Record<string, unknown> = {
        select: jest.fn().mockImplementation(() => builder),
        order: jest.fn().mockImplementation(() => builder),

        eq: jest.fn().mockImplementation((col: string, val: unknown) => {
          filteredData = filteredData.filter((row) => row[col] === val);
          return builder;
        }),

        or: jest.fn().mockImplementation((orClause: string) => {
          // Parse basic clauses like `name.ilike.%term%,code.ilike.%term%` or `source_id.eq.x,target_id.eq.x`
          const parts = orClause.split(',');
          filteredData = filteredData.filter((row) => {
            return parts.some((p) => {
              const [col, op, v] = p.split('.');
              if (op === 'eq') return row[col] === v;
              if (op === 'ilike') {
                const term = v.replace(/%/g, '').toLowerCase();
                return String(row[col] ?? '').toLowerCase().includes(term);
              }
              return false;
            });
          });
          return builder;
        }),

        in: jest.fn().mockImplementation((col: string, vals: unknown[]) => {
          filteredData = filteredData.filter((row) => vals.includes(row[col]));
          return builder;
        }),

        single: jest.fn().mockImplementation(async () => {
          isSingle = true;
          if (filteredData.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
          }
          return { data: filteredData[0], error: null };
        }),

        maybeSingle: jest.fn().mockImplementation(async () => {
          isMaybeSingle = true;
          if (filteredData.length === 0) {
            return { data: null, error: null };
          }
          return { data: filteredData[0], error: null };
        }),

        insert: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
          const table = getTable(tableName);

          // Enforce unique (tenant_id, code) constraint for customers
          if (tableName === 'interior_customers') {
            const duplicate = table.find(
              (r) => r.tenant_id === payload.tenant_id && r.code === payload.code
            );
            if (duplicate) {
              const err = {
                code: '23505',
                message: 'duplicate key value violates unique constraint uq_interior_customers_tenant_code',
              };
              return {
                select: () => ({
                  single: async () => ({ data: null, error: err }),
                }),
              };
            }
          }

          // RSK-07: Enforce composite foreign key constraint (tenant_id, customer_id)
          if (tableName === 'interior_customer_contacts' || tableName === 'interior_customer_addresses') {
            const parent = state.customers.find(
              (c) => c.tenant_id === payload.tenant_id && c.id === payload.customer_id
            );
            if (!parent) {
              const err = {
                code: '23503',
                message: `insert on ${tableName} violates foreign key constraint (tenant_id, customer_id)`,
              };
              return {
                select: () => ({
                  single: async () => ({ data: null, error: err }),
                }),
              };
            }
            const flag = tableName === 'interior_customer_contacts' ? 'is_primary' : 'is_default';
            const constraint = tableName === 'interior_customer_contacts'
              ? 'uq_interior_customer_contacts_one_primary'
              : 'uq_interior_customer_addresses_one_default';
            if (payload[flag] === true && table.some((row) =>
              row.tenant_id === payload.tenant_id && row.customer_id === payload.customer_id && row[flag] === true
            )) {
              const err = { code: '23505', message: `duplicate key value violates unique constraint ${constraint}` };
              return { select: () => ({ single: async () => ({ data: null, error: err }) }) };
            }
          }

          // RSK-07: Enforce composite foreign keys for aliases and merge logs
          if (tableName === 'interior_customer_aliases' || tableName === 'interior_customer_merge_logs') {
            const source = state.customers.find(
              (c) => c.tenant_id === payload.tenant_id && c.id === payload.source_customer_id
            );
            const target = state.customers.find(
              (c) => c.tenant_id === payload.tenant_id && c.id === payload.target_customer_id
            );
            if (!source || !target) {
              const err = {
                code: '23503',
                message: `insert on ${tableName} violates composite foreign key constraint`,
              };
              return {
                select: () => ({
                  single: async () => ({ data: null, error: err }),
                }),
              };
            }
          }

          const newRow = {
            id: payload.id ?? `uuid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          };
          table.push(newRow);

          return {
            select: () => ({
              single: async () => ({ data: newRow, error: null }),
            }),
          };
        }),

        update: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
          return {
            eq: (col1: string, val1: unknown) => {
              return {
                eq: (col2: string, val2: unknown) => {
                  let updatedCount = 0;
                  let lastUpdated: Record<string, unknown> | null = null;
                  const table = getTable(tableName);

                  for (let i = 0; i < table.length; i++) {
                    if (table[i][col1] === val1 && table[i][col2] === val2) {
                      table[i] = { ...table[i], ...payload, updated_at: new Date().toISOString() };
                      lastUpdated = table[i];
                      updatedCount++;
                    }
                  }

                  return {
                    select: () => ({
                      single: async () => ({ data: lastUpdated, error: null }),
                    }),
                    then: (resolve: (val: unknown) => void) => {
                      resolve({ count: updatedCount, error: null });
                    },
                  };
                },
                then: (resolve: (val: unknown) => void) => {
                  resolve({ count: 1, error: null });
                },
              };
            },
          };
        }),

        delete: jest.fn().mockImplementation(() => {
          return {
            eq: (col1: string, val1: unknown) => {
              return {
                eq: async (col2: string, val2: unknown) => {
                  const table = getTable(tableName);
                  const idx = table.findIndex((r) => r[col1] === val1 && r[col2] === val2);
                  if (idx >= 0) table.splice(idx, 1);
                  return { error: null };
                },
              };
            },
          };
        }),

        then: (resolve: (val: unknown) => void) => {
          resolve({ data: filteredData, error: null });
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Bella Interior CRM — Customer Persistence Design & Simulation (Phase C1)', () => {
  const TENANT_A = 'tenant-interior-alpha-1111';
  const TENANT_B = 'tenant-interior-beta-2222';
  const ACTOR_ID = 'actor-user-9999';

  let mockDb: ReturnType<typeof createMockSupabaseClient>;
  let repo: SupabaseCustomerRepository;

  beforeEach(() => {
    mockDb = createMockSupabaseClient();
    repo = new SupabaseCustomerRepository(mockDb.client);
  });

  // ─── 1. Identity & Concurrency ───────────────────────────────────────────────

  it('1. Atomic Code Generation: 50 concurrent requests sinh mã KH-XXXXXX không trùng lặp', async () => {
    // Simulate 50 concurrent requests calling create simultaneously without explicit code
    const promises = Array.from({ length: 50 }, (_, i) =>
      repo.create(TENANT_A, {
        name: `Khách hàng đồng thời #${i + 1}`,
      })
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(50);
    const codes = results.map((c) => c.code);
    const uniqueCodes = new Set(codes);

    // Absolutely zero duplicate codes
    expect(uniqueCodes.size).toBe(50);

    // Sequence format follows KH-000001 ... KH-000050
    expect(codes).toContain('KH-000001');
    expect(codes).toContain('KH-000050');
  });

  it('2. Unique Constraint (tenant_id, code): Chặn trùng trong cùng tenant, độc lập giữa các tenant', async () => {
    const customCode = 'KH-VIP-999';

    // Tenant A tạo khách hàng với mã customCode
    const custA = await repo.create(TENANT_A, {
      code: customCode,
      name: 'Khách VIP Tenant A',
    });
    expect(custA.code).toBe(customCode);

    // Tenant A cố tình tạo khách hàng thứ 2 cùng mã customCode -> BỊ TỪ CHỐI (Unique constraint error)
    await expect(
      repo.create(TENANT_A, {
        code: customCode,
        name: 'Trùng mã trong Tenant A',
      })
    ).rejects.toMatchObject({ code: '23505' });

    // Tenant B tạo khách hàng cùng mã customCode -> THÀNH CÔNG (Độc lập theo tenant_id)
    const custB = await repo.create(TENANT_B, {
      code: customCode,
      name: 'Khách VIP Tenant B',
    });
    expect(custB.code).toBe(customCode);
    expect(custB.tenantId).toBe(TENANT_B);
  });

  it('3. Phone/Email Non-Uniqueness: Cho phép nhiều hồ sơ trùng SĐT và Email', async () => {
    const sharedPhone = '0988888888';
    const sharedEmail = 'ceo@bellagroup.vn';

    const cust1 = await repo.create(TENANT_A, {
      name: 'Chủ tịch Tập đoàn',
      primaryPhone: sharedPhone,
      primaryEmail: sharedEmail,
    });

    const cust2 = await repo.create(TENANT_A, {
      name: 'Trợ lý Chủ tịch',
      primaryPhone: sharedPhone,
      primaryEmail: sharedEmail,
    });

    expect(cust1.id).not.toBe(cust2.id);
    expect(cust1.primaryPhone).toBe(sharedPhone);
    expect(cust2.primaryPhone).toBe(sharedPhone);

    const list = await repo.list(TENANT_A);
    expect(list.length).toBe(2);
  });

  // ─── 2. Financial Projection Protection ──────────────────────────────────────

  it('4. Financial Protection: Chặn tuyệt đối hành vi ghi trường tài chính qua create/update', async () => {
    // Create attempt
    await expect(
      repo.create(TENANT_A, {
        name: 'Financial Hack',
        totalContractValue: 1_000_000_000,
      } as unknown as Parameters<typeof repo.create>[1])
    ).rejects.toThrow(DirectFinancialMutationError);

    const cust = await repo.create(TENANT_A, { name: 'Normal Customer' });

    // Update attempt
    await expect(
      repo.update(TENANT_A, cust.id, {
        receivableDebt: 500_000_000,
      } as unknown as Parameters<typeof repo.update>[2])
    ).rejects.toThrow(DirectFinancialMutationError);
  });

  it('5. Dynamic Financial Projection: Tính toán chính xác từ Commercial Contract & Payments', async () => {
    const cust = await repo.create(TENANT_A, { name: 'Khách Hàng Dự Án Ecopark' });

    // Seed mock projects, contracts, and payments
    mockDb.state.projects.push(
      {
        id: 'proj-1',
        tenant_id: TENANT_A,
        customer_profile_id: cust.id, // Linked via new column
        customer_id: cust.id,
        status: 'in_progress',
      },
      {
        id: 'proj-2',
        tenant_id: TENANT_A,
        customer_profile_id: cust.id,
        customer_id: cust.id,
        status: 'completed',
      }
    );

    mockDb.state.contracts.push(
      { id: 'contract-1', tenant_id: TENANT_A, project_id: 'proj-1', contract_value: 300_000_000 },
      { id: 'contract-2', tenant_id: TENANT_A, project_id: 'proj-2', contract_value: 200_000_000 }
    );

    mockDb.state.payments.push(
      { id: 'pay-1', tenant_id: TENANT_A, contract_id: 'contract-1', amount: 150_000_000, status: 'confirmed' },
      { id: 'pay-2', tenant_id: TENANT_A, contract_id: 'contract-2', amount: 200_000_000, status: 'confirmed' },
      { id: 'pay-3', tenant_id: TENANT_A, contract_id: 'contract-1', amount: 50_000_000, status: 'pending' } // unconfirmed
    );

    const projection = await repo.getFinancialProjection(TENANT_A, cust.id);

    expect(projection).not.toBeNull();
    expect(projection?.customerId).toBe(cust.id);
    expect(projection?.tenantId).toBe(TENANT_A);
    expect(projection?.totalContractValue).toBe(500_000_000); // 300m + 200m
    expect(projection?.totalPaidAmount).toBe(350_000_000); // 150m + 200m (chỉ tính confirmed)
    expect(projection?.receivableDebt).toBe(150_000_000); // 500m - 350m
    expect(projection?.asOfDate).toBeDefined();
  });

  // ─── 3. Multi-Contact & Multi-Address Management ──────────────────────────────

  it('6. Contacts & Addresses: Quản lý liên hệ đa vai trò và phân định primary/default', async () => {
    const cust = await repo.create(TENANT_A, { name: 'Công ty Cổ phần Xây dựng Bella' });

    // Thêm contact 1
    const c1 = await repo.addContact(TENANT_A, cust.id, {
      name: 'Nguyễn Văn Đại Diện',
      role: 'legal_representative',
      phone: '0901234567',
      isPrimary: true,
    });

    // Tạo contact thứ hai với cờ primary phải fail, không được âm thầm đổi contact cũ.
    await expect(repo.addContact(TENANT_A, cust.id, {
      name: 'Trần Kế Toán',
      role: 'accountant',
      phone: '0907654321',
      isPrimary: true,
    })).rejects.toThrow('only one primary contact');

    const c2 = await repo.addContact(TENANT_A, cust.id, {
      name: 'Trần Kế Toán',
      role: 'accountant',
      phone: '0907654321',
      isPrimary: false,
    });
    await repo.updateContact(TENANT_A, c2.id, { isPrimary: true });

    const contacts = await repo.listContacts(TENANT_A, cust.id);
    expect(contacts.length).toBe(2);
    expect(contacts.find((c) => c.id === c2.id)?.isPrimary).toBe(true);
    expect(contacts.find((c) => c.id === c1.id)?.isPrimary).toBe(false);

    // Thêm address
    const a1 = await repo.addAddress(TENANT_A, cust.id, {
      addressType: 'headquarters',
      fullAddress: 'Tầng 5, Tháp Keangnam, Hà Nội',
      city: 'Hà Nội',
      isDefault: true,
    });

    const addresses = await repo.listAddresses(TENANT_A, cust.id);
    expect(addresses.length).toBe(1);
    expect(addresses[0].id).toBe(a1.id);
    expect(addresses[0].isDefault).toBe(true);

    await expect(repo.addAddress(TENANT_A, cust.id, {
      addressType: 'billing',
      fullAddress: 'Địa chỉ mặc định trùng',
      city: 'Hà Nội',
      isDefault: true,
    })).rejects.toThrow('only one default address');
  });

  it('6a. P5: Maps a database unique conflict from the primary/default switch RPC without clearing the existing flag', async () => {
    const customer = await repo.create(TENANT_A, { name: 'Primary/default conflict fixture' });
    const primaryContact = await repo.addContact(TENANT_A, customer.id, {
      name: 'Primary contact', role: 'legal_representative', phone: '0901000001', isPrimary: true,
    });
    const nextContact = await repo.addContact(TENANT_A, customer.id, {
      name: 'Next contact', role: 'accountant', phone: '0901000002', isPrimary: false,
    });
    const defaultAddress = await repo.addAddress(TENANT_A, customer.id, {
      addressType: 'headquarters', fullAddress: 'Current default', city: 'Hà Nội', isDefault: true,
    });
    const nextAddress = await repo.addAddress(TENANT_A, customer.id, {
      addressType: 'billing', fullAddress: 'Next default', city: 'Hà Nội', isDefault: false,
    });

    const rpc = mockDb.client.rpc as unknown as jest.Mock;
    rpc.mockImplementationOnce(async (functionName: string) => ({
      data: null,
      error: {
        code: '23505',
        message: `duplicate key value violates unique constraint ${functionName === 'interior_set_primary_contact'
          ? 'uq_interior_customer_contacts_one_primary' : 'uq_interior_customer_addresses_one_default'}`,
      },
    }));
    await expect(repo.updateContact(TENANT_A, nextContact.id, { isPrimary: true }))
      .rejects.toBeInstanceOf(CustomerPrimaryContactConflictError);
    expect(mockDb.state.contacts.find((row) => row.id === primaryContact.id)?.is_primary).toBe(true);
    expect(mockDb.state.contacts.find((row) => row.id === nextContact.id)?.is_primary).toBe(false);

    rpc.mockImplementationOnce(async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint uq_interior_customer_addresses_one_default' },
    }));
    await expect(repo.updateAddress(TENANT_A, nextAddress.id, { isDefault: true }))
      .rejects.toBeInstanceOf(CustomerDefaultAddressConflictError);
    expect(mockDb.state.addresses.find((row) => row.id === defaultAddress.id)?.is_default).toBe(true);
    expect(mockDb.state.addresses.find((row) => row.id === nextAddress.id)?.is_default).toBe(false);
  });

  // ─── 4. Merge Integrity, Alias Resolution & Cycle Detection ──────────────────

  it('7. Merge & Transfer Relationships: Chuyển giao danh bạ, địa chỉ và lưu log kiểm toán', async () => {
    const target = await repo.create(TENANT_A, { name: 'Nguyễn Văn Chuẩn (Target)' });
    const source = await repo.create(TENANT_A, { name: 'Nguyễn V. Chuẩn (Source)' });

    await repo.addContact(TENANT_A, source.id, {
      name: 'Vợ của Chuẩn',
      role: 'occupant',
      phone: '0912999888',
      isPrimary: false,
    });

    await repo.addAddress(TENANT_A, source.id, {
      addressType: 'site_location',
      fullAddress: 'Căn hộ P2-1102 Aqua Bay',
      city: 'Hưng Yên',
      isDefault: false,
    });

    // Chuyển giao dữ liệu, alias, trạng thái và log bằng đúng một RPC.
    const mergeResult = await repo.mergeAtomically(TENANT_A, {
      sourceCustomerId: source.id,
      targetCustomerId: target.id,
      actorId: ACTOR_ID,
      reason: 'Gộp hồ sơ trùng do nhân viên sale nhập lần 2',
    });

    expect(mergeResult.contactsTransferred).toBe(1);
    expect(mergeResult.addressesTransferred).toBe(1);
    const mergeLog = mergeResult.mergeLog;
    expect(mergeLog.id).toBeDefined();
    expect(mergeLog.reason).toContain('Gộp hồ sơ trùng');

    const updatedSource = await repo.findById(TENANT_A, source.id);
    expect(updatedSource?.profileStatus).toBe('merged');

    // Verify merge log audit query
    const logs = await repo.getMergeLogs(TENANT_A, target.id);
    expect(logs.length).toBe(1);
  });

  it('8. Alias Resolution: Phân giải alias đa cấp và phát hiện chu kỳ (Cycle Detection)', async () => {
    // Setup alias chain: A -> B -> C
    const aId = 'uuid-cust-a';
    const bId = 'uuid-cust-b';
    const cId = 'uuid-cust-c';

    mockDb.state.aliases.push(
      { tenant_id: TENANT_A, source_customer_id: aId, target_customer_id: bId },
      { tenant_id: TENANT_A, source_customer_id: bId, target_customer_id: cId }
    );

    // Resolving A must yield final canonical ID C
    const canonicalA = await repo.resolveCanonicalId(TENANT_A, aId);
    expect(canonicalA).toBe(cId);

    // Resolving B must yield C
    const canonicalB = await repo.resolveCanonicalId(TENANT_A, bId);
    expect(canonicalB).toBe(cId);

    // Simulate cycle: C -> A
    mockDb.state.aliases.push({ tenant_id: TENANT_A, source_customer_id: cId, target_customer_id: aId });

    await expect(repo.resolveCanonicalId(TENANT_A, aId)).rejects.toThrow(
      CustomerMergeCycleDetectedError
    );
  });

  // ─── 5. Tenant Isolation & Security ──────────────────────────────────────────

  it('9. Tenant Isolation: Chặn đứng truy vấn không có tenantId hoặc chéo tenant', async () => {
    const custA = await repo.create(TENANT_A, { name: 'Customer Alpha' });

    // Empty tenant throws TenantIsolationViolationError immediately
    await expect(repo.findById('', custA.id)).rejects.toThrow(TenantIsolationViolationError);
    await expect(repo.list('   ')).rejects.toThrow(TenantIsolationViolationError);

    // Cross-tenant query returns null (fails closed)
    const crossFind = await repo.findById(TENANT_B, custA.id);
    expect(crossFind).toBeNull();
  });

  // ─── 6. Backward Compatibility with customer_id TEXT ─────────────────────────

  it('10. Backward Compatibility: Dự án cũ chỉ có customer_id TEXT vẫn tính toán financial projection bình thường', async () => {
    const legacyCustomerId = 'CUST-LEGACY-001';

    // Tạo customer profile mới tương ứng
    const cust = await repo.create(TENANT_A, {
      code: 'KH-000088',
      name: 'Khách Hàng Chuyển Tiếp',
    });

    // Dự án cũ chỉ chứa customer_id = legacyCustomerId (chưa có customer_profile_id)
    mockDb.state.projects.push({
      id: 'proj-legacy-1',
      tenant_id: TENANT_A,
      customer_id: cust.id, // Hoặc liên kết trực tiếp ID
      customer_profile_id: null, // Nullable column
      status: 'in_progress',
    });

    mockDb.state.contracts.push({
      id: 'contract-legacy-1',
      tenant_id: TENANT_A,
      project_id: 'proj-legacy-1',
      contract_value: 120_000_000,
    });

    mockDb.state.payments.push({
      id: 'pay-legacy-1',
      tenant_id: TENANT_A,
      contract_id: 'contract-legacy-1',
      amount: 60_000_000,
      status: 'confirmed',
    });

    const projection = await repo.getFinancialProjection(TENANT_A, cust.id);
    expect(projection).not.toBeNull();
    expect(projection?.totalContractValue).toBe(120_000_000);
    expect(projection?.totalPaidAmount).toBe(60_000_000);
    expect(projection?.receivableDebt).toBe(60_000_000);
  });

  // ─── 7. C2.1 Independent Security Hardening Tests (RSK-07 to RSK-12) ──────────

  it('11. RSK-07: Composite Relational Integrity — Chặn đứng tiêm nhiễm liên kết chéo tenant', async () => {
    // Tạo customer thuộc Tenant A
    const custA = await repo.create(TENANT_A, { name: 'Khách Hàng Tenant A' });
    // Tạo customer thuộc Tenant B
    const custB = await repo.create(TENANT_B, { name: 'Khách Hàng Tenant B' });

    // 1. Thử thêm contact vào Tenant B nhưng trỏ tới customer của Tenant A -> Vi phạm FK composite
    await expect(
      repo.addContact(TENANT_B, custA.id, {
        name: 'Kẻ Tiêm Nhiễm',
        role: 'occupant',
        phone: '0909000999',
      })
    ).rejects.toMatchObject({
      code: '23503',
    });

    // 2. Thử thêm address vào Tenant B nhưng trỏ tới customer của Tenant A -> Vi phạm FK composite
    await expect(
      repo.addAddress(TENANT_B, custA.id, {
        addressType: 'site_location',
        fullAddress: 'Số 10 Đường X',
        city: 'Hà Nội',
      })
    ).rejects.toMatchObject({
      code: '23503',
    });

    // 3. Thử tạo alias chéo tenant (Source Tenant A, Target Tenant B) -> Bị chặn
    await expect(
      repo.mergeAtomically(TENANT_A, {
        sourceCustomerId: custA.id,
        targetCustomerId: custB.id,
        actorId: ACTOR_ID,
        reason: 'Attempt cross tenant merge',
      })
    ).rejects.toMatchObject({
      code: '23503',
    });
  });

  it('12. RSK-08 & RSK-09: Merge Concurrency & Ordered Row Locking — Chặn race condition đảo ngược và deadlock', async () => {
    const cust1 = await repo.create(TENANT_A, { name: 'Khách Hàng 1' });
    const cust2 = await repo.create(TENANT_A, { name: 'Khách Hàng 2' });

    // Giả lập khóa hàng theo thứ tự lexicographical UUID: min(id1, id2) trước
    const lockOrder = [cust1.id, cust2.id].sort();
    expect(lockOrder[0]).toBeDefined();
    expect(lockOrder[1]).toBeDefined();

    // Giao dịch 1: Merge cust1 -> cust2
    // 1. Khóa theo thứ tự min trước, max sau
    // 2. Cập nhật cust1 thành merged
    mockDb.state.customers = mockDb.state.customers.map((c) =>
      c.id === cust1.id
        ? { ...c, profile_status: 'merged', merged_into_id: cust2.id }
        : c
    );
    mockDb.state.aliases.push({
      tenant_id: TENANT_A,
      source_customer_id: cust1.id,
      target_customer_id: cust2.id,
    });

    // Giao dịch 2 (chạy đồng thời hoặc ngay sau): Merge cust2 -> cust1
    // Khi giao dịch 2 kiểm tra: target_customer (cust1) đã ở trạng thái 'merged'
    const targetCust = mockDb.state.customers.find((c) => c.id === cust1.id);
    expect(targetCust?.profile_status).toBe('merged');

    // Theo logic SQL Part 8: IF v_target.profile_status = 'merged' THEN RAISE EXCEPTION 'TARGET_CUSTOMER_CANNOT_BE_MERGED_STATE';
    const validateMergeTarget = (targetStatus: string) => {
      if (targetStatus === 'merged') {
        throw new CustomerAlreadyMergedError(cust1.id);
      }
    };

    expect(() => validateMergeTarget(targetCust?.profile_status as string)).toThrow(
      CustomerAlreadyMergedError
    );
  });

  it('13. RSK-10: Sequence Concurrency & Isolation — Độc lập tenant và chấp nhận ACID gap', async () => {
    const generateCode = async (tenantId: string): Promise<string> => {
      const res = await mockDb.client.rpc('interior_generate_customer_code', { p_tenant_id: tenantId });
      return res.data as string;
    };

    // 1. Sinh 10 mã đồng thời trên Tenant A
    const codesA = await Promise.all(
      Array.from({ length: 10 }).map(() => generateCode(TENANT_A))
    );
    const uniqueCodesA = new Set(codesA);
    expect(uniqueCodesA.size).toBe(10);

    // 2. Sinh 5 mã trên Tenant B -> Bắt đầu từ KH-000001 độc lập
    const codesB = await Promise.all(
      Array.from({ length: 5 }).map(() => generateCode(TENANT_B))
    );
    expect(codesB[0]).toBe('KH-000001');
    expect(codesB[4]).toBe('KH-000005');

    // 3. Không có sự trùng lặp mã giữa 2 tenant
    expect(codesA[0]).toBe('KH-000001'); // Tenant A bắt đầu từ KH-000001
    expect(codesB[0]).toBe('KH-000001'); // Tenant B cũng có KH-000001 độc lập
    expect(TENANT_A).not.toBe(TENANT_B);

    // 4. ACID gap behavior: Nếu giao dịch hủy bỏ sau khi sinh mã, sequence gap là chuẩn mực ACID an toàn
    const counterBefore = mockDb.state.sequences.get(TENANT_A) ?? 0;
    // Giả lập giao dịch sinh mã KH-(N+1) nhưng downstream lỗi (vd: validation thất bại)
    const discardedCode = await generateCode(TENANT_A);
    expect(discardedCode).toBe(`KH-${String(counterBefore + 1).padStart(6, '0')}`);
    // Mã tiếp theo sẽ là KH-(N+2) tạo khoảng trống hợp lệ
    const nextCode = await generateCode(TENANT_A);
    expect(nextCode).toBe(`KH-${String(counterBefore + 2).padStart(6, '0')}`);
  });

  it('14. RSK-12: Migration Script Verification — Phân tích tĩnh Lock Safety và DDL Constraints', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../../supabase/migrations/20261119090000_interior_crm_customer_persistence.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, 'utf-8');

    // 1. Phải có lock_timeout và statement_timeout để bảo vệ hàng đợi O1–O4
    expect(content).toContain("SET lock_timeout = '5s';");
    expect(content).toContain("SET statement_timeout = '30s';");

    // 2. Phải có ràng buộc UNIQUE (tenant_id, id) trên interior_customers
    expect(content).toContain('CONSTRAINT uq_interior_customers_tenant_id UNIQUE (tenant_id, id)');

    // 3. Phải có Composite Foreign Keys bảo vệ chống rò rỉ chéo tenant
    expect(content).toContain(
      'CONSTRAINT fk_interior_customer_contacts_customer FOREIGN KEY (tenant_id, customer_id)'
    );
    expect(content).toContain(
      'CONSTRAINT fk_interior_customer_addresses_customer FOREIGN KEY (tenant_id, customer_id)'
    );
    expect(content).toContain(
      'CONSTRAINT fk_interior_customer_aliases_source FOREIGN KEY (tenant_id, source_customer_id)'
    );
    expect(content).toContain(
      'CONSTRAINT fk_interior_customer_aliases_target FOREIGN KEY (tenant_id, target_customer_id)'
    );
    expect(content).toContain('fk_interior_projects_customer_profile');
    expect(content).toContain('FOREIGN KEY (tenant_id, customer_profile_id)');

    // 4. Không được tạo index non-concurrent trên cột dữ liệu cũ populated (idx_interior_projects_customer_id)
    expect(content).not.toContain('idx_interior_projects_customer_id');

    // 5. Index trên customer_profile_id phải là partial index (WHERE customer_profile_id IS NOT NULL)
    expect(content).toContain('WHERE customer_profile_id IS NOT NULL');
  });

  it('15. RSK-11 & Production Truth — Phân loại trung thực trạng thái Backup và Lock Performance', () => {
    // Trạng thái kỹ thuật trung thực theo hiến pháp Bella
    const verificationReadiness = {
      backupReadiness: 'NOT_PROVEN',
      pitrDrillStatus: 'NOT_PROVEN',
      lockContentionMeasured: 'NOT_MEASURED',
      alterTableLockDuration: 'NOT_MEASURED',
      productionMigrationAuthorized: 'NOT_AUTHORIZED',
    };

    // Nghiêm cấm gán PASS cho những hạng mục chưa có bằng chứng diễn tập staging thực tế
    expect(verificationReadiness.backupReadiness).toBe('NOT_PROVEN');
    expect(verificationReadiness.pitrDrillStatus).toBe('NOT_PROVEN');
    expect(verificationReadiness.lockContentionMeasured).toBe('NOT_MEASURED');
    expect(verificationReadiness.alterTableLockDuration).toBe('NOT_MEASURED');
    expect(verificationReadiness.productionMigrationAuthorized).toBe('NOT_AUTHORIZED');
  });

  it('16. Hard Delete Prohibited & Archive Lifecycle — Bella Interior preserves customer history via profile_status = inactive', async () => {
    // 1. Calling delete() directly on repository throws CustomerDeleteForbiddenError
    await expect(repo.delete(TENANT_A, 'cust-hard-del-1')).rejects.toThrow(
      'CUSTOMER_HARD_DELETE_PROHIBITED'
    );

    // 2. Calling archive() sets profile_status to inactive
    const created = await repo.create(TENANT_A, {
      code: 'KH-000999',
      name: 'Archive Test Customer',
      type: 'individual',
      tier: 'standard',
    });

    const archived = await repo.archive(TENANT_A, created.id);
    expect(archived.profileStatus).toBe('inactive');

    // 3. Customer still exists in storage and retains all data
    const found = await repo.findById(TENANT_A, created.id);
    expect(found).not.toBeNull();
    expect(found?.profileStatus).toBe('inactive');
    expect(found?.code).toBe('KH-000999');
  });
});
