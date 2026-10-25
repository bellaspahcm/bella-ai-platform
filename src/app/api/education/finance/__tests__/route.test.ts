/** Approved API contract: current admin/accountant before operation client; explicit key, one atomic command. */
const mockGetCurrentUser = jest.fn();
const mockCreateClient = jest.fn();
const mockAtomicCommand = jest.fn();
const mockLegacyRecord = jest.fn();
const mockLegacyReconcile = jest.fn();
const mockInvoiceRead = jest.fn();
const mockBranchRead = jest.fn();
const mockBillingCompile = jest.fn();

jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockGetCurrentUser() }));
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));
jest.mock('@/products/bella-education/finance/repositories/preschool-finance.repository', () => ({
  PreschoolFinanceRepository: jest.fn(() => ({ getInvoiceById: mockInvoiceRead, readBranchState: mockBranchRead })),
  FinanceAtomicDatabaseError: class extends Error {
    paymentNotCommitted = false;
    constructor(message: string, readonly code: string) { super(message); }
  },
}));
jest.mock('@/products/bella-education/finance/services/payment-reconciliation.service', () => ({
  PaymentReconciliationService: jest.fn(() => ({ recordAndReconcilePayment: mockAtomicCommand,
    recordInboundPayment: mockLegacyRecord, reconcilePaymentToInvoice: mockLegacyReconcile })),
}));
jest.mock('@/products/bella-education/finance/services/tuition-billing.service', () => ({
  TuitionBillingService: jest.fn(() => ({ compileDraftInvoice: mockBillingCompile })),
}));
jest.mock('@/products/bella-education/finance/services/invoice-issuance.service');
jest.mock('@/products/bella-education/finance/services/tuition-service-period-completion.service');
jest.mock('@/products/bella-education/finance/services/overdue-payment-scanner.service');
jest.mock('@/products/bella-education/parent-engagement/bridges/finance-projection.bridge');
jest.mock('@/products/bella-education/parent-engagement/services/communication-delivery.service');
jest.mock('@/products/bella-education/parent-engagement/repositories/parent-communication.repository');
jest.mock('@/products/bella-education/parent-engagement/services/communication-exception.service');

import { GET, POST } from '../route';
import { FinanceAtomicDatabaseError } from '@/products/bella-education/finance/repositories/preschool-finance.repository';

