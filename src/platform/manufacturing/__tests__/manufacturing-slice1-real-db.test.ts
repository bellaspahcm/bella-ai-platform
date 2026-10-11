import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow } from 'pg';

import {
  FixedManufacturingClock,
  ManufacturingSlice1Service,
  PostgresManufacturingRepository,
  StaticManufacturingAuthorization,
  type FinishedGoodsReceiptEvidence,
  type LogisticsEvidenceBindingPort,
  type ManufacturingActor,
  type ManufacturingIdFactory,
  type ManufacturingSqlClient,
  type MaterialIssueLogisticsEvidence,
  type MaterialAvailabilityPort,
} from '..';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadManufacturingE2eEnv();

const dbUrl =
  process.env.E2E_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

const migrationSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20261010010000_create_manufacturing_slice1_foundation.sql'),
  'utf8'
);
const executionCompletionMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261010040000_create_manufacturing_execution_completion.sql'
  ),
  'utf8'
);
const qualityDispositionMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261010050000_create_manufacturing_quality_dispositions.sql'
  ),
  'utf8'
);
const routingProgressMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261011010000_create_manufacturing_routing_progress.sql'
  ),
  'utf8'
);
const operationProgressEvidenceMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261011020000_bind_manufacturing_operation_progress_evidence.sql'
  ),
  'utf8'
);
const lotGenealogyMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261011030000_bind_manufacturing_lot_genealogy_evidence.sql'
  ),
  'utf8'
);
const productionPlanMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261011050000_create_manufacturing_production_plan_mvp.sql'
  ),
  'utf8'
);

const describeWithRealDb =
  isRunnableDbUrl(dbUrl) && isAllowedE2eProject() && isAllowedE2eDbUrl(dbUrl) ? describe : describe.skip;

class RandomUuidManufacturingIdFactory implements ManufacturingIdFactory {
  next(): string {
    return randomUUID();
  }
}

class AuthenticatedManufacturingSqlClient implements ManufacturingSqlClient {
  constructor(
    private readonly client: Client,
    private readonly context: { userId: string; tenantId: string }
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }> {
    if (sql.trim().toUpperCase() === 'BEGIN') {
      await this.client.query('BEGIN');
      await this.client.query('SET LOCAL ROLE authenticated');
      await this.client.query('SET LOCAL row_security = on');
      await this.client.query(
        `
          SELECT
            set_config('app.current_user_id', $1, TRUE),
            set_config('app.current_tenant_id', $2, TRUE),
            set_config('request.jwt.claim.sub', $1, TRUE),
            set_config('request.jwt.claim.role', 'authenticated', TRUE)
        `,
        [this.context.userId, this.context.tenantId]
      );
      return { rows: [] };
    }

    const result = await this.client.query<Row>(sql, values ? [...values] : undefined);
    return { rows: result.rows };
  }
}

type CountRow = QueryResultRow & { count: string };
type PolicyRow = QueryResultRow & { tablename: string; policyname: string };

