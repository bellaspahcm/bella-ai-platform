export const AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID =
  'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORBIDDEN_POLICY_FIELDS = [
  'accounting_policy_id',
  'accountingPolicyId',
  'accounting_policy_version',
  'accountingPolicyVersion',
];

const ACCOUNTING_CAPABLE_ROLES = new Set([
  'accountant',
  'admin',
  'super_admin',
  'hq_super_admin',
  'finance_admin',
  'finance_manager',
]);

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export interface VehicleSaleRecognitionCommand {
  saleTransactionId: string;
  idempotencyKey: string;
  bookingId: string;
  vehicleId: string;
  customerId: string;
  recognizedAt?: string;
  recognitionBasis: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  handoverEvidenceRef: string;
  salePriceRecognized: number;
  discountAmount?: number;
  priceAdjustmentAmount?: number;
  currencyCode?: 'VND';
  depositReceivedTotal?: number;
  paymentReceivedTotal?: number;
  receivableAmountAtRecognition?: number;
  costBasisAtSale: number;
  costBasisSourceType: string;
  costBasisSourceRef: string;
  costBasisComponents?: JsonObject;
  warrantyEntitlementRef?: string;
  metadata?: JsonObject;
}

export interface VehicleSaleRecognitionActor {
  id: string;
  tenantId: string;
  role: string;
  status?: string | null;
}

export interface VehicleSaleRecognitionPolicy {
  policyId: string;
  version: string;
}

export interface VehicleSaleRecognitionVehicle {
  id: string;
  tenantId: string;
}

export interface VehicleSaleRecognitionCustomer {
  id: string;
  tenantId: string;
}

export interface VehicleSaleRecognitionBooking {
  id: string;
  tenantId: string;
  customerId: string;
  vehicleId: string | null;
}

export interface VehicleSaleRecognitionLedgerInsert {
  tenantId: string;
  saleTransactionId: string;
  idempotencyKey: string;
  bookingId: string;
  vehicleId: string;
  customerId: string;
  recognizedAt: string;
  recognizedByUserId: string;
  recognitionBasis: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  handoverEvidenceRef: string;
  accountingPolicyId: string;
  accountingPolicyVersion: string;
  salePriceRecognized: number;
  discountAmount: number;
  priceAdjustmentAmount: number;
  currencyCode: 'VND';
  depositReceivedTotal: number;
  paymentReceivedTotal: number;
  receivableAmountAtRecognition: number;
  costBasisAtSale: number;
  costBasisSourceType: string;
  costBasisSourceRef: string;
  costBasisComponents: JsonObject;
  warrantyEntitlementRef: string | null;
  metadata: JsonObject;
}

export interface VehicleSaleRecognitionRecord
  extends VehicleSaleRecognitionLedgerInsert {
  id: string;
  createdAt: string;
}

export interface VehicleSaleRecognitionRepository {
  getActorProfile(actorUserId: string): Promise<VehicleSaleRecognitionActor | null>;
  getVehicleById(vehicleId: string): Promise<VehicleSaleRecognitionVehicle | null>;
  getCustomerById(customerId: string): Promise<VehicleSaleRecognitionCustomer | null>;
  getBookingById(bookingId: string): Promise<VehicleSaleRecognitionBooking | null>;
  findActiveAccountingPolicies(params: {
    policyId: string;
    effectiveDate: string;
  }): Promise<VehicleSaleRecognitionPolicy[]>;
  findRecognitionByIdempotencyKey(params: {
    tenantId: string;
    idempotencyKey: string;
  }): Promise<VehicleSaleRecognitionRecord | null>;
  findRecognitionBySaleTransactionId(params: {
    tenantId: string;
    saleTransactionId: string;
  }): Promise<VehicleSaleRecognitionRecord | null>;
  insertRecognition(
    input: VehicleSaleRecognitionLedgerInsert
  ): Promise<VehicleSaleRecognitionRecord>;
}

export class VehicleSaleRecognitionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400
  ) {
    super(message);
    this.name = 'VehicleSaleRecognitionError';
  }
}

