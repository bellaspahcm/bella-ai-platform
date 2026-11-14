import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const databaseUrl = process.env.E2E_SUPABASE_DB_URL || process.env.SUPABASE_DB_URL
  || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '';
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const configured = Boolean(supabaseUrl && supabaseKey && serviceRoleKey && databaseUrl);
const describeWithE2e = configured || isCi ? describe : describe.skip;

type DbRole = 'authenticated' | 'anon' | 'service_role';
type ApprovalRequest = { id: string; approval_token: string };
type UploadedEvidence = { path: string; bytes: Buffer };

function validateE2eTarget(): void {
  let api: URL;
  let db: URL;
  try {
    api = new URL(supabaseUrl);
    db = new URL(databaseUrl);
  } catch {
    throw new Error('INTERIOR_COMMERCIAL_E2E_TARGET_INVALID');
  }
  const user = decodeURIComponent(db.username);
  const direct = db.hostname === `db.${EXPECTED_E2E_PROJECT_REF}.supabase.co`
    && (!db.port || db.port === '5432');
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname)
    && user.endsWith(`.${EXPECTED_E2E_PROJECT_REF}`)
    && ['5432', '6543'].includes(db.port);
  if (api.protocol !== 'https:' || api.hostname !== `${EXPECTED_E2E_PROJECT_REF}.supabase.co`
    || db.hostname.includes('lvnvkpyxtuilhrabtlwv') || user.includes('lvnvkpyxtuilhrabtlwv')
    || !['postgres:', 'postgresql:'].includes(db.protocol) || !user || !db.password
    || db.pathname !== '/postgres' || (!direct && !pooler)) {
    throw new Error('INTERIOR_COMMERCIAL_E2E_TARGET_REJECTED');
  }
}

function createDatabaseClient(): Client {
  const db = new URL(databaseUrl);
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslnegotiation']) {
    db.searchParams.delete(key);
  }
  const ca = (process.env.E2E_SUPABASE_DB_SSL_CA || '').trim().replace(/\\n/g, '\n');
  const candidates = [ca, Buffer.from(ca, 'base64').toString('utf8').trim()];
  const certificate = candidates.find((candidate) => candidate.includes('-----BEGIN CERTIFICATE-----')
    && candidate.includes('-----END CERTIFICATE-----'));
  if (!certificate) throw new Error('INTERIOR_COMMERCIAL_E2E_DATABASE_TLS_CA_INVALID');
  return new Client({ connectionString: db.toString(), ssl: { ca: certificate, rejectUnauthorized: true } });
}