const actorId = '00000000-0000-0000-0000-000000000001';
const tenantId = '00000000-0000-0000-0000-000000000002';
const body = { action: 'recordAndReconcilePayment', branchId: 'selected-branch', operationKey: 'retained-client-key', invoiceId: 'invoice-id', paymentAmount: 40.01, paymentMethod: 'CASH' };
function request(input: object = body): Request {
  return new Request('http://localhost/api/education/finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

describe('Preschool Finance atomic API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'admin' });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => { throw new Error('Unexpected pre-recovery read'); }) });
    mockAtomicCommand.mockResolvedValue({ payment: { id: 'payment-id' }, reconciliationEntry: { id: 'allocation-id' }, receipt: { id: 'receipt-id' }, updatedSettlementStatus: 'PARTIALLY_PAID' });
  });

  it('rejects anonymous caller before creating an operation client', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockAtomicCommand).not.toHaveBeenCalled();
  });

  it.each(['admin_staff', 'ktv', 'super_admin'])('denies unapproved Finance role %s before operation client', async (role) => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role });
    expect((await POST(request())).status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockAtomicCommand).not.toHaveBeenCalled();
  });

  it.each(['admin', 'accountant'])('runs one atomic command for current %s using trusted tenant/actor', async (role) => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role });
    const response = await POST(request({ ...body, tenantId: 'untrusted-tenant', actorId: 'untrusted-actor' }));
    expect(response.status).toBe(200);
    expect(mockAtomicCommand).toHaveBeenCalledWith({ tenantId, actorId, branchId: body.branchId, operationKey: body.operationKey,
      invoiceId: body.invoiceId, paymentAmount: 40.01, paymentMethod: 'CASH' });
    expect(mockAtomicCommand).toHaveBeenCalledTimes(1);
    expect(mockInvoiceRead).not.toHaveBeenCalled();
    expect(mockLegacyRecord).not.toHaveBeenCalled();
    expect(mockLegacyReconcile).not.toHaveBeenCalled();
    expect(await response.json()).toEqual(expect.objectContaining({ payment: { id: 'payment-id' }, receipt: { id: 'receipt-id' } }));
  });

  it('rejects missing branch instead of resolving a default or tenant-wide action', async () => {
    expect((await POST(request({ ...body, branchId: undefined }))).status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockAtomicCommand).not.toHaveBeenCalled();
  });

  it('does not attribute global completion to the selected branch', async () => {
    expect((await POST(request({ action: 'completeTuitionServicePeriod', branchId: body.branchId, billingPeriodId: 'period' }))).status).toBe(403);
    expect(mockAtomicCommand).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('directory GET passes null branch to public Product read without a default', async () => {
    mockBranchRead.mockResolvedValue({ branches: [], selectedBranchId: null, students: [], invoices: [] });
    const response = await GET(new Request('http://localhost/api/education/finance'));
    expect(response.status).toBe(200);
    expect(mockBranchRead).toHaveBeenCalledWith(tenantId, actorId, null);
  });

  it('uses the explicitly selected branch and fails closed on read DB errors', async () => {
    mockBranchRead.mockRejectedValue(new FinanceAtomicDatabaseError('database unavailable', '08006'));
    expect((await GET(new Request('http://localhost/api/education/finance?branchId=branch-a'))).status).toBe(500);
    expect(mockBranchRead).toHaveBeenCalledWith(tenantId, actorId, 'branch-a');
  });

  it('compiles with the configured period due date and authenticated actor, ignoring caller overrides', async () => {
    mockBranchRead.mockResolvedValue({ students: [{ studentPartyId: 'student-a' }],
      billingPeriods: [{ id: 'configured-period', dueDate: '2026-11-05' }] });
    mockBillingCompile.mockResolvedValue({ id: 'draft-invoice' });
    const response = await POST(request({ action: 'compileDraftInvoice', branchId: body.branchId,
      studentPartyId: 'student-a', billingPeriodId: 'configured-period', dueDate: '2030-01-01',
      tenantId: 'untrusted-tenant', createdBy: 'untrusted-actor' }));
    expect(response.status).toBe(200);
    expect(mockBranchRead).toHaveBeenCalledWith(tenantId, actorId, body.branchId);
    expect(mockBillingCompile).toHaveBeenCalledTimes(1);
    expect(mockBillingCompile).toHaveBeenCalledWith({ tenantId, studentPartyId: 'student-a',
      billingPeriodId: 'configured-period', dueDate: '2026-11-05', createdBy: actorId });
  });

  it('rejects a billing period absent from the authorized branch read before compilation', async () => {
    mockBranchRead.mockResolvedValue({ students: [{ studentPartyId: 'student-a' }], billingPeriods: [] });
    const response = await POST(request({ action: 'compileDraftInvoice', branchId: body.branchId,
      studentPartyId: 'student-a', billingPeriodId: 'foreign-or-inactive-period' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false,
      error: expect.stringContaining('FINANCE_BILLING_PERIOD_NOT_FOUND') });
    expect(mockBillingCompile).not.toHaveBeenCalled();
  });

  it('rejects a student outside the current branch before compilation', async () => {
    mockBranchRead.mockResolvedValue({ students: [],
      billingPeriods: [{ id: 'configured-period', dueDate: '2026-11-05' }] });
    const response = await POST(request({ action: 'compileDraftInvoice', branchId: body.branchId,
      studentPartyId: 'foreign-student', billingPeriodId: 'configured-period' }));
    expect(response.status).toBe(403);
    expect(mockBillingCompile).not.toHaveBeenCalled();
  });

  it('does not compile when the public branch read fails', async () => {
    mockBranchRead.mockRejectedValue(new FinanceAtomicDatabaseError('database unavailable', '08006'));
    expect((await POST(request({ action: 'compileDraftInvoice', branchId: body.branchId,
      studentPartyId: 'student-a', billingPeriodId: 'configured-period' }))).status).toBe(500);
    expect(mockBillingCompile).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '  ', 'a'.repeat(201)])('requires a stable operation key before command (%s)', async (operationKey) => {
    expect((await POST(request({ ...body, operationKey }))).status).toBe(400);
    expect(mockAtomicCommand).not.toHaveBeenCalled();
    expect(mockLegacyRecord).not.toHaveBeenCalled();
  });

  it('maps payload mismatch to conflict409', async () => {
    mockAtomicCommand.mockRejectedValue(new FinanceAtomicDatabaseError('FINANCE_OPERATION_CONFLICT: mismatch', 'P0001'));
    expect((await POST(request())).status).toBe(409);
  });

  it('maps canonical recovery mismatch to conflict409', async () => {
    mockAtomicCommand.mockRejectedValue(new Error('FINANCE_CANONICAL_CONFLICT: IDs mismatch'));
    expect((await POST(request())).status).toBe(409);
    expect(mockLegacyRecord).not.toHaveBeenCalled();
  });

  it('keeps unissued or archived invoice rejection a client error', async () => {
    mockAtomicCommand.mockRejectedValue(new FinanceAtomicDatabaseError('UNISSUED_INVOICE_RECONCILIATION_ERROR: Active ISSUED invoice required.', 'P0001'));
    expect((await POST(request())).status).toBe(400);
  });

  it('exposes correction only when the service confirms no committed operation', async () => {
    const rejection = new FinanceAtomicDatabaseError('ALLOCATION_EXCEEDS_OUTSTANDING_ERROR: Balance exceeded.', 'P0001');
    rejection.paymentNotCommitted = true;
    mockAtomicCommand.mockRejectedValueOnce(rejection);
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ paymentNotCommitted: true });
    mockAtomicCommand.mockRejectedValueOnce(new FinanceAtomicDatabaseError('ALLOCATION_EXCEEDS_OUTSTANDING_ERROR: Balance exceeded.', 'P0001'));
    expect(await (await POST(request())).json()).not.toHaveProperty('paymentNotCommitted');
  });

  it('fails closed on permission denial and database failures', async () => {
    mockAtomicCommand.mockRejectedValueOnce(new FinanceAtomicDatabaseError('permission denied', '42501'));
    expect((await POST(request())).status).toBe(403);
    mockAtomicCommand.mockRejectedValueOnce(new FinanceAtomicDatabaseError('database unavailable', '08006'));
    expect((await POST(request())).status).toBe(500);
    expect(mockLegacyRecord).not.toHaveBeenCalled();
  });

  it.each([false, null, 0, -1, 'invalid'])('rejects malformed amount without command (%s)', async (paymentAmount) => {
    expect((await POST(request({ ...body, paymentAmount }))).status).toBe(400);
    expect(mockAtomicCommand).not.toHaveBeenCalled();
  });
});
