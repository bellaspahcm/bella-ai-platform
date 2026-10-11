import { Client } from 'pg';
import type { QueryResultRow } from 'pg';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { requireSupabasePublicEnv } from '@/lib/supabase-public-env';
import type { Database } from '@/types/database.types';
import {
  AuthenticatedManufacturingSqlClient,
  createManufacturingOperationalRuntime,
  getManufacturingDatabaseUrl,
  type ManufacturingOperationalRuntime,
} from '@/platform/manufacturing';
import {
  ManufacturingAuthorizationError,
  ManufacturingError,
  ManufacturingIdempotencyConflictError,
  ManufacturingNotFoundError,
  ManufacturingValidationError,
} from '@/platform/manufacturing/domain/errors';
import type {
  FinishedGoodsReceiptEvidence,
  ManufacturingActor,
  MaterialIssueLogisticsEvidence,
  OperationProgressStatus,
  QualityDisposition,
  QualityDispositionSourceQuantityType,
} from '@/platform/manufacturing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AuthenticatedManufacturingContext {
  actor: ManufacturingActor;
  tenantName: string;
}

interface UserProfile {
  id: string;
  tenant_id: string | null;
  role: string | null;
  full_name: string | null;
}

interface TenantProfile {
  id: string;
  name: string | null;
  product_key: string | null;
}

interface FactoryAccessRow extends QueryResultRow {
  org_unit_id: string;
}

export async function GET(request: NextRequest) {
  const databaseUrl = getManufacturingDatabaseUrl();
  if (!databaseUrl) {
    return jsonError('Manufacturing database URL is not configured', 503, 'MANUFACTURING_DATABASE_NOT_CONFIGURED');
  }

  const factoryOrgUnitId = request.nextUrl.searchParams.get('factoryOrgUnitId') ?? undefined;
  const limit = readOptionalIntegerFromSearch(request, 'limit');
  const context = await resolveManufacturingContext(request, databaseUrl, factoryOrgUnitId);
  if ('response' in context) return context.response;

  const runtime = await createManufacturingOperationalRuntime({
    databaseUrl,
    actor: context.actor,
  });
  try {
    const snapshot = await runtime.service.getOperationalReadinessSnapshot(context.actor, { limit });
    return NextResponse.json(
      {
        productKey: 'bella_manufacturing',
        tenantName: context.tenantName,
        snapshot,
      },
      { headers: noStoreHeaders() }
    );
  } finally {
    await runtime.close();
  }
}

export async function POST(request: NextRequest) {
  const databaseUrl = getManufacturingDatabaseUrl();
  if (!databaseUrl) {
    return jsonError('Manufacturing database URL is not configured', 503, 'MANUFACTURING_DATABASE_NOT_CONFIGURED');
  }

  let body: Record<string, unknown>;
  try {
    body = readRecord(await request.json());
  } catch (error) {
    return jsonError(errorMessage(error), 400, 'MANUFACTURING_INVALID_REQUEST');
  }

  const action = requiredString(body, 'action');
  const payload = readRecord(body.payload ?? {});
  const requestedFactoryOrgUnitId = optionalString(body, 'factoryOrgUnitId');
  const context = await resolveManufacturingContext(request, databaseUrl, requestedFactoryOrgUnitId);
  if ('response' in context) return context.response;

  const runtime = await createManufacturingOperationalRuntime({
    databaseUrl,
    actor: context.actor,
  });
  try {
    const result = await executeManufacturingAction(runtime, context.actor, action, payload);
    const snapshot = await runtime.service.getOperationalReadinessSnapshot(context.actor, { limit: 50 });
    return NextResponse.json(
      {
        action,
        result,
        snapshot,
      },
      { headers: noStoreHeaders() }
    );
  } catch (error) {
    return handleManufacturingError(error);
  } finally {
    await runtime.close();
  }
}

