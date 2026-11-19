import { createClient } from '@supabase/supabase-js';
import { SupabaseInteriorRepository } from '../repositories/supabase.repository';
import { InMemoryCustomerRepository } from '../repositories/crm/in-memory-customer.repository';
import { Customer360AggregatorService } from '../services/crm/customer-360-aggregator.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isLiveVerificationEnabled = Boolean(
  supabaseKey &&
  !process.env.CI &&
  process.env.ENABLE_PROD_LIVE_VERIFICATION !== 'false'
);

const describeLive = isLiveVerificationEnabled ? describe : describe.skip;

describeLive('Customer 360 Real Production Runtime & Business Data Verification', () => {

  const supabase = createClient(supabaseUrl, supabaseKey);
  const interiorRepo = new SupabaseInteriorRepository(supabase as any);
  let tenantId: string;
  let aggregator: Customer360AggregatorService;

  beforeAll(async () => {
    // Read real tenantId from production interior_projects
    const { data, error } = await supabase
      .from('interior_projects')
      .select('tenant_id')
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data?.tenant_id).toBeDefined();
    tenantId = data!.tenant_id;

    // Use in-memory customer repository simulating unmigrated CRM profile state
    // to verify seamless runtime fallback & harmonization against live DB
    const customerRepo = new InMemoryCustomerRepository();
    aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);
  });

  test('Runtime Check 1: listCustomersOverview aggregates real Production projects into harmonized profiles', async () => {
    const overview = await aggregator.listCustomersOverview(tenantId, { page: 1, limit: 10 });
    expect(overview).toBeDefined();
    expect(overview.total).toBeGreaterThanOrEqual(4);
    expect(overview.customers.length).toBeGreaterThanOrEqual(4);

    // Verify key fields on harmonized profiles
    const codes = overview.customers.map((c) => c.code);
    expect(codes).toContain('KH-CUST-001');

    // Check KPIs calculation
    expect(overview.kpis.totalCustomers.value).toBeGreaterThanOrEqual(4);
    expect(overview.salesFunnel.steps.length).toBe(5);
  });

  test('Runtime Check 2: getCustomer360("cust-001") verifies multi-project, contracts, payments, and handover on real data', async () => {
    const c360 = await aggregator.getCustomer360(tenantId, 'cust-001');
    expect(c360).not.toBeNull();

    // 1. Profile
    expect(c360?.profile.id).toBe('cust-001');
    expect(c360?.profile.name).toBeDefined();

    // 2. Multi-project: cust-001 has both INT-2024-001 and INT-THD-2026
    const projectCodes = c360?.projects.map((p) => p.code);
    expect(projectCodes).toContain('INT-2024-001');
    expect(projectCodes).toContain('INT-THD-2026');

    // 3. Commercial Contracts: HD-NT-2026/08 with 1,350,000,000 VND
    expect(c360?.commercial.contracts.length).toBeGreaterThanOrEqual(1);
    const contract = c360?.commercial.contracts.find((c) => c.contractNumber === 'HD-NT-2026/08');
    expect(contract).toBeDefined();
    expect(contract?.contractValue).toBe(1_350_000_000);

    // 4. Commercial Payments: 2 recorded transactions totaling 675,000,000 VND
    expect(c360?.commercial.payments.length).toBeGreaterThanOrEqual(2);
    const totalPaid = c360?.commercial.payments.reduce((sum, p) => sum + p.amount, 0) || 0;
    expect(totalPaid).toBe(675_000_000);

    // 5. Handover Dossier: Accepted and signed by Tran Minh Quan
    expect(c360?.delivery.handovers.length).toBeGreaterThanOrEqual(1);
    const handover = c360?.delivery.handovers[0];
    expect(handover?.clientAccepted).toBe(true);

    // 6. Financial Summary Verification
    expect(c360?.financialSummary.totalContractValue).toBe(1_350_000_000);
    expect(c360?.financialSummary.totalPaidAmount).toBe(675_000_000);
    expect(c360?.financialSummary.receivableDebt).toBe(675_000_000);
    expect(c360?.financialSummary.overpaidAmount).toBe(0);

    // 7. Timeline events sorted descending
    expect(c360?.timeline.length).toBeGreaterThanOrEqual(4);
    const timestamps = c360?.timeline.map((t) => new Date(t.timestamp).getTime()) || [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });

  test('Runtime Check 3: getCustomer360("CUST-PILOT-01") verifies commercial pilot project with addendum adjustment', async () => {
    const c360 = await aggregator.getCustomer360(tenantId, 'CUST-PILOT-01');
    expect(c360).not.toBeNull();

    // Project INT-PILOT-2026
    expect(c360?.projects.length).toBe(1);
    expect(c360?.projects[0].code).toBe('INT-PILOT-2026');

    // Contract HD-PILOT-2026/01: baseline 500M, adjusted to 550M by approved addendum
    const contract = c360?.commercial.contracts.find((c) => c.contractNumber === 'HD-PILOT-2026/01');
    expect(contract).toBeDefined();
    expect(contract?.contractValue).toBe(550_000_000);

    // Payment: 250M
    expect(c360?.commercial.payments.length).toBe(1);
    expect(c360?.commercial.payments[0].amount).toBe(250_000_000);

    // Financial summary: Total 550M, Paid 250M, Debt 300M
    expect(c360?.financialSummary.totalContractValue).toBe(550_000_000);
    expect(c360?.financialSummary.totalPaidAmount).toBe(250_000_000);
    expect(c360?.financialSummary.receivableDebt).toBe(300_000_000);
  });

  test('Runtime Check 4: getCustomer360("cust-004") verifies site diaries logged for Duplex Aqua Bay', async () => {
    const c360 = await aggregator.getCustomer360(tenantId, 'cust-004');
    expect(c360).not.toBeNull();

    // 2 site diaries recorded on project INT-2024-004
    expect(c360?.execution.siteDiaries.length).toBe(2);
    expect(c360?.execution.siteDiaries[0].progressSummary).toBeDefined();
    expect(c360?.financialSummary.totalContractValue).toBe(0); // No contract signed yet
    expect(c360?.financialSummary.receivableDebt).toBe(0);
  });

  test('Runtime Check 5: Non-existent customer returns null gracefully without throw', async () => {
    const c360 = await aggregator.getCustomer360(tenantId, 'non-existent-customer-999');
    expect(c360).toBeNull();
  });
});
