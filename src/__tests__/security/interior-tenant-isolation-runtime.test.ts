/**
 * Bella Interior — Tenant Isolation Runtime Verification
 *
 * PURPOSE: Chứng minh runtime rằng PostgreSQL RLS + interior_actor_tenant()
 * thực sự cách ly dữ liệu giữa các tenant khi dùng JWT user thật.
 *
 * ENVIRONMENT: Supabase project lvnvkpyxtuilhrabtlwv (staging/dev)
 * SCOPE: interior_customers + contacts + addresses + aliases + merge
 *
 * QUAN TRỌNG:
 * - Service role CHỈ dùng để setup fixture và verify post-test
 * - Mọi truy vấn kiểm chứng RLS dùng JWT client của từng user
 * - Không chạy trên Production
 * - Không thay đổi dữ liệu nghiệp vụ thật
 *
 * CÁCH CHẠY:
 *   INTEGRATION_TEST=true npx jest --testPathPattern="interior-tenant-isolation-runtime" --no-coverage
 *
 * YÊU CẦU:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (fixture + post-verify only)
 *   - INT_TEST_USER_A_EMAIL + INT_TEST_USER_A_PASSWORD (Tenant A — bella_interior)
 *   - INT_TEST_USER_B_EMAIL + INT_TEST_USER_B_PASSWORD (Tenant B — bella_interior)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

jest.setTimeout(90_000);

const SKIP_IF_NO_INTEGRATION = !process.env.INTEGRATION_TEST;

const describeOrSkip = SKIP_IF_NO_INTEGRATION ? describe.skip : describe;

describeOrSkip('🔒 Bella Interior — Tenant Isolation Runtime (Gate 0)', () => {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // --- Clients ---
  // Service role: ONLY for fixture setup and post-test verification
  const adminClient = () => createClient<Database>(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // JWT clients: used for ALL RLS-sensitive queries
  let clientA: ReturnType<typeof createClient<Database>>;
  let clientB: ReturnType<typeof createClient<Database>>;

  // Fixture state
  let tenantAId: string;
  let tenantBId: string;
  let customerAId: string;
  let customerBId: string;
  let contactBId: string;
  let addressBId: string;

  // ──────────────────────────────────────────────────────────────
  // SETUP: Authenticate real users and seed fixture data
  // ──────────────────────────────────────────────────────────────
  beforeAll(async () => {
    const admin = adminClient();

    // Authenticate User A (must belong to a bella_interior tenant)
    const { data: authA, error: errAuthA } = await createClient<Database>(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      .auth.signInWithPassword({
        email: process.env.INT_TEST_USER_A_EMAIL!,
        password: process.env.INT_TEST_USER_A_PASSWORD!,
      });
    if (errAuthA || !authA.session) throw new Error(`User A auth failed: ${errAuthA?.message}`);

    clientA = createClient<Database>(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${authA.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authenticate User B (must belong to a DIFFERENT bella_interior tenant)
    const { data: authB, error: errAuthB } = await createClient<Database>(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      .auth.signInWithPassword({
        email: process.env.INT_TEST_USER_B_EMAIL!,
        password: process.env.INT_TEST_USER_B_PASSWORD!,
      });
    if (errAuthB || !authB.session) throw new Error(`User B auth failed: ${errAuthB?.message}`);

    clientB = createClient<Database>(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${authB.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve tenant IDs from interior_actor_tenant() via RPC (using JWT)
    const { data: tenantA, error: errTenantA } = await clientA.rpc('interior_actor_tenant' as never);
    const { data: tenantB, error: errTenantB } = await clientB.rpc('interior_actor_tenant' as never);

    tenantAId = tenantA as unknown as string;
    tenantBId = tenantB as unknown as string;

    if (!tenantAId || !tenantBId) {
      throw new Error(`Could not resolve tenant IDs from JWT: A=${tenantAId} (${errTenantA?.message}), B=${tenantBId} (${errTenantB?.message})`);
    }
    if (tenantAId === tenantBId) throw new Error('FIXTURE ERROR: User A and B must belong to DIFFERENT tenants');

    // Seed: Customer in Tenant B (service_role for fixture only)
    const { data: custB, error: custBErr } = await admin
      .from('interior_customers')
      .insert({
        tenant_id: tenantBId,
        code: `KH-ISOL-B-${Date.now()}`,
        name: 'Isolation Test Customer B',
        type: 'individual',
        tier: 'standard',
        profile_status: 'active',
      })
      .select('id')
      .single();
    if (custBErr) throw new Error(`Fixture B customer failed: ${custBErr.message}`);
    customerBId = custB!.id;

    // Seed: Customer in Tenant A
    const { data: custA, error: custAErr } = await admin
      .from('interior_customers')
      .insert({
        tenant_id: tenantAId,
        code: `KH-ISOL-A-${Date.now()}`,
        name: 'Isolation Test Customer A',
        type: 'individual',
        tier: 'standard',
        profile_status: 'active',
      })
      .select('id')
      .single();
    if (custAErr) throw new Error(`Fixture A customer failed: ${custAErr.message}`);
    customerAId = custA!.id;

    // Seed: Contact in Tenant B
    const { data: contB, error: contBErr } = await admin
      .from('interior_customer_contacts')
      .insert({
        tenant_id: tenantBId,
        customer_id: customerBId,
        name: 'Contact B',
        role: 'primary_contact',
        phone: '0900000001',
        is_primary: true,
      })
      .select('id').single();
    if (contBErr) throw new Error(`Fixture B contact failed: ${contBErr.message}`);
    contactBId = contB?.id ?? '';

    // Seed: Address in Tenant B
    const { data: addrB, error: addrBErr } = await admin
      .from('interior_customer_addresses')
      .insert({
        tenant_id: tenantBId,
        customer_id: customerBId,
        address_type: 'site_location',
        full_address: '123 Test B',
        city: 'HCM',
        is_default: true,
      })
      .select('id').single();
    if (addrBErr) throw new Error(`Fixture B address failed: ${addrBErr.message}`);
    addressBId = addrB?.id ?? '';
  });

  // ──────────────────────────────────────────────────────────────
  // TEARDOWN: Remove fixture data
  // ──────────────────────────────────────────────────────────────
  afterAll(async () => {
    const admin = adminClient();
    if (contactBId) await admin.from('interior_customer_contacts').delete().eq('id', contactBId);
    if (addressBId) await admin.from('interior_customer_addresses').delete().eq('id', addressBId);
    if (customerBId) await admin.from('interior_customers').update({ profile_status: 'inactive' }).eq('id', customerBId);
    if (customerAId) await admin.from('interior_customers').update({ profile_status: 'inactive' }).eq('id', customerAId);
  });

  // ──────────────────────────────────────────────────────────────
  // TC-01: Cross-tenant SELECT bị chặn
  // ──────────────────────────────────────────────────────────────
  it('TC-01 ✅ User A không đọc được Customer của Tenant B', async () => {
    const { data, error } = await clientA
      .from('interior_customers')
      .select('id, name')
      .eq('id', customerBId);

    // RLS RESTRICTIVE: data sẽ là [] hoặc error — không bao giờ trả về hàng của tenant B
    const hasLeak = Array.isArray(data) && data.length > 0;
    if (hasLeak) {
      console.error('🚨 TC-01 SECURITY VIOLATION: Cross-tenant customer read!', data);
    }
    expect(hasLeak).toBe(false);
    expect(error).toBeNull(); // RLS trả [] không phải error
  });

  // ──────────────────────────────────────────────────────────────
  // TC-02: Cross-tenant UPDATE bị chặn
  // ──────────────────────────────────────────────────────────────
  it('TC-02 ✅ User A không cập nhật được Customer của Tenant B', async () => {
    const { data, error } = await clientA
      .from('interior_customers')
      .update({ name: 'HACKED BY TENANT A' })
      .eq('id', customerBId)
      .select('id');

    const hasLeak = Array.isArray(data) && data.length > 0;
    if (hasLeak) {
      console.error('🚨 TC-02 SECURITY VIOLATION: Cross-tenant customer update!', data);
    }
    expect(hasLeak).toBe(false);

    // Verify: dữ liệu Tenant B không thay đổi
    const { data: verify } = await adminClient()
      .from('interior_customers')
      .select('name')
      .eq('id', customerBId)
      .single();
    expect(verify?.name).not.toBe('HACKED BY TENANT A');
  });

  // ──────────────────────────────────────────────────────────────
  // TC-03: Cross-tenant Contacts bị chặn
  // ──────────────────────────────────────────────────────────────
  it('TC-03 ✅ User A không đọc được Contacts của Tenant B', async () => {
    const { data } = await clientA
      .from('interior_customer_contacts')
      .select('id')
      .eq('id', contactBId);

    expect(data?.length ?? 0).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // TC-04: Cross-tenant Addresses bị chặn
  // ──────────────────────────────────────────────────────────────
  it('TC-04 ✅ User A không đọc được Addresses của Tenant B', async () => {
    const { data } = await clientA
      .from('interior_customer_addresses')
      .select('id')
      .eq('id', addressBId);

    expect(data?.length ?? 0).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // TC-05: Cross-tenant Merge bị chặn tại RPC
  // ──────────────────────────────────────────────────────────────
  it('TC-05 ✅ Merge Customer cross-tenant bị từ chối', async () => {
    const { error } = await clientA.rpc('interior_execute_customer_merge' as never, {
      p_tenant_id: tenantBId,          // Tenant B
      p_source_customer_id: customerAId,
      p_target_customer_id: customerBId,
      p_reason: 'adversarial-cross-tenant-merge-test',
    } as never);

    // Expected: TENANT_FORBIDDEN or permission denied
    expect(error).not.toBeNull();
    const msg = error?.message ?? '';
    const isForbidden = msg.includes('TENANT_FORBIDDEN')
      || msg.includes('PERMISSION_DENIED')
      || msg.includes('permission denied')
      || msg.includes('INTERIOR_PERMISSION_DENIED');
    expect(isForbidden).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // TC-06: interior_generate_customer_code — không thể sinh code cho tenant khác
  // ──────────────────────────────────────────────────────────────
  it('TC-06 ✅ User A không thể sinh customer code cho Tenant B', async () => {
    const { error } = await clientA.rpc('interior_generate_customer_code' as never, {
      p_tenant_id: tenantBId,
    } as never);

    expect(error).not.toBeNull();
    const msg = error?.message ?? '';
    expect(msg.includes('TENANT_FORBIDDEN') || msg.includes('INTERIOR_PERMISSION_DENIED')).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // TC-07: Không có JWT → không truy cập được
  // ──────────────────────────────────────────────────────────────
  it('TC-07 ✅ Request không có JWT bị từ chối', async () => {
    const anonClient = createClient<Database>(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await anonClient
      .from('interior_customers')
      .select('id')
      .eq('tenant_id', tenantBId);

    // anon role không có PERMISSIVE policy grant → data rỗng hoặc error
    const hasLeak = Array.isArray(data) && data.length > 0;
    expect(hasLeak).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // TC-08: Tenant B data nguyên vẹn sau tất cả test
  // ──────────────────────────────────────────────────────────────
  it('TC-08 ✅ Dữ liệu Tenant B vẫn nguyên vẹn sau các adversarial test', async () => {
    const admin = adminClient();
    const { data } = await admin
      .from('interior_customers')
      .select('id, name, profile_status')
      .eq('id', customerBId)
      .single();

    expect(data?.name).toBe('Isolation Test Customer B');
    expect(data?.profile_status).toBe('active');
  });

  // ──────────────────────────────────────────────────────────────
  // TC-09: User B đọc được data của chính mình
  // ──────────────────────────────────────────────────────────────
  it('TC-09 ✅ User B đọc được Customer của Tenant B (happy path)', async () => {
    const { data, error } = await clientB
      .from('interior_customers')
      .select('id, name')
      .eq('id', customerBId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0]?.id).toBe(customerBId);
  });

  // ──────────────────────────────────────────────────────────────
  // TC-10: interior_actor_tenant() trả về đúng tenant cho từng user
  // ──────────────────────────────────────────────────────────────
  it('TC-10 ✅ interior_actor_tenant() trả về đúng tenant riêng cho từng user', async () => {
    // User A
    const { data: tenantFromA } = await clientA.rpc('interior_actor_tenant' as never);
    // User B
    const { data: tenantFromB } = await clientB.rpc('interior_actor_tenant' as never);

    expect(tenantFromA).toBe(tenantAId);
    expect(tenantFromB).toBe(tenantBId);
    expect(tenantFromA).not.toBe(tenantFromB);
  });
});