export async function recognizeVehicleSaleRevenue(params: {
  actorUserId: string;
  command: VehicleSaleRecognitionCommand;
  repository: VehicleSaleRecognitionRepository;
  clock?: () => Date;
}): Promise<{
  status: 'created' | 'idempotent';
  recognition: VehicleSaleRecognitionRecord;
}> {
  rejectCallerPolicyFields(params.command);

  const clock = params.clock ?? (() => new Date());
  const command = normalizeCommand(params.command, clock);
  const actor = await requireAuthorizedActor(params.repository, params.actorUserId);

  await verifyTenantBoundReferences(params.repository, actor.tenantId, command);

  const policy = await resolveAccountingPolicy(params.repository, command.recognizedAt);
  const existingByIdempotencyKey =
    await params.repository.findRecognitionByIdempotencyKey({
      tenantId: actor.tenantId,
      idempotencyKey: command.idempotencyKey,
    });

  if (existingByIdempotencyKey) {
    if (existingByIdempotencyKey.saleTransactionId !== command.saleTransactionId) {
      throw new VehicleSaleRecognitionError(
        'IDEMPOTENCY_KEY_CONFLICT',
        'Idempotency key is already bound to another sale transaction.',
        409
      );
    }

    return {
      status: 'idempotent',
      recognition: existingByIdempotencyKey,
    };
  }

  const existingBySaleTransaction =
    await params.repository.findRecognitionBySaleTransactionId({
      tenantId: actor.tenantId,
      saleTransactionId: command.saleTransactionId,
    });

  if (existingBySaleTransaction) {
    throw new VehicleSaleRecognitionError(
      'SALE_TRANSACTION_ALREADY_RECOGNIZED',
      'Sale transaction already has an initial revenue recognition.',
      409
    );
  }

  const recognition = await params.repository.insertRecognition({
    tenantId: actor.tenantId,
    saleTransactionId: command.saleTransactionId,
    idempotencyKey: command.idempotencyKey,
    bookingId: command.bookingId,
    vehicleId: command.vehicleId,
    customerId: command.customerId,
    recognizedAt: command.recognizedAt,
    recognizedByUserId: actor.id,
    recognitionBasis: command.recognitionBasis,
    sourceDocumentType: command.sourceDocumentType,
    sourceDocumentId: command.sourceDocumentId,
    handoverEvidenceRef: command.handoverEvidenceRef,
    accountingPolicyId: policy.policyId,
    accountingPolicyVersion: policy.version,
    salePriceRecognized: command.salePriceRecognized,
    discountAmount: command.discountAmount,
    priceAdjustmentAmount: command.priceAdjustmentAmount,
    currencyCode: command.currencyCode,
    depositReceivedTotal: command.depositReceivedTotal,
    paymentReceivedTotal: command.paymentReceivedTotal,
    receivableAmountAtRecognition: command.receivableAmountAtRecognition,
    costBasisAtSale: command.costBasisAtSale,
    costBasisSourceType: command.costBasisSourceType,
    costBasisSourceRef: command.costBasisSourceRef,
    costBasisComponents: command.costBasisComponents,
    warrantyEntitlementRef: command.warrantyEntitlementRef,
    metadata: {
      ...command.metadata,
      command: 'recognize_vehicle_sale_revenue',
    },
  });

  return {
    status: 'created',
    recognition,
  };
}

