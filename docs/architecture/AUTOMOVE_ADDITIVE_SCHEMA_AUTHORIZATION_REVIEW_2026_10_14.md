# AutoMove Additive Schema Authorization Review

Date: 2026-10-14
Scope: schema authorization review only

## Decision

The minimal additive schema scope is suitable for a future migration batch, with strict conditions. This review does not create, authorize, or apply a migration.

```ini
ADDITIVE_SCHEMA_AUTHORIZATION_REVIEW = COMPLETE
SCHEMA_AUTHORIZATION_RECOMMENDATION  = APPROVE_MINIMAL_ADDITIVE_SCHEMA_WITH_CONDITIONS
CODE_MUTATION                        = NOT_STARTED
SCHEMA_MIGRATION                     = NOT_STARTED
PRODUCTION_MUTATION                  = NOT_AUTHORIZED
FINANCIAL_REPORTING_SERVICE          = HELD
WARRANTY_SERVICE_MIGRATION           = HELD
AUTOMOVE_FULL_PRODUCT_READINESS      = NOT_READY
```

## Scope Boundary

This review covers only the additive schema needed to support trusted policy resolution, immutable vehicle-sale recognition, idempotent retry behavior, and append-only adjustment/reversal records.

Out of scope:

- Do not migrate `FinancialReportingService`.
- Do not migrate `WarrantyService`.
- Do not post ledger entries or map TK 511, COGS, advances, receivables, refunds, or reversals.
- Do not implement tax invoice rules.
- Do not mutate Production.
- Do not create `auto_sales` to satisfy legacy consumers.
- Do not weaken RLS or use service-role bypass to hide authorization gaps.

## Evidence Summary

Existing candidate source records:

- `auto_bookings` has tenant, customer, vehicle, booking number, `total_price`, deposit fields, `payment_status`, business `status`, and `accounting_entry_id`.
- `auto_vehicles` has tenant, VIN, catalog reference, `list_price`, `cost_price`, lifecycle status, allocation fields, delivery fields, and RLS.
- `auto_deposits` has tenant, booking, amount, payment method/date/reference, status, audit fields, RLS, and grants.

Existing governance and Finance primitives:

- `policy_registry` has policy id, semver version, status, optional tenant id, active flag, effective/expiry dates, config, metadata, and audit fields.
- `policy_registry` active uniqueness is currently global by `policy_id`, not tenant-scoped.
- `DefaultPolicyContextResolver` has the right conceptual shape for tenant/effective-time resolution, but is currently default/in-memory and not a trusted database-backed policy source.
- Accounting journal tables already protect posted entries from direct mutation, but vehicle-sale ledger mapping remains unapproved.
- Accounting outbox idempotency has already been hardened to `(tenant_id, event_type, reference_type, reference_id)`, which is the right pattern to mirror for sale recognition identity separation.

## 1. Recognition Ledger

Status: `APPROVE_SCHEMA_SCOPE_WITH_CONDITIONS`

Approved future table shape:

`public.auto_vehicle_sale_recognitions`