describeWithRealDb('Manufacturing Slice 1 real DB verification', () => {
  jest.setTimeout(120_000);

  const marker = `mfg-slice1-${Date.now()}`;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    personA: randomUUID(),
    personB: randomUUID(),
    factoryA: randomUUID(),
    factoryADenied: randomUUID(),
    factoryB: randomUUID(),
  };

  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await admin.connect();
    await admin.query(migrationSql);
    await admin.query(executionCompletionMigrationSql);
    await admin.query(qualityDispositionMigrationSql);
    await admin.query(routingProgressMigrationSql);
    await admin.query(operationProgressEvidenceMigrationSql);
    await admin.query(lotGenealogyMigrationSql);
    await admin.query(productionPlanMigrationSql);
    await seedTenant(ids.tenantA, `${marker} Tenant A`);
    await seedTenant(ids.tenantB, `${marker} Tenant B`);
    await seedUser(ids.tenantA, ids.userA, ids.personA, ids.factoryA, ids.factoryADenied, 'a');
    await seedUser(ids.tenantB, ids.userB, ids.personB, ids.factoryB, undefined, 'b');
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      await cleanupFixtures();
      await admin.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    } finally {
      await admin.end();
    }
  });

  it('applies schema, constraints, and RLS policies for Slice 1 tables', async () => {
    const tables = [
      'manufacturing_production_orders',
      'manufacturing_production_order_lines',
      'manufacturing_bom_revisions',
      'manufacturing_bom_components',
      'manufacturing_material_requirements',
      'manufacturing_production_executions',
      'manufacturing_production_order_completions',
      'manufacturing_quality_dispositions',
      'manufacturing_work_centers',
      'manufacturing_routing_revisions',
      'manufacturing_routing_operations',
      'manufacturing_operation_progress',
      'manufacturing_production_plans',
      'manufacturing_production_plan_schedule_slots',
      'manufacturing_command_idempotency',
    ];

    for (const table of tables) {
      const exists = await admin.query<CountRow>(
        `
          SELECT COUNT(*)::text AS count
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        `,
        [table]
      );
      expect(Number(exists.rows[0].count)).toBe(1);

      const rls = await admin.query<QueryResultRow & { relrowsecurity: boolean }>(
        'SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass',
        [`public.${table}`]
      );
      expect(rls.rows[0].relrowsecurity).toBe(true);
    }

    const policies = await admin.query<PolicyRow>(
      `
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename LIKE 'manufacturing_%'
      `
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual(
      expect.arrayContaining([
        'manufacturing_production_orders_factory_access',
        'manufacturing_production_executions_order_access',
        'manufacturing_production_completions_order_access',
        'manufacturing_quality_dispositions_order_access',
        'manufacturing_work_centers_factory_access',
        'manufacturing_routing_revisions_factory_access',
        'manufacturing_routing_operations_revision_access',
        'manufacturing_operation_progress_order_access',
        'manufacturing_production_plans_factory_access',
        'manufacturing_plan_schedule_slots_plan_access',
        'manufacturing_command_idempotency_factory_access',
      ])
    );

    const lineUniqueness = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM pg_constraint
        WHERE conname = 'uq_manufacturing_production_order_lines_order_item'
      `
    );
    expect(Number(lineUniqueness.rows[0].count)).toBe(1);

    const progressEvidenceColumns = await admin.query<QueryResultRow & { column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'manufacturing_operation_progress'
          AND column_name IN ('production_execution_id', 'completed_quantity', 'quantity_uom')
      `
    );
    expect(progressEvidenceColumns.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(['production_execution_id', 'completed_quantity', 'quantity_uom'])
    );

    const progressEvidenceConstraints = await admin.query<QueryResultRow & { conname: string }>(
      `
        SELECT conname
        FROM pg_constraint
        WHERE conname IN (
          'uq_manufacturing_production_executions_line_id',
          'fk_manufacturing_operation_progress_execution_line',
          'ck_manufacturing_operation_progress_completed_evidence'
        )
      `
    );
    expect(progressEvidenceConstraints.rows.map((row) => row.conname)).toEqual(
      expect.arrayContaining([
        'uq_manufacturing_production_executions_line_id',
        'fk_manufacturing_operation_progress_execution_line',
        'ck_manufacturing_operation_progress_completed_evidence',
      ])
    );
  });

  it('persists order, BOM, requirements, release state, and idempotency through authenticated RLS', async () => {
    const { service, client } = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const order = await service.createProductionOrder(actor, {
        idempotencyKey: `${marker}-create-order`,
        orderNumber: `${marker}-PO-001`,
        finishedGoodItemId: 'finished_good_a',
        targetQuantity: 10,
        uom: 'EA',
      });
      const duplicateOrder = await service.createProductionOrder(actor, {
        idempotencyKey: `${marker}-create-order`,
        orderNumber: `${marker}-PO-001`,
        finishedGoodItemId: 'finished_good_a',
        targetQuantity: 10,
        uom: 'EA',
      });

      expect(order.isDuplicate).toBe(false);
      expect(duplicateOrder.isDuplicate).toBe(true);
      expect(duplicateOrder.value.id).toBe(order.value.id);

      const bom = await service.createBOMRevision(actor, {
        idempotencyKey: `${marker}-create-bom`,
        finishedGoodItemId: 'finished_good_a',
        revisionCode: 'REV-1',
        components: [{ componentItemId: 'component_a', quantityPerUnit: 2, uom: 'EA' }],
      });
      const approvedBom = await service.approveBOMRevision(actor, {
        idempotencyKey: `${marker}-approve-bom`,
        bomRevisionId: bom.value.id,
      });
      const requirements = await service.calculateMaterialRequirements(actor, {
        idempotencyKey: `${marker}-calc-req`,
        productionOrderId: order.value.id,
        bomRevisionId: approvedBom.value.id,
        sourceLocationId: 'warehouse-a',
      });
      const released = await service.releaseProductionOrder(actor, {
        idempotencyKey: `${marker}-release-order`,
        productionOrderId: order.value.id,
        bomRevisionId: approvedBom.value.id,
      });

      expect(requirements.value[0]).toMatchObject({
        componentItemId: 'component_a',
        requiredQuantity: 20,
        availableQuantity: 100,
        status: 'available',
      });
      expect(released.value.status).toBe('released');

      await expectCount('manufacturing_production_orders', ids.tenantA, 1);
      await expectCount('manufacturing_bom_revisions', ids.tenantA, 1);
      await expectCount('manufacturing_material_requirements', ids.tenantA, 1);
      await expectCount('manufacturing_command_idempotency', ids.tenantA, 5);
    } finally {
      await client.end();
    }
  });

  it('persists production plans, schedule slots, approval, plan-to-order link, and tenant RLS', async () => {
    const { service, repository, client } = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const bom = await service.createBOMRevision(actor, {
        idempotencyKey: `${marker}-plan-bom`,
        finishedGoodItemId: 'finished_good_plan',
        revisionCode: 'PLAN-REV-1',
        components: [{ componentItemId: 'component_a', quantityPerUnit: 2, uom: 'EA' }],
      });
      const approvedBom = await service.approveBOMRevision(actor, {
        idempotencyKey: `${marker}-plan-bom-approve`,
        bomRevisionId: bom.value.id,
      });
      const workCenter = await service.createWorkCenter(actor, {
        idempotencyKey: `${marker}-plan-wc`,
        code: `${marker}-WC-PLAN`,
        name: 'Plan Work Center',
      });
      const routing = await service.createRoutingRevision(actor, {
        idempotencyKey: `${marker}-plan-route`,
        finishedGoodItemId: 'finished_good_plan',
        revisionCode: 'PLAN-ROUTE-1',
        operations: [{
          sequence: 10,
          operationCode: 'PLAN-OP-10',
          operationName: 'Plan Operation',
          workCenterId: workCenter.value.id,
        }],
      });
      const approvedRouting = await service.approveRoutingRevision(actor, {
        idempotencyKey: `${marker}-plan-route-approve`,
        routingRevisionId: routing.value.id,
      });
      const plan = await service.createProductionPlan(actor, {
        idempotencyKey: `${marker}-plan-create`,
        planNumber: `${marker}-PLAN-001`,
        sourceType: 'sales_order',
        sourceReferenceId: `${marker}-SO-001`,
        sourceReferenceNumber: 'SO-001',
        finishedGoodItemId: 'finished_good_plan',
        plannedQuantity: 10,
        uom: 'EA',
        requestedDueAt: '2026-10-20T00:00:00.000Z',
      });
      const retryPlan = await service.createProductionPlan(actor, {
        idempotencyKey: `${marker}-plan-create`,
        planNumber: `${marker}-PLAN-001`,
        sourceType: 'sales_order',
        sourceReferenceId: `${marker}-SO-001`,
        sourceReferenceNumber: 'SO-001',
        finishedGoodItemId: 'finished_good_plan',
        plannedQuantity: 10,
        uom: 'EA',
        requestedDueAt: '2026-10-20T00:00:00.000Z',
      });
      expect(retryPlan.isDuplicate).toBe(true);
      expect(retryPlan.value.id).toBe(plan.value.id);

      const readiness = await service.calculateProductionPlanMaterialReadiness(actor, {
        idempotencyKey: `${marker}-plan-ready`,
        productionPlanId: plan.value.id,
        bomRevisionId: approvedBom.value.id,
        sourceLocationId: 'warehouse-a',
      });
      expect(readiness.value.materialReadinessStatus).toBe('available');
      expect(readiness.value.materialRequirements[0]).toMatchObject({
        componentItemId: 'component_a',
        requiredQuantity: 20,
        availableQuantity: 100,
        status: 'available',
      });

      await service.scheduleProductionPlan(actor, {
        idempotencyKey: `${marker}-plan-schedule`,
        productionPlanId: plan.value.id,
        routingRevisionId: approvedRouting.value.id,
        slots: [{
          routingOperationId: approvedRouting.value.operations[0].id,
          plannedDate: '2026-10-20',
          shiftCode: 'DAY',
          plannedQuantity: 10,
        }],
      });
      await service.submitProductionPlanForApproval(actor, {
        idempotencyKey: `${marker}-plan-submit`,
        productionPlanId: plan.value.id,
      });
      await service.approveProductionPlan(actor, {
        idempotencyKey: `${marker}-plan-approve`,
        productionPlanId: plan.value.id,
      });
      const released = await service.releaseProductionPlanToOrder(actor, {
        idempotencyKey: `${marker}-plan-release`,
        productionPlanId: plan.value.id,
        orderNumber: `${marker}-PO-FROM-PLAN`,
      });

      expect(released.value.plan.status).toBe('released');
      expect(released.value.productionOrder.status).toBe('draft');
      expect(released.value.productionOrder.bomRevisionId).toBe(approvedBom.value.id);

      const persistedPlan = await repository.getProductionPlan(ids.tenantA, plan.value.id);
      const persistedSlots = await repository.getProductionPlanScheduleSlots({
        tenantId: ids.tenantA,
        productionPlanId: plan.value.id,
      });
      expect(persistedPlan).toMatchObject({
        status: 'released',
        linkedProductionOrderId: released.value.productionOrder.id,
      });
      expect(persistedSlots).toHaveLength(1);
      expect(persistedSlots[0]).toMatchObject({
        status: 'released',
        workCenterId: workCenter.value.id,
      });

      const tenantB = await createRealDbService(ids.userB, ids.tenantB);
      try {
        await expect(
          tenantB.repository.withTransaction((repository) => repository.getProductionPlan(ids.tenantA, plan.value.id))
        ).resolves.toBeNull();
      } finally {
        await tenantB.client.end();
      }

      await expectCount('manufacturing_production_plans', ids.tenantA, 1);
      await expectCount('manufacturing_production_plan_schedule_slots', ids.tenantA, 1);
    } finally {
      await client.end();
    }
  });

  it('enforces tenant and factory isolation under authenticated role', async () => {
    const { service, client } = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);
    const order = await service.createProductionOrder(actor, {
      idempotencyKey: `${marker}-rls-order`,
      orderNumber: `${marker}-PO-RLS`,
      finishedGoodItemId: 'finished_good_rls',
      targetQuantity: 1,
      uom: 'EA',
    });

    await client.end();

    const tenantBClient = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await tenantBClient.connect();
    try {
      const tenantB = new AuthenticatedManufacturingSqlClient(tenantBClient, {
        userId: ids.userB,
        tenantId: ids.tenantB,
      });
      const repository = new PostgresManufacturingRepository(tenantB);
      const hidden = await repository.withTransaction((scopedRepository) =>
        scopedRepository.getProductionOrder(ids.tenantA, order.value.id)
      );
      expect(hidden).toBeNull();
    } finally {
      await tenantBClient.end();
    }

    const factoryDenied = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await factoryDenied.connect();
    try {
      await factoryDenied.query('BEGIN');
      await factoryDenied.query('SET LOCAL ROLE authenticated');
      await factoryDenied.query('SET LOCAL row_security = on');
      await factoryDenied.query(
        `
          SELECT
            set_config('app.current_user_id', $1, TRUE),
            set_config('app.current_tenant_id', $2, TRUE),
            set_config('request.jwt.claim.sub', $1, TRUE),
            set_config('request.jwt.claim.role', 'authenticated', TRUE)
        `,
        [ids.userA, ids.tenantA]
      );
      await expect(
        factoryDenied.query(
          `
            INSERT INTO public.manufacturing_production_orders (
              id, tenant_id, factory_org_unit_id, order_number, finished_good_item_id,
              target_quantity, uom, status, created_by
            )
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'finished_good_denied', 1, 'EA', 'draft', $5::uuid)
          `,
          [randomUUID(), ids.tenantA, ids.factoryADenied, `${marker}-PO-DENIED`, ids.userA]
        )
      ).rejects.toThrow();
    } finally {
      await factoryDenied.query('ROLLBACK').catch(() => undefined);
      await factoryDenied.end();
    }
  });

  it('keeps idempotent command log atomic under concurrent duplicate create commands', async () => {
    const first = await createRealDbService(ids.userA, ids.tenantA);
    const second = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);
    const command = {
      idempotencyKey: `${marker}-concurrent-create`,
      orderNumber: `${marker}-PO-CONCURRENT`,
      finishedGoodItemId: 'finished_good_concurrent',
      targetQuantity: 2,
      uom: 'EA',
    };

    try {
      const results = await Promise.all([
        first.service.createProductionOrder(actor, command),
        second.service.createProductionOrder(actor, command),
      ]);

      expect(results.map((result) => result.value.id).sort()).toEqual([
        results[0].value.id,
        results[0].value.id,
      ]);
      expect(results.some((result) => result.isDuplicate)).toBe(true);
      await expectCountWhere(
        'manufacturing_production_orders',
        'tenant_id = $1::uuid AND order_number = $2',
        [ids.tenantA, command.orderNumber],
        1
      );
      await expectCountWhere(
        'manufacturing_command_idempotency',
        'tenant_id = $1::uuid AND operation = $2 AND business_key = $3',
        [ids.tenantA, 'manufacturing.production_order.create', command.idempotencyKey],
        1
      );
    } finally {
      await first.client.end();
      await second.client.end();
    }
  });

  it('persists production execution and completion reconciliation through authenticated RLS', async () => {
    const { service, client } = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const order = await service.createProductionOrder(actor, {
        idempotencyKey: `${marker}-execution-order`,
        orderNumber: `${marker}-PO-EXECUTION`,
        finishedGoodItemId: 'finished_good_execution',
        targetQuantity: 10,
        uom: 'EA',
      });
      const bom = await service.createBOMRevision(actor, {
        idempotencyKey: `${marker}-execution-bom`,
        finishedGoodItemId: 'finished_good_execution',
        revisionCode: 'REV-EXECUTION',
        components: [{ componentItemId: 'component_execution', quantityPerUnit: 1, uom: 'EA' }],
      });
      const approvedBom = await service.approveBOMRevision(actor, {
        idempotencyKey: `${marker}-execution-approve-bom`,
        bomRevisionId: bom.value.id,
      });
      await service.calculateMaterialRequirements(actor, {
        idempotencyKey: `${marker}-execution-calc-req`,
        productionOrderId: order.value.id,
        bomRevisionId: approvedBom.value.id,
        sourceLocationId: 'warehouse-execution',
      });
      const released = await service.releaseProductionOrder(actor, {
        idempotencyKey: `${marker}-execution-release`,
        productionOrderId: order.value.id,
        bomRevisionId: approvedBom.value.id,
      });
      const line = released.value.lines[0];
      if (!line) throw new Error('Expected production order line');

      const execution = await service.recordProductionExecution(actor, {
        idempotencyKey: `${marker}-execution-record`,
        productionOrderId: order.value.id,
        productionOrderLineId: line.id,
        materialIssueDocumentId: `${marker}-issue-doc`,
        materialIssueMovementId: `${marker}-issue-movement`,
        materialIssueEvidence: materialIssueEvidence({
          productionOrderId: order.value.id,
          productionOrderLineId: line.id,
          issueDocumentId: `${marker}-issue-doc`,
          movementId: `${marker}-issue-movement`,
        }),
        actualQuantity: 10,
        acceptedQuantity: 8,
        rejectedQuantity: 1,
        scrapQuantity: 1,
        uom: 'EA',
      });
      const duplicateExecution = await service.recordProductionExecution(actor, {
        idempotencyKey: `${marker}-execution-record`,
        productionOrderId: order.value.id,
        productionOrderLineId: line.id,
        materialIssueDocumentId: `${marker}-issue-doc`,
        materialIssueMovementId: `${marker}-issue-movement`,
        materialIssueEvidence: materialIssueEvidence({
          productionOrderId: order.value.id,
          productionOrderLineId: line.id,
          issueDocumentId: `${marker}-issue-doc`,
          movementId: `${marker}-issue-movement`,
        }),
        actualQuantity: 10,
        acceptedQuantity: 8,
        rejectedQuantity: 1,
        scrapQuantity: 1,
        uom: 'EA',
      });

      expect(execution.isDuplicate).toBe(false);
      expect(duplicateExecution.isDuplicate).toBe(true);
      expect(duplicateExecution.value.id).toBe(execution.value.id);

      const rejectedDisposition = await service.recordQualityDisposition(actor, {
        idempotencyKey: `${marker}-quality-reject`,
        productionOrderId: order.value.id,
        productionOrderLineId: line.id,
        productionExecutionId: execution.value.id,
        sourceQuantityType: 'rejected',
        disposition: 'discard_reject',
        quantity: 1,
        acceptedOutputQuantity: 0,
        reasonCode: 'FAILED_INSPECTION',
        evidenceReference: `${marker}-qc-report`,
        finalHandlingDecision: true,
      });
      const duplicateRejectedDisposition = await service.recordQualityDisposition(actor, {
        idempotencyKey: `${marker}-quality-reject`,
        productionOrderId: order.value.id,
        productionOrderLineId: line.id,
        productionExecutionId: execution.value.id,
        sourceQuantityType: 'rejected',
        disposition: 'discard_reject',
        quantity: 1,
        acceptedOutputQuantity: 0,
        reasonCode: 'FAILED_INSPECTION',
        evidenceReference: `${marker}-qc-report`,
        finalHandlingDecision: true,
      });
      await service.recordQualityDisposition(actor, {
        idempotencyKey: `${marker}-quality-scrap`,
        productionOrderId: order.value.id,
        productionOrderLineId: line.id,
        productionExecutionId: execution.value.id,
        sourceQuantityType: 'scrap',
        disposition: 'scrap',
        quantity: 1,
        acceptedOutputQuantity: 0,
        reasonCode: 'DAMAGED_OUTPUT',
        evidenceReference: `${marker}-qc-photo`,
      });

      expect(rejectedDisposition.isDuplicate).toBe(false);
      expect(duplicateRejectedDisposition.isDuplicate).toBe(true);
      expect(duplicateRejectedDisposition.value.id).toBe(rejectedDisposition.value.id);
      await expect(
        service.recordQualityDisposition(actor, {
          idempotencyKey: `${marker}-quality-reject`,
          productionOrderId: order.value.id,
          productionOrderLineId: line.id,
          productionExecutionId: execution.value.id,
          sourceQuantityType: 'rejected',
          disposition: 'discard_reject',
          quantity: 0.5,
          acceptedOutputQuantity: 0,
          reasonCode: 'FAILED_INSPECTION',
          evidenceReference: `${marker}-qc-report`,
          finalHandlingDecision: true,
        })
      ).rejects.toThrow();

      const completion = await service.completeProductionOrder(actor, {
        idempotencyKey: `${marker}-execution-complete`,
        productionOrderId: order.value.id,
        receiptEvidence: [receiptEvidence({
          productionOrderId: order.value.id,
          productionOrderLineId: line.id,
          receiptDocumentId: `${marker}-fgr`,
          receiptLineId: `${marker}-fgr-line`,
          acceptedQuantity: 8,
          rejectedQuantity: 1,
          pendingQuantity: 0,
        })],
      });

      expect(completion.value).toMatchObject({
        productionOrderId: order.value.id,
        completedQuantity: 8,
        rejectedQuantity: 1,
        scrapQuantity: 1,
        qualityDispositionEvidence: expect.arrayContaining([
          expect.objectContaining({ disposition: 'discard_reject', terminal: true }),
          expect.objectContaining({ disposition: 'scrap', terminal: true }),
        ]),
      });
      await expectCountWhere(
        'manufacturing_production_executions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.value.id],
        1
      );
      await expectCountWhere(
        'manufacturing_quality_dispositions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.value.id],
        2
      );
      await expectCountWhere(
        'manufacturing_production_order_completions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.value.id],
        1
      );
    } finally {
      await client.end();
    }
  });

  it('persists routing progress, enforces idempotency, and blocks completion until routed operations complete', async () => {
    const { service, client } = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const { order, line, execution } = await createExecutedOrder({
        service,
        actor,
        suffix: 'routing-progress',
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        scrapQuantity: 0,
      });
      const workCenter = await service.createWorkCenter(actor, {
        idempotencyKey: `${marker}-routing-wc`,
        code: `${marker}-WC-ROUTING`,
        name: `${marker} routing work center`,
      });
      const routing = await service.createRoutingRevision(actor, {
        idempotencyKey: `${marker}-routing-revision`,
        finishedGoodItemId: line.finishedGoodItemId,
        revisionCode: `${marker}-ROUTE-1`,
        operations: [
          {
            sequence: 10,
            operationCode: `${marker}-CUT`,
            operationName: 'Cutting',
            workCenterId: workCenter.value.id,
          },
          {
            sequence: 20,
            operationCode: `${marker}-ASSEMBLE`,
            operationName: 'Assembly',
            workCenterId: workCenter.value.id,
          },
        ],
      });
      const approvedRouting = await service.approveRoutingRevision(actor, {
        idempotencyKey: `${marker}-routing-approve`,
        routingRevisionId: routing.value.id,
      });
      const applied = await service.applyRoutingRevision(actor, {
        idempotencyKey: `${marker}-routing-apply`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        routingRevisionId: approvedRouting.value.id,
      });
      const duplicateApply = await service.applyRoutingRevision(actor, {
        idempotencyKey: `${marker}-routing-apply`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        routingRevisionId: approvedRouting.value.id,
      });

      expect(applied.isDuplicate).toBe(false);
      expect(duplicateApply.isDuplicate).toBe(true);
      expect(applied.value).toHaveLength(2);
      await expectCountWhere(
        'manufacturing_operation_progress',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.id],
        2
      );
      const firstProgress = applied.value.find(
        (progress) => progress.routingOperationId === approvedRouting.value.operations[0].id
      );
      const secondProgress = applied.value.find(
        (progress) => progress.routingOperationId === approvedRouting.value.operations[1].id
      );
      if (!firstProgress || !secondProgress) throw new Error('Expected routed operation progress rows');
      const tenantBClient = new Client({ connectionString: dbUrl, ssl: sslConfig() });
      await tenantBClient.connect();
      try {
        const tenantB = new AuthenticatedManufacturingSqlClient(tenantBClient, {
          userId: ids.userB,
          tenantId: ids.tenantB,
        });
        const tenantBRepository = new PostgresManufacturingRepository(tenantB);
        const hiddenProgress = await tenantBRepository.withTransaction((repository) =>
          repository.getOperationProgressById(ids.tenantA, firstProgress.id)
        );
        expect(hiddenProgress).toBeNull();
      } finally {
        await tenantBClient.end();
      }

      const receipt = receiptEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        receiptDocumentId: `${marker}-fgr-routing-progress`,
        receiptLineId: `${marker}-fgr-line-routing-progress`,
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        pendingQuantity: 0,
      });
      await expect(
        service.completeProductionOrder(actor, {
          idempotencyKey: `${marker}-complete-routing-incomplete`,
          productionOrderId: order.id,
          receiptEvidence: [receipt],
        })
      ).rejects.toThrow();
      await expectCountWhere(
        'manufacturing_production_order_completions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.id],
        0
      );

      await service.updateOperationProgress(actor, {
        idempotencyKey: `${marker}-routing-second-ready`,
        operationProgressId: secondProgress.id,
        status: 'ready',
      });
      await expect(
        service.updateOperationProgress(actor, {
          idempotencyKey: `${marker}-routing-second-start-too-early`,
          operationProgressId: secondProgress.id,
          status: 'in_progress',
        })
      ).rejects.toThrow();

      const ready = await service.updateOperationProgress(actor, {
        idempotencyKey: `${marker}-routing-ready`,
        operationProgressId: firstProgress.id,
        status: 'ready',
      });
      const started = await service.updateOperationProgress(actor, {
        idempotencyKey: `${marker}-routing-start`,
        operationProgressId: firstProgress.id,
        status: 'in_progress',
      });
      await expect(
        service.updateOperationProgress(actor, {
          idempotencyKey: `${marker}-routing-complete-too-much`,
          operationProgressId: firstProgress.id,
          status: 'completed',
          productionExecutionId: execution.id,
          completedQuantity: 11,
        })
      ).rejects.toThrow();
      const completed = await service.updateOperationProgress(actor, {
        idempotencyKey: `${marker}-routing-complete`,
        operationProgressId: firstProgress.id,
        status: 'completed',
        productionExecutionId: execution.id,
        completedQuantity: 10,
      });

      expect(ready.value.status).toBe('ready');
      expect(started.value.startedAt).toBeDefined();
      expect(completed.value.completedAt).toBeDefined();
      expect(completed.value.productionExecutionId).toBe(execution.id);
      expect(completed.value.completedQuantity).toBe(10);

      await service.updateOperationProgress(actor, {
        idempotencyKey: `${marker}-routing-second-start`,
        operationProgressId: secondProgress.id,
        status: 'in_progress',
      });
      await service.updateOperationProgress(actor, {
        idempotencyKey: `${marker}-routing-second-complete`,
        operationProgressId: secondProgress.id,
        status: 'completed',
        productionExecutionId: execution.id,
        completedQuantity: 10,
      });

      const completion = await service.completeProductionOrder(actor, {
        idempotencyKey: `${marker}-complete-routing-finished`,
        productionOrderId: order.id,
        receiptEvidence: [receipt],
      });
      expect(completion.value.completedQuantity).toBe(10);
    } finally {
      await client.end();
    }
  });

  it('blocks production completion when rework quality disposition remains open on real DB', async () => {
    const { service, client } = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const { order, line, execution } = await createExecutedOrder({
        service,
        actor,
        suffix: 'quality-rework',
        acceptedQuantity: 9,
        rejectedQuantity: 1,
        scrapQuantity: 0,
      });

      await service.recordQualityDisposition(actor, {
        idempotencyKey: `${marker}-quality-rework`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        productionExecutionId: execution.id,
        sourceQuantityType: 'rejected',
        disposition: 'rework',
        quantity: 1,
        acceptedOutputQuantity: 0,
      });

      await expect(
        service.completeProductionOrder(actor, {
          idempotencyKey: `${marker}-complete-quality-rework`,
          productionOrderId: order.id,
          receiptEvidence: [receiptEvidence({
            productionOrderId: order.id,
            productionOrderLineId: line.id,
            receiptDocumentId: `${marker}-fgr-quality-rework`,
            receiptLineId: `${marker}-fgr-line-quality-rework`,
            acceptedQuantity: 9,
            rejectedQuantity: 1,
            pendingQuantity: 0,
          })],
        })
      ).rejects.toThrow();

      await expectCountWhere(
        'manufacturing_quality_dispositions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.id],
        1
      );
      await expectCountWhere(
        'manufacturing_production_order_completions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.id],
        0
      );
    } finally {
      await client.end();
    }
  });

  it('blocks production completion when pending quality disposition remains open on real DB', async () => {
    const { service, client } = await createRealDbService(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const { order, line, execution } = await createExecutedOrder({
        service,
        actor,
        suffix: 'quality-pending',
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        scrapQuantity: 0,
      });

      await service.recordQualityDisposition(actor, {
        idempotencyKey: `${marker}-quality-pending`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        productionExecutionId: execution.id,
        receiptDocumentId: `${marker}-fgr-quality-pending`,
        receiptLineId: `${marker}-fgr-line-quality-pending`,
        sourceQuantityType: 'pending',
        disposition: 'pending',
        quantity: 1,
        acceptedOutputQuantity: 0,
      });

      await expect(
        service.completeProductionOrder(actor, {
          idempotencyKey: `${marker}-complete-quality-pending`,
          productionOrderId: order.id,
          receiptEvidence: [receiptEvidence({
            productionOrderId: order.id,
            productionOrderLineId: line.id,
            receiptDocumentId: `${marker}-fgr-quality-pending`,
            receiptLineId: `${marker}-fgr-line-quality-pending`,
            acceptedQuantity: 10,
            rejectedQuantity: 0,
            pendingQuantity: 1,
          })],
        })
      ).rejects.toThrow();

      await expectCountWhere(
        'manufacturing_quality_dispositions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.id],
        1
      );
      await expectCountWhere(
        'manufacturing_production_order_completions',
        'tenant_id = $1::uuid AND production_order_id = $2::uuid',
        [ids.tenantA, order.id],
        0
      );
    } finally {
      await client.end();
    }
  });

  async function createRealDbService(userId: string, tenantId: string) {
    const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    const repository = new PostgresManufacturingRepository(
      new AuthenticatedManufacturingSqlClient(client, { userId, tenantId })
    );
    const authorization = new StaticManufacturingAuthorization(
      { [ids.userA]: ids.factoryA, [ids.userB]: ids.factoryB },
      {
        [ids.userA]: [
          'manufacturing:production_plan:write',
          'manufacturing:production_plan:approve',
          'manufacturing:production_plan:release',
          'manufacturing:production_order:write',
          'manufacturing:production_order:release',
          'manufacturing:production_order:complete',
          'manufacturing:bom:write',
          'manufacturing:bom:approve',
          'manufacturing:material_requirement:calculate',
          'manufacturing:availability:read',
          'manufacturing:execution:record',
          'manufacturing:quality_disposition:record',
          'manufacturing:work_center:write',
          'manufacturing:routing:write',
          'manufacturing:routing:approve',
          'manufacturing:routing:apply',
          'manufacturing:operation_progress:update',
          'manufacturing:genealogy:read',
        ],
        [ids.userB]: ['manufacturing:production_order:write'],
      }
    );
    const availability: MaterialAvailabilityPort = {
      async getAvailable() {
        return 100;
      },
    };
    return {
      client,
      repository,
      service: new ManufacturingSlice1Service(
        repository,
        authorization,
        availability,
        createEvidenceBindingPort(),
        new RandomUuidManufacturingIdFactory(),
        new FixedManufacturingClock()
      ),
    };
  }

  function createEvidenceBindingPort(): LogisticsEvidenceBindingPort {
    return {
      async verifyMaterialIssueEvidence(params) {
        if (
          params.evidence.productionOrderId !== params.productionOrderId ||
          params.evidence.productionOrderLineId !== params.productionOrderLineId
        ) {
          throw new Error('Material issue evidence mismatch');
        }
      },
      async verifyFinishedGoodsReceiptEvidence(params) {
        const evidence = params.receipt.logisticsEvidence;
        if (
          evidence.productionOrderId !== params.productionOrderId ||
          evidence.productionOrderLineId !== params.receipt.productionOrderLineId ||
          evidence.receiptDocumentId !== params.receipt.receiptDocumentId ||
          evidence.receiptLineId !== params.receipt.receiptLineId
        ) {
          throw new Error('Finished goods receipt evidence mismatch');
        }
      },
    };
  }

  function materialIssueEvidence(params: {
    productionOrderId: string;
    productionOrderLineId: string;
    issueDocumentId: string;
    movementId: string;
    materialRequirementId?: string;
    quantity?: number;
    lotNumber?: string;
    serialNumbers?: string[];
  }): MaterialIssueLogisticsEvidence {
    return {
      issueDocumentId: params.issueDocumentId,
      movementId: params.movementId,
      traceabilityEventId: `${params.movementId}-trace`,
      itemId: 'component_a',
      locationId: 'warehouse-bin-a',
      quantity: params.quantity ?? 20,
      lotNumber: params.lotNumber ?? 'raw-lot-1',
      serialNumbers: params.serialNumbers,
      productionOrderId: params.productionOrderId,
      productionOrderLineId: params.productionOrderLineId,
      materialRequirementId: params.materialRequirementId,
    };
  }

  function receiptEvidence(params: {
    productionOrderId: string;
    productionOrderLineId: string;
    receiptDocumentId: string;
    receiptLineId: string;
    acceptedQuantity: number;
    rejectedQuantity?: number;
    pendingQuantity?: number;
    lotNumber?: string;
    serialNumbers?: string[];
  }): FinishedGoodsReceiptEvidence {
    return {
      productionOrderLineId: params.productionOrderLineId,
      receiptDocumentId: params.receiptDocumentId,
      receiptLineId: params.receiptLineId,
      lotNumber: params.lotNumber ?? 'fg-lot-1',
      serialNumbers: params.serialNumbers,
      acceptedQuantity: params.acceptedQuantity,
      rejectedQuantity: params.rejectedQuantity,
      pendingQuantity: params.pendingQuantity,
      logisticsEvidence: {
        receiptDocumentId: params.receiptDocumentId,
        receiptLineId: params.receiptLineId,
        movementId: `${params.receiptLineId}-movement`,
        traceabilityEventId: `${params.receiptLineId}-trace`,
        itemId: 'finished_good_a',
        locationId: 'finished-goods-warehouse',
        quantity: params.acceptedQuantity,
        lotNumber: params.lotNumber ?? 'fg-lot-1',
        serialNumbers: params.serialNumbers,
        productionOrderId: params.productionOrderId,
        productionOrderLineId: params.productionOrderLineId,
        acceptedQuantity: params.acceptedQuantity,
        rejectedQuantity: params.rejectedQuantity,
        pendingQuantity: params.pendingQuantity,
      },
    };
  }

  async function createExecutedOrder(params: {
    service: ManufacturingSlice1Service;
    actor: ManufacturingActor;
    suffix: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
    scrapQuantity: number;
  }) {
    const targetQuantity = params.acceptedQuantity + params.rejectedQuantity + params.scrapQuantity;
    const order = await params.service.createProductionOrder(params.actor, {
      idempotencyKey: `${marker}-${params.suffix}-order`,
      orderNumber: `${marker}-PO-${params.suffix}`,
      finishedGoodItemId: `finished_good_${params.suffix}`,
      targetQuantity,
      uom: 'EA',
    });
    const bom = await params.service.createBOMRevision(params.actor, {
      idempotencyKey: `${marker}-${params.suffix}-bom`,
      finishedGoodItemId: `finished_good_${params.suffix}`,
      revisionCode: `REV-${params.suffix}`,
      components: [{ componentItemId: `component_${params.suffix}`, quantityPerUnit: 1, uom: 'EA' }],
    });
    const approvedBom = await params.service.approveBOMRevision(params.actor, {
      idempotencyKey: `${marker}-${params.suffix}-approve-bom`,
      bomRevisionId: bom.value.id,
    });
    await params.service.calculateMaterialRequirements(params.actor, {
      idempotencyKey: `${marker}-${params.suffix}-calc-req`,
      productionOrderId: order.value.id,
      bomRevisionId: approvedBom.value.id,
      sourceLocationId: `warehouse-${params.suffix}`,
    });
    const released = await params.service.releaseProductionOrder(params.actor, {
      idempotencyKey: `${marker}-${params.suffix}-release`,
      productionOrderId: order.value.id,
      bomRevisionId: approvedBom.value.id,
    });
    const line = released.value.lines[0];
    if (!line) throw new Error('Expected production order line');
    const execution = await params.service.recordProductionExecution(params.actor, {
      idempotencyKey: `${marker}-${params.suffix}-execution`,
      productionOrderId: order.value.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: `${marker}-issue-doc-${params.suffix}`,
      materialIssueMovementId: `${marker}-issue-movement-${params.suffix}`,
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.value.id,
        productionOrderLineId: line.id,
        issueDocumentId: `${marker}-issue-doc-${params.suffix}`,
        movementId: `${marker}-issue-movement-${params.suffix}`,
      }),
      actualQuantity: targetQuantity,
      acceptedQuantity: params.acceptedQuantity,
      rejectedQuantity: params.rejectedQuantity,
      scrapQuantity: params.scrapQuantity,
      uom: 'EA',
    });

    return { order: order.value, line, execution: execution.value };
  }

  async function seedTenant(tenantId: string, name: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.tenants (id, name, status, enabled_modules)
        VALUES ($1::uuid, $2, 'active', '{}'::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            status = EXCLUDED.status,
            enabled_modules = EXCLUDED.enabled_modules
      `,
      [tenantId, name]
    );
  }

  async function seedUser(
    tenantId: string,
    userId: string,
    personId: string,
    factoryId: string,
    extraFactoryId: string | undefined,
    label: string
  ): Promise<void> {
    await admin.query(
      `
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        VALUES (
          '00000000-0000-0000-0000-000000000000'::uuid,
          $1::uuid,
          'authenticated',
          'authenticated',
          $2,
          '',
          NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [userId, `${marker}-${label}@example.com`]
    );
    await admin.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, 'ktv', 'active')
        ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            status = EXCLUDED.status
      `,
      [userId, tenantId, `${marker}-${label}@example.com`, `${marker} ${label}`]
    );
    await seedFactory(tenantId, factoryId, `${marker}-${label}-factory`);
    if (extraFactoryId) {
      await seedFactory(tenantId, extraFactoryId, `${marker}-${label}-factory-denied`);
    }
    await admin.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"manufacturing-slice1"}'::jsonb)
      `,
      [personId, tenantId, userId, `${marker} person ${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata
        )
        VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, '{"proof":"manufacturing-slice1"}'::jsonb)
      `,
      [tenantId, personId, factoryId]
    );
  }

  async function seedFactory(tenantId: string, factoryId: string, code: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{"proof":"manufacturing-slice1","manufacturing_role":"factory"}'::jsonb)
      `,
      [factoryId, tenantId, code, code]
    );
  }

  function createActor(tenantId: string, userId: string, factoryOrgUnitId: string): ManufacturingActor {
    return {
      tenantId,
      userId,
      factoryOrgUnitId,
      roles: ['manufacturing_planner'],
    };
  }

  async function expectCount(table: string, tenantId: string, expected: number): Promise<void> {
    await expectCountWhere(table, 'tenant_id = $1::uuid', [tenantId], expected);
  }

  async function expectCountWhere(
    table: string,
    whereClause: string,
    values: readonly unknown[],
    expected: number
  ): Promise<void> {
    const result = await admin.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM public.${table} WHERE ${whereClause}`,
      [...values]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
    await admin.query('DELETE FROM public.manufacturing_production_plan_schedule_slots WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_production_plans WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_production_order_completions WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_operation_progress WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_quality_dispositions WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_production_executions WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_command_idempotency WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_material_requirements WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_bom_components WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_bom_revisions WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_routing_operations WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_routing_revisions WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_work_centers WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_production_order_lines WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.manufacturing_production_orders WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.org_relationships WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.people_directory WHERE id = ANY($1::uuid[])', [[ids.personA, ids.personB]]);
    await admin.query('DELETE FROM public.org_units WHERE id = ANY($1::uuid[])', [
      [ids.factoryA, ids.factoryADenied, ids.factoryB],
    ]);
    await admin.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
  }
});

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function loadManufacturingE2eEnv(): void {
  for (const filePath of candidateE2eEnvFiles()) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnv(readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
      }
    }
  }
  mapE2eAliases();
}

function candidateE2eEnvFiles(): string[] {
  const candidates = [
    process.env.E2E_ENV_FILE,
    path.join(tmpdir(), 'bella-spa-e2e.env'),
    path.resolve(process.cwd(), '.env.e2e'),
    path.resolve(process.cwd(), '../BELLA SPA ERP/.env.e2e'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(candidates.map((filePath) => path.resolve(filePath)))];
}

function mapE2eAliases(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.E2E_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.E2E_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!process.env.SUPABASE_DB_URL && process.env.E2E_SUPABASE_DB_URL) {
    process.env.SUPABASE_DB_URL = process.env.E2E_SUPABASE_DB_URL;
  }
}

function isAllowedE2eProject(): boolean {
  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  try {
    return new URL(supabaseUrl).host === EXPECTED_E2E_SUPABASE_HOST;
  } catch {
    return false;
  }
}

function isAllowedE2eDbUrl(value: string): boolean {
  return value.toLowerCase().includes(EXPECTED_E2E_PROJECT_REF);
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}
