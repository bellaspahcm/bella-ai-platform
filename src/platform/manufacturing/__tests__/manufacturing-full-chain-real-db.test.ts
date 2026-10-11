import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow } from 'pg';

import {
  FixedManufacturingClock,
  LogisticsEvidenceBindingAdapter,
  LogisticsFinishedGoodsReceiptAdapter,
  LogisticsProductionConsumptionIssueAdapter,
  ManufacturingSlice1Service,
  PostgresManufacturingRepository,
  StaticManufacturingAuthorization,
  type FinishedGoodsReceiptEvidence,
  type ManufacturingActor,
  type ManufacturingIdFactory,
  type ManufacturingSqlClient,
  type MaterialAvailabilityPort,
  type MaterialIssueLogisticsEvidence,
} from '..';
import { WarehouseStockInCanonicalFacade } from '../../logistics/warehouse/stock-in-canonical.facade';
import { createWarehousePostgresStockInPorts } from '../../logistics/warehouse/postgres-stock-in-ports';
import { WarehouseStockOutCanonicalFacade } from '../../logistics/warehouse/stock-out-canonical.facade';
import { createWarehousePostgresStockOutPorts } from '../../logistics/warehouse/postgres-stock-out-ports';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadManufacturingE2eEnv();

const dbUrl =
  process.env.E2E_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

const manufacturingFoundationMigrationSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20261010010000_create_manufacturing_slice1_foundation.sql'),
  'utf8'
);
const stockOutIdempotencyMigrationSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20261010020000_create_logistics_stock_out_idempotency.sql'),
  'utf8'
);
const stockInIdempotencyMigrationSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20261010030000_create_logistics_stock_in_idempotency.sql'),
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

const describeWithRealDb =
  isRunnableDbUrl(dbUrl) && isAllowedE2eProject() && isAllowedE2eDbUrl(dbUrl) ? describe : describe.skip;

class RandomUuidManufacturingIdFactory implements ManufacturingIdFactory {
  next(): string {
    return randomUUID();
  }
}

class AuthenticatedSqlClient implements ManufacturingSqlClient {
  constructor(
    private readonly client: Client,
    private readonly context: { userId: string; tenantId: string }
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[]; rowCount: number | null }> {
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
      return { rows: [], rowCount: 0 };
    }

    const result = await this.client.query<Row>(sql, values ? [...values] : undefined);
    return { rows: result.rows, rowCount: result.rowCount };
  }
}

type CountRow = QueryResultRow & { count: string };

