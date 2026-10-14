import type {
  JsonObject,
  VehicleSaleRecognitionActor,
  VehicleSaleRecognitionBooking,
  VehicleSaleRecognitionCustomer,
  VehicleSaleRecognitionLedgerInsert,
  VehicleSaleRecognitionPolicy,
  VehicleSaleRecognitionRecord,
  VehicleSaleRecognitionRepository,
  VehicleSaleRecognitionVehicle,
} from './VehicleSaleRecognitionService';

type SupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type SupabaseListResult<T> = {
  data: T[] | null;
  error: SupabaseError | null;
};

type SupabaseSelectBuilder<T> = PromiseLike<SupabaseListResult<T>> & {
  eq(column: string, value: unknown): SupabaseSelectBuilder<T>;
  is(column: string, value: null): SupabaseSelectBuilder<T>;
  lte(column: string, value: string): SupabaseSelectBuilder<T>;
  or(filter: string): SupabaseSelectBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): SupabaseSelectBuilder<T>;
  limit(count: number): SupabaseSelectBuilder<T>;
  maybeSingle(): Promise<SupabaseResult<T>>;
};

type SupabaseInsertBuilder = {
  select(columns: string): {
    single(): Promise<SupabaseResult<Record<string, unknown>>>;
  };
};

type SupabaseTableBuilder = {
  select<T extends Record<string, unknown>>(columns: string): SupabaseSelectBuilder<T>;
  insert(values: Record<string, unknown>): SupabaseInsertBuilder;
};

export type SupabaseClientLike = {
  from(table: string): SupabaseTableBuilder;
};

export class SupabaseVehicleSaleRecognitionRepository
  implements VehicleSaleRecognitionRepository
{
  constructor(
    private readonly userClient: SupabaseClientLike,
    private readonly adminClient: SupabaseClientLike
  ) {}

  async getActorProfile(actorUserId: string): Promise<VehicleSaleRecognitionActor | null> {
    const result = await this.userClient
      .from('users')
      .select<Record<string, unknown>>('id, tenant_id, role, status')
      .eq('id', actorUserId)
      .maybeSingle();

    throwOnSupabaseError(result.error, 'Failed to load recognition actor.');
    return result.data ? mapActor(result.data) : null;
  }

  async getVehicleById(vehicleId: string): Promise<VehicleSaleRecognitionVehicle | null> {
    const result = await this.adminClient
      .from('auto_vehicles')
      .select<Record<string, unknown>>('id, tenant_id')
      .eq('id', vehicleId)
      .maybeSingle();

    throwOnSupabaseError(result.error, 'Failed to load recognition vehicle.');
    return result.data
      ? {
          id: getString(result.data, 'id'),
          tenantId: getString(result.data, 'tenant_id'),
        }
      : null;
  }

  async getCustomerById(customerId: string): Promise<VehicleSaleRecognitionCustomer | null> {
    const result = await this.adminClient
      .from('customers')
      .select<Record<string, unknown>>('id, tenant_id')
      .eq('id', customerId)
      .maybeSingle();

    throwOnSupabaseError(result.error, 'Failed to load recognition customer.');
    return result.data
      ? {
          id: getString(result.data, 'id'),
          tenantId: getString(result.data, 'tenant_id'),
        }
      : null;
  }

  async getBookingById(bookingId: string): Promise<VehicleSaleRecognitionBooking | null> {
    const result = await this.adminClient
      .from('auto_bookings')
      .select<Record<string, unknown>>('id, tenant_id, customer_id, vehicle_id')
      .eq('id', bookingId)
      .maybeSingle();

    throwOnSupabaseError(result.error, 'Failed to load recognition booking.');
    return result.data
      ? {
          id: getString(result.data, 'id'),
          tenantId: getString(result.data, 'tenant_id'),
          customerId: getString(result.data, 'customer_id'),
          vehicleId: getNullableString(result.data, 'vehicle_id'),
        }
      : null;
  }

  async findActiveAccountingPolicies(params: {
    policyId: string;
    effectiveDate: string;
  }): Promise<VehicleSaleRecognitionPolicy[]> {
    const result = await this.adminClient
      .from('policy_registry')
      .select<Record<string, unknown>>('policy_id, version')
      .eq('policy_id', params.policyId)
      .eq('status', 'active')
      .eq('is_active', true)
      .is('deleted_at', null)
      .lte('effective_date', params.effectiveDate)
      .or(`expire_date.is.null,expire_date.gt.${params.effectiveDate}`)
      .order('version', { ascending: false })
      .limit(2);

    throwOnSupabaseError(result.error, 'Failed to resolve accounting policy.');
    return (result.data ?? []).map((row) => ({
      policyId: getString(row, 'policy_id'),
      version: getString(row, 'version'),
    }));
  }

  async findRecognitionByIdempotencyKey(params: {
    tenantId: string;
    idempotencyKey: string;
  }): Promise<VehicleSaleRecognitionRecord | null> {
    const result = await this.adminClient
      .from('auto_vehicle_sale_recognitions')
      .select<Record<string, unknown>>('*')
      .eq('tenant_id', params.tenantId)
      .eq('idempotency_key', params.idempotencyKey)
      .maybeSingle();

    throwOnSupabaseError(result.error, 'Failed to load recognition by idempotency key.');
    return result.data ? mapRecognitionRecord(result.data) : null;
  }

  async findRecognitionBySaleTransactionId(params: {
    tenantId: string;
    saleTransactionId: string;
  }): Promise<VehicleSaleRecognitionRecord | null> {
    const result = await this.adminClient
      .from('auto_vehicle_sale_recognitions')
      .select<Record<string, unknown>>('*')
      .eq('tenant_id', params.tenantId)
      .eq('sale_transaction_id', params.saleTransactionId)
      .maybeSingle();

    throwOnSupabaseError(
      result.error,
      'Failed to load recognition by sale transaction.'
    );
    return result.data ? mapRecognitionRecord(result.data) : null;
  }

  async insertRecognition(
    input: VehicleSaleRecognitionLedgerInsert
  ): Promise<VehicleSaleRecognitionRecord> {
    const result = await this.adminClient
      .from('auto_vehicle_sale_recognitions')
      .insert(toRecognitionInsertRow(input))
      .select('*')
      .single();

    throwOnSupabaseError(result.error, 'Failed to insert vehicle sale recognition.');
    if (!result.data) {
      throw new Error('Vehicle sale recognition insert returned no row.');
    }
    return mapRecognitionRecord(result.data);
  }
}