async function executeManufacturingAction(
  runtime: ManufacturingOperationalRuntime,
  actor: ManufacturingActor,
  action: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  switch (action) {
    case 'createProductionOrder':
      return runtime.service.createProductionOrder(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        orderNumber: requiredString(payload, 'orderNumber'),
        finishedGoodItemId: requiredString(payload, 'finishedGoodItemId'),
        targetQuantity: requiredNumber(payload, 'targetQuantity'),
        uom: requiredString(payload, 'uom'),
      });
    case 'createBOMRevision':
      return runtime.service.createBOMRevision(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        finishedGoodItemId: requiredString(payload, 'finishedGoodItemId'),
        revisionCode: requiredString(payload, 'revisionCode'),
        components: requiredArray(payload, 'components').map(readBOMComponent),
      });
    case 'approveBOMRevision':
      return runtime.service.approveBOMRevision(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        bomRevisionId: requiredString(payload, 'bomRevisionId'),
      });
    case 'calculateMaterialRequirements':
      return runtime.service.calculateMaterialRequirements(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        bomRevisionId: requiredString(payload, 'bomRevisionId'),
        sourceLocationId: requiredString(payload, 'sourceLocationId'),
      });
    case 'releaseProductionOrder':
      return runtime.service.releaseProductionOrder(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        bomRevisionId: requiredString(payload, 'bomRevisionId'),
      });
    case 'createWorkCenter':
      return runtime.service.createWorkCenter(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        code: requiredString(payload, 'code'),
        name: requiredString(payload, 'name'),
      });
    case 'createRoutingRevision':
      return runtime.service.createRoutingRevision(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        finishedGoodItemId: requiredString(payload, 'finishedGoodItemId'),
        revisionCode: requiredString(payload, 'revisionCode'),
        operations: requiredArray(payload, 'operations').map(readRoutingOperation),
      });
    case 'approveRoutingRevision':
      return runtime.service.approveRoutingRevision(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        routingRevisionId: requiredString(payload, 'routingRevisionId'),
      });
    case 'applyRoutingRevision':
      return runtime.service.applyRoutingRevision(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        productionOrderLineId: requiredString(payload, 'productionOrderLineId'),
        routingRevisionId: requiredString(payload, 'routingRevisionId'),
      });
    case 'updateOperationProgress':
      return runtime.service.updateOperationProgress(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        operationProgressId: requiredString(payload, 'operationProgressId'),
        status: readOperationProgressStatus(payload),
        blockedReason: optionalString(payload, 'blockedReason'),
        productionExecutionId: optionalString(payload, 'productionExecutionId'),
        completedQuantity: optionalNumber(payload, 'completedQuantity'),
      });
    case 'issueMaterial':
      await runtime.authorize('manufacturing:material_issue:record');
      return runtime.issue.issue({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        correlationId: optionalString(payload, 'correlationId'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        productionOrderLineId: requiredString(payload, 'productionOrderLineId'),
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        issueDocumentId: requiredString(payload, 'issueDocumentId'),
        issueDocumentNumber: optionalString(payload, 'issueDocumentNumber'),
        warehouseSkuId: requiredString(payload, 'warehouseSkuId'),
        warehouseBinId: requiredString(payload, 'warehouseBinId'),
        itemId: requiredString(payload, 'itemId'),
        locationId: requiredString(payload, 'locationId'),
        quantity: requiredNumber(payload, 'quantity'),
        unitOfMeasure: requiredString(payload, 'unitOfMeasure'),
        lotNumber: optionalString(payload, 'lotNumber'),
        serialNumbers: optionalStringArray(payload, 'serialNumbers'),
        materialRequirementId: optionalString(payload, 'materialRequirementId'),
      });
    case 'recordExecution':
      return runtime.service.recordProductionExecution(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        productionOrderLineId: requiredString(payload, 'productionOrderLineId'),
        materialIssueDocumentId: requiredString(payload, 'materialIssueDocumentId'),
        materialIssueMovementId: requiredString(payload, 'materialIssueMovementId'),
        materialIssueEvidence: readMaterialIssueEvidence(payload.materialIssueEvidence),
        materialRequirementId: optionalString(payload, 'materialRequirementId'),
        actualQuantity: requiredNumber(payload, 'actualQuantity'),
        acceptedQuantity: requiredNumber(payload, 'acceptedQuantity'),
        rejectedQuantity: optionalNumber(payload, 'rejectedQuantity'),
        scrapQuantity: optionalNumber(payload, 'scrapQuantity'),
        uom: requiredString(payload, 'uom'),
      });
    case 'receiveFinishedGoods':
      await runtime.authorize('manufacturing:fgr:record');
      return runtime.receipt.receive({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        correlationId: optionalString(payload, 'correlationId'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        productionOrderLineId: requiredString(payload, 'productionOrderLineId'),
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        receiptDocumentId: requiredString(payload, 'receiptDocumentId'),
        receiptDocumentNumber: optionalString(payload, 'receiptDocumentNumber'),
        receiptLineId: requiredString(payload, 'receiptLineId'),
        warehouseSkuId: requiredString(payload, 'warehouseSkuId'),
        warehouseBinId: requiredString(payload, 'warehouseBinId'),
        itemId: requiredString(payload, 'itemId'),
        locationId: requiredString(payload, 'locationId'),
        acceptedQuantity: requiredNumber(payload, 'acceptedQuantity'),
        rejectedQuantity: optionalNumber(payload, 'rejectedQuantity'),
        pendingQuantity: optionalNumber(payload, 'pendingQuantity'),
        qualityInspectionId: optionalString(payload, 'qualityInspectionId'),
        unitOfMeasure: requiredString(payload, 'unitOfMeasure'),
        lotNumber: optionalString(payload, 'lotNumber'),
        serialNumbers: optionalStringArray(payload, 'serialNumbers'),
        unitCost: optionalNumber(payload, 'unitCost'),
        currency: optionalString(payload, 'currency'),
      });
    case 'recordQualityDisposition':
      return runtime.service.recordQualityDisposition(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        productionOrderLineId: requiredString(payload, 'productionOrderLineId'),
        productionExecutionId: requiredString(payload, 'productionExecutionId'),
        receiptDocumentId: optionalString(payload, 'receiptDocumentId'),
        receiptLineId: optionalString(payload, 'receiptLineId'),
        sourceQuantityType: readQualitySourceQuantityType(payload),
        disposition: readQualityDisposition(payload),
        quantity: requiredNumber(payload, 'quantity'),
        acceptedOutputQuantity: requiredNumber(payload, 'acceptedOutputQuantity'),
        reasonCode: optionalString(payload, 'reasonCode'),
        reasonText: optionalString(payload, 'reasonText'),
        evidenceReference: optionalString(payload, 'evidenceReference'),
        finalHandlingDecision: optionalBoolean(payload, 'finalHandlingDecision'),
        conditionalAcceptPolicyApproved: optionalBoolean(payload, 'conditionalAcceptPolicyApproved'),
      });
    case 'completeProductionOrder':
      return runtime.service.completeProductionOrder(actor, {
        idempotencyKey: requiredString(payload, 'idempotencyKey'),
        productionOrderId: requiredString(payload, 'productionOrderId'),
        receiptEvidence: requiredArray(payload, 'receiptEvidence').map(readReceiptEvidence),
      });
    case 'traceFinishedGoodLot':
      return runtime.service.traceFinishedGoodLot(actor, {
        finishedGoodItemId: optionalString(payload, 'finishedGoodItemId'),
        lotNumber: optionalString(payload, 'lotNumber'),
        serialNumber: optionalString(payload, 'serialNumber'),
      });
    case 'traceRawMaterialLot':
      return runtime.service.traceRawMaterialLot(actor, {
        rawMaterialItemId: optionalString(payload, 'rawMaterialItemId'),
        lotNumber: optionalString(payload, 'lotNumber'),
        serialNumber: optionalString(payload, 'serialNumber'),
      });
    default:
      throw new ManufacturingValidationError(`Unsupported Manufacturing action: ${action}`);
  }
}