describeWithE2e('Bella Interior Commercial customer chain on isolated E2E PostgreSQL', () => {
  jest.setTimeout(180_000);

  const marker = `bella-commercial-e2e-${randomUUID()}`;
  const tenantId = randomUUID();
  const foreignTenantId = randomUUID();
  let staffPreparerId = '';
  let staffApproverId = '';
  let foreignStaffId = '';
  const actorIds: string[] = [];
  const uploadedEvidence: UploadedEvidence[] = [];
  const supabaseAdmin = configured
    ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    : null;

  let database: Client | null = null;
  let transactionStarted = false;

  beforeAll(async () => {
    if (!configured) {
      if (isCi) throw new Error('INTERIOR_COMMERCIAL_E2E_CREDENTIALS_NOT_CONFIGURED');
      return;
    }
    validateE2eTarget();
    database = createDatabaseClient();
    await database.connect();

    await database.query(
      "INSERT INTO public.tenants (id, name, status, enabled_modules, product_key) "
        + "VALUES ($1::uuid, $2, 'active', '{}'::jsonb, 'bella_interior')",
      [tenantId, marker],
    );
    await database.query(
      "INSERT INTO public.tenants (id, name, status, enabled_modules, product_key) "
        + "VALUES ($1::uuid, $2, 'active', '{}'::jsonb, 'bella_interior')",
      [foreignTenantId, `${marker}-foreign-tenant`],
    );
    staffPreparerId = await createStaffActor('preparer');
    staffApproverId = await createStaffActor('approver');
    foreignStaffId = await createStaffActor('foreign-tenant-owner', foreignTenantId);
    await database.query('BEGIN');
    transactionStarted = true;
  });

  afterAll(async () => {
    if (database && transactionStarted) {
      await database.query('ROLLBACK').catch(() => {});
      transactionStarted = false;
    }
    if (supabaseAdmin && uploadedEvidence.length > 0) {
      const result = await supabaseAdmin.storage.from('interior-customer-signatures')
        .remove(uploadedEvidence.map((item) => item.path));
      if (result.error) throw new Error('INTERIOR_COMMERCIAL_E2E_SIGNATURE_FIXTURE_CLEANUP_FAILED');
    }
    if (database) {
      await database.query('RESET ROLE').catch(() => {});
      await database.query('DELETE FROM public.interior_user_roles WHERE tenant_id = ANY($1::uuid[])',
        [[tenantId, foreignTenantId]]).catch(() => {});
      await database.query('DELETE FROM public.users WHERE tenant_id = ANY($1::uuid[])',
        [[tenantId, foreignTenantId]]).catch(() => {});
      await database.query('DELETE FROM public.tenants WHERE id = ANY($1::uuid[])',
        [[tenantId, foreignTenantId]]).catch(() => {});
      await database.end();
    }
    if (supabaseAdmin) {
      for (const actorId of actorIds) {
        const deleted = await supabaseAdmin.auth.admin.deleteUser(actorId);
        if (deleted.error && deleted.error.code !== 'user_not_found') {
          throw new Error('INTERIOR_COMMERCIAL_E2E_AUTH_FIXTURE_CLEANUP_FAILED');
        }
      }
    }
  });

  it('persists quote approval, signed contract lineage, payments, addendum, handover and warranty atomically', async () => {
    const db = requireDatabase();
    const projectId = randomUUID();
    const designRevisionId = randomUUID();
    const boqId = randomUUID();
    const boqItemId = randomUUID();
    const stableComponentId = randomUUID();
    const quoteId = randomUUID();
    const quoteItemId = randomUUID();
    const quotationApprovalId = randomUUID();
    const quotationApprovalToken = randomUUID();
    const contractId = randomUUID();
    const milestoneIds = [randomUUID(), randomUUID()];
    const contractApprovalId = randomUUID();
    const contractApprovalToken = randomUUID();
    const addendumId = randomUUID();
    const addendumApprovalId = randomUUID();
    const addendumApprovalToken = randomUUID();
    let handoverApprovalId = '';
    let handoverApprovalToken = '';

    await db.query(
      `INSERT INTO public.interior_projects (
        id, tenant_id, code, name, customer_id, customer_name, customer_phone,
        site_address, project_type, status, estimated_budget, target_completion_date,
        lead_architect_id, lead_architect_name
      ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,'residential','survey',1200000,'2027-03-01',$9,$10)`,
      [projectId, tenantId, marker, 'Commercial E2E fixture', marker, 'E2E Customer Fixture',
        '+84000000000', 'E2E-only address', staffPreparerId, 'E2E Staff'],
    );
    await db.query(
      `INSERT INTO public.interior_design_revisions (
        id, tenant_id, project_id, version_number, title, status, submitted_by,
        approved_by, approved_at, submitted_by_user_id, approved_by_user_id
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,1,'E2E approved revision','approved',$4::text,$5::text,clock_timestamp(),$4::uuid,$5::uuid)`,
      [designRevisionId, tenantId, projectId, staffPreparerId, staffApproverId],
    );
    await db.query(
      'UPDATE public.interior_projects SET active_approved_revision_id = $1::uuid WHERE id = $2::uuid AND tenant_id = $3::uuid',
      [designRevisionId, projectId, tenantId],
    );

    await setClaims('authenticated', staffPreparerId);
    await db.query(
      `INSERT INTO public.interior_boqs (
        id, tenant_id, project_id, design_revision_id, boq_number, version_number, status,
        total_internal_cost, total_client_price, total_gross_margin, gross_margin_percent, prepared_by
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,1,'draft',500000,1000000,500000,50,$6)`,
      [boqId, tenantId, projectId, designRevisionId, `${marker}-BOQ-V1`, staffPreparerId],
    );
    await db.query(
      `INSERT INTO public.interior_boq_items (
        id, tenant_id, boq_id, room_zone_name, item_code, item_name, category,
        unit, quantity, internal_unit_cost, internal_total_cost, client_unit_price,
        client_total_price, gross_margin_amount, gross_margin_percent,
        specifications_json, stable_component_id
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,'Living room','CAB-001','Cabinet E2E','cabinet',
        'bộ',1,500000,500000,1000000,1000000,500000,50,
        '{"carcassMaterial":"MDF chống ẩm","doorFrontMaterial":"Veneer sồi","surfaceFinish":"Sơn mờ","hardwareSpec":"Blum","stoneOrGlassSpec":"Quartz"}'::jsonb,$4::uuid)`,
      [boqItemId, tenantId, boqId, stableComponentId],
    );

    await assumeDatabaseRole('authenticated', staffApproverId);
    const approvedBoq = await db.query(
      'SELECT status, reason FROM public.interior_approve_boq($1::uuid)', [boqId],
    );
    expect(approvedBoq.rows[0]).toEqual({ status: 'COMMITTED', reason: 'BOQ_APPROVED' });
    await db.query(
      'SELECT public.fork_interior_boq_revision($1::uuid,$2::uuid,$3::uuid,$4,$5)',
      [tenantId, boqId, staffApproverId, `${marker} sealed snapshot`, marker],
    );
    const sealed = await db.query(
      'SELECT status, version_number, snapshot_sealed_at FROM public.interior_boqs WHERE tenant_id=$1::uuid AND id=$2::uuid',
      [tenantId, boqId],
    );
    expect(sealed.rows[0]).toMatchObject({ status: 'approved', version_number: 1 });
    expect(sealed.rows[0].snapshot_sealed_at).toBeTruthy();

    const quotationItem = {
      id: quoteItemId, tenant_id: tenantId, quotation_id: quoteId, boq_item_id: boqItemId,
      stable_component_id: stableComponentId, room_zone_name: 'Living room', item_code: 'CAB-001',
      item_name: 'Cabinet E2E', category: 'cabinet',
      specifications: 'MDF chống ẩm; Veneer sồi; Sơn mờ; Blum; Quartz', unit: 'bộ',
      quantity: 1, internal_unit_cost: 500000, internal_total_cost: 500000,
      markup_percent: 100, client_unit_price: 1000000, client_total_price: 1000000,
      gross_margin_amount: 500000, gross_margin_percent: 50,
      cost_breakdown_json: { materialCost: 350000, laborCost: 150000 },
    };
    const quoteDraft = {
      id: quoteId, tenant_id: tenantId, project_id: projectId, boq_id: boqId,
      boq_version_number: 1, quotation_number: `${marker}-Q1`, version_number: 1,
      status: 'draft', subtotal: 1000000, discount_amount: 0, vat_percent: 8,
      vat_amount: 80000, grand_total: 1080000, total_internal_cogs: 500000,
      total_gross_margin: 500000, gross_margin_percent: 50, payment_terms: 'E2E fixture terms',
      validity_days: 30, prepared_by: staffApproverId,
    };
    const quoteCreated = await db.query(
      'SELECT public.interior_create_quotation_snapshot($1::jsonb,$2::jsonb) AS id',
      [JSON.stringify(quoteDraft), JSON.stringify([quotationItem])],
    );
    expect(quoteCreated.rows[0].id).toBe(quoteId);

    const quotationApproval = await createApprovalRequest(db, {
      id: quotationApprovalId, approval_token: quotationApprovalToken, tenant_id: tenantId,
      project_id: projectId, subject_type: 'quotation', subject_id: quoteId,
      subject_version_number: 1, status: 'pending', client_representative: 'E2E Customer Fixture',
      client_contact: '+84000000000', sent_by_actor_id: staffApproverId,
      sent_by_actor_name: 'E2E Staff Approver',
    });
    expect(quotationApproval.id).toBe(quotationApprovalId);
    await assumeDatabaseRole('anon');
    const publicQuote = await db.query(
      'SELECT public.interior_read_public_customer_approval($1::uuid,$2::uuid) AS payload',
      [quotationApprovalId, quotationApprovalToken],
    );
    expect(publicQuote.rows[0].payload.subject).toMatchObject({ quotationId: quoteId, versionNumber: 1 });
    expect(publicQuote.rows[0].payload.subject.items).toHaveLength(1);
    const crossTokenRead = await db.query(
      'SELECT public.interior_read_public_customer_approval($1::uuid,$2::uuid) AS payload',
      [quotationApprovalId, randomUUID()],
    );
    expect(crossTokenRead.rows[0].payload).toBeNull();
    const quoteAccepted = await transitionPublicApproval(db, quotationApprovalId, quotationApprovalToken, 'approved');
    expect(quoteAccepted).toBe(true);
    expect(await transitionPublicApproval(db, quotationApprovalId, quotationApprovalToken, 'approved')).toBe(false);
    await assumeAdminRole();
    const acceptedQuoteRow = await db.query(
      'SELECT status, version_number, boq_id, boq_version_number FROM public.interior_quotations WHERE id=$1::uuid AND tenant_id=$2::uuid',
      [quoteId, tenantId],
    );
    expect(acceptedQuoteRow.rows[0]).toEqual({
      status: 'accepted', version_number: 1, boq_id: boqId, boq_version_number: 1,
    });
    await assumeDatabaseRole('authenticated', foreignStaffId, foreignTenantId);
    const crossTenantRead = await db.query(
      'SELECT public.interior_read_quotation($1::uuid) AS quotation', [quoteId],
    );
    expect(crossTenantRead.rows[0].quotation).toBeNull();

    await assumeDatabaseRole('authenticated', staffApproverId);
    const milestonePayload = [
      { id: milestoneIds[0], milestone_order: 1, name: 'Deposit', percentage: 50,
        amount: 540000, trigger_condition: 'Contract signed', status: 'pending' },
      { id: milestoneIds[1], milestone_order: 2, name: 'Completion', percentage: 50,
        amount: 540000, trigger_condition: 'Customer handover', status: 'pending' },
    ];
    const contractDraft = {
      id: contractId, tenant_id: tenantId, project_id: projectId, quotation_id: quoteId,
      contract_number: `${marker}-CTR1`, title: 'E2E interior contract', status: 'draft',
      baseline_contract_value: 1080000, current_contract_value: 1080000, signed_date: null,
      quotation_customer_approval_id: quotationApprovalId, customer_approval_id: null,
      client_representative: 'E2E Customer Fixture', contractor_representative: 'E2E Bella Staff',
      quotation_number: `${marker}-Q1`, quotation_version_number: 1,
      boq_id: boqId, boq_version_number: 1, design_revision_id: designRevisionId,
      design_version_number: 1, payment_terms: 'E2E fixture terms',
      execution_start_date: '2027-01-01', execution_end_date: '2027-03-01', notes: marker,
    };
    const contractCreated = await db.query(
      'SELECT public.interior_create_contract_with_milestones($1::jsonb,$2::jsonb) AS id',
      [JSON.stringify(contractDraft), JSON.stringify(milestonePayload)],
    );
    expect(contractCreated.rows[0].id).toBe(contractId);
    const contractApproval = await createApprovalRequest(db, {
      id: contractApprovalId, approval_token: contractApprovalToken, tenant_id: tenantId,
      project_id: projectId, subject_type: 'contract', subject_id: contractId,
      subject_version_number: 1, status: 'pending', client_representative: 'E2E Customer Fixture',
      client_contact: '+84000000000', sent_by_actor_id: staffApproverId,
      sent_by_actor_name: 'E2E Staff Approver',
    });
    expect(contractApproval.id).toBe(contractApprovalId);
    await assumeAdminRole();
    const internalRpcAccess = await db.query(
      `SELECT has_function_privilege('anon', 'public.interior_create_contract_with_milestones(jsonb,jsonb)', 'EXECUTE') AS anon_can_create_contract`,
    );
    expect(internalRpcAccess.rows[0].anon_can_create_contract).toBe(false);

    const contractSignature = await uploadSyntheticEvidence(tenantId, contractApprovalId);
    await assumeDatabaseRole('service_role');
    const signed = await db.query(
      `SELECT public.interior_transition_public_customer_approval(
        $1::uuid,$2::uuid,'approved'::public.interior_approval_status,NULL,NULL,
        $3,$4,$5,$6,$7::timestamptz
      ) AS changed`,
      [contractApprovalId, contractApprovalToken, contractSignature.path, 'application/pdf',
        contractSignature.bytes.length, createHash('sha256').update(contractSignature.bytes).digest('hex'), new Date().toISOString()],
    );
    expect(signed.rows[0].changed).toBe(true);
    expect(await transitionPublicApproval(db, contractApprovalId, contractApprovalToken, 'approved')).toBe(false);

    await assumeAdminRole();
    const signedContract = await db.query(
      `SELECT status, quotation_id, quotation_version_number, boq_id, boq_version_number,
        design_revision_id, design_version_number, quotation_customer_approval_id,
        customer_approval_id, baseline_contract_value, current_contract_value
       FROM public.interior_contracts WHERE tenant_id=$1::uuid AND id=$2::uuid`,
      [tenantId, contractId],
    );
    expect(signedContract.rows[0]).toEqual({
      status: 'signed', quotation_id: quoteId, quotation_version_number: 1,
      boq_id: boqId, boq_version_number: 1, design_revision_id: designRevisionId,
      design_version_number: 1, quotation_customer_approval_id: quotationApprovalId,
      customer_approval_id: contractApprovalId, baseline_contract_value: '1080000.00',
      current_contract_value: '1080000.00',
    });
    await expectRejectedUpdate(db,
      'UPDATE public.interior_contracts SET baseline_contract_value=1 WHERE id=$1::uuid',
      [contractId], 'ContractImmutabilityViolation');
    const contractOutbox = await db.query(
      `SELECT count(*)::integer AS count FROM public.interior_finance_outbox
       WHERE tenant_id=$1::uuid AND event_type='INTERIOR_CONTRACT_MILESTONE_INVOICED' AND reference_id LIKE $2`,
      [tenantId, `${contractId}_m%`],
    );
    expect(contractOutbox.rows[0].count).toBe(1);

    await assumeDatabaseRole('authenticated', staffApproverId);
    const proposedSchedule = milestoneIds.map((id, index) => ({
      id, milestoneOrder: index + 1, name: index === 0 ? 'Deposit' : 'Completion',
      percentage: 50, amount: 600000,
      triggerCondition: index === 0 ? 'Contract signed' : 'Customer handover', dueDate: null,
    }));
    const addendumDraft = {
      id: addendumId, tenant_id: tenantId, contract_id: contractId,
      addendum_number: `${marker}-ADD1`, title: 'E2E approved variation',
      value_delta: 120000, reason: 'Controlled synthetic E2E fixture',
      proposed_payment_schedule: proposedSchedule,
    };
    const createdAddendum = await db.query(
      'SELECT public.interior_create_contract_addendum_request($1::jsonb) AS row',
      [JSON.stringify(addendumDraft)],
    );
    expect(createdAddendum.rows[0].row.status).toBe('pending_customer_approval');
    const addendumApproval = await db.query(
      'SELECT public.interior_create_customer_addendum_approval_request($1::jsonb) AS row',
      [JSON.stringify({
        id: addendumApprovalId, approval_token: addendumApprovalToken,
        tenant_id: tenantId, project_id: projectId, subject_type: 'contract_addendum',
        subject_id: addendumId, subject_version_number: 1, status: 'pending',
        client_representative: 'E2E Customer Fixture', client_contact: '+84000000000',
        sent_at: new Date().toISOString(), expires_at: futureExpiry(),
        sent_by_actor_id: staffApproverId,
      })],
    );
    expect(addendumApproval.rows[0].row.id).toBe(addendumApprovalId);
    await assumeDatabaseRole('anon');
    const publicAddendum = await db.query(
      'SELECT public.interior_read_public_customer_addendum_approval($1::uuid,$2::uuid) AS payload',
      [addendumApprovalId, addendumApprovalToken],
    );
    expect(publicAddendum.rows[0].payload.subject.proposedContractValue).toBe(1200000);
    expect(await transitionPublicApproval(db, addendumApprovalId, addendumApprovalToken, 'approved')).toBe(true);
    expect(await transitionPublicApproval(db, addendumApprovalId, addendumApprovalToken, 'approved')).toBe(false);

    await assumeAdminRole();
    const approvedAddendum = await db.query(
      `SELECT d.status AS addendum_status, c.current_contract_value, c.baseline_contract_value,
        (SELECT sum(m.amount) FROM public.interior_payment_milestones m
         WHERE m.tenant_id=c.tenant_id AND m.contract_id=c.id) AS schedule_total
       FROM public.interior_contract_addenda d
       JOIN public.interior_contracts c ON c.tenant_id=d.tenant_id AND c.id=d.contract_id
       WHERE d.tenant_id=$1::uuid AND d.id=$2::uuid`,
      [tenantId, addendumId],
    );
    expect(approvedAddendum.rows[0]).toEqual({
      addendum_status: 'approved', current_contract_value: '1200000.00',
      baseline_contract_value: '1080000.00', schedule_total: '1200000.00',
    });

    await assumeDatabaseRole('authenticated', staffApproverId);
    await db.query(
      `INSERT INTO public.interior_payment_transactions (
        id, tenant_id, contract_id, milestone_id, amount, payment_method,
        reference_code, transaction_date, notes, recorded_by
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,600000,'bank_transfer',$5,CURRENT_DATE,$6,$7)`,
      [randomUUID(), tenantId, contractId, milestoneIds[0], `${marker}-PAY-1`, marker, staffApproverId],
    );
    await expectUniquePaymentReference(db, {
      tenantId, contractId, milestoneId: milestoneIds[0], reference: `${marker}-PAY-1`, actorId: staffApproverId,
    });
    await expectOverpaymentRejected(db, {
      tenantId, contractId, milestoneId: milestoneIds[0], reference: `${marker}-PAY-OVER`, actorId: staffApproverId,
    });
    await db.query(
      `INSERT INTO public.interior_payment_transactions (
        id, tenant_id, contract_id, milestone_id, amount, payment_method,
        reference_code, transaction_date, notes, recorded_by
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,600000,'bank_transfer',$5,CURRENT_DATE,$6,$7)`,
      [randomUUID(), tenantId, contractId, milestoneIds[1], `${marker}-PAY-2`, marker, staffApproverId],
    );
    await assumeAdminRole();
    const paymentBalance = await db.query(
      `SELECT sum(amount)::numeric(15,2) AS receipts,
        (SELECT sum(collected_amount) FROM public.interior_payment_milestones
         WHERE tenant_id=$1::uuid AND contract_id=$2::uuid) AS collected,
        (SELECT sum(amount-collected_amount) FROM public.interior_payment_milestones
         WHERE tenant_id=$1::uuid AND contract_id=$2::uuid) AS outstanding,
        (SELECT count(*)::integer FROM public.interior_finance_outbox
         WHERE tenant_id=$1::uuid AND event_type='INTERIOR_PAYMENT_TRANSACTION_RECORDED'
           AND payload->>'contractId'=($2::uuid)::text) AS outbox_count
       FROM public.interior_payment_transactions WHERE tenant_id=$1::uuid AND contract_id=$2::uuid`,
      [tenantId, contractId],
    );
    expect(paymentBalance.rows[0]).toEqual({
      receipts: '1200000.00', collected: '1200000.00', outstanding: '0.00', outbox_count: 2,
    });

    await assumeDatabaseRole('authenticated', staffApproverId);
    const handover = await db.query(
      'SELECT public.interior_request_handover_acceptance($1::uuid,$2::uuid) AS result',
      [projectId, contractId],
    );
    expect(handover.rows[0].result.status).toBe('COMMITTED');
    handoverApprovalId = handover.rows[0].result.approval.id;
    handoverApprovalToken = handover.rows[0].result.approval.token;
    await assumeDatabaseRole('anon');
    const publicHandover = await db.query(
      'SELECT public.interior_read_public_handover_acceptance($1::uuid,$2::uuid) AS payload',
      [handoverApprovalId, handoverApprovalToken],
    );
    expect(publicHandover.rows[0].payload.subject).toMatchObject({
      contractNumber: `${marker}-CTR1`, contractStatus: 'signed', finalSettlementValue: 1200000,
      openPunchListItems: 0,
    });
    const handoverSignature = await uploadSyntheticEvidence(tenantId, handoverApprovalId);
    await assumeDatabaseRole('service_role');
    const acceptedHandover = await db.query(
      `SELECT public.interior_transition_public_handover_acceptance(
        $1::uuid,$2::uuid,'approved',NULL,$3,$4,'application/pdf',$5,$6
      ) AS changed`,
      [handoverApprovalId, handoverApprovalToken, 'Synthetic E2E acceptance fixture',
        handoverSignature.path, handoverSignature.bytes.length,
        createHash('sha256').update(handoverSignature.bytes).digest('hex')],
    );
    expect(acceptedHandover.rows[0].changed).toBe(true);
    const duplicateHandover = await db.query(
      `SELECT public.interior_transition_public_handover_acceptance(
        $1::uuid,$2::uuid,'approved',NULL,$3,$4,'application/pdf',$5,$6
      ) AS changed`,
      [handoverApprovalId, handoverApprovalToken, 'Synthetic E2E acceptance fixture',
        handoverSignature.path, handoverSignature.bytes.length,
        createHash('sha256').update(handoverSignature.bytes).digest('hex')],
    );
    expect(duplicateHandover.rows[0].changed).toBe(false);

    await assumeAdminRole();
    const finalState = await db.query(
      `SELECT p.status AS project_status, h.status AS handover_status,
        h.client_accepted, r.status AS acceptance_status, r.signature_sha256_hash,
        w.certificate_number, w.contract_id,
        (SELECT count(*)::integer FROM public.interior_warranty_certificates other
         WHERE other.tenant_id=w.tenant_id AND other.contract_id=w.contract_id) AS warranty_count
       FROM public.interior_projects p
       JOIN public.interior_handover_dossiers h ON h.tenant_id=p.tenant_id AND h.project_id=p.id
       JOIN public.interior_handover_acceptance_requests r ON r.tenant_id=h.tenant_id AND r.id=h.customer_acceptance_request_id
       JOIN public.interior_warranty_certificates w ON w.tenant_id=p.tenant_id AND w.project_id=p.id AND w.contract_id=$2::uuid
       WHERE p.tenant_id=$1::uuid AND p.id=$3::uuid`,
      [tenantId, contractId, projectId],
    );
    expect(finalState.rows).toHaveLength(1);
    expect(finalState.rows[0]).toMatchObject({
      project_status: 'warranty', handover_status: 'completed', client_accepted: true,
      acceptance_status: 'approved',
      signature_sha256_hash: createHash('sha256').update(handoverSignature.bytes).digest('hex'),
      contract_id: contractId, warranty_count: 1,
    });
    expect(finalState.rows[0].certificate_number).toContain(marker);
  });

  async function createStaffActor(label: string, actorTenantId = tenantId): Promise<string> {
    const admin = requireSupabaseAdmin();
    const email = `${marker}-${label}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data.user) {
      throw new Error('INTERIOR_COMMERCIAL_E2E_AUTH_FIXTURE_CREATE_FAILED');
    }
    const userId = created.data.user.id;
    actorIds.push(userId);
    const db = requireDatabase();
    await db.query(
      "INSERT INTO public.users (id, tenant_id, email, full_name, role, status) "
        + "VALUES ($1::uuid,$2::uuid,$3,$4,'admin','active')",
      [userId, actorTenantId, email, `E2E ${label}`],
    );
    await db.query(
      `INSERT INTO public.interior_user_roles (tenant_id,user_id,role_key,scope_type,scope_id,granted_by)
       VALUES ($1::uuid,$2::uuid,'OWNER','TENANT',NULL,$2::uuid)`,
      [actorTenantId, userId],
    );
    return userId;
  }

  async function setClaims(role: DbRole, actorId = '', actorTenantId = tenantId): Promise<void> {
    const claims = role === 'anon'
      ? { role }
      : { role, ...(actorId ? { sub: actorId } : {}), tenant_id: actorTenantId,
        app_metadata: { tenant_id: actorTenantId } };
    await requireDatabase().query(
      `SELECT set_config('request.jwt.claim.sub',$1,true),
        set_config('request.jwt.claim.role',$2,true),
        set_config('request.jwt.claims',$3,true)`,
      [actorId, role, JSON.stringify(claims)],
    );
  }

  async function assumeDatabaseRole(role: DbRole, actorId = '', actorTenantId = tenantId): Promise<void> {
    await requireDatabase().query('RESET ROLE');
    await setClaims(role, actorId, actorTenantId);
    await requireDatabase().query(`SET LOCAL ROLE ${role}`);
  }

  async function assumeAdminRole(): Promise<void> {
    await requireDatabase().query('RESET ROLE');
    await setClaims('service_role');
    await requireDatabase().query('RESET request.jwt.claim.sub');
    await requireDatabase().query("SELECT set_config('request.jwt.claim.role','service_role',true)");
    await requireDatabase().query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
  }

  async function createApprovalRequest(db: Client, approval: Record<string, unknown>): Promise<ApprovalRequest> {
    await assumeDatabaseRole('authenticated', staffApproverId);
    const result = await db.query(
      'SELECT public.interior_create_customer_approval_request($1::jsonb) AS approval',
      [JSON.stringify({ ...approval, sent_at: new Date().toISOString(), expires_at: futureExpiry(),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() })],
    );
    return result.rows[0].approval as ApprovalRequest;
  }

  async function transitionPublicApproval(
    db: Client,
    approvalId: string,
    token: string,
    targetStatus: 'approved' | 'rejected',
  ): Promise<boolean> {
    await assumeDatabaseRole('anon');
    const result = await db.query(
      `SELECT public.interior_transition_public_customer_approval(
        $1::uuid,$2::uuid,$3::public.interior_approval_status,NULL,NULL,NULL,NULL,NULL,NULL,NULL
      ) AS changed`,
      [approvalId, token, targetStatus],
    );
    return result.rows[0].changed as boolean;
  }

  async function uploadSyntheticEvidence(tenant: string, approvalId: string): Promise<UploadedEvidence> {
    const bytes = Buffer.from(`%PDF-1.4\n% Synthetic non-customer E2E evidence ${marker}\n%%EOF\n`);
    const path = `${tenant}/${approvalId}/${randomUUID()}.pdf`;
    const result = await requireSupabaseAdmin().storage.from('interior-customer-signatures')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (result.error) throw new Error('INTERIOR_COMMERCIAL_E2E_SIGNATURE_FIXTURE_UPLOAD_FAILED');
    uploadedEvidence.push({ path, bytes });
    return { path, bytes };
  }

  async function expectRejectedUpdate(db: Client, sql: string, values: unknown[], message: string): Promise<void> {
    await db.query('SAVEPOINT expected_contract_immutability_failure');
    try {
      await db.query(sql, values);
      throw new Error('INTERIOR_COMMERCIAL_E2E_EXPECTED_IMMUTABILITY_REJECTION');
    } catch (error) {
      const pgError = error as { message?: string };
      expect(pgError.message).toContain(message);
    } finally {
      await db.query('ROLLBACK TO SAVEPOINT expected_contract_immutability_failure');
      await db.query('RELEASE SAVEPOINT expected_contract_immutability_failure');
    }
  }

  async function expectUniquePaymentReference(
    db: Client,
    fixture: { tenantId: string; contractId: string; milestoneId: string; reference: string; actorId: string },
  ): Promise<void> {
    await db.query('SAVEPOINT expected_duplicate_payment');
    let code = '';
    try {
      await db.query(
        `INSERT INTO public.interior_payment_transactions (
          id,tenant_id,contract_id,milestone_id,amount,payment_method,reference_code,transaction_date,notes,recorded_by
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,1,'bank_transfer',$5,CURRENT_DATE,'duplicate fixture',$6)`,
        [randomUUID(), fixture.tenantId, fixture.contractId, fixture.milestoneId, fixture.reference, fixture.actorId],
      );
    } catch (error) {
      code = (error as { code?: string }).code || '';
    }
    await db.query('ROLLBACK TO SAVEPOINT expected_duplicate_payment');
    await db.query('RELEASE SAVEPOINT expected_duplicate_payment');
    expect(code).toBe('23505');
  }

  async function expectOverpaymentRejected(
    db: Client,
    fixture: { tenantId: string; contractId: string; milestoneId: string; reference: string; actorId: string },
  ): Promise<void> {
    await db.query('SAVEPOINT expected_overpayment');
    let message = '';
    try {
      await db.query(
        `INSERT INTO public.interior_payment_transactions (
          id,tenant_id,contract_id,milestone_id,amount,payment_method,reference_code,transaction_date,notes,recorded_by
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,1,'bank_transfer',$5,CURRENT_DATE,'overpayment fixture',$6)`,
        [randomUUID(), fixture.tenantId, fixture.contractId, fixture.milestoneId, fixture.reference, fixture.actorId],
      );
    } catch (error) {
      message = (error as { message?: string }).message || '';
    }
    await db.query('ROLLBACK TO SAVEPOINT expected_overpayment');
    await db.query('RELEASE SAVEPOINT expected_overpayment');
    expect(message).toContain('INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE');
  }

  function futureExpiry(): string {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  function requireDatabase(): Client {
    if (!database) throw new Error('INTERIOR_COMMERCIAL_E2E_DATABASE_NOT_CONNECTED');
    return database;
  }

  function requireSupabaseAdmin(): SupabaseClient {
    if (!supabaseAdmin) throw new Error('INTERIOR_COMMERCIAL_E2E_SUPABASE_ADMIN_NOT_CONFIGURED');
    return supabaseAdmin;
  }
});
