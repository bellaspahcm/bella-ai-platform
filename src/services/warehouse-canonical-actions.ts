'use server';

import { Client } from 'pg';
import { revalidatePath } from 'next/cache';

import { createWarehousePostgresStockAdjustmentPorts } from '@/platform/logistics/warehouse/postgres-stock-adjustment-ports';
import { createWarehousePostgresStockInPorts } from '@/platform/logistics/warehouse/postgres-stock-in-ports';
import { createWarehousePostgresStockOutPorts } from '@/platform/logistics/warehouse/postgres-stock-out-ports';
import { createWarehousePostgresStockTransferPorts } from '@/platform/logistics/warehouse/postgres-stock-transfer-ports';
import {
  WarehouseStockAdjustmentCanonicalFacade,
  type WarehouseStockAdjustmentCommand,
  type WarehouseStockAdjustmentLineCommand,
  type WarehouseStockAdjustmentResult,
  type WarehouseStockAdjustmentSourceType,
} from '@/platform/logistics/warehouse/stock-adjustment-canonical.facade';
import { AdjustmentReason } from '@/platform/logistics/contracts/inventory.contract';
import {
  WarehouseStockInCanonicalFacade,
  type WarehouseStockInCommand,
  type WarehouseStockInLineCommand,
  type WarehouseStockInResult,
  type WarehouseStockInSourceType,
} from '@/platform/logistics/warehouse/stock-in-canonical.facade';
import {
  WarehouseStockOutCanonicalFacade,
  type WarehouseStockOutCommand,
  type WarehouseStockOutLineCommand,
  type WarehouseStockOutReason,
  type WarehouseStockOutResult,
  type WarehouseStockOutSourceType,
} from '@/platform/logistics/warehouse/stock-out-canonical.facade';
import {
  WarehouseStockTransferCanonicalFacade,
  type WarehouseStockTransferCommand,
  type WarehouseStockTransferLineCommand,
  type WarehouseStockTransferResult,
  type WarehouseStockTransferSourceType,
} from '@/platform/logistics/warehouse/stock-transfer-canonical.facade';

export type WarehouseCanonicalActionResult<TValue> =
  | {
      ok: true;
      value: TValue;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        lineIndex?: number;
      };
    };

export interface WarehouseCanonicalStockInActionInput {
  correlationId?: string;
  sourceDocument: {
    id: string;
    number?: string;
    type: WarehouseStockInSourceType;
  };
  lines: WarehouseCanonicalStockInLineInput[];
}

export interface WarehouseCanonicalStockInLineInput {
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: string;
  locationId: string;
  quantity: number;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumbers?: string[];
  unitCost?: number;
  currency?: string;
  supplierId?: string;
  sourceLineId?: string;
  metadata?: Record<string, unknown>;
}

type WarehouseStockInActionValue = Extract<WarehouseStockInResult, { ok: true }>['value'];
type WarehouseStockAdjustmentActionValue = Extract<WarehouseStockAdjustmentResult, { ok: true }>['value'];
type WarehouseStockOutActionValue = Extract<WarehouseStockOutResult, { ok: true }>['value'];
type WarehouseStockTransferActionValue = Extract<WarehouseStockTransferResult, { ok: true }>['value'];

export interface WarehouseCanonicalStockAdjustmentActionInput {
  correlationId?: string;
  adjustmentDocument: {
    id: string;
    number?: string;
    type: WarehouseStockAdjustmentSourceType;
  };
  lines: WarehouseCanonicalStockAdjustmentLineInput[];
}

