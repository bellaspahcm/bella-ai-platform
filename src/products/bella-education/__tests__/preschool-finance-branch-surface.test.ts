import { PreschoolFinanceRepository } from '../finance/repositories/preschool-finance.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
describe('Product public branch surface fails closed', () => {
  const rpc = jest.fn();
  const client = { rpc } as unknown as SupabaseClient<Database>;
  beforeEach(() => rpc.mockReset());
  it('directory requests omit branch argument rather than inventing a default', async () => {
    rpc.mockResolvedValue({ data: { branches: [{ id: 'branch-a', name: 'A', code: null }], selectedBranchId: null,
      students: [], billingPeriods: [], invoices: [], payments: [], exceptions: [] }, error: null });
    const result = await new PreschoolFinanceRepository(client).readBranchState('tenant-a', 'actor-a', null);
    expect(rpc).toHaveBeenCalledWith('preschool_finance_read_branch', { p_tenant_id: 'tenant-a', p_actor_id: 'actor-a' });
    expect(result.selectedBranchId).toBeNull(); expect(result.completionAvailable).toBe(false);
  });
  it('does not transform a DB permission error into an empty branch list', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(new PreschoolFinanceRepository(client).readBranchState('tenant-a', 'actor-a', 'branch-a')).rejects.toMatchObject({ code: '42501' });
  });
  it('fails closed when the branch read RPC is unavailable instead of reading tenant tables', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    await expect(new PreschoolFinanceRepository(client).readBranchState('tenant-a', 'actor-a', 'branch-a'))
      .rejects.toMatchObject({ code: 'PGRST202' });
  });
  it('composes ALL only from branches returned by the authorized RPC', async () => {
    const branch = { id: 'branch-a', name: 'A', code: null };
    const rpcData = (selectedBranchId: string | null) => ({
      branches: [branch], selectedBranchId,
      students: selectedBranchId ? [{ enrollmentId: 'enrollment-a', courseId: 'course-a', studentPartyId: 'party-a',
        studentId: 'student-a', studentCode: 'S-01', displayName: 'Student A' }] : [],
      billingPeriods: [], invoices: [], payments: [], exceptions: [],
    });
    rpc.mockImplementation(async (_name: string, args: { p_branch_id?: string }) => ({
      data: rpcData(args.p_branch_id ?? null), error: null,
    }));
    const result = await new PreschoolFinanceRepository(client).readBranchState('tenant-a', 'actor-a', 'ALL');
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(result.selectedBranchId).toBe('ALL');
    expect(result.branches).toEqual([branch]);
    expect(result.students.map(student => student.enrollmentId)).toEqual(['enrollment-a']);
    expect(result.branchBreakdowns).toEqual([expect.objectContaining({ branchId: 'branch-a', studentCount: 1 })]);
  });
  it('rejects malformed canonical student mapping instead of fabricating identity', async () => {
    rpc.mockResolvedValue({ data: { branches: [], students: [{ enrollmentId: 'e', courseId: 'c', studentPartyId: 'p', studentId: null }],
      billingPeriods: [], invoices: [], payments: [], exceptions: [] }, error: null });
    await expect(new PreschoolFinanceRepository(client).readBranchState('tenant-a', 'actor-a', 'branch-a')).rejects.toThrow();
  });
  it('cannot execute a branch command without explicit server context', async () => {
    await expect(new PreschoolFinanceRepository(client).branchCommand('resolveException', {})).rejects.toThrow('Explicit Finance branch');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not return synthetic success when a Finance command RPC is missing', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const repo = new PreschoolFinanceRepository(client, { tenantId: 'tenant-a', actorId: 'actor-a', branchId: 'branch-a' });
    await expect(repo.branchCommand('resolveException', { exceptionId: 'exception-a' })).rejects.toMatchObject({ code: 'PGRST202' });
  });
  it('does not treat an invoice read failure as not found in branch publication', async () => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: '08006', message: 'database unavailable' } }) };
    const from = jest.fn(() => query);
    const repo = new PreschoolFinanceRepository({ from } as unknown as SupabaseClient<Database>,
      { tenantId: 'tenant-a', actorId: 'actor-a', branchId: 'branch-a' });
    await expect(repo.getInvoiceById('tenant-a', 'invoice-a')).rejects.toMatchObject({ code: '08006' });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('does not publish an invoice with fabricated empty lines after a line read failure', async () => {
    const invoiceQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'invoice-a' }, error: null }) };
    const itemsQuery = { select: () => ({ eq: () => ({ eq: async () => ({ data: null,
      error: { code: '08006', message: 'line read unavailable' } }) }) }) };
    const from = jest.fn((table: string) => table === 'edu_fin_invoices' ? invoiceQuery : itemsQuery);
    const repo = new PreschoolFinanceRepository({ from } as unknown as SupabaseClient<Database>,
      { tenantId: 'tenant-a', actorId: 'actor-a', branchId: 'branch-a' });
    await expect(repo.getInvoiceById('tenant-a', 'invoice-a')).rejects.toMatchObject({ code: '08006' });
  });
});