describeWithRealDb('Manufacturing full operational chain evidence binding real DB verification', () => {
  jest.setTimeout(180_000);

  const marker = `mfg-full-chain-${Date.now()}`;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    personA: randomUUID(),
    personB: randomUUID(),
    factoryA: randomUUID(),
    factoryB: randomUUID(),
    rawItemA: randomUUID(),
    rawItemB: randomUUID(),
    finishedGoodA: randomUUID(),
    rawLocationA: randomUUID(),
    rawLocationB: randomUUID(),
    finishedGoodLocationA: randomUUID(),
  };

  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await admin.connect();
    await admin.query(manufacturingFoundationMigrationSql);
    await admin.query(stockOutIdempotencyMigrationSql);
    await admin.query(stockInIdempotencyMigrationSql);
    await admin.query(executionCompletionMigrationSql);
    await admin.query(qualityDispositionMigrationSql);
    await admin.query(routingProgressMigrationSql);
    await admin.query(operationProgressEvidenceMigrationSql);
    await admin.query(lotGenealogyMigrationSql);
    await assertRuntimeTablesExist();
    await seedTenant(ids.tenantA, `${marker} Tenant A`);
    await seedTenant(ids.tenantB, `${marker} Tenant B`);
    await seedUser(ids.tenantA, ids.userA, ids.personA, ids.factoryA, 'a');
    await seedUser(ids.tenantB, ids.userB, ids.personB, ids.factoryB, 'b');
    await seedLogisticsItem(ids.tenantA, ids.rawItemA, `${marker}-RAW-A`, 'RAW_MATERIAL');
    await seedLogisticsItem(ids.tenantB, ids.rawItemB, `${marker}-RAW-B`, 'RAW_MATERIAL');
    await seedLogisticsItem(ids.tenantA, ids.finishedGoodA, `${marker}-FG-A`, 'FINISHED_GOOD');
    await seedLogisticsLocation(ids.tenantA, ids.rawLocationA, `${marker}-RAW-LOC-A`);
    await seedLogisticsLocation(ids.tenantB, ids.rawLocationB, `${marker}-RAW-LOC-B`);
    await seedLogisticsLocation(ids.tenantA, ids.finishedGoodLocationA, `${marker}-FG-LOC-A`);
    await seedInventory(ids.tenantA, ids.rawItemA, ids.rawLocationA, 20, `${marker}-raw-lot-a`);
    await seedInventory(ids.tenantB, ids.rawItemB, ids.rawLocationB, 20, `${marker}-raw-lot-b`);
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      await cleanupFixtures();
    } finally {
      await admin.end();
    }
  });

  it('binds real Logistics stock-out and stock-in evidence through completion', async () => {
    const runtime = await createRuntime(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const { order, line, requirementId } = await createReleasedOrder(runtime.service, actor, 'happy');
      const stockOut = await runtime.issue.issue({
        tenantId: ids.tenantA,
        actorId: ids.userA,
        correlationId: `${marker}-happy-issue`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        idempotencyKey: `${marker}-happy-issue`,
        issueDocumentId: `${marker}-issue-doc-happy`,
        issueDocumentNumber: `${marker}-ISSUE-HAPPY`,
        warehouseSkuId: `${marker}-raw-sku`,
        warehouseBinId: `${marker}-raw-bin`,
        itemId: ids.rawItemA,
        locationId: ids.rawLocationA,
        quantity: 10,
        unitOfMeasure: 'EA',
        lotNumber: `${marker}-raw-lot-a`,
        materialRequirementId: requirementId,
      });
      expect(stockOut.ok).toBe(true);
      if (!stockOut.ok) throw new Error(stockOut.error.message);

      const duplicateStockOut = await runtime.issue.issue({
        tenantId: ids.tenantA,
        actorId: ids.userA,
        correlationId: `${marker}-happy-issue`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        idempotencyKey: `${marker}-happy-issue`,
        issueDocumentId: `${marker}-issue-doc-happy`,
        issueDocumentNumber: `${marker}-ISSUE-HAPPY`,
        warehouseSkuId: `${marker}-raw-sku`,
        warehouseBinId: `${marker}-raw-bin`,
        itemId: ids.rawItemA,
        locationId: ids.rawLocationA,
        quantity: 10,
        unitOfMeasure: 'EA',
        lotNumber: `${marker}-raw-lot-a`,
        materialRequirementId: requirementId,
      });
      expect(duplicateStockOut.ok).toBe(true);
      if (!duplicateStockOut.ok) throw new Error(duplicateStockOut.error.message);
      expect(duplicateStockOut.value.isDuplicate).toBe(true);
      expect(duplicateStockOut.value.lines[0].movement.id).toBe(stockOut.value.lines[0].movement.id);

      const execution = await runtime.service.recordProductionExecution(actor, {
        idempotencyKey: `${marker}-happy-execution`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        materialIssueDocumentId: stockOut.value.issueDocumentId,
        materialIssueMovementId: stockOut.value.lines[0].movement.id,
        materialIssueEvidence: materialIssueEvidenceFromStockOut(stockOut.value, requirementId),
        materialRequirementId: requirementId,
        actualQuantity: 10,
        acceptedQuantity: 9,
        rejectedQuantity: 1,
        scrapQuantity: 0,
        uom: 'EA',
      });

      await runtime.service.recordQualityDisposition(actor, {
        idempotencyKey: `${marker}-happy-quality-reject`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        productionExecutionId: execution.value.id,
        sourceQuantityType: 'rejected',
        disposition: 'discard_reject',
        quantity: 1,
        acceptedOutputQuantity: 0,
        reasonCode: 'FAILED_INSPECTION',
        evidenceReference: `${marker}-qc-report-happy`,
        finalHandlingDecision: true,
      });

      const stockIn = await runtime.receipt.receive({
        tenantId: ids.tenantA,
        actorId: ids.userA,
        correlationId: `${marker}-happy-fgr`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        idempotencyKey: `${marker}-happy-fgr`,
        receiptDocumentId: `${marker}-fgr-doc-happy`,
        receiptDocumentNumber: `${marker}-FGR-HAPPY`,
        receiptLineId: `${marker}-fgr-line-happy`,
        warehouseSkuId: `${marker}-fg-sku`,
        warehouseBinId: `${marker}-fg-bin`,
        itemId: ids.finishedGoodA,
        locationId: ids.finishedGoodLocationA,
        acceptedQuantity: 9,
        rejectedQuantity: 1,
        pendingQuantity: 0,
        qualityInspectionId: `${marker}-qc-happy`,
        unitOfMeasure: 'EA',
        lotNumber: `${marker}-fg-lot-happy`,
      });
      expect(stockIn.ok).toBe(true);
      if (!stockIn.ok) throw new Error(stockIn.error.message);

      const completion = await runtime.service.completeProductionOrder(actor, {
        idempotencyKey: `${marker}-happy-complete`,
        productionOrderId: order.id,
        receiptEvidence: [receiptEvidenceFromStockIn(stockIn.value, 9, 1, 0)],
      });

      expect(completion.value).toMatchObject({
        productionOrderId: order.id,
        completedQuantity: 9,
        rejectedQuantity: 1,
        scrapQuantity: 0,
      });
      await expectMovementCount(ids.tenantA, ids.rawItemA, 'warehouse_stock_out', 1);
      await expectMovementCount(ids.tenantA, ids.finishedGoodA, 'warehouse_stock_in', 1);
      await expectManufacturingCompletionCount(ids.tenantA, order.id, 1);

      const finishedGoodTrace = await runtime.service.traceFinishedGoodLot(actor, {
        finishedGoodItemId: ids.finishedGoodA,
        lotNumber: `${marker}-fg-lot-happy`,
      });
      expect(finishedGoodTrace).toEqual([
        expect.objectContaining({
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          materials: [
            expect.objectContaining({
              itemId: ids.rawItemA,
              lotNumber: `${marker}-raw-lot-a`,
              movementId: stockOut.value.lines[0].movement.id,
              traceabilityEventId: stockOut.value.lines[0].traceabilityEvent.id,
            }),
          ],
          finishedGoods: [
            expect.objectContaining({
              itemId: ids.finishedGoodA,
              lotNumber: `${marker}-fg-lot-happy`,
              movementId: stockIn.value.lines[0].movement.id,
              traceabilityEventId: stockIn.value.lines[0].traceabilityEvent.id,
            }),
          ],
        }),
      ]);

      const rawMaterialTrace = await runtime.service.traceRawMaterialLot(actor, {
        rawMaterialItemId: ids.rawItemA,
        lotNumber: `${marker}-raw-lot-a`,
      });
      expect(rawMaterialTrace).toEqual([
        expect.objectContaining({
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          materials: [
            expect.objectContaining({
              itemId: ids.rawItemA,
              lotNumber: `${marker}-raw-lot-a`,
            }),
          ],
          finishedGoods: [
            expect.objectContaining({
              itemId: ids.finishedGoodA,
              lotNumber: `${marker}-fg-lot-happy`,
            }),
          ],
        }),
      ]);
    } finally {
      await runtime.close();
    }
  });

  it('rejects nonexistent or cross-tenant material issue evidence before recording execution', async () => {
    const tenantA = await createRuntime(ids.userA, ids.tenantA);
    const tenantB = await createRuntime(ids.userB, ids.tenantB);
    const actorA = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const { order, line, requirementId } = await createReleasedOrder(tenantA.service, actorA, 'invalid-issue');
      await expect(
        tenantA.service.recordProductionExecution(actorA, {
          idempotencyKey: `${marker}-missing-issue-execution`,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          materialIssueDocumentId: `${marker}-missing-issue-doc`,
          materialIssueMovementId: randomUUID(),
          materialIssueEvidence: {
            issueDocumentId: `${marker}-missing-issue-doc`,
            movementId: randomUUID(),
            traceabilityEventId: randomUUID(),
            itemId: ids.rawItemA,
            locationId: ids.rawLocationA,
            quantity: 10,
            productionOrderId: order.id,
            productionOrderLineId: line.id,
            materialRequirementId: requirementId,
          },
          materialRequirementId: requirementId,
          actualQuantity: 10,
          acceptedQuantity: 10,
          uom: 'EA',
        })
      ).rejects.toThrow();

      const tenantBStockOut = await tenantB.issue.issue({
        tenantId: ids.tenantB,
        actorId: ids.userB,
        correlationId: `${marker}-tenant-b-issue`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        idempotencyKey: `${marker}-tenant-b-issue`,
        issueDocumentId: `${marker}-tenant-b-issue-doc`,
        warehouseSkuId: `${marker}-raw-sku-b`,
        warehouseBinId: `${marker}-raw-bin-b`,
        itemId: ids.rawItemB,
        locationId: ids.rawLocationB,
        quantity: 10,
        unitOfMeasure: 'EA',
        lotNumber: `${marker}-raw-lot-b`,
        materialRequirementId: requirementId,
      });
      expect(tenantBStockOut.ok).toBe(true);
      if (!tenantBStockOut.ok) throw new Error(tenantBStockOut.error.message);

      await expect(
        tenantA.service.recordProductionExecution(actorA, {
          idempotencyKey: `${marker}-cross-tenant-issue-execution`,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          materialIssueDocumentId: tenantBStockOut.value.issueDocumentId,
          materialIssueMovementId: tenantBStockOut.value.lines[0].movement.id,
          materialIssueEvidence: materialIssueEvidenceFromStockOut(tenantBStockOut.value, requirementId),
          materialRequirementId: requirementId,
          actualQuantity: 10,
          acceptedQuantity: 10,
          uom: 'EA',
        })
      ).rejects.toThrow();

      await expectProductionExecutionCount(ids.tenantA, order.id, 0);
    } finally {
      await tenantA.close();
      await tenantB.close();
    }
  });

  it('rejects mismatched FGR evidence and pending quality evidence before completion', async () => {
    const runtime = await createRuntime(ids.userA, ids.tenantA);
    const actor = createActor(ids.tenantA, ids.userA, ids.factoryA);

    try {
      const { order, line, requirementId } = await createReleasedOrder(runtime.service, actor, 'invalid-fgr');
      const stockOut = await runtime.issue.issue({
        tenantId: ids.tenantA,
        actorId: ids.userA,
        correlationId: `${marker}-invalid-fgr-issue`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        idempotencyKey: `${marker}-invalid-fgr-issue`,
        issueDocumentId: `${marker}-issue-doc-invalid-fgr`,
        warehouseSkuId: `${marker}-raw-sku-invalid`,
        warehouseBinId: `${marker}-raw-bin-invalid`,
        itemId: ids.rawItemA,
        locationId: ids.rawLocationA,
        quantity: 10,
        unitOfMeasure: 'EA',
        lotNumber: `${marker}-raw-lot-a`,
        materialRequirementId: requirementId,
      });
      expect(stockOut.ok).toBe(true);
      if (!stockOut.ok) throw new Error(stockOut.error.message);

      const execution = await runtime.service.recordProductionExecution(actor, {
        idempotencyKey: `${marker}-invalid-fgr-execution`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        materialIssueDocumentId: stockOut.value.issueDocumentId,
        materialIssueMovementId: stockOut.value.lines[0].movement.id,
        materialIssueEvidence: materialIssueEvidenceFromStockOut(stockOut.value, requirementId),
        materialRequirementId: requirementId,
        actualQuantity: 10,
        acceptedQuantity: 10,
        uom: 'EA',
      });

      const stockIn = await runtime.receipt.receive({
        tenantId: ids.tenantA,
        actorId: ids.userA,
        correlationId: `${marker}-invalid-fgr`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        idempotencyKey: `${marker}-invalid-fgr`,
        receiptDocumentId: `${marker}-fgr-doc-invalid`,
        receiptLineId: `${marker}-fgr-line-invalid`,
        warehouseSkuId: `${marker}-fg-sku-invalid`,
        warehouseBinId: `${marker}-fg-bin-invalid`,
        itemId: ids.finishedGoodA,
        locationId: ids.finishedGoodLocationA,
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        pendingQuantity: 0,
        unitOfMeasure: 'EA',
        lotNumber: `${marker}-fg-lot-invalid`,
      });
      expect(stockIn.ok).toBe(true);
      if (!stockIn.ok) throw new Error(stockIn.error.message);

      const receipt = receiptEvidenceFromStockIn(stockIn.value, 10, 0, 0);
      await expect(
        runtime.service.completeProductionOrder(actor, {
          idempotencyKey: `${marker}-invalid-fgr-complete`,
          productionOrderId: order.id,
          receiptEvidence: [{
            ...receipt,
            acceptedQuantity: 9,
          }],
        })
      ).rejects.toThrow();

      await runtime.service.recordQualityDisposition(actor, {
        idempotencyKey: `${marker}-invalid-fgr-pending-quality`,
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        productionExecutionId: execution.value.id,
        receiptDocumentId: receipt.receiptDocumentId,
        receiptLineId: receipt.receiptLineId,
        sourceQuantityType: 'pending',
        disposition: 'pending',
        quantity: 1,
        acceptedOutputQuantity: 0,
      });
      await expect(
        runtime.service.completeProductionOrder(actor, {
          idempotencyKey: `${marker}-pending-quality-complete`,
          productionOrderId: order.id,
          receiptEvidence: [{
            ...receipt,
            pendingQuantity: 1,
            logisticsEvidence: {
              ...receipt.logisticsEvidence,
              pendingQuantity: 1,
            },
          }],
        })
      ).rejects.toThrow();

      await expectManufacturingCompletionCount(ids.tenantA, order.id, 0);
    } finally {
      await runtime.close();
    }
  });

  async function createRuntime(userId: string, tenantId: string) {
    const manufacturingClient = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    const logisticsClient = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await manufacturingClient.connect();
    await logisticsClient.connect();

    const manufacturingSql = new AuthenticatedSqlClient(manufacturingClient, { userId, tenantId });
    const logisticsSql = new AuthenticatedSqlClient(logisticsClient, { userId, tenantId });
    const stockOutPorts = createWarehousePostgresStockOutPorts(logisticsSql, {
      idFactory: () => randomUUID(),
    });
    const stockInPorts = createWarehousePostgresStockInPorts(logisticsSql, {
      idFactory: () => randomUUID(),
    });
    const repository = new PostgresManufacturingRepository(manufacturingSql);
    const authorization = new StaticManufacturingAuthorization(
      { [ids.userA]: ids.factoryA, [ids.userB]: ids.factoryB },
      {
        [ids.userA]: [
          'manufacturing:production_order:write',
          'manufacturing:production_order:release',
          'manufacturing:production_order:complete',
          'manufacturing:bom:write',
          'manufacturing:bom:approve',
          'manufacturing:material_requirement:calculate',
          'manufacturing:availability:read',
          'manufacturing:execution:record',
          'manufacturing:quality_disposition:record',
          'manufacturing:genealogy:read',
        ],
        [ids.userB]: [
          'manufacturing:production_order:write',
          'manufacturing:production_order:release',
          'manufacturing:bom:write',
          'manufacturing:bom:approve',
          'manufacturing:material_requirement:calculate',
          'manufacturing:availability:read',
          'manufacturing:execution:record',
          'manufacturing:genealogy:read',
        ],
      }
    );
    const availability: MaterialAvailabilityPort = {
      async getAvailable() {
        return 20;
      },
    };
    const service = new ManufacturingSlice1Service(
      repository,
      authorization,
      availability,
      new LogisticsEvidenceBindingAdapter(stockOutPorts, stockInPorts),
      new RandomUuidManufacturingIdFactory(),
      new FixedManufacturingClock()
    );

    return {
      service,
      issue: new LogisticsProductionConsumptionIssueAdapter(
        new WarehouseStockOutCanonicalFacade(stockOutPorts)
      ),
      receipt: new LogisticsFinishedGoodsReceiptAdapter(
        new WarehouseStockInCanonicalFacade(stockInPorts)
      ),
      close: async () => {
        await manufacturingClient.end();
        await logisticsClient.end();
      },
    };
  }

  async function createReleasedOrder(
    service: ManufacturingSlice1Service,
    actor: ManufacturingActor,
    suffix: string
  ) {
    const order = await service.createProductionOrder(actor, {
      idempotencyKey: `${marker}-${suffix}-order`,
      orderNumber: `${marker}-PO-${suffix}`,
      finishedGoodItemId: ids.finishedGoodA,
      targetQuantity: 10,
      uom: 'EA',
    });
    const bom = await service.createBOMRevision(actor, {
      idempotencyKey: `${marker}-${suffix}-bom`,
      finishedGoodItemId: ids.finishedGoodA,
      revisionCode: `REV-${suffix}`,
      components: [{ componentItemId: ids.rawItemA, quantityPerUnit: 1, uom: 'EA' }],
    });
    const approvedBom = await service.approveBOMRevision(actor, {
      idempotencyKey: `${marker}-${suffix}-approve-bom`,
      bomRevisionId: bom.value.id,
    });
    const requirements = await service.calculateMaterialRequirements(actor, {
      idempotencyKey: `${marker}-${suffix}-requirements`,
      productionOrderId: order.value.id,
      bomRevisionId: approvedBom.value.id,
      sourceLocationId: ids.rawLocationA,
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: `${marker}-${suffix}-release`,
      productionOrderId: order.value.id,
      bomRevisionId: approvedBom.value.id,
    });
    const line = released.value.lines[0];
    const requirement = requirements.value[0];
    if (!line || !requirement) throw new Error('Expected Manufacturing order line and material requirement');
    return { order: released.value, line, requirementId: requirement.id };
  }

  function materialIssueEvidenceFromStockOut(
    value: {
      issueDocumentId: string;
      productionConsumptionReference?: {
        productionOrderId: string;
        productionOrderLineId: string;
      };
      lines: Array<{
        itemId: string;
        locationId: string;
        quantity: number;
        movement: { id: string };
        traceabilityEvent: { id: string; lot_number?: string; serial_numbers?: string[] };
      }>;
    },
    materialRequirementId: string
  ): MaterialIssueLogisticsEvidence {
    const line = value.lines[0];
    const reference = value.productionConsumptionReference;
    if (!line || !reference) throw new Error('Expected stock-out production consumption evidence');
    return {
      issueDocumentId: value.issueDocumentId,
      movementId: line.movement.id,
      traceabilityEventId: line.traceabilityEvent.id,
      itemId: line.itemId,
      locationId: line.locationId,
      quantity: line.quantity,
      lotNumber: line.traceabilityEvent.lot_number,
      serialNumbers: line.traceabilityEvent.serial_numbers,
      productionOrderId: reference.productionOrderId,
      productionOrderLineId: reference.productionOrderLineId,
      materialRequirementId,
    };
  }

  function receiptEvidenceFromStockIn(
    value: {
      sourceDocumentId: string;
      productionOutputReference?: {
        productionOrderId: string;
        productionOrderLineId: string;
        receiptLineId?: string;
      };
      lines: Array<{
        itemId: string;
        locationId: string;
        quantity: number;
        movement: { id: string };
        traceabilityEvent: { id: string; lot_number?: string; serial_numbers?: string[] };
      }>;
    },
    acceptedQuantity: number,
    rejectedQuantity: number,
    pendingQuantity: number
  ): FinishedGoodsReceiptEvidence {
    const line = value.lines[0];
    const reference = value.productionOutputReference;
    if (!line || !reference?.receiptLineId) throw new Error('Expected stock-in production output evidence');
    return {
      productionOrderLineId: reference.productionOrderLineId,
      receiptDocumentId: value.sourceDocumentId,
      receiptLineId: reference.receiptLineId,
      lotNumber: line.traceabilityEvent.lot_number,
      serialNumbers: line.traceabilityEvent.serial_numbers,
      acceptedQuantity,
      rejectedQuantity,
      pendingQuantity,
      logisticsEvidence: {
        receiptDocumentId: value.sourceDocumentId,
        receiptLineId: reference.receiptLineId,
        movementId: line.movement.id,
        traceabilityEventId: line.traceabilityEvent.id,
        itemId: line.itemId,
        locationId: line.locationId,
        quantity: line.quantity,
        lotNumber: line.traceabilityEvent.lot_number,
        serialNumbers: line.traceabilityEvent.serial_numbers,
        productionOrderId: reference.productionOrderId,
        productionOrderLineId: reference.productionOrderLineId,
        acceptedQuantity,
        rejectedQuantity,
        pendingQuantity,
      },
    };
  }

  async function assertRuntimeTablesExist(): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE (n.nspname = 'logistics' AND c.relname = ANY($1::text[]))
           OR (n.nspname = 'public' AND c.relname = ANY($2::text[]))
      `,
      [
        [
          'items',
          'locations',
          'inventory',
          'inventory_movements',
          'traceability',
          'stock_out_idempotency',
          'stock_in_idempotency',
        ],
        [
          'manufacturing_production_orders',
          'manufacturing_production_executions',
          'manufacturing_production_order_completions',
          'manufacturing_quality_dispositions',
          'manufacturing_work_centers',
          'manufacturing_routing_revisions',
          'manufacturing_routing_operations',
          'manufacturing_operation_progress',
        ],
      ]
    );
    expect(Number(result.rows[0].count)).toBe(15);
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
    await admin.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"manufacturing-full-chain"}'::jsonb)
      `,
      [personId, tenantId, userId, `${marker} person ${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata
        )
        VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, '{"proof":"manufacturing-full-chain"}'::jsonb)
      `,
      [tenantId, personId, factoryId]
    );
  }

  async function seedFactory(tenantId: string, factoryId: string, code: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{"proof":"manufacturing-full-chain","manufacturing_role":"factory"}'::jsonb)
      `,
      [factoryId, tenantId, code, code]
    );
  }

  async function seedLogisticsLocation(tenantId: string, locationId: string, code: string): Promise<void> {
    const columns = await tableColumns('logistics', 'locations');
    const row = buildInsertRow(columns, {
      id: locationId,
      tenant_id: tenantId,
      location_code: code,
      code,
      name: code,
      location_type: 'WAREHOUSE',
      status: 'ACTIVE',
      created_by: tenantId === ids.tenantA ? ids.userA : ids.userB,
      updated_by: tenantId === ids.tenantA ? ids.userA : ids.userB,
    });
    await insertRow('logistics.locations', row, 'id');
  }

  async function seedLogisticsItem(
    tenantId: string,
    itemId: string,
    sku: string,
    category: string
  ): Promise<void> {
    const columns = await tableColumns('logistics', 'items');
    const row = buildInsertRow(columns, {
      id: itemId,
      tenant_id: tenantId,
      sku_code: sku,
      name: sku,
      type: 'GOODS',
      category,
      base_uom: 'EA',
      lot_tracked: true,
      serial_tracked: false,
      expiry_tracked: false,
      status: 'ACTIVE',
      created_by: tenantId === ids.tenantA ? ids.userA : ids.userB,
      updated_by: tenantId === ids.tenantA ? ids.userA : ids.userB,
    });
    await insertRow('logistics.items', row, 'id');
  }

  async function seedInventory(
    tenantId: string,
    itemId: string,
    locationId: string,
    quantity: number,
    lotNumber: string
  ): Promise<void> {
    const columns = await tableColumns('logistics', 'inventory');
    const row = buildInsertRow(columns, {
      tenant_id: tenantId,
      item_id: itemId,
      location_id: locationId,
      location_type: 'WAREHOUSE',
      quantity_on_hand: quantity,
      quantity_reserved: 0,
      lot_number: lotNumber,
      serial_number: null,
      status: 'AVAILABLE',
      created_by: tenantId === ids.tenantA ? ids.userA : ids.userB,
      updated_by: tenantId === ids.tenantA ? ids.userA : ids.userB,
    });
    await insertRow('logistics.inventory', row);
  }

  async function tableColumns(schema: string, table: string): Promise<TableColumn[]> {
    const result = await admin.query<TableColumn>(
      `
        SELECT column_name, data_type, udt_name, is_nullable, column_default, is_generated
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `,
      [schema, table]
    );
    return result.rows;
  }

  function buildInsertRow(
    columns: TableColumn[],
    provided: Record<string, unknown>
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const column of columns) {
      if (column.is_generated === 'ALWAYS') continue;
      if (column.column_name in provided) {
        row[column.column_name] = provided[column.column_name];
      } else if (column.is_nullable === 'NO' && !column.column_default) {
        row[column.column_name] = fallbackValue(column);
      }
    }
    return row;
  }

  async function insertRow(
    tableName: string,
    row: Record<string, unknown>,
    conflictColumn?: string
  ): Promise<void> {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const conflict = conflictColumn ? ` ON CONFLICT (${conflictColumn}) DO NOTHING` : '';
    await admin.query(
      `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        ${conflict}
      `,
      columns.map((column) => row[column])
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

  async function expectMovementCount(
    tenantId: string,
    itemId: string,
    sourceDocumentType: string,
    expected: number
  ): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM logistics.inventory_movements
        WHERE tenant_id = $1::uuid
          AND item_id = $2
          AND source_document_type = $3
      `,
      [tenantId, itemId, sourceDocumentType]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function expectProductionExecutionCount(
    tenantId: string,
    productionOrderId: string,
    expected: number
  ): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.manufacturing_production_executions
        WHERE tenant_id = $1::uuid AND production_order_id = $2::uuid
      `,
      [tenantId, productionOrderId]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function expectManufacturingCompletionCount(
    tenantId: string,
    productionOrderId: string,
    expected: number
  ): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.manufacturing_production_order_completions
        WHERE tenant_id = $1::uuid AND production_order_id = $2::uuid
      `,
      [tenantId, productionOrderId]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
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
    await admin.query('DELETE FROM logistics.stock_out_idempotency WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM logistics.stock_in_idempotency WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM logistics.inventory_movements WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM logistics.traceability WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM logistics.inventory WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM logistics.locations WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM logistics.items WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    await admin.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    for (const tenantId of [ids.tenantA, ids.tenantB]) {
      await admin
        .query('DELETE FROM public.tenants WHERE id = $1::uuid', [tenantId])
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(
            `[Manufacturing full-chain Real DB cleanup] retained tenant shell because append-only rows may hold tenant FK rows: ${tenantId}. ${message}`
          );
        });
    }
  }
});

interface TableColumn extends QueryResultRow {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  is_generated: 'ALWAYS' | 'NEVER';
}

function fallbackValue(column: TableColumn): unknown {
  if (column.udt_name === 'uuid') return randomUUID();
  if (column.data_type.includes('timestamp')) return new Date();
  if (column.data_type === 'boolean') return true;
  if (column.data_type === 'jsonb' || column.data_type === 'json') return {};
  if (column.data_type === 'integer' || column.data_type === 'numeric') return 0;
  return `${column.column_name}-test`;
}

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