export interface WarehouseCanonicalStockAdjustmentLineInput {
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: string;
  locationId: string;
  quantityDelta: number;
  unitOfMeasure: string;
  reason: AdjustmentReason;
  lotNumber?: string;
  serialNumbers?: string[];
  sourceLineId?: string;
  notes?: string;
  unitCost?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface WarehouseCanonicalStockTransferActionInput {
  correlationId?: string;
  transferDocument: {
    id: string;
    number?: string;
    type: WarehouseStockTransferSourceType;
  };
  lines: WarehouseCanonicalStockTransferLineInput[];
}

export interface WarehouseCanonicalStockTransferLineInput {
  warehouseSkuId: string;
  fromWarehouseBinId: string;
  toWarehouseBinId: string;
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumbers?: string[];
  sourceLineId?: string;
  metadata?: Record<string, unknown>;
}

export interface WarehouseCanonicalStockOutActionInput {
  correlationId?: string;
  issueDocument: {
    id: string;
    number?: string;
    type: WarehouseStockOutSourceType;
  };
  idempotencyKey?: string;
  lines: WarehouseCanonicalStockOutLineInput[];
}

export interface WarehouseCanonicalStockOutLineInput {
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: string;
  locationId: string;
  quantity: number;
  unitOfMeasure: string;
  reason: WarehouseStockOutReason;
  lotNumber?: string;
  serialNumbers?: string[];
  sourceLineId?: string;
  notes?: string;
  unitCost?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface WarehouseCanonicalActionAuthContext {
  userId: string;
  tenantId: string;
}

export interface WarehouseCanonicalStockInActionOptions {
  databaseUrl?: string;
  revalidateCanonicalStockInPath?: boolean;
}

export interface WarehouseCanonicalStockAdjustmentActionOptions {
  databaseUrl?: string;
  revalidateCanonicalAdjustmentPath?: boolean;
}

export interface WarehouseCanonicalStockTransferActionOptions {
  databaseUrl?: string;
  revalidateCanonicalTransferPath?: boolean;
}

export interface WarehouseCanonicalStockOutActionOptions {
  databaseUrl?: string;
  revalidateCanonicalStockOutPath?: boolean;
}

export async function executeCanonicalWarehouseStockInAction(
  input: WarehouseCanonicalStockInActionInput
): Promise<WarehouseCanonicalActionResult<WarehouseStockInActionValue>> {
  const authContext = await resolveWarehouseAuthContext();
  if (!authContext.ok) return authContext;

  return executeCanonicalWarehouseStockInWithContext(input, authContext.value, {
    revalidateCanonicalStockInPath: true,
  });
}

export async function executeCanonicalWarehouseStockInWithContext(
  input: WarehouseCanonicalStockInActionInput,
  authContext: WarehouseCanonicalActionAuthContext,
  options: WarehouseCanonicalStockInActionOptions = {}
): Promise<WarehouseCanonicalActionResult<WarehouseStockInActionValue>> {
  const dbUrl = options.databaseUrl ?? getWarehouseDatabaseUrl();

  if (!dbUrl) {
    return failure(
      'WAREHOUSE_CANONICAL_DB_URL_MISSING',
      'canonical Warehouse direct PostgreSQL URL is not configured'
    );
  }

  const db = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await db.connect();

  try {
    await db.query('BEGIN');
    await bindAuthenticatedTenantContext(db, authContext.userId);

    const facade = new WarehouseStockInCanonicalFacade(
      createWarehousePostgresStockInPorts(db)
    );
    const result = await facade.execute(toStockInCommand(input, authContext));

    if (!result.ok) {
      await db.query('ROLLBACK');
      return result;
    }

    await db.query('COMMIT');
    if (options.revalidateCanonicalStockInPath) {
      revalidatePath('/warehouse/stock-in');
    }
    return result;
  } catch (error) {
    await rollbackQuietly(db);
    return failure(
      'WAREHOUSE_CANONICAL_STOCK_IN_ACTION_FAILED',
      error instanceof Error ? error.message : 'canonical Warehouse Stock-In action failed'
    );
  } finally {
    await db.end();
  }
}

export async function executeCanonicalWarehouseStockAdjustmentAction(
  input: WarehouseCanonicalStockAdjustmentActionInput
): Promise<WarehouseCanonicalActionResult<WarehouseStockAdjustmentActionValue>> {
  const authContext = await resolveWarehouseAuthContext();
  if (!authContext.ok) return authContext;

  return executeCanonicalWarehouseStockAdjustmentWithContext(input, authContext.value, {
    revalidateCanonicalAdjustmentPath: true,
  });
}

export async function executeCanonicalWarehouseStockAdjustmentWithContext(
  input: WarehouseCanonicalStockAdjustmentActionInput,
  authContext: WarehouseCanonicalActionAuthContext,
  options: WarehouseCanonicalStockAdjustmentActionOptions = {}
): Promise<WarehouseCanonicalActionResult<WarehouseStockAdjustmentActionValue>> {
  const dbUrl = options.databaseUrl ?? getWarehouseDatabaseUrl();

  if (!dbUrl) {
    return failure(
      'WAREHOUSE_CANONICAL_DB_URL_MISSING',
      'canonical Warehouse direct PostgreSQL URL is not configured'
    );
  }

  const db = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await db.connect();

  try {
    await db.query('BEGIN');
    await bindAuthenticatedTenantContext(db, authContext.userId);

    const facade = new WarehouseStockAdjustmentCanonicalFacade(
      createWarehousePostgresStockAdjustmentPorts(db)
    );
    const result = await facade.execute(toStockAdjustmentCommand(input, authContext));

    if (!result.ok) {
      await db.query('ROLLBACK');
      return result;
    }

    await db.query('COMMIT');
    if (options.revalidateCanonicalAdjustmentPath) {
      revalidatePath('/warehouse/adjustment');
    }
    return result;
  } catch (error) {
    await rollbackQuietly(db);
    return failure(
      'WAREHOUSE_CANONICAL_STOCK_ADJUSTMENT_ACTION_FAILED',
      error instanceof Error ? error.message : 'canonical Warehouse Stock Adjustment action failed'
    );
  } finally {
    await db.end();
  }
}

export async function executeCanonicalWarehouseStockTransferAction(
  input: WarehouseCanonicalStockTransferActionInput
): Promise<WarehouseCanonicalActionResult<WarehouseStockTransferActionValue>> {
  const authContext = await resolveWarehouseAuthContext();
  if (!authContext.ok) return authContext;

  return executeCanonicalWarehouseStockTransferWithContext(input, authContext.value, {
    revalidateCanonicalTransferPath: true,
  });
}

export async function executeCanonicalWarehouseStockTransferWithContext(
  input: WarehouseCanonicalStockTransferActionInput,
  authContext: WarehouseCanonicalActionAuthContext,
  options: WarehouseCanonicalStockTransferActionOptions = {}
): Promise<WarehouseCanonicalActionResult<WarehouseStockTransferActionValue>> {
  const dbUrl = options.databaseUrl ?? getWarehouseDatabaseUrl();

  if (!dbUrl) {
    return failure(
      'WAREHOUSE_CANONICAL_DB_URL_MISSING',
      'canonical Warehouse direct PostgreSQL URL is not configured'
    );
  }

  const db = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await db.connect();

  try {
    await db.query('BEGIN');
    await bindAuthenticatedTenantContext(db, authContext.userId);

    const facade = new WarehouseStockTransferCanonicalFacade(
      createWarehousePostgresStockTransferPorts(db)
    );
    const result = await facade.execute(toStockTransferCommand(input, authContext));

    if (!result.ok) {
      await db.query('ROLLBACK');
      return result;
    }

    await db.query('COMMIT');
    if (options.revalidateCanonicalTransferPath) {
      revalidatePath('/warehouse/transfer');
    }
    return result;
  } catch (error) {
    await rollbackQuietly(db);
    return failure(
      'WAREHOUSE_CANONICAL_STOCK_TRANSFER_ACTION_FAILED',
      error instanceof Error ? error.message : 'canonical Warehouse Stock Transfer action failed'
    );
  } finally {
    await db.end();
  }
}

export async function executeCanonicalWarehouseStockOutAction(
  input: WarehouseCanonicalStockOutActionInput
): Promise<WarehouseCanonicalActionResult<WarehouseStockOutActionValue>> {
  const authContext = await resolveWarehouseAuthContext();
  if (!authContext.ok) return authContext;

  return executeCanonicalWarehouseStockOutWithContext(input, authContext.value, {
    revalidateCanonicalStockOutPath: true,
  });
}

export async function executeCanonicalWarehouseStockOutWithContext(
  input: WarehouseCanonicalStockOutActionInput,
  authContext: WarehouseCanonicalActionAuthContext,
  options: WarehouseCanonicalStockOutActionOptions = {}
): Promise<WarehouseCanonicalActionResult<WarehouseStockOutActionValue>> {
  const dbUrl = options.databaseUrl ?? getWarehouseDatabaseUrl();

  if (!dbUrl) {
    return failure(
      'WAREHOUSE_CANONICAL_DB_URL_MISSING',
      'canonical Warehouse direct PostgreSQL URL is not configured'
    );
  }

  const db = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await db.connect();

  try {
    await db.query('BEGIN');
    await bindAuthenticatedTenantContext(db, authContext.userId);

    const facade = new WarehouseStockOutCanonicalFacade(
      createWarehousePostgresStockOutPorts(db)
    );
    const result = await facade.execute(toStockOutCommand(input, authContext));

    if (!result.ok) {
      await db.query('ROLLBACK');
      return result;
    }

    await db.query('COMMIT');
    if (options.revalidateCanonicalStockOutPath) {
      revalidatePath('/warehouse/stock-out');
    }
    return result;
  } catch (error) {
    await rollbackQuietly(db);
    return failure(
      'WAREHOUSE_CANONICAL_STOCK_OUT_ACTION_FAILED',
      error instanceof Error ? error.message : 'canonical Warehouse Stock-Out action failed'
    );
  } finally {
    await db.end();
  }
}

async function resolveWarehouseAuthContext(): Promise<
  WarehouseCanonicalActionResult<WarehouseCanonicalActionAuthContext>
> {
  const { getCurrentUser } = await import('./user-actions');
  const user = await getCurrentUser();

  if (!user) {
    return failure('WAREHOUSE_CANONICAL_UNAUTHENTICATED', 'authenticated user is required');
  }

  if (!hasText(user.tenant_id)) {
    return failure(
      'WAREHOUSE_CANONICAL_TENANT_NOT_FOUND',
      'authenticated user tenant is required'
    );
  }

  return {
    ok: true,
    value: {
      userId: user.id,
      tenantId: user.tenant_id,
    },
  };
}

async function bindAuthenticatedTenantContext(db: Client, userId: string): Promise<void> {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
  });