export function asSupabaseVehicleSaleRecognitionClient(
  client: unknown
): SupabaseClientLike {
  return client as SupabaseClientLike;
}

function mapActor(row: Record<string, unknown>): VehicleSaleRecognitionActor {
  return {
    id: getString(row, 'id'),
    tenantId: getString(row, 'tenant_id'),
    role: getString(row, 'role'),
    status: getNullableString(row, 'status'),
  };
}

function mapRecognitionRecord(row: Record<string, unknown>): VehicleSaleRecognitionRecord {
  return {
    id: getString(row, 'id'),
    tenantId: getString(row, 'tenant_id'),
    saleTransactionId: getString(row, 'sale_transaction_id'),
    idempotencyKey: getString(row, 'idempotency_key'),
    bookingId: getString(row, 'booking_id'),
    vehicleId: getString(row, 'vehicle_id'),
    customerId: getString(row, 'customer_id'),
    recognizedAt: getString(row, 'recognized_at'),
    recognizedByUserId: getString(row, 'recognized_by_user_id'),
    recognitionBasis: getString(row, 'recognition_basis'),
    sourceDocumentType: getString(row, 'source_document_type'),
    sourceDocumentId: getString(row, 'source_document_id'),
    handoverEvidenceRef: getString(row, 'handover_evidence_ref'),
    accountingPolicyId: getString(row, 'accounting_policy_id'),
    accountingPolicyVersion: getString(row, 'accounting_policy_version'),
    salePriceRecognized: getNumber(row, 'sale_price_recognized'),
    discountAmount: getNumber(row, 'discount_amount'),
    priceAdjustmentAmount: getNumber(row, 'price_adjustment_amount'),
    currencyCode: 'VND',
    depositReceivedTotal: getNumber(row, 'deposit_received_total'),
    paymentReceivedTotal: getNumber(row, 'payment_received_total'),
    receivableAmountAtRecognition: getNumber(
      row,
      'receivable_amount_at_recognition'
    ),
    costBasisAtSale: getNumber(row, 'cost_basis_at_sale'),
    costBasisSourceType: getString(row, 'cost_basis_source_type'),
    costBasisSourceRef: getString(row, 'cost_basis_source_ref'),
    costBasisComponents: getJsonObject(row, 'cost_basis_components'),
    warrantyEntitlementRef: getNullableString(row, 'warranty_entitlement_ref'),
    metadata: getJsonObject(row, 'metadata'),
    createdAt: getString(row, 'created_at'),
  };
}

function toRecognitionInsertRow(
  input: VehicleSaleRecognitionLedgerInsert
): Record<string, unknown> {
  return {
    tenant_id: input.tenantId,
    sale_transaction_id: input.saleTransactionId,
    idempotency_key: input.idempotencyKey,
    booking_id: input.bookingId,
    vehicle_id: input.vehicleId,
    customer_id: input.customerId,
    recognized_at: input.recognizedAt,
    recognized_by_user_id: input.recognizedByUserId,
    recognition_basis: input.recognitionBasis,
    source_document_type: input.sourceDocumentType,
    source_document_id: input.sourceDocumentId,
    handover_evidence_ref: input.handoverEvidenceRef,
    accounting_policy_id: input.accountingPolicyId,
    accounting_policy_version: input.accountingPolicyVersion,
    sale_price_recognized: input.salePriceRecognized,
    discount_amount: input.discountAmount,
    price_adjustment_amount: input.priceAdjustmentAmount,
    currency_code: input.currencyCode,
    deposit_received_total: input.depositReceivedTotal,
    payment_received_total: input.paymentReceivedTotal,
    receivable_amount_at_recognition: input.receivableAmountAtRecognition,
    cost_basis_at_sale: input.costBasisAtSale,
    cost_basis_source_type: input.costBasisSourceType,
    cost_basis_source_ref: input.costBasisSourceRef,
    cost_basis_components: input.costBasisComponents,
    warranty_entitlement_ref: input.warrantyEntitlementRef,
    metadata: input.metadata,
  };
}

function throwOnSupabaseError(error: SupabaseError | null, message: string): void {
  if (!error) return;
  throw new Error(`${message} ${error.message}`);
}

function getString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Expected ${field} to be a string.`);
}

function getNullableString(
  row: Record<string, unknown>,
  field: string
): string | null {
  const value = row[field];
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Expected ${field} to be a string or null.`);
}

function getNumber(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Expected ${field} to be a numeric value.`);
}

function getJsonObject(row: Record<string, unknown>, field: string): JsonObject {
  const value = row[field];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  throw new Error(`Expected ${field} to be a JSON object.`);
}