async function resolveManufacturingContext(
  request: NextRequest,
  databaseUrl: string,
  requestedFactoryOrgUnitId?: string
): Promise<AuthenticatedManufacturingContext | { response: NextResponse }> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase.auth.getUser();
  let userId = data.user?.id ?? null;
  let queryClient: SupabaseClient<Database> = supabase;

  if ((!userId || error) && process.env.NODE_ENV === 'development') {
    const mockEmail = request.headers.get('x-mock-user-email');
    const adminUrl = getSupabaseAdminUrl();
    const adminKey = getSupabaseAdminKey();
    if (mockEmail && adminUrl && adminKey) {
      queryClient = createSupabaseJsClient<Database>(adminUrl, adminKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const profile = await readUserProfileByEmail(queryClient, mockEmail);
      userId = profile?.id ?? null;
    }
  }

  if (!userId) {
    return { response: jsonError('Unauthorized', 401, 'MANUFACTURING_UNAUTHORIZED') };
  }

  const profile = await readUserProfile(queryClient, userId);
  if (!profile?.tenant_id) {
    return { response: jsonError('User is not linked to a tenant', 403, 'MANUFACTURING_TENANT_REQUIRED') };
  }
  const tenant = await readTenantProfile(queryClient, profile.tenant_id);
  if (!tenant) {
    return { response: jsonError('Tenant not found', 404, 'MANUFACTURING_TENANT_NOT_FOUND') };
  }
  if (tenant.product_key !== 'bella_manufacturing') {
    return {
      response: jsonError(
        'Tenant is not registered for bella_manufacturing',
        403,
        'MANUFACTURING_PRODUCT_REQUIRED'
      ),
    };
  }

  const factoryOrgUnitId =
    requestedFactoryOrgUnitId ??
    (await readFirstFactoryOrgUnitId(databaseUrl, userId, profile.tenant_id));
  if (!factoryOrgUnitId) {
    return {
      response: jsonError(
        'User has no accessible factory org unit',
        403,
        'MANUFACTURING_FACTORY_ACCESS_REQUIRED'
      ),
    };
  }

  return {
    actor: {
      tenantId: profile.tenant_id,
      userId,
      roles: [profile.role ?? ''],
      factoryOrgUnitId,
    },
    tenantName: tenant.name ?? 'Bella Manufacturing',
  };
}