  await db.query("SET LOCAL role = 'authenticated'");
  await db.query(
    `
    SELECT
      set_config('request.jwt.claim.sub', $1, true),
      set_config('request.jwt.claim.role', 'authenticated', true),
      set_config('request.jwt.claims', $2, true)
    `,
    [userId, claims]
  );
}

function toStockInCommand(
  input: WarehouseCanonicalStockInActionInput,
  authContext: WarehouseCanonicalActionAuthContext
): WarehouseStockInCommand {
  return {
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    correlationId: input.correlationId,
    sourceDocument: input.sourceDocument,
    lines: input.lines.map(toStockInLineCommand),
  };
}

function toStockInLineCommand(
  line: WarehouseCanonicalStockInLineInput
): WarehouseStockInLineCommand {
  return {
    warehouseSkuId: line.warehouseSkuId,
    warehouseBinId: line.warehouseBinId,
    itemId: line.itemId,
    locationId: line.locationId,
    quantity: line.quantity,
    unitOfMeasure: line.unitOfMeasure,
    lotNumber: line.lotNumber,
    serialNumbers: line.serialNumbers,
    unitCost: line.unitCost,
    currency: line.currency,
    supplierId: line.supplierId,
    sourceLineId: line.sourceLineId,
    metadata: line.metadata,
  };
}

