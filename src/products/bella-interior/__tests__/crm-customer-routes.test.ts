/**
 * Bella Interior OS — CRM Customer API Routes Tests
 *
 * Verifies:
 * - GET /api/interior/crm/customers: Paginated overview, filtering, and search
 * - POST /api/interior/crm/customers: Customer profile creation and validation
 * - GET /api/interior/crm/customers/[id]: Customer 360 detailed aggregation
 * - Authentication & Tenant Isolation enforcement
 *
 * @module src/products/bella-interior/__tests__/crm-customer-routes.test
 */

import { NextRequest } from 'next/server';
import { GET as getCustomers, POST as createCustomer } from '@/app/api/interior/crm/customers/route';
import { POST as mergeCustomers } from '@/app/api/interior/crm/customers/merge/route';
import {
  GET as getCustomer360,
  PATCH as updateCustomer,
  DELETE as deleteCustomer,
} from '@/app/api/interior/crm/customers/[id]/route';
import {
  GET as getContacts,
  POST as addContact,
} from '@/app/api/interior/crm/customers/[id]/contacts/route';
import {
  PATCH as updateContact,
  DELETE as removeContact,
} from '@/app/api/interior/crm/customers/[id]/contacts/[contactId]/route';
import {
  GET as getAddresses,
  POST as addAddress,
} from '@/app/api/interior/crm/customers/[id]/addresses/route';
import {
  PATCH as updateAddress,
  DELETE as removeAddress,
} from '@/app/api/interior/crm/customers/[id]/addresses/[addressId]/route';
import { resolveInteriorContext } from '../lib/server-context';
import { SupabaseCustomerRepository } from '../repositories/crm/supabase-customer.repository';
import { SupabaseInteriorRepository } from '../repositories/supabase.repository';
import { Customer360AggregatorService } from '../services/crm/customer-360-aggregator.service';
import { CustomerMergeService } from '../services/crm/customer-merge.service';
import {
  CustomerDefaultAddressConflictError,
  CustomerPrimaryContactConflictError,
} from '../domain/crm/customer-errors';

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(),
}));

jest.mock('../repositories/crm/supabase-customer.repository');
jest.mock('../repositories/supabase.repository');
jest.mock('../services/crm/customer-360-aggregator.service');

const resolveContextMock = jest.mocked(resolveInteriorContext);
const CustomerRepoMock = jest.mocked(SupabaseCustomerRepository);
const InteriorRepoMock = jest.mocked(SupabaseInteriorRepository);
const AggregatorMock = jest.mocked(Customer360AggregatorService);