async function createRouteHandlerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const { url, publicKey } = requireSupabasePublicEnv();
  return createSupabaseServerClient<Database>(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        } catch {
          // Route handlers may be unable to set cookies after response work starts.
        }
      },
    },
  });
}

async function readUserProfile(client: SupabaseClient<Database>, userId: string): Promise<UserProfile | null> {
  const { data, error } = await client
    .from('users')
    .select('id, tenant_id, role, full_name')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

async function readUserProfileByEmail(
  client: SupabaseClient<Database>,
  email: string
): Promise<UserProfile | null> {
  const { data, error } = await client
    .from('users')
    .select('id, tenant_id, role, full_name')
    .eq('email', email)
    .single();
  if (error) return null;
  return data;
}

async function readTenantProfile(
  client: SupabaseClient<Database>,
  tenantId: string
): Promise<TenantProfile | null> {
  const { data, error } = await client
    .from('tenants')
    .select('id, name, product_key')
    .eq('id', tenantId)
    .single();
  if (error) return null;
  return data;
}

async function readFirstFactoryOrgUnitId(
  databaseUrl: string,
  userId: string,
  tenantId: string
): Promise<string | null> {
  const client = new Client({ connectionString: databaseUrl, ssl: sslConfig() });
  await client.connect();
  const sql = new AuthenticatedManufacturingSqlClient(client, { userId, tenantId });
  try {
    await sql.query('BEGIN');
    const result = await sql.query<FactoryAccessRow>(
      `
        SELECT org_unit_id
        FROM public.user_org_unit_access
        WHERE user_id = $1::uuid AND tenant_id = $2::uuid
        ORDER BY org_unit_id
        LIMIT 1
      `,
      [userId, tenantId]
    );
    await sql.query('COMMIT');
    return result.rows[0]?.org_unit_id ?? null;
  } catch (error) {
    await sql.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

function readBOMComponent(value: unknown) {
  const component = readRecord(value);
  return {
    componentItemId: requiredString(component, 'componentItemId'),
    quantityPerUnit: requiredNumber(component, 'quantityPerUnit'),
    uom: requiredString(component, 'uom'),
    scrapAllowancePercent: optionalNumber(component, 'scrapAllowancePercent'),
  };
}

function readRoutingOperation(value: unknown) {
  const operation = readRecord(value);
  return {
    sequence: requiredNumber(operation, 'sequence'),
    operationCode: requiredString(operation, 'operationCode'),
    operationName: requiredString(operation, 'operationName'),
    workCenterId: requiredString(operation, 'workCenterId'),
    required: optionalBoolean(operation, 'required'),
  };
}

function readMaterialIssueEvidence(value: unknown): MaterialIssueLogisticsEvidence {
  const evidence = readRecord(value);
  return {
    issueDocumentId: requiredString(evidence, 'issueDocumentId'),
    movementId: requiredString(evidence, 'movementId'),
    traceabilityEventId: requiredString(evidence, 'traceabilityEventId'),
    itemId: requiredString(evidence, 'itemId'),
    locationId: requiredString(evidence, 'locationId'),
    quantity: requiredNumber(evidence, 'quantity'),
    lotNumber: optionalString(evidence, 'lotNumber'),
    serialNumbers: optionalStringArray(evidence, 'serialNumbers'),
    productionOrderId: requiredString(evidence, 'productionOrderId'),
    productionOrderLineId: requiredString(evidence, 'productionOrderLineId'),
    materialRequirementId: optionalString(evidence, 'materialRequirementId'),
  };
}

function readReceiptEvidence(value: unknown): FinishedGoodsReceiptEvidence {
  const receipt = readRecord(value);
  return {
    productionOrderLineId: requiredString(receipt, 'productionOrderLineId'),
    receiptDocumentId: requiredString(receipt, 'receiptDocumentId'),
    receiptLineId: requiredString(receipt, 'receiptLineId'),
    lotNumber: optionalString(receipt, 'lotNumber'),
    serialNumbers: optionalStringArray(receipt, 'serialNumbers'),
    acceptedQuantity: requiredNumber(receipt, 'acceptedQuantity'),
    rejectedQuantity: optionalNumber(receipt, 'rejectedQuantity'),
    pendingQuantity: optionalNumber(receipt, 'pendingQuantity'),
    logisticsEvidence: readFinishedGoodsReceiptLogisticsEvidence(receipt.logisticsEvidence),
  };
}

function readFinishedGoodsReceiptLogisticsEvidence(value: unknown) {
  const evidence = readRecord(value);
  return {
    receiptDocumentId: requiredString(evidence, 'receiptDocumentId'),
    receiptLineId: requiredString(evidence, 'receiptLineId'),
    movementId: requiredString(evidence, 'movementId'),
    traceabilityEventId: requiredString(evidence, 'traceabilityEventId'),
    itemId: requiredString(evidence, 'itemId'),
    locationId: requiredString(evidence, 'locationId'),
    quantity: requiredNumber(evidence, 'quantity'),
    lotNumber: optionalString(evidence, 'lotNumber'),
    serialNumbers: optionalStringArray(evidence, 'serialNumbers'),
    productionOrderId: requiredString(evidence, 'productionOrderId'),
    productionOrderLineId: requiredString(evidence, 'productionOrderLineId'),
    acceptedQuantity: requiredNumber(evidence, 'acceptedQuantity'),
    rejectedQuantity: optionalNumber(evidence, 'rejectedQuantity'),
    pendingQuantity: optionalNumber(evidence, 'pendingQuantity'),
  };
}

function readOperationProgressStatus(payload: Record<string, unknown>): OperationProgressStatus {
  return readAllowed(payload, 'status', ['planned', 'ready', 'in_progress', 'completed', 'blocked']);
}

function readQualitySourceQuantityType(payload: Record<string, unknown>): QualityDispositionSourceQuantityType {
  return readAllowed(payload, 'sourceQuantityType', ['accepted', 'rejected', 'scrap', 'pending']);
}

function readQualityDisposition(payload: Record<string, unknown>): QualityDisposition {
  return readAllowed(payload, 'disposition', [
    'accepted',
    'conditional_accept',
    'rework',
    'scrap',
    'discard_reject',
    'pending',
  ]);
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ManufacturingValidationError('Expected JSON object');
  }
  return value as Record<string, unknown>;
}

function requiredArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new ManufacturingValidationError(`${key} must be an array`);
  }
  return value;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ManufacturingValidationError(`${key} is required`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new ManufacturingValidationError(`${key} must be a string`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    throw new ManufacturingValidationError(`${key} must be a finite number`);
  }
  return parsed;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') return undefined;
  return requiredNumber(record, key);
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'boolean') {
    throw new ManufacturingValidationError(`${key} must be boolean`);
  }
  return value;
}

function optionalStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ManufacturingValidationError(`${key} must be an array of strings`);
  }
  return [...value];
}

function readAllowed<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const value = requiredString(record, key);
  for (const candidate of allowed) {
    if (candidate === value) return candidate;
  }
  throw new ManufacturingValidationError(`${key} has unsupported value`);
}

function readOptionalIntegerFromSearch(request: NextRequest, key: string): number | undefined {
  const value = request.nextUrl.searchParams.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function handleManufacturingError(error: unknown): NextResponse {
  if (error instanceof ManufacturingIdempotencyConflictError) {
    return jsonError(error.message, 409, error.code);
  }
  if (error instanceof ManufacturingAuthorizationError) {
    return jsonError(error.message, 403, error.code);
  }
  if (error instanceof ManufacturingNotFoundError) {
    return jsonError(error.message, 404, error.code);
  }
  if (error instanceof ManufacturingError) {
    return jsonError(error.message, 400, error.code);
  }
  return jsonError(errorMessage(error), 500, 'MANUFACTURING_INTERNAL_ERROR');
}

function jsonError(message: string, status: number, code: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders() });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function noStoreHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

function sslConfig(): boolean | { rejectUnauthorized: false } | undefined {
  return process.env.SUPABASE_DB_SSL === 'disable' ? undefined : { rejectUnauthorized: false };
}
