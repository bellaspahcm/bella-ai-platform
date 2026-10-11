'use client';

import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Factory,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  FinishedGoodsReceiptEvidence,
  ManufacturingOperationalOrderSnapshot,
  ManufacturingOperationalSnapshot,
  MaterialIssueLogisticsEvidence,
  OperationProgressStatus,
  QualityDisposition,
  QualityDispositionSourceQuantityType,
} from '@/platform/manufacturing/domain/types';

type JsonRecord = Record<string, unknown>;

interface OperationalReadinessResponse {
  productKey: string;
  tenantName: string;
  snapshot: ManufacturingOperationalSnapshot;
}

interface ManufacturingCommandResponse {
  action: string;
  result: unknown;
  snapshot: ManufacturingOperationalSnapshot;
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

const progressStatuses: OperationProgressStatus[] = [
  'planned',
  'ready',
  'in_progress',
  'completed',
  'blocked',
];

const qualitySourceTypes: QualityDispositionSourceQuantityType[] = [
  'accepted',
  'rejected',
  'scrap',
  'pending',
];

const qualityDispositions: QualityDisposition[] = [
  'accepted',
  'conditional_accept',
  'rework',
  'scrap',
  'discard_reject',
  'pending',
];

const defaultMaterialIssueEvidence = JSON.stringify(
  {
    issueDocumentId: 'MI-001',
    movementId: 'movement-001',
    traceabilityEventId: 'trace-001',
    itemId: 'component_a',
    locationId: 'raw-bin-a',
    quantity: 1,
    lotNumber: 'raw-lot-001',
    productionOrderId: '',
    productionOrderLineId: '',
    materialRequirementId: '',
  },
  null,
  2
);

const defaultReceiptEvidence = JSON.stringify(
  [
    {
      productionOrderLineId: '',
      receiptDocumentId: 'FGR-001',
      receiptLineId: 'FGR-001-L1',
      lotNumber: 'fg-lot-001',
      acceptedQuantity: 1,
      rejectedQuantity: 0,
      pendingQuantity: 0,
      logisticsEvidence: {
        receiptDocumentId: 'FGR-001',
        receiptLineId: 'FGR-001-L1',
        movementId: 'receipt-movement-001',
        traceabilityEventId: 'receipt-trace-001',
        itemId: 'finished_good_a',
        locationId: 'fg-bin-a',
        quantity: 1,
        lotNumber: 'fg-lot-001',
        productionOrderId: '',
        productionOrderLineId: '',
        acceptedQuantity: 1,
        rejectedQuantity: 0,
        pendingQuantity: 0,
      },
    },
  ],
  null,
  2
);

const defaultBomComponents = JSON.stringify(
  [
    {
      componentItemId: 'component_a',
      quantityPerUnit: 1,
      uom: 'EA',
    },
  ],
  null,
  2
);

const defaultRoutingOperations = JSON.stringify(
  [
    {
      sequence: 10,
      operationCode: 'OP-10',
      operationName: 'Operation 10',
      workCenterId: '',
      required: true,
    },
  ],
  null,
  2
);

function createIdempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export default function ManufacturingDashboardClient() {
  const [factoryOrgUnitId, setFactoryOrgUnitId] = useState('');
  const [tenantName, setTenantName] = useState('Bella Manufacturing');
  const [snapshot, setSnapshot] = useState<ManufacturingOperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [commandResult, setCommandResult] = useState<unknown>(null);

  const [productionOrderForm, setProductionOrderForm] = useState({
    idempotencyKey: createIdempotencyKey('po'),
    orderNumber: '',
    finishedGoodItemId: '',
    targetQuantity: '1',
    uom: 'EA',
  });
  const [planningForm, setPlanningForm] = useState({
    idempotencyKey: createIdempotencyKey('mrp'),
    productionOrderId: '',
    bomRevisionId: '',
    sourceLocationId: '',
  });
  const [bomForm, setBomForm] = useState({
    idempotencyKey: createIdempotencyKey('bom'),
    finishedGoodItemId: '',
    revisionCode: '',
    componentsJson: defaultBomComponents,
  });
  const [bomApprovalForm, setBomApprovalForm] = useState({
    idempotencyKey: createIdempotencyKey('approve-bom'),
    bomRevisionId: '',
  });
  const [routingRevisionForm, setRoutingRevisionForm] = useState({
    idempotencyKey: createIdempotencyKey('route'),
    finishedGoodItemId: '',
    revisionCode: '',
    operationsJson: defaultRoutingOperations,
  });
  const [routingApprovalForm, setRoutingApprovalForm] = useState({
    idempotencyKey: createIdempotencyKey('approve-route'),
    routingRevisionId: '',
  });
  const [routingForm, setRoutingForm] = useState({
    idempotencyKey: createIdempotencyKey('routing'),
    productionOrderId: '',
    productionOrderLineId: '',
    routingRevisionId: '',
  });
  const [workCenterForm, setWorkCenterForm] = useState({
    idempotencyKey: createIdempotencyKey('wc'),
    code: '',
    name: '',
  });
  const [operationProgressForm, setOperationProgressForm] = useState({
    idempotencyKey: createIdempotencyKey('op'),
    operationProgressId: '',
    status: 'ready' as OperationProgressStatus,
    blockedReason: '',
    productionExecutionId: '',
    completedQuantity: '',
  });
  const [materialIssueForm, setMaterialIssueForm] = useState({
    idempotencyKey: createIdempotencyKey('mi'),
    productionOrderId: '',
    productionOrderLineId: '',
    issueDocumentId: '',
    warehouseSkuId: '',
    warehouseBinId: '',
    itemId: '',
    locationId: '',
    quantity: '1',
    unitOfMeasure: 'EA',
    materialRequirementId: '',
    lotNumber: '',
  });
  const [executionForm, setExecutionForm] = useState({
    idempotencyKey: createIdempotencyKey('exec'),
    productionOrderId: '',
    productionOrderLineId: '',
    materialIssueDocumentId: '',
    materialIssueMovementId: '',
    materialRequirementId: '',
    actualQuantity: '1',
    acceptedQuantity: '1',
    rejectedQuantity: '0',
    scrapQuantity: '0',
    uom: 'EA',
    materialIssueEvidenceJson: defaultMaterialIssueEvidence,
  });
  const [finishedGoodsForm, setFinishedGoodsForm] = useState({
    idempotencyKey: createIdempotencyKey('fgr'),
    productionOrderId: '',
    productionOrderLineId: '',
    receiptDocumentId: '',
    receiptLineId: '',
    warehouseSkuId: '',
    warehouseBinId: '',
    itemId: '',
    locationId: '',
    acceptedQuantity: '1',
    rejectedQuantity: '0',
    pendingQuantity: '0',
    unitOfMeasure: 'EA',
    lotNumber: '',
  });
  const [qualityForm, setQualityForm] = useState({
    idempotencyKey: createIdempotencyKey('qc'),
    productionOrderId: '',
    productionOrderLineId: '',
    productionExecutionId: '',
    receiptDocumentId: '',
    receiptLineId: '',
    sourceQuantityType: 'accepted' as QualityDispositionSourceQuantityType,
    disposition: 'accepted' as QualityDisposition,
    quantity: '1',
    acceptedOutputQuantity: '1',
    reasonCode: '',
    reasonText: '',
    evidenceReference: '',
    finalHandlingDecision: true,
    conditionalAcceptPolicyApproved: false,
  });
  const [completionForm, setCompletionForm] = useState({
    idempotencyKey: createIdempotencyKey('complete'),
    productionOrderId: '',
    receiptEvidenceJson: defaultReceiptEvidence,
  });
  const [traceForm, setTraceForm] = useState({
    finishedGoodItemId: '',
    rawMaterialItemId: '',
    lotNumber: '',
    serialNumber: '',
  });

  const stats = useMemo(() => {
    const orders = snapshot?.orders ?? [];
    return {
      orders: orders.length,
      shortage: orders.filter((order) => order.materialReadiness === 'shortage').length,
      blocked: orders.reduce((sum, order) => sum + order.blockedOperationCount, 0),
      openQuality: orders.reduce((sum, order) => sum + order.openQualityDispositionCount, 0),
      completed: orders.filter((order) => order.reconciliationStatus === 'completed_reconciled').length,
    };
  }, [snapshot]);

  const loadSnapshot = async (factoryOverride?: string) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      const selectedFactory = factoryOverride ?? factoryOrgUnitId;
      if (selectedFactory.trim()) query.set('factoryOrgUnitId', selectedFactory.trim());
      query.set('limit', '50');
      const response = await fetch(`/api/manufacturing/operational-readiness?${query.toString()}`, {
        cache: 'no-store',
      });
      const data = await readJson<OperationalReadinessResponse>(response);
      setTenantName(data.tenantName);
      setSnapshot(data.snapshot);
      if (!factoryOrgUnitId && data.snapshot.factoryOrgUnitId) {
        setFactoryOrgUnitId(data.snapshot.factoryOrgUnitId);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAction = async (action: string, payload: JsonRecord) => {
    setSubmitting(action);
    try {
      const response = await fetch('/api/manufacturing/operational-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          factoryOrgUnitId: factoryOrgUnitId.trim() || undefined,
          payload,
        }),
      });
      const data = await readJson<ManufacturingCommandResponse>(response);
      setSnapshot(data.snapshot);
      setCommandResult(data.result);
      toast.success(`${action} completed`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950" data-testid="manufacturing-dashboard">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Factory className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Bella Manufacturing
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                Operational Readiness
              </h1>
              <p className="mt-1 text-sm text-slate-600">{tenantName}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field
              id="factoryOrgUnitId"
              label="Factory org unit"
              value={factoryOrgUnitId}
              onChange={setFactoryOrgUnitId}
              placeholder="factory org unit id"
              testId="manufacturing-factory-input"
            />
            <button
              type="button"
              onClick={() => void loadSnapshot()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="manufacturing-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-5">
          <MetricTile icon={ClipboardList} label="Orders" value={stats.orders} testId="manufacturing-order-count" />
          <MetricTile icon={Boxes} label="Shortage" value={stats.shortage} tone="amber" />
          <MetricTile icon={Activity} label="Blocked ops" value={stats.blocked} tone="rose" />
          <MetricTile icon={AlertTriangle} label="Open QC" value={stats.openQuality} tone="amber" />
          <MetricTile icon={PackageCheck} label="Completed" value={stats.completed} tone="emerald" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
          <div className="space-y-5">
            <Panel
              title="Production orders"
              icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
              testId="manufacturing-order-list"
            >
              {loading ? (
                <div className="h-32 rounded-md border border-dashed border-slate-300 bg-white" />
              ) : snapshot?.orders.length ? (
                <div className="grid gap-3">
                  {snapshot.orders.map((order) => (
                    <OrderSnapshotCard key={order.order.id} snapshot={order} />
                  ))}
                </div>
              ) : (
                <EmptyState label="No production orders in this factory scope." />
              )}
            </Panel>

            <Panel title="Reconciliation" icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Order</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Material</th>
                      <th className="px-3 py-2 font-semibold">Actual</th>
                      <th className="px-3 py-2 font-semibold">Accepted</th>
                      <th className="px-3 py-2 font-semibold">FGR</th>
                      <th className="px-3 py-2 font-semibold">Missing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(snapshot?.orders ?? []).map((order) => (
                      <tr key={order.order.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-900">{order.order.orderNumber}</td>
                        <td className="px-3 py-2">
                          <StatusBadge value={order.reconciliationStatus} />
                        </td>
                        <td className="px-3 py-2">{order.materialReadiness}</td>
                        <td className="px-3 py-2">{order.quantities.actualQuantity}</td>
                        <td className="px-3 py-2">{order.quantities.acceptedQuantity}</td>
                        <td className="px-3 py-2">{order.quantities.receivedAcceptedQuantity}</td>
                        <td className="px-3 py-2">{order.missingEvidence.join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel
              title="Planner"
              icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
              testId="manufacturing-planner-form"
            >
              <ActionForm
                title="Production order"
                actionLabel="Create"
                busy={submitting === 'createProductionOrder'}
                onSubmit={() =>
                  runAction('createProductionOrder', {
                    ...productionOrderForm,
                    targetQuantity: numberValue(productionOrderForm.targetQuantity),
                  })
                }
              >
                <Field label="Order number" value={productionOrderForm.orderNumber} onChange={(value) => setProductionOrderForm({ ...productionOrderForm, orderNumber: value })} />
                <Field label="Finished good" value={productionOrderForm.finishedGoodItemId} onChange={(value) => setProductionOrderForm({ ...productionOrderForm, finishedGoodItemId: value })} />
                <Field label="Quantity" value={productionOrderForm.targetQuantity} onChange={(value) => setProductionOrderForm({ ...productionOrderForm, targetQuantity: value })} />
                <Field label="UOM" value={productionOrderForm.uom} onChange={(value) => setProductionOrderForm({ ...productionOrderForm, uom: value })} />
              </ActionForm>

              <ActionForm
                title="BOM revision"
                actionLabel="Create"
                busy={submitting === 'createBOMRevision'}
                onSubmit={() =>
                  runAction('createBOMRevision', {
                    idempotencyKey: bomForm.idempotencyKey,
                    finishedGoodItemId: bomForm.finishedGoodItemId,
                    revisionCode: bomForm.revisionCode,
                    components: parseJsonArray(bomForm.componentsJson, 'BOM components'),
                  })
                }
              >
                <Field label="Finished good" value={bomForm.finishedGoodItemId} onChange={(value) => setBomForm({ ...bomForm, finishedGoodItemId: value })} />
                <Field label="Revision code" value={bomForm.revisionCode} onChange={(value) => setBomForm({ ...bomForm, revisionCode: value })} />
                <Textarea label="Components" value={bomForm.componentsJson} onChange={(value) => setBomForm({ ...bomForm, componentsJson: value })} />
              </ActionForm>

              <ActionForm
                title="Approve BOM"
                actionLabel="Approve"
                busy={submitting === 'approveBOMRevision'}
                onSubmit={() => runAction('approveBOMRevision', bomApprovalForm)}
              >
                <Field label="BOM revision" value={bomApprovalForm.bomRevisionId} onChange={(value) => setBomApprovalForm({ ...bomApprovalForm, bomRevisionId: value })} />
              </ActionForm>

              <ActionForm
                title="Material readiness"
                actionLabel="Calculate"
                secondaryLabel="Release"
                busy={submitting === 'calculateMaterialRequirements' || submitting === 'releaseProductionOrder'}
                onSubmit={() =>
                  runAction('calculateMaterialRequirements', {
                    ...planningForm,
                  })
                }
                onSecondary={() =>
                  runAction('releaseProductionOrder', {
                    idempotencyKey: createIdempotencyKey('release'),
                    productionOrderId: planningForm.productionOrderId,
                    bomRevisionId: planningForm.bomRevisionId,
                  })
                }
              >
                <Field label="Production order" value={planningForm.productionOrderId} onChange={(value) => setPlanningForm({ ...planningForm, productionOrderId: value })} />
                <Field label="BOM revision" value={planningForm.bomRevisionId} onChange={(value) => setPlanningForm({ ...planningForm, bomRevisionId: value })} />
                <Field label="Source location" value={planningForm.sourceLocationId} onChange={(value) => setPlanningForm({ ...planningForm, sourceLocationId: value })} />
              </ActionForm>

              <ActionForm
                title="Work center"
                actionLabel="Create"
                busy={submitting === 'createWorkCenter'}
                onSubmit={() => runAction('createWorkCenter', workCenterForm)}
              >
                <Field label="Code" value={workCenterForm.code} onChange={(value) => setWorkCenterForm({ ...workCenterForm, code: value })} />
                <Field label="Name" value={workCenterForm.name} onChange={(value) => setWorkCenterForm({ ...workCenterForm, name: value })} />
              </ActionForm>

              <ActionForm
                title="Routing revision"
                actionLabel="Create"
                busy={submitting === 'createRoutingRevision'}
                onSubmit={() =>
                  runAction('createRoutingRevision', {
                    idempotencyKey: routingRevisionForm.idempotencyKey,
                    finishedGoodItemId: routingRevisionForm.finishedGoodItemId,
                    revisionCode: routingRevisionForm.revisionCode,
                    operations: parseJsonArray(routingRevisionForm.operationsJson, 'routing operations'),
                  })
                }
              >
                <Field label="Finished good" value={routingRevisionForm.finishedGoodItemId} onChange={(value) => setRoutingRevisionForm({ ...routingRevisionForm, finishedGoodItemId: value })} />
                <Field label="Revision code" value={routingRevisionForm.revisionCode} onChange={(value) => setRoutingRevisionForm({ ...routingRevisionForm, revisionCode: value })} />
                <Textarea label="Operations" value={routingRevisionForm.operationsJson} onChange={(value) => setRoutingRevisionForm({ ...routingRevisionForm, operationsJson: value })} />
              </ActionForm>

              <ActionForm
                title="Approve routing"
                actionLabel="Approve"
                busy={submitting === 'approveRoutingRevision'}
                onSubmit={() => runAction('approveRoutingRevision', routingApprovalForm)}
              >
                <Field label="Routing revision" value={routingApprovalForm.routingRevisionId} onChange={(value) => setRoutingApprovalForm({ ...routingApprovalForm, routingRevisionId: value })} />
              </ActionForm>

              <ActionForm
                title="Apply routing"
                actionLabel="Apply"
                busy={submitting === 'applyRoutingRevision'}
                onSubmit={() => runAction('applyRoutingRevision', routingForm)}
              >
                <Field label="Production order" value={routingForm.productionOrderId} onChange={(value) => setRoutingForm({ ...routingForm, productionOrderId: value })} />
                <Field label="Order line" value={routingForm.productionOrderLineId} onChange={(value) => setRoutingForm({ ...routingForm, productionOrderLineId: value })} />
                <Field label="Routing revision" value={routingForm.routingRevisionId} onChange={(value) => setRoutingForm({ ...routingForm, routingRevisionId: value })} />
              </ActionForm>
            </Panel>

            <Panel title="Operator" icon={<Activity className="h-4 w-4" aria-hidden="true" />}>
              <ActionForm
                title="Material issue"
                actionLabel="Issue"
                busy={submitting === 'issueMaterial'}
                onSubmit={() =>
                  runAction('issueMaterial', {
                    ...materialIssueForm,
                    quantity: numberValue(materialIssueForm.quantity),
                    materialRequirementId: optionalValue(materialIssueForm.materialRequirementId),
                    lotNumber: optionalValue(materialIssueForm.lotNumber),
                  })
                }
              >
                <Field label="Production order" value={materialIssueForm.productionOrderId} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, productionOrderId: value })} />
                <Field label="Order line" value={materialIssueForm.productionOrderLineId} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, productionOrderLineId: value })} />
                <Field label="Issue document" value={materialIssueForm.issueDocumentId} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, issueDocumentId: value })} />
                <Field label="Item" value={materialIssueForm.itemId} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, itemId: value })} />
                <Field label="Location" value={materialIssueForm.locationId} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, locationId: value })} />
                <Field label="Quantity" value={materialIssueForm.quantity} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, quantity: value })} />
                <Field label="Warehouse SKU" value={materialIssueForm.warehouseSkuId} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, warehouseSkuId: value })} />
                <Field label="Warehouse bin" value={materialIssueForm.warehouseBinId} onChange={(value) => setMaterialIssueForm({ ...materialIssueForm, warehouseBinId: value })} />
              </ActionForm>

              <ActionForm
                title="Execution"
                actionLabel="Record"
                busy={submitting === 'recordExecution'}
                onSubmit={() =>
                  runAction('recordExecution', {
                    idempotencyKey: executionForm.idempotencyKey,
                    productionOrderId: executionForm.productionOrderId,
                    productionOrderLineId: executionForm.productionOrderLineId,
                    materialIssueDocumentId: executionForm.materialIssueDocumentId,
                    materialIssueMovementId: executionForm.materialIssueMovementId,
                    materialIssueEvidence: parseJsonObject<MaterialIssueLogisticsEvidence>(
                      executionForm.materialIssueEvidenceJson,
                      'material issue evidence'
                    ),
                    materialRequirementId: optionalValue(executionForm.materialRequirementId),
                    actualQuantity: numberValue(executionForm.actualQuantity),
                    acceptedQuantity: numberValue(executionForm.acceptedQuantity),
                    rejectedQuantity: numberValue(executionForm.rejectedQuantity),
                    scrapQuantity: numberValue(executionForm.scrapQuantity),
                    uom: executionForm.uom,
                  })
                }
              >
                <Field label="Production order" value={executionForm.productionOrderId} onChange={(value) => setExecutionForm({ ...executionForm, productionOrderId: value })} />
                <Field label="Order line" value={executionForm.productionOrderLineId} onChange={(value) => setExecutionForm({ ...executionForm, productionOrderLineId: value })} />
                <Field label="Issue document" value={executionForm.materialIssueDocumentId} onChange={(value) => setExecutionForm({ ...executionForm, materialIssueDocumentId: value })} />
                <Field label="Issue movement" value={executionForm.materialIssueMovementId} onChange={(value) => setExecutionForm({ ...executionForm, materialIssueMovementId: value })} />
                <Field label="Actual" value={executionForm.actualQuantity} onChange={(value) => setExecutionForm({ ...executionForm, actualQuantity: value })} />
                <Field label="Accepted" value={executionForm.acceptedQuantity} onChange={(value) => setExecutionForm({ ...executionForm, acceptedQuantity: value })} />
                <Textarea label="Material issue evidence" value={executionForm.materialIssueEvidenceJson} onChange={(value) => setExecutionForm({ ...executionForm, materialIssueEvidenceJson: value })} />
              </ActionForm>

              <ActionForm
                title="Operation progress"
                actionLabel="Update"
                busy={submitting === 'updateOperationProgress'}
                onSubmit={() =>
                  runAction('updateOperationProgress', {
                    idempotencyKey: operationProgressForm.idempotencyKey,
                    operationProgressId: operationProgressForm.operationProgressId,
                    status: operationProgressForm.status,
                    blockedReason: optionalValue(operationProgressForm.blockedReason),
                    productionExecutionId: optionalValue(operationProgressForm.productionExecutionId),
                    completedQuantity: optionalNumberValue(operationProgressForm.completedQuantity),
                  })
                }
              >
                <Field label="Progress id" value={operationProgressForm.operationProgressId} onChange={(value) => setOperationProgressForm({ ...operationProgressForm, operationProgressId: value })} />
                <SelectField label="Status" value={operationProgressForm.status} values={progressStatuses} onChange={(value) => setOperationProgressForm({ ...operationProgressForm, status: value })} />
                <Field label="Execution id" value={operationProgressForm.productionExecutionId} onChange={(value) => setOperationProgressForm({ ...operationProgressForm, productionExecutionId: value })} />
                <Field label="Completed quantity" value={operationProgressForm.completedQuantity} onChange={(value) => setOperationProgressForm({ ...operationProgressForm, completedQuantity: value })} />
                <Field label="Blocked reason" value={operationProgressForm.blockedReason} onChange={(value) => setOperationProgressForm({ ...operationProgressForm, blockedReason: value })} />
              </ActionForm>
            </Panel>

            <Panel title="QC" icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
              <ActionForm
                title="Finished goods receipt"
                actionLabel="Receive"
                busy={submitting === 'receiveFinishedGoods'}
                onSubmit={() =>
                  runAction('receiveFinishedGoods', {
                    ...finishedGoodsForm,
                    acceptedQuantity: numberValue(finishedGoodsForm.acceptedQuantity),
                    rejectedQuantity: numberValue(finishedGoodsForm.rejectedQuantity),
                    pendingQuantity: numberValue(finishedGoodsForm.pendingQuantity),
                    lotNumber: optionalValue(finishedGoodsForm.lotNumber),
                  })
                }
              >
                <Field label="Production order" value={finishedGoodsForm.productionOrderId} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, productionOrderId: value })} />
                <Field label="Order line" value={finishedGoodsForm.productionOrderLineId} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, productionOrderLineId: value })} />
                <Field label="Receipt document" value={finishedGoodsForm.receiptDocumentId} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, receiptDocumentId: value })} />
                <Field label="Receipt line" value={finishedGoodsForm.receiptLineId} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, receiptLineId: value })} />
                <Field label="Item" value={finishedGoodsForm.itemId} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, itemId: value })} />
                <Field label="Location" value={finishedGoodsForm.locationId} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, locationId: value })} />
                <Field label="Accepted" value={finishedGoodsForm.acceptedQuantity} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, acceptedQuantity: value })} />
                <Field label="Lot" value={finishedGoodsForm.lotNumber} onChange={(value) => setFinishedGoodsForm({ ...finishedGoodsForm, lotNumber: value })} />
              </ActionForm>

              <ActionForm
                title="Quality disposition"
                actionLabel="Record"
                busy={submitting === 'recordQualityDisposition'}
                onSubmit={() =>
                  runAction('recordQualityDisposition', {
                    ...qualityForm,
                    receiptDocumentId: optionalValue(qualityForm.receiptDocumentId),
                    receiptLineId: optionalValue(qualityForm.receiptLineId),
                    quantity: numberValue(qualityForm.quantity),
                    acceptedOutputQuantity: numberValue(qualityForm.acceptedOutputQuantity),
                    reasonCode: optionalValue(qualityForm.reasonCode),
                    reasonText: optionalValue(qualityForm.reasonText),
                    evidenceReference: optionalValue(qualityForm.evidenceReference),
                  })
                }
              >
                <Field label="Production order" value={qualityForm.productionOrderId} onChange={(value) => setQualityForm({ ...qualityForm, productionOrderId: value })} />
                <Field label="Order line" value={qualityForm.productionOrderLineId} onChange={(value) => setQualityForm({ ...qualityForm, productionOrderLineId: value })} />
                <Field label="Execution id" value={qualityForm.productionExecutionId} onChange={(value) => setQualityForm({ ...qualityForm, productionExecutionId: value })} />
                <SelectField label="Source" value={qualityForm.sourceQuantityType} values={qualitySourceTypes} onChange={(value) => setQualityForm({ ...qualityForm, sourceQuantityType: value })} />
                <SelectField label="Disposition" value={qualityForm.disposition} values={qualityDispositions} onChange={(value) => setQualityForm({ ...qualityForm, disposition: value })} />
                <Field label="Quantity" value={qualityForm.quantity} onChange={(value) => setQualityForm({ ...qualityForm, quantity: value })} />
                <Field label="Accepted output" value={qualityForm.acceptedOutputQuantity} onChange={(value) => setQualityForm({ ...qualityForm, acceptedOutputQuantity: value })} />
                <Field label="Reason" value={qualityForm.reasonCode} onChange={(value) => setQualityForm({ ...qualityForm, reasonCode: value })} />
              </ActionForm>
            </Panel>

            <Panel title="Supervisor" icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
              <ActionForm
                title="Completion"
                actionLabel="Complete"
                busy={submitting === 'completeProductionOrder'}
                onSubmit={() =>
                  runAction('completeProductionOrder', {
                    idempotencyKey: completionForm.idempotencyKey,
                    productionOrderId: completionForm.productionOrderId,
                    receiptEvidence: parseJsonArray<FinishedGoodsReceiptEvidence>(
                      completionForm.receiptEvidenceJson,
                      'receipt evidence'
                    ),
                  })
                }
              >
                <Field label="Production order" value={completionForm.productionOrderId} onChange={(value) => setCompletionForm({ ...completionForm, productionOrderId: value })} />
                <Textarea label="Receipt evidence" value={completionForm.receiptEvidenceJson} onChange={(value) => setCompletionForm({ ...completionForm, receiptEvidenceJson: value })} />
              </ActionForm>

              <ActionForm
                title="Trace finished lot"
                actionLabel="Trace"
                busy={submitting === 'traceFinishedGoodLot'}
                onSubmit={() =>
                  runAction('traceFinishedGoodLot', {
                    finishedGoodItemId: optionalValue(traceForm.finishedGoodItemId),
                    lotNumber: optionalValue(traceForm.lotNumber),
                    serialNumber: optionalValue(traceForm.serialNumber),
                  })
                }
                secondaryLabel="Trace raw lot"
                onSecondary={() =>
                  runAction('traceRawMaterialLot', {
                    rawMaterialItemId: optionalValue(traceForm.rawMaterialItemId),
                    lotNumber: optionalValue(traceForm.lotNumber),
                    serialNumber: optionalValue(traceForm.serialNumber),
                  })
                }
              >
                <Field label="Finished good" value={traceForm.finishedGoodItemId} onChange={(value) => setTraceForm({ ...traceForm, finishedGoodItemId: value })} />
                <Field label="Raw material" value={traceForm.rawMaterialItemId} onChange={(value) => setTraceForm({ ...traceForm, rawMaterialItemId: value })} />
                <Field label="Lot" value={traceForm.lotNumber} onChange={(value) => setTraceForm({ ...traceForm, lotNumber: value })} />
                <Field label="Serial" value={traceForm.serialNumber} onChange={(value) => setTraceForm({ ...traceForm, serialNumber: value })} />
              </ActionForm>
            </Panel>

            <Panel title="Command result" icon={<Search className="h-4 w-4" aria-hidden="true" />}>
              <pre
                className="max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100"
                data-testid="manufacturing-command-result"
              >
                {commandResult ? JSON.stringify(commandResult, null, 2) : 'No command result'}
              </pre>
            </Panel>
          </div>
        </section>
      </div>
    </div>
  );
}