describe('Interior CRM Customer API Routes', () => {
  const TENANT_ID = 'tenant-test-123';

  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: TENANT_ID,
      supabase: {} as any,
    } as any);
  });

  describe('GET /api/interior/crm/customers', () => {
    it('returns 200 with paginated overview when context is valid', async () => {
      const mockResult = {
        customers: [
          {
            id: 'cust-1',
            code: 'KH-001',
            name: 'Nguyen Van A',
            avatar: '',
            type: 'individual' as const,
            typeLabel: 'Cá nhân',
            typeBadgeClass: '',
            tier: 'standard' as const,
            source: 'referral',
            sourceLabel: 'Giới thiệu',
            sourceClass: '',
            managerName: 'Admin',
            managerAvatar: '',
            opportunityCount: 1,
            projectCount: 1,
            totalValue: 1_000_000,
            totalValueFormatted: '1.000.000 ₫',
            debt: 0,
            debtFormatted: '0 ₫',
            hasDebt: false,
            lastInteractionDate: 'Vừa xong',
            status: 'transacting',
            statusLabel: 'Đang theo dự án',
            statusBadgeClass: '',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        kpis: {} as any,
        salesFunnel: {} as any,
        growthChart: {} as any,
      };

      const mockListMethod = jest.fn().mockResolvedValue(mockResult);
      AggregatorMock.prototype.listCustomersOverview = mockListMethod;

      const req = new NextRequest('https://bella.example/api/interior/crm/customers?page=1&limit=20&search=Nguyen');
      const res = await getCustomers(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.customers.length).toBe(1);
      expect(json.data.customers[0].name).toBe('Nguyen Van A');
      expect(mockListMethod).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        page: 1,
        limit: 20,
        search: 'Nguyen',
      }));
    });

    it('returns error response when authentication fails', async () => {
      resolveContextMock.mockResolvedValueOnce({
        ok: false,
        response: new Response('UNAUTHORIZED', { status: 401 }) as any,
      } as any);

      const req = new NextRequest('https://bella.example/api/interior/crm/customers');
      const res = await getCustomers(req);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/interior/crm/customers', () => {
    it('returns 201 with created customer on valid input', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'new-cust-1',
        tenantId: TENANT_ID,
        code: 'KH-002',
        name: 'Tran Thi B',
        type: 'individual',
        tier: 'silver',
        profileStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      CustomerRepoMock.prototype.create = mockCreate;

      const req = new NextRequest('https://bella.example/api/interior/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tran Thi B',
          tier: 'silver',
          primaryPhone: '0912345678',
        }),
      });

      const res = await createCustomer(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('new-cust-1');
      expect(mockCreate).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        name: 'Tran Thi B',
        tier: 'silver',
        primaryPhone: '0912345678',
      }));
    });

    it('returns 400 when customer name is missing', async () => {
      const req = new NextRequest('https://bella.example/api/interior/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: 'silver',
        }),
      });

      const res = await createCustomer(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('name is required');
    });
  });

  describe('POST /api/interior/crm/customers/merge', () => {
    it('authorizes through the resolved actor and delegates one atomic merge', async () => {
      const sourceCustomerId = '123e4567-e89b-42d3-a456-426614174000';
      const targetCustomerId = '123e4567-e89b-42d3-a456-426614174001';
      const actorId = 'actor-admin';
      const reason = 'Duplicate commercial customer record';
      resolveContextMock.mockResolvedValueOnce({
        ok: true,
        tenantId: TENANT_ID,
        supabase: {},
        actor: { id: actorId },
      } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
      const mergeSpy = jest.spyOn(CustomerMergeService.prototype, 'mergeCustomers').mockResolvedValue({
        success: true,
        sourceCustomerId,
        targetCustomerId,
        contactsTransferred: 1,
        addressesTransferred: 0,
        mergeLog: {
          id: 'merge-log-1',
          tenantId: TENANT_ID,
          sourceCustomerId,
          targetCustomerId,
          actorId,
          reason,
          contactsTransferredCount: 1,
          addressesTransferredCount: 0,
          mergedAt: '2026-11-21T00:00:00.000Z',
        },
      });

      const request = new NextRequest('https://bella.example/api/interior/crm/customers/merge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceCustomerId, targetCustomerId, reason }),
      });
      const response = await mergeCustomers(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.contactsTransferred).toBe(1);
      expect(mergeSpy).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        sourceCustomerId,
        targetCustomerId,
        reason,
        actorId,
      });
      mergeSpy.mockRestore();
    });
  });

  describe('GET /api/interior/crm/customers/[id]', () => {
    it('returns 200 with full Customer 360 profile', async () => {
      const mock360 = {
        profile: {
          id: 'cust-100',
          tenantId: TENANT_ID,
          code: 'KH-100',
          name: 'Pham Minh C',
          type: 'individual',
          tier: 'vip',
          profileStatus: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        contacts: [],
        addresses: [],
        projects: [
          {
            id: 'proj-1',
            code: 'INT-001',
            name: 'Villa Riverside',
            projectType: 'residential_villa',
            status: 'contracted',
            siteAddress: '123 River Road',
            estimatedBudget: 2_000_000_000,
            targetCompletionDate: '2026-12-31',
            leadArchitectName: 'KTS Long',
            createdAt: new Date().toISOString(),
          },
        ],
        commercial: {
          quotations: [],
          contracts: [],
          payments: [],
        },
        execution: {
          productionOrders: [],
          siteDiaries: [],
          punchListItems: [],
        },
        delivery: { handovers: [] },
        aftercare: { warrantyTickets: [] },
        financialSummary: {
          totalContractValue: 2_000_000_000,
          totalPaidAmount: 500_000_000,
          receivableDebt: 1_500_000_000,
          totalProjects: 1,
          activeProjects: 1,
          completedProjects: 0,
        },
        timeline: [],
      };

      const mockGet360 = jest.fn().mockResolvedValue(mock360);
      AggregatorMock.prototype.getCustomer360 = mockGet360;

      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100');
      const res = await getCustomer360(req, { params: Promise.resolve({ id: 'cust-100' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.profile.name).toBe('Pham Minh C');
      expect(json.data.projects.length).toBe(1);
      expect(json.data.financialSummary.receivableDebt).toBe(1_500_000_000);
      expect(mockGet360).toHaveBeenCalledWith(TENANT_ID, 'cust-100');
    });

    it('returns 404 when customer is not found', async () => {
      const mockGet360 = jest.fn().mockResolvedValue(null);
      AggregatorMock.prototype.getCustomer360 = mockGet360;

      const req = new NextRequest('https://bella.example/api/interior/crm/customers/non-existent');
      const res = await getCustomer360(req, { params: Promise.resolve({ id: 'non-existent' }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('CUSTOMER_NOT_FOUND');
    });
  });

  describe('PATCH /api/interior/crm/customers/[id]', () => {
    it('updates customer profile and returns 200', async () => {
      const mockUpdated = {
        id: 'cust-100',
        tenantId: TENANT_ID,
        code: 'KH-000100',
        name: 'Pham Minh C Updated',
        type: 'individual' as const,
        tier: 'vip' as const,
        profileStatus: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      CustomerRepoMock.prototype.update = jest.fn().mockResolvedValue(mockUpdated);

      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Pham Minh C Updated', tier: 'vip' }),
      });
      const res = await updateCustomer(req, { params: Promise.resolve({ id: 'cust-100' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Pham Minh C Updated');
      expect(json.data.tier).toBe('vip');
      expect(CustomerRepoMock.prototype.update).toHaveBeenCalledWith(
        TENANT_ID,
        'cust-100',
        expect.objectContaining({ name: 'Pham Minh C Updated', tier: 'vip' })
      );
    });

    it('rejects direct financial mutation with 400 Bad Request', async () => {
      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hacker Attempt', receivableDebt: 0 }),
      });
      const res = await updateCustomer(req, { params: Promise.resolve({ id: 'cust-100' }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('DIRECT_FINANCIAL_MUTATION_PROHIBITED');
    });
  });

  describe('DELETE /api/interior/crm/customers/[id]', () => {
    it('archives customer profile by default and returns 200', async () => {
      const mockArchived = {
        id: 'cust-100',
        tenantId: TENANT_ID,
        code: 'KH-000100',
        name: 'Pham Minh C',
        type: 'individual' as const,
        tier: 'standard' as const,
        profileStatus: 'inactive' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      CustomerRepoMock.prototype.archive = jest.fn().mockResolvedValue(mockArchived);

      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100', {
        method: 'DELETE',
      });
      const res = await deleteCustomer(req, { params: Promise.resolve({ id: 'cust-100' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.archived).toBe(true);
      expect(json.data.customer.profileStatus).toBe('inactive');
    });
  });

  describe('Contacts API Routes', () => {
    it('lists customer contacts via GET', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          tenantId: TENANT_ID,
          customerId: 'cust-100',
          name: 'Contact One',
          role: 'primary_contact' as const,
          phone: '0901112233',
          isPrimary: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      CustomerRepoMock.prototype.listContacts = jest.fn().mockResolvedValue(mockContacts);

      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/contacts');
      const res = await getContacts(req, { params: Promise.resolve({ id: 'cust-100' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].name).toBe('Contact One');
    });

    it('creates new contact via POST', async () => {
      const mockCreated = {
        id: 'contact-2',
        tenantId: TENANT_ID,
        customerId: 'cust-100',
        name: 'New Contact',
        role: 'site_manager' as const,
        phone: '0909998877',
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      CustomerRepoMock.prototype.addContact = jest.fn().mockResolvedValue(mockCreated);

      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/contacts', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Contact', phone: '0909998877', role: 'site_manager' }),
      });
      const res = await addContact(req, { params: Promise.resolve({ id: 'cust-100' }) });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('New Contact');
    });

    it('updates and removes contact', async () => {
      const mockUpdated = {
        id: 'contact-2',
        tenantId: TENANT_ID,
        customerId: 'cust-100',
        name: 'Updated Contact',
        role: 'decision_maker' as const,
        phone: '0909998877',
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      CustomerRepoMock.prototype.updateContact = jest.fn().mockResolvedValue(mockUpdated);
      CustomerRepoMock.prototype.removeContact = jest.fn().mockResolvedValue(true);

      const patchReq = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/contacts/contact-2', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Contact', role: 'decision_maker' }),
      });
      const patchRes = await updateContact(patchReq, { params: Promise.resolve({ id: 'cust-100', contactId: 'contact-2' }) });
      const patchJson = await patchRes.json();
      expect(patchRes.status).toBe(200);
      expect(patchJson.data.role).toBe('decision_maker');

      const delReq = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/contacts/contact-2', {
        method: 'DELETE',
      });
      const delRes = await removeContact(delReq, { params: Promise.resolve({ id: 'cust-100', contactId: 'contact-2' }) });
      const delJson = await delRes.json();
      expect(delRes.status).toBe(200);
      expect(delJson.data.deleted).toBe(true);
    });

    it('returns 409 when switching a primary contact conflicts with the database invariant', async () => {
      CustomerRepoMock.prototype.updateContact = jest.fn().mockRejectedValue(new CustomerPrimaryContactConflictError());
      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/contacts/contact-2', {
        method: 'PATCH',
        body: JSON.stringify({ isPrimary: true }),
      });
      const res = await updateContact(req, { params: Promise.resolve({ id: 'cust-100', contactId: 'contact-2' }) });
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json.error).toContain('Switch the existing contact');
    });
  });

  describe('Addresses API Routes', () => {
    it('lists and adds customer addresses', async () => {
      const mockAddresses = [
        {
          id: 'addr-1',
          tenantId: TENANT_ID,
          customerId: 'cust-100',
          addressType: 'site_location' as const,
          fullAddress: 'Ecopark Grand',
          city: 'Hưng Yên',
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      CustomerRepoMock.prototype.listAddresses = jest.fn().mockResolvedValue(mockAddresses);
      CustomerRepoMock.prototype.addAddress = jest.fn().mockResolvedValue(mockAddresses[0]);

      const getReq = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/addresses');
      const getRes = await getAddresses(getReq, { params: Promise.resolve({ id: 'cust-100' }) });
      const getJson = await getRes.json();
      expect(getRes.status).toBe(200);
      expect(getJson.data[0].city).toBe('Hưng Yên');

      const postReq = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/addresses', {
        method: 'POST',
        body: JSON.stringify({ fullAddress: 'Ecopark Grand', city: 'Hưng Yên' }),
      });
      const postRes = await addAddress(postReq, { params: Promise.resolve({ id: 'cust-100' }) });
      const postJson = await postRes.json();
      expect(postRes.status).toBe(201);
      expect(postJson.data.fullAddress).toBe('Ecopark Grand');
    });

    it('updates and removes address', async () => {
      CustomerRepoMock.prototype.updateAddress = jest.fn().mockResolvedValue({
        id: 'addr-1',
        tenantId: TENANT_ID,
        customerId: 'cust-100',
        addressType: 'billing' as const,
        fullAddress: 'Updated Address',
        city: 'Hà Nội',
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      CustomerRepoMock.prototype.removeAddress = jest.fn().mockResolvedValue(true);

      const patchReq = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/addresses/addr-1', {
        method: 'PATCH',
        body: JSON.stringify({ city: 'Hà Nội' }),
      });
      const patchRes = await updateAddress(patchReq, { params: Promise.resolve({ id: 'cust-100', addressId: 'addr-1' }) });
      expect(patchRes.status).toBe(200);

      const delReq = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/addresses/addr-1', {
        method: 'DELETE',
      });
      const delRes = await removeAddress(delReq, { params: Promise.resolve({ id: 'cust-100', addressId: 'addr-1' }) });
      const delJson = await delRes.json();
      expect(delRes.status).toBe(200);
      expect(delJson.data.deleted).toBe(true);
    });

    it('returns 409 when switching a default address conflicts with the database invariant', async () => {
      CustomerRepoMock.prototype.updateAddress = jest.fn().mockRejectedValue(new CustomerDefaultAddressConflictError());
      const req = new NextRequest('https://bella.example/api/interior/crm/customers/cust-100/addresses/addr-2', {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      });
      const res = await updateAddress(req, { params: Promise.resolve({ id: 'cust-100', addressId: 'addr-2' }) });
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json.error).toContain('Switch the existing address');
    });
  });
});