function toStockAdjustmentCommand(
  input: WarehouseCanonicalStockAdjustmentActionInput,
  authContext: WarehouseCanonicalActionAuthContext
): WarehouseStockAdjustmentCommand {
  return {
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    correlationId: input.correlationId,
    adjustmentDocument: input.adjustmentDocument,
    lines: input.lines.map(toStockAdjustmentLineCommand),
  };
}

function toStockAdjustmentLineCommand(
  line: WarehouseCanonicalStockAdjustmentLineInput
): WarehouseStockAdjustmentLineCommand {
  return {
    warehouseSkuId: line.warehouseSkuId,
    warehouseBinId: line.warehouseBinId,
    itemId: line.itemId,
    locationId: line.locationId,
    quantityDelta: line.quantityDelta,
    unitOfMeasure: line.unitOfMeasure,
    reason: line.reason,
    lotNumber: line.lotNumber,
    serialNumbers: line.serialNumbers,
    sourceLineId: line.sourceLineId,
    notes: line.notes,
    unitCost: line.unitCost,
    currency: line.currency,
    metadata: line.metadata,
  };
}

function toStockTransferCommand(
  input: WarehouseCanonicalStockTransferActionInput,
  authContext: WarehouseCanonicalActionAuthContext
): WarehouseStockTransferCommand {
  return {
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    correlationId: input.correlationId,
    transferDocument: input.transferDocument,
    lines: input.lines.map(toStockTransferLineCommand),
  };
}

