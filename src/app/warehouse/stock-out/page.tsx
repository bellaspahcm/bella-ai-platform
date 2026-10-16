import { redirect } from 'next/navigation';

import {
  executeCanonicalWarehouseStockOutAction,
  type WarehouseCanonicalStockOutActionInput,
} from '@/services/warehouse-canonical-actions';
import type {
  WarehouseStockOutReason,
  WarehouseStockOutSourceType,
} from '@/platform/logistics/warehouse/stock-out-canonical.facade';

interface WarehouseStockOutPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const sourceTypes = new Set<WarehouseStockOutSourceType>([
  'warehouse_issue',
  'disposal',
  'damage',
  'loss',
  'sales_order',
]);

const reasons = new Set<WarehouseStockOutReason>(['disposal', 'damage', 'loss', 'sale']);

export default async function WarehouseStockOutPage({ searchParams }: WarehouseStockOutPageProps) {
  const params = await searchParams;
  const status = readParam(params, 'status');
  const error = readParam(params, 'error');

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Canonical Warehouse
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Stock Out</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Minimal canonical Stock-Out entry. This path calls the Warehouse Stock-Out action
            adapter, then the sealed canonical facade and Logistics OS persistence.
          </p>
        </header>

        {status === 'success' ? (
          <section
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            data-testid="stock-out-status"
          >
            <p className="font-semibold">Canonical Stock-Out completed</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <StatusRow label="Balance" value={readParam(params, 'balance')} />
              <StatusRow label="Movement" value={readParam(params, 'movement')} />
              <StatusRow label="Traceability" value={readParam(params, 'traceability')} />
              <StatusRow label="Quantity" value={readParam(params, 'quantity')} />
            </dl>
          </section>
        ) : null}

        {error ? (
          <section
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            data-testid="stock-out-error"
          >
            <p className="font-semibold">Canonical Stock-Out rejected</p>
            <p className="mt-1">{error}</p>
          </section>
        ) : null}

        <form
          action={submitCanonicalStockOut}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="canonical-stock-out-form"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Issue document ID" name="issueDocumentId" />
            <Field label="Issue document number" name="issueDocumentNumber" />
            <Field label="Idempotency key" name="idempotencyKey" />
            <SelectField
              label="Issue type"
              name="issueType"
              options={[
                ['warehouse_issue', 'Warehouse issue'],
                ['disposal', 'Disposal'],
                ['damage', 'Damage'],
                ['loss', 'Loss'],
                ['sales_order', 'Sales order'],
              ]}
            />
            <SelectReason label="Reason" name="reason" />
            <Field label="Source line ID" name="sourceLineId" />
            <Field label="Warehouse SKU ID" name="warehouseSkuId" />
            <Field label="Warehouse bin ID" name="warehouseBinId" />
            <Field label="Canonical item ID" name="itemId" />
            <Field label="Location ID" name="locationId" />
            <Field label="Quantity" name="quantity" type="number" step="0.0001" />
            <Field label="Unit of measure" name="unitOfMeasure" defaultValue="EA" />
            <Field label="Lot number" name="lotNumber" />
            <Field label="Notes" name="notes" />
            <Field label="Unit cost" name="unitCost" type="number" step="0.01" defaultValue="0" />
            <Field label="Currency" name="currency" defaultValue="VND" />
          </div>
          <button
            type="submit"
            className="h-11 w-fit rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            data-testid="canonical-stock-out-submit"
          >
            Submit canonical Stock-Out
          </button>
        </form>
      </div>
    </main>
  );
}

async function submitCanonicalStockOut(formData: FormData): Promise<void> {
  'use server';

  const quantity = Number(readFormText(formData, 'quantity'));
  const unitCost = Number(readFormText(formData, 'unitCost'));
  const input: WarehouseCanonicalStockOutActionInput = {
    issueDocument: {
      id: readFormText(formData, 'issueDocumentId'),
      number: readOptionalFormText(formData, 'issueDocumentNumber'),
      type: readIssueType(readFormText(formData, 'issueType')),
    },
    idempotencyKey: readOptionalFormText(formData, 'idempotencyKey'),
    lines: [
      {
        warehouseSkuId: readFormText(formData, 'warehouseSkuId'),
        warehouseBinId: readFormText(formData, 'warehouseBinId'),
        itemId: readFormText(formData, 'itemId'),
        locationId: readFormText(formData, 'locationId'),
        quantity,
        unitOfMeasure: readFormText(formData, 'unitOfMeasure'),
        reason: readReason(readFormText(formData, 'reason')),
        lotNumber: readOptionalFormText(formData, 'lotNumber'),
        sourceLineId: readOptionalFormText(formData, 'sourceLineId'),
        notes: readOptionalFormText(formData, 'notes'),
        unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
        currency: readOptionalFormText(formData, 'currency'),
        metadata: {
          browser_entry: 'canonical_stock_out',
        },
      },
    ],
  };

  const result = await executeCanonicalWarehouseStockOutAction(input);
  const redirectParams = new URLSearchParams();

  if (!result.ok) {
    redirectParams.set('error', `${result.error.code}: ${result.error.message}`);
    redirect(`/warehouse/stock-out?${redirectParams.toString()}`);
  }

  const firstLine = result.value.lines[0];
  if (!firstLine) {
    redirectParams.set('error', 'WAREHOUSE_STOCK_OUT_EMPTY_RESULT');
    redirect(`/warehouse/stock-out?${redirectParams.toString()}`);
  }

  redirectParams.set('status', 'success');
  redirectParams.set('balance', String(firstLine.readBack.balance.on_hand));
  redirectParams.set('movement', 'ISSUE:OUTBOUND:COMPLETED');
  redirectParams.set('quantity', String(firstLine.quantity));
  redirectParams.set(
    'traceability',
    readMetadataText(firstLine.readBack.traceability.metadata, 'compliance_status') ?? 'RECORDED'
  );
  redirect(`/warehouse/stock-out?${redirectParams.toString()}`);
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <input
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`stock-out-${props.name}`}
        defaultValue={props.defaultValue}
        name={props.name}
        required={
          props.name !== 'issueDocumentNumber' &&
          props.name !== 'idempotencyKey' &&
          props.name !== 'sourceLineId' &&
          props.name !== 'notes'
        }
        step={props.step}
        type={props.type ?? 'text'}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  options: Array<[WarehouseStockOutSourceType, string]>;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`stock-out-${props.name}`}
        name={props.name}
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectReason(props: { label: string; name: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`stock-out-${props.name}`}
        name={props.name}
      >
        <option value="disposal">Disposal</option>
        <option value="damage">Damage</option>
        <option value="loss">Loss</option>
        <option value="sale">Sale</option>
      </select>
    </label>
  );
}

function StatusRow(props: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide">{props.label}</dt>
      <dd className="mt-1 break-all font-mono text-xs" data-testid={`stock-out-${slugify(props.label)}`}>
        {props.value ?? 'NOT_PROVEN'}
      </dd>
    </div>
  );
}

function readIssueType(value: string): WarehouseStockOutSourceType {
  return sourceTypes.has(value as WarehouseStockOutSourceType)
    ? (value as WarehouseStockOutSourceType)
    : 'warehouse_issue';
}

function readReason(value: string): WarehouseStockOutReason {
  return reasons.has(value as WarehouseStockOutReason)
    ? (value as WarehouseStockOutReason)
    : 'disposal';
}

function readFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalFormText(formData: FormData, key: string): string | undefined {
  const value = readFormText(formData, key);
  return value.length > 0 ? value : undefined;
}

function readParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function readMetadataText(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