export function parseVehicleSaleRecognitionCommand(
  value: unknown
): VehicleSaleRecognitionCommand {
  if (!isRecord(value)) {
    throw new VehicleSaleRecognitionError(
      'INVALID_PAYLOAD',
      'Vehicle sale recognition payload must be an object.'
    );
  }

  rejectCallerPolicyFields(value);

  return {
    saleTransactionId: readRequiredString(value, 'saleTransactionId'),
    idempotencyKey: readRequiredString(value, 'idempotencyKey'),
    bookingId: readRequiredString(value, 'bookingId'),
    vehicleId: readRequiredString(value, 'vehicleId'),
    customerId: readRequiredString(value, 'customerId'),
    recognizedAt: readOptionalString(value, 'recognizedAt'),
    recognitionBasis: readRequiredString(value, 'recognitionBasis'),
    sourceDocumentType: readRequiredString(value, 'sourceDocumentType'),
    sourceDocumentId: readRequiredString(value, 'sourceDocumentId'),
    handoverEvidenceRef: readRequiredString(value, 'handoverEvidenceRef'),
    salePriceRecognized: readRequiredMoney(value, 'salePriceRecognized'),
    discountAmount: readOptionalMoney(value, 'discountAmount', 0),
    priceAdjustmentAmount: readOptionalSignedMoney(value, 'priceAdjustmentAmount', 0),
    currencyCode: readCurrency(value),
    depositReceivedTotal: readOptionalMoney(value, 'depositReceivedTotal', 0),
    paymentReceivedTotal: readOptionalMoney(value, 'paymentReceivedTotal', 0),
    receivableAmountAtRecognition: readOptionalSignedMoney(
      value,
      'receivableAmountAtRecognition',
      0
    ),
    costBasisAtSale: readRequiredNonNegativeMoney(value, 'costBasisAtSale'),
    costBasisSourceType: readRequiredString(value, 'costBasisSourceType'),
    costBasisSourceRef: readRequiredString(value, 'costBasisSourceRef'),
    costBasisComponents: readOptionalJsonObject(value, 'costBasisComponents'),
    warrantyEntitlementRef: readOptionalString(value, 'warrantyEntitlementRef'),
    metadata: readOptionalJsonObject(value, 'metadata'),
  };
}

function normalizeCommand(
  command: VehicleSaleRecognitionCommand,
  clock: () => Date
): Required<
  Omit<
    VehicleSaleRecognitionCommand,
    'recognizedAt' | 'warrantyEntitlementRef'
  >
> & {
  recognizedAt: string;
  warrantyEntitlementRef: string | null;
} {
  requireUuid(command.saleTransactionId, 'saleTransactionId');
  requireUuid(command.bookingId, 'bookingId');
  requireUuid(command.vehicleId, 'vehicleId');
  requireUuid(command.customerId, 'customerId');

  const recognizedAt = command.recognizedAt ?? clock().toISOString();
  const recognizedDate = new Date(recognizedAt);
  if (Number.isNaN(recognizedDate.getTime())) {
    throw new VehicleSaleRecognitionError(
      'INVALID_RECOGNIZED_AT',
      'recognizedAt must be a valid ISO timestamp.'
    );
  }

  return {
    saleTransactionId: command.saleTransactionId,
    idempotencyKey: requireText(command.idempotencyKey, 'idempotencyKey'),
    bookingId: command.bookingId,
    vehicleId: command.vehicleId,
    customerId: command.customerId,
    recognizedAt: recognizedDate.toISOString(),
    recognitionBasis: requireText(command.recognitionBasis, 'recognitionBasis'),
    sourceDocumentType: requireText(command.sourceDocumentType, 'sourceDocumentType'),
    sourceDocumentId: requireText(command.sourceDocumentId, 'sourceDocumentId'),
    handoverEvidenceRef: requireText(command.handoverEvidenceRef, 'handoverEvidenceRef'),
    salePriceRecognized: requirePositiveIntegerMoney(
      command.salePriceRecognized,
      'salePriceRecognized'
    ),
    discountAmount: requireNonNegativeIntegerMoney(
      command.discountAmount ?? 0,
      'discountAmount'
    ),
    priceAdjustmentAmount: requireIntegerMoney(
      command.priceAdjustmentAmount ?? 0,
      'priceAdjustmentAmount'
    ),
    currencyCode: command.currencyCode ?? 'VND',
    depositReceivedTotal: requireNonNegativeIntegerMoney(
      command.depositReceivedTotal ?? 0,
      'depositReceivedTotal'
    ),
    paymentReceivedTotal: requireNonNegativeIntegerMoney(
      command.paymentReceivedTotal ?? 0,
      'paymentReceivedTotal'
    ),
    receivableAmountAtRecognition: requireIntegerMoney(
      command.receivableAmountAtRecognition ?? 0,
      'receivableAmountAtRecognition'
    ),
    costBasisAtSale: requireNonNegativeIntegerMoney(
      command.costBasisAtSale,
      'costBasisAtSale'
    ),
    costBasisSourceType: requireText(
      command.costBasisSourceType,
      'costBasisSourceType'
    ),
    costBasisSourceRef: requireText(command.costBasisSourceRef, 'costBasisSourceRef'),
    costBasisComponents: command.costBasisComponents ?? {},
    warrantyEntitlementRef: command.warrantyEntitlementRef
      ? requireText(command.warrantyEntitlementRef, 'warrantyEntitlementRef')
      : null,
    metadata: command.metadata ?? {},
  };
}