function OrderSnapshotCard({ snapshot }: { snapshot: ManufacturingOperationalOrderSnapshot }) {
  const order = snapshot.order;
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">{order.orderNumber}</h2>
            <StatusBadge value={order.status} />
            <StatusBadge value={snapshot.reconciliationStatus} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {order.finishedGoodItemId} / {order.targetQuantity} {order.uom}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <SmallFact label="Material" value={snapshot.materialReadiness} />
          <SmallFact label="Ops" value={`${snapshot.completedRequiredOperationCount}/${snapshot.requiredOperationCount}`} />
          <SmallFact label="Actual" value={snapshot.quantities.actualQuantity} />
          <SmallFact label="FGR" value={snapshot.quantities.receivedAcceptedQuantity} />
        </div>
      </div>
      {snapshot.missingEvidence.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {snapshot.missingEvidence.map((item) => (
            <span key={item} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Panel({
  title,
  icon,
  children,
  testId,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function ActionForm({
  title,
  actionLabel,
  secondaryLabel,
  busy,
  children,
  onSubmit,
  onSecondary,
}: {
  title: string;
  actionLabel: string;
  secondaryLabel?: string;
  busy: boolean;
  children: ReactNode;
  onSubmit(): Promise<void>;
  onSecondary?(): Promise<void>;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };
  return (
    <form onSubmit={submit} className="mb-4 rounded-md border border-slate-100 bg-slate-50 p-3 last:mb-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{title}</h3>
        <div className="flex gap-2">
          {onSecondary && secondaryLabel ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSecondary()}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {actionLabel}
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  id?: string;
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  testId?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? `${label.toLowerCase().replace(/\s+/g, '-')}-${generatedId}`;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const generatedId = useId();
  const inputId = `${label.toLowerCase().replace(/\s+/g, '-')}-${generatedId}`;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">
      {label}
      <textarea
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={8}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange(value: T): void;
}) {
  const generatedId = useId();
  const inputId = `${label.toLowerCase().replace(/\s+/g, '-')}-${generatedId}`;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      <select
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone = 'slate',
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose';
  testId?: string;
}) {
  const toneClass = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }[tone];
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-normal text-slate-950" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const tone = value.includes('shortage') || value.includes('pending') || value === 'blocked'
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : value.includes('completed') || value === 'available'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {value}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
      {label}
    </div>
  );
}

async function readJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = isRecord(payload) ? (payload as ApiErrorResponse) : {};
    throw new Error(errorPayload.error?.message ?? `Request failed with ${response.status}`);
  }
  return payload as T;
}

function parseJsonObject<T>(value: string, label: string): T {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as T;
}

function parseJsonArray<T>(value: string, label: string): T[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array`);
  }
  return parsed as T[];
}

function numberValue(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Quantity must be a finite number');
  }
  return parsed;
}

function optionalNumberValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  return numberValue(value);
}

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Manufacturing action failed';
}