Minimum columns:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
- `sale_transaction_id UUID NOT NULL`
- `idempotency_key TEXT NOT NULL`
- `booking_id UUID`; insert validation must fail closed unless `auto_bookings` exists and the row matches the recognition tenant, customer, and vehicle.
- `vehicle_id UUID NOT NULL REFERENCES public.auto_vehicles(id) ON DELETE RESTRICT`
- `customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT`
- `recognized_at TIMESTAMPTZ NOT NULL`
- `recognized_by_user_id UUID REFERENCES public.users(id)`
- `recognition_basis TEXT NOT NULL`
- `source_document_type TEXT NOT NULL`
- `source_document_id TEXT NOT NULL`
- `handover_evidence_ref TEXT`
- `accounting_policy_id TEXT NOT NULL`
- `accounting_policy_version TEXT NOT NULL`
- `sale_price_recognized NUMERIC(18,0) NOT NULL CHECK (sale_price_recognized >= 0)`
- `discount_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)`
- `price_adjustment_amount NUMERIC(18,0) NOT NULL DEFAULT 0`
- `currency_code TEXT NOT NULL DEFAULT 'VND'`
- `deposit_received_total NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (deposit_received_total >= 0)`
- `payment_received_total NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (payment_received_total >= 0)`
- `receivable_amount_at_recognition NUMERIC(18,0) NOT NULL DEFAULT 0`
- `cost_basis_at_sale NUMERIC(18,0) NOT NULL CHECK (cost_basis_at_sale >= 0)`
- `cost_basis_source_type TEXT NOT NULL`
- `cost_basis_source_ref TEXT NOT NULL`
- `cost_basis_components JSONB NOT NULL DEFAULT '{}'::jsonb`
- `warranty_entitlement_ref TEXT`
- `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

Required constraints:

- `UNIQUE (tenant_id, sale_transaction_id)`
- `UNIQUE (tenant_id, idempotency_key)`
- `CHECK (currency_code = 'VND')` for v1 unless multi-currency is separately approved.
- `CHECK (source_document_type <> '')`
- `CHECK (source_document_id <> '')`
- `CHECK (accounting_policy_id <> '')`
- `CHECK (accounting_policy_version ~ '^\d+\.\d+\.\d+$')`

Required immutability:

- Do not add `updated_at` as a normal mutation path.
- Add a database trigger that rejects `UPDATE` and `DELETE` on recognized sale rows.
- Any correction must go through the adjustment/reversal table.

Rationale:

- `auto_bookings.total_price` and `auto_vehicles.cost_price` are candidate inputs, not historical reporting truth.
- This ledger snapshots recognized revenue, sale-time cost basis, policy version, and evidence references at the moment of recognition.
- The schema does not require `auto_sales` and does not rewrite legacy consumers.

## 2. Adjustment Ledger

Status: `APPROVE_SCHEMA_SCOPE_WITH_CONDITIONS`

Approved future table shape:

`public.auto_vehicle_sale_recognition_adjustments`

Minimum columns:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
- `recognition_id UUID NOT NULL REFERENCES public.auto_vehicle_sale_recognitions(id) ON DELETE RESTRICT`
- `adjustment_type TEXT NOT NULL`
- `idempotency_key TEXT NOT NULL`
- `reason TEXT NOT NULL`
- `evidence_ref TEXT NOT NULL`
- `affected_period_ref TEXT`
- `created_by_user_id UUID REFERENCES public.users(id)`
- `accounting_policy_id TEXT NOT NULL`
- `accounting_policy_version TEXT NOT NULL`
- `sale_price_delta NUMERIC(18,0) NOT NULL DEFAULT 0`
- `cost_basis_delta NUMERIC(18,0) NOT NULL DEFAULT 0`
- `receivable_delta NUMERIC(18,0) NOT NULL DEFAULT 0`
- `refund_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0)`
- `currency_code TEXT NOT NULL DEFAULT 'VND'`
- `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

Required constraints:

- `UNIQUE (tenant_id, idempotency_key)`
- `CHECK (adjustment_type IN ('sale_revenue_adjusted', 'sale_revenue_reversed', 'cost_basis_adjusted', 'refund_recorded', 'warranty_entitlement_adjusted'))`
- `CHECK (reason <> '')`
- `CHECK (evidence_ref <> '')`
- `CHECK (currency_code = 'VND')` for v1 unless multi-currency is separately approved.
- `CHECK (accounting_policy_version ~ '^\d+\.\d+\.\d+$')`

Required immutability:

- Add a database trigger that rejects `UPDATE` and `DELETE` on adjustment rows.
- Adjustment rows must reference the original `recognition_id`; they must never overwrite the original recognition row.

Required retry behavior:

- Initial recognition and adjustment/reversal commands must use separate idempotency keys.
- Retry of the same adjustment key returns the existing adjustment or fails closed without duplicate financial effect.

Blocked items:

- Closed-period adjustment behavior remains `NOT_AUTHORIZED` until accounting approval defines it.
- Ledger posting for any adjustment remains `NOT_AUTHORIZED`.

## 3. Policy Ownership

Status: `APPROVE_GLOBAL_POLICY_REGISTRY_ONLY`

Approved v1 assumption:

- Accounting Policy v1 is a global AutoMove policy for the approved implementation scope.
- The trusted resolver may use `policy_registry` only if it resolves a dedicated global policy id, for example `AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY`, with `status = 'active'`, `is_active = true`, effective date satisfied, expiry date not passed, and non-deleted state.

Conditions:

- Runtime must not trust `accounting_policy_id` or `accounting_policy_version` from caller payload.
- Runtime must persist the resolved policy id/version on recognition and adjustment records.
- Policy resolution must use recognition effective time, not the current wall-clock time when replaying or correcting historical events.
- The migration must not silently alter `policy_registry` uniqueness.

Not approved:

- Tenant-specific active policy versions are not approved under the current `policy_registry` shape.
- If tenant-specific policy is required, create a separate authorization review for either a tenant-scoped policy assignment table or an AutoMove-specific policy table.
- Do not treat the current default in-memory Finance resolver as a trusted approved-policy source.

## RLS And Grants Scope

Status: `APPROVE_WITH_STRICT_MINIMUM`

Required for both new tables:

- Enable RLS.
- Tenant isolation must use `tenant_id = public.get_auth_tenant_id()` for authenticated access.
- Do not grant broad `ALL` privileges to `authenticated`.
- Direct `SELECT` may be granted to `authenticated` only with tenant RLS.
- Direct `INSERT` may be granted to `authenticated` only if the command path proves actor authority and RLS `WITH CHECK` enforces tenant equality.
- Direct `UPDATE` and `DELETE` must not be granted to `authenticated`.
- Service-role or owner-operated maintenance must not be used to bypass tenant/authority proof.

Recommended table policies:

- `SELECT TO authenticated USING (tenant_id = public.get_auth_tenant_id())`
- `INSERT TO authenticated WITH CHECK (tenant_id = public.get_auth_tenant_id())`
- No authenticated update/delete policy.

If the implementation chooses RPC instead of direct insert:

- The RPC must validate tenant, actor, authority, policy resolution, and idempotency explicitly.
- The RPC must not accept caller-supplied policy version as authoritative.
- The RPC must not weaken table RLS to compensate for missing command validation.

## Verification Required Before Seal

Non-Production Real DB tests are mandatory before any implementation can be sealed:

- `policy_registry` global active policy resolves correctly.
- Missing, draft, inactive, future, expired, deleted, or ambiguous policy fails closed.
- Caller-supplied `accounting_policy_version` is ignored or rejected.
- Recognition insert stores resolved policy id/version.
- Recognition duplicate retry by `(tenant_id, idempotency_key)` does not duplicate.
- Recognition duplicate retry by `(tenant_id, sale_transaction_id)` does not duplicate.
- Attempted update/delete of recognition row is rejected.
- Adjustment insert references original recognition.
- Adjustment duplicate retry by `(tenant_id, idempotency_key)` does not duplicate.
- Attempted update/delete of adjustment row is rejected.
- Tenant A cannot read or insert Tenant B recognition/adjustment rows.
- Later `auto_vehicles.cost_price` changes do not alter stored `cost_basis_at_sale`.
- Booking/deposit/payment/handover/invoice events do not create recognized revenue unless the recognition command runs.
- AutoMove producer remains sealed: booking/deposit flow still does not emit `PACKAGE_SALE`.

## Stop Conditions

Stop and return to review if any of these appears during migration planning:

- Requirement for tenant-specific accounting policy versions.
- Requirement to post ledger entries.
- Requirement to update or delete recognition history.
- Requirement to use `auto_sales`.
- Requirement to migrate `FinancialReportingService` or `WarrantyService`.
- Requirement to use service-role bypass for normal user-facing recognition.
- Requirement to mutate Production.

## Final Authorization Recommendation

```ini
RECOGNITION_LEDGER_SCHEMA          = APPROVE_WITH_CONDITIONS
ADJUSTMENT_LEDGER_SCHEMA           = APPROVE_WITH_CONDITIONS
POLICY_OWNERSHIP                   = APPROVE_GLOBAL_POLICY_REGISTRY_ONLY
RLS_AND_GRANTS_SCOPE               = APPROVE_WITH_STRICT_MINIMUM
NON_PRODUCTION_REAL_DB_TEST_PLAN   = REQUIRED

MIGRATION_CREATION                 = PENDING_USER_AUTHORIZATION
CODE_IMPLEMENTATION                = PENDING_USER_AUTHORIZATION
LEDGER_POSTING_SCOPE               = NOT_AUTHORIZED
FINANCIAL_REPORTING_SERVICE        = HELD
WARRANTY_SERVICE_MIGRATION         = HELD
PRODUCTION_MUTATION                = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS    = NOT_READY
```