async function requireAuthorizedActor(
  repository: VehicleSaleRecognitionRepository,
  actorUserId: string
): Promise<VehicleSaleRecognitionActor> {
  requireUuid(actorUserId, 'actorUserId');

  const actor = await repository.getActorProfile(actorUserId);
  if (!actor?.tenantId) {
    throw new VehicleSaleRecognitionError(
      'ACTOR_NOT_FOUND',
      'Recognition actor was not found or has no tenant.',
      403
    );
  }

  if (actor.status && actor.status !== 'active') {
    throw new VehicleSaleRecognitionError(
      'ACTOR_INACTIVE',
      'Recognition actor is not active.',
      403
    );
  }

  if (!ACCOUNTING_CAPABLE_ROLES.has(actor.role)) {
    throw new VehicleSaleRecognitionError(
      'ACTOR_NOT_AUTHORIZED',
      'Actor is not authorized to recognize vehicle sale revenue.',
      403
    );
  }

  return actor;
}

async function verifyTenantBoundReferences(
  repository: VehicleSaleRecognitionRepository,
  tenantId: string,
  command: ReturnType<typeof normalizeCommand>
): Promise<void> {
  const vehicle = await repository.getVehicleById(command.vehicleId);
  const customer = await repository.getCustomerById(command.customerId);
  const booking = await repository.getBookingById(command.bookingId);

  if (!vehicle || vehicle.tenantId !== tenantId) {
    throw new VehicleSaleRecognitionError(
      'VEHICLE_OUTSIDE_TENANT',
      'Vehicle does not belong to the recognition tenant.',
      403
    );
  }

  if (!customer || customer.tenantId !== tenantId) {
    throw new VehicleSaleRecognitionError(
      'CUSTOMER_OUTSIDE_TENANT',
      'Customer does not belong to the recognition tenant.',
      403
    );
  }

  if (!booking || booking.tenantId !== tenantId) {
    throw new VehicleSaleRecognitionError(
      'BOOKING_OUTSIDE_TENANT',
      'Booking does not belong to the recognition tenant.',
      403
    );
  }

  if (booking.customerId !== command.customerId) {
    throw new VehicleSaleRecognitionError(
      'BOOKING_CUSTOMER_MISMATCH',
      'Booking customer does not match the recognition customer.'
    );
  }

  if (booking.vehicleId && booking.vehicleId !== command.vehicleId) {
    throw new VehicleSaleRecognitionError(
      'BOOKING_VEHICLE_MISMATCH',
      'Booking vehicle does not match the recognition vehicle.'
    );
  }
}

async function resolveAccountingPolicy(
  repository: VehicleSaleRecognitionRepository,
  recognizedAt: string
): Promise<VehicleSaleRecognitionPolicy> {
  const effectiveDate = recognizedAt.slice(0, 10);
  const policies = await repository.findActiveAccountingPolicies({
    policyId: AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID,
    effectiveDate,
  });

  if (policies.length === 0) {
    throw new VehicleSaleRecognitionError(
      'ACCOUNTING_POLICY_NOT_FOUND',
      'No active AutoMove vehicle sale accounting policy is approved for the recognition date.',
      409
    );
  }

  if (policies.length > 1) {
    throw new VehicleSaleRecognitionError(
      'ACCOUNTING_POLICY_AMBIGUOUS',
      'Multiple active AutoMove vehicle sale accounting policies match the recognition date.',
      409
    );
  }

  return policies[0];
}