function toStockTransferLineCommand(
  line: WarehouseCanonicalStockTransferLineInput
): WarehouseStockTransferLineCommand {
  return {
    warehouseSkuId: line.warehouseSkuId,
    fromWarehouseBinId: line.fromWarehouseBinId,
    toWarehouseBinId: line.toWarehouseBinId,
    itemId: line.itemId,
    fromLocationId: line.fromLocationId,
    toLocationId: line.toLocationId,
    quantity: line.quantity,
    unitOfMeasure: line.unitOfMeasure,
    lotNumber: line.lotNumber,
    serialNumbers: line.serialNumbers,
    sourceLineId: line.sourceLineId,
    metadata: line.metadata,
  };
}

function toStockOutCommand(
  input: WarehouseCanonicalStockOutActionInput,
  authContext: WarehouseCanonicalActionAuthContext
): WarehouseStockOutCommand {
  return {
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    correlationId: input.correlationId,
    issueDocument: input.issueDocument,
    idempotencyKey: input.idempotencyKey,
    lines: input.lines.map(toStockOutLineCommand),
  };
}

function toStockOutLineCommand(
  line: WarehouseCanonicalStockOutLineInput
): WarehouseStockOutLineCommand {
  return {
    warehouseSkuId: line.warehouseSkuId,
    warehouseBinId: line.warehouseBinId,
    itemId: line.itemId,
    locationId: line.locationId,
    quantity: line.quantity,
    unitOfMeasure: line.unitOfMeasure,
    reason: line.reason,
    lotNumber: line.lotNumber,
    serialNumbers: line.serialNumbers,
    sourceLineId: line.sourceLineId,
    notes: line.notes,
    unitCost: line.unitCost,
    currency: line.currency,
    metadata: line.metadata,
  };
}

function getWarehouseDatabaseUrl(): string | undefined {
  return process.env.SUPABASE_DB_URL
    ?? process.env.SUPABASE_DATABASE_URL
    ?? process.env.DATABASE_URL;
}

async function rollbackQuietly(db: Client): Promise<void> {
  try {
    await db.query('ROLLBACK');
  } catch {
    return;
  }
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function failure<TValue>(
  code: string,
  message: string,
  lineIndex?: number
): WarehouseCanonicalActionResult<TValue> {
  return {
    ok: false,
    error: {
      code,
      message,
      lineIndex,
    },
  };
}