function rejectCallerPolicyFields(value: unknown): void {
  if (!isRecord(value)) return;

  const forbidden = FORBIDDEN_POLICY_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(value, field)
  );

  if (forbidden) {
    throw new VehicleSaleRecognitionError(
      'CALLER_POLICY_NOT_ALLOWED',
      `Caller-supplied ${forbidden} is not accepted. Policy must be resolved from the trusted registry.`
    );
  }
}

function requireUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new VehicleSaleRecognitionError(
      'INVALID_UUID',
      `${field} must be a valid UUID.`
    );
  }
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new VehicleSaleRecognitionError(
      'INVALID_TEXT',
      `${field} must be a non-empty string.`
    );
  }
  return trimmed;
}

function requirePositiveIntegerMoney(value: number, field: string): number {
  const normalized = requireIntegerMoney(value, field);
  if (normalized <= 0) {
    throw new VehicleSaleRecognitionError(
      'INVALID_MONEY',
      `${field} must be greater than zero.`
    );
  }
  return normalized;
}

function requireNonNegativeIntegerMoney(value: number, field: string): number {
  const normalized = requireIntegerMoney(value, field);
  if (normalized < 0) {
    throw new VehicleSaleRecognitionError(
      'INVALID_MONEY',
      `${field} must be greater than or equal to zero.`
    );
  }
  return normalized;
}

function requireIntegerMoney(value: number, field: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new VehicleSaleRecognitionError(
      'INVALID_MONEY',
      `${field} must be an integer VND amount.`
    );
  }
  return value;
}

function readRequiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new VehicleSaleRecognitionError(
      'INVALID_PAYLOAD',
      `${field} must be a non-empty string.`
    );
  }
  return value.trim();
}

function readOptionalString(
  record: Record<string, unknown>,
  field: string
): string | undefined {
  const value = record[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new VehicleSaleRecognitionError(
      'INVALID_PAYLOAD',
      `${field} must be a string when provided.`
    );
  }
  return value.trim() || undefined;
}

function readRequiredMoney(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== 'number') {
    throw new VehicleSaleRecognitionError(
      'INVALID_PAYLOAD',
      `${field} must be a numeric VND amount.`
    );
  }
  return requirePositiveIntegerMoney(value, field);
}

function readRequiredNonNegativeMoney(
  record: Record<string, unknown>,
  field: string
): number {
  const value = record[field];
  if (typeof value !== 'number') {
    throw new VehicleSaleRecognitionError(
      'INVALID_PAYLOAD',
      `${field} must be a numeric VND amount.`
    );
  }
  return requireNonNegativeIntegerMoney(value, field);
}

function readOptionalMoney(
  record: Record<string, unknown>,
  field: string,
  fallback: number
): number {
  const value = record[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number') {
    throw new VehicleSaleRecognitionError(
      'INVALID_PAYLOAD',
      `${field} must be a numeric VND amount.`
    );
  }
  return requireNonNegativeIntegerMoney(value, field);
}

function readOptionalSignedMoney(
  record: Record<string, unknown>,
  field: string,
  fallback: number
): number {
  const value = record[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number') {
    throw new VehicleSaleRecognitionError(
      'INVALID_PAYLOAD',
      `${field} must be a numeric VND amount.`
    );
  }
  return requireIntegerMoney(value, field);
}

function readCurrency(record: Record<string, unknown>): 'VND' {
  const value = record.currencyCode;
  if (value === undefined || value === null || value === 'VND') return 'VND';
  throw new VehicleSaleRecognitionError(
    'UNSUPPORTED_CURRENCY',
    'Only VND is supported for AutoMove vehicle sale recognition v1.'
  );
}

function readOptionalJsonObject(
  record: Record<string, unknown>,
  field: string
): JsonObject {
  const value = record[field];
  if (value === undefined || value === null) return {};
  if (!isJsonObject(value)) {
    throw new VehicleSaleRecognitionError(
      'INVALID_JSON_OBJECT',
      `${field} must be a JSON object.`
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
}
