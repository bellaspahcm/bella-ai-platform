/**
 * Bella Interior OS — Takeoff Diff Engine Service
 *
 * Computes a structured diff between two TakeoffRuns linked to different
 * Design Revisions. Used by Estimators to understand what changed in the
 * design before deciding whether to create a new BOQ revision.
 *
 * Scope boundary (HARD):
 * - This service is READ-ONLY and has zero side-effects on BOQ data.
 * - It does NOT write to any repository.
 * - Phase 2C (Sync to BOQ) is explicitly OUT OF SCOPE here.
 *
 * Identity contract:
 * - Components are matched ONLY by stableComponentId.
 * - Name, code, position, or zone are NEVER used for matching.
 * - REVIEW_REQUIRED is emitted for any ambiguous case.
 *   The engine must NEVER guess ADDED or REMOVED.
 *
 * Category-specific diff rules:
 * - cabinetry      : width/depth/height change > CABINETRY_DIM_THRESHOLD_MM → MODIFIED
 * - loose_furniture: quantity or upholsteryMaterialName change → MODIFIED
 * - all categories : unit change, significant material change → MODIFIED
 *
 * @module src/products/bella-interior/services/interior-takeoff-diff.service
 */

import { TenantIsolationViolationError, TakeoffRunNotFoundError, TakeoffDiffRunMismatchError } from '../domain/errors';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { DesignTakeoffComponent, TakeoffComponentCategory } from '../domain/takeoff/types';
import type {
  ComputeDiffInput,
  TakeoffRunDiffResult,
  ComponentDiffItem,
  ComponentFieldDiff,
  DiffChangeType,
} from '../domain/takeoff/diff.types';

/** Dimension change threshold for cabinetry category (millimetres). */
const CABINETRY_DIM_THRESHOLD_MM = 50;

export class InteriorTakeoffDiffService {
  constructor(private readonly repository: IInteriorRepository) {}

  /**
   * Compute a structured diff between two TakeoffRuns.
   *
   * Both runs must belong to the same tenant and the same project.
   * The base run is always the "before" state; the target run is "after".
   *
   * @throws TenantIsolationViolationError   if tenantId is missing
   * @throws TakeoffRunNotFoundError         if either run does not exist
   * @throws TakeoffDiffRunMismatchError     if runs belong to different projects
   */
  async computeDiff(input: ComputeDiffInput): Promise<TakeoffRunDiffResult> {
    // Gate 0 — Tenant Isolation
    if (!input.tenantId || input.tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    // Load both runs — repository enforces tenant isolation
    const [baseRun, targetRun] = await Promise.all([
      this.repository.getTakeoffRun(input.tenantId, input.baseRunId),
      this.repository.getTakeoffRun(input.tenantId, input.targetRunId),
    ]);

    if (!baseRun) {
      throw new TakeoffRunNotFoundError(input.baseRunId);
    }
    if (!targetRun) {
      throw new TakeoffRunNotFoundError(input.targetRunId);
    }

    // Both runs must belong to the same project
    if (baseRun.projectId !== targetRun.projectId) {
      throw new TakeoffDiffRunMismatchError(
        `Base run belongs to project '${baseRun.projectId}' but target run belongs to project '${targetRun.projectId}'. Diff requires same project.`
      );
    }

    // Tenant double-check on loaded data (defence-in-depth)
    if (baseRun.tenantId !== input.tenantId || targetRun.tenantId !== input.tenantId) {
      throw new TenantIsolationViolationError(
        'Loaded runs do not belong to the requesting tenant.'
      );
    }

    // Index components by stableComponentId
    const baseMap = indexByStableId(baseRun.components);
    const targetMap = indexByStableId(targetRun.components);

    // Collect all unique stableComponentIds across both runs
    const allIds = new Set([...baseMap.keys(), ...targetMap.keys()]);

    const items: ComponentDiffItem[] = [];

    for (const stableId of allIds) {
      const baseComponents = baseMap.get(stableId) ?? [];
      const targetComponents = targetMap.get(stableId) ?? [];

      const item = resolveComponentDiff(stableId, baseComponents, targetComponents);
      items.push(item);
    }

    // Aggregate counts
    const addedCount = items.filter(i => i.changeType === 'added').length;
    const modifiedCount = items.filter(i => i.changeType === 'modified').length;
    const removedCount = items.filter(i => i.changeType === 'removed').length;
    const unchangedCount = items.filter(i => i.changeType === 'unchanged').length;
    const reviewRequiredCount = items.filter(i => i.changeType === 'review_required').length;

    return {
      baseRunId: input.baseRunId,
      targetRunId: input.targetRunId,
      baseDesignRevisionId: baseRun.designRevisionId,
      targetDesignRevisionId: targetRun.designRevisionId,
      addedCount,
      modifiedCount,
      removedCount,
      unchangedCount,
      reviewRequiredCount,
      items,
      computedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Build an index from stableComponentId → array of DesignTakeoffComponent.
 * Arrays because (in edge cases) a run might contain duplicate stableComponentIds —
 * which is itself an ambiguity signal.
 */
function indexByStableId(
  components: readonly DesignTakeoffComponent[]
): Map<string, DesignTakeoffComponent[]> {
  const map = new Map<string, DesignTakeoffComponent[]>();
  for (const c of components) {
    const existing = map.get(c.stableComponentId);
    if (existing) {
      existing.push(c);
    } else {
      map.set(c.stableComponentId, [c]);
    }
  }
  return map;
}

/**
 * Resolve a single component's DiffChangeType given its occurrences in both runs.
 *
 * Rules:
 * - Only in base  → removed
 * - Only in target → added
 * - Duplicate stableComponentId in either side → review_required (ambiguity)
 * - In both → compare fields → unchanged | modified
 */
function resolveComponentDiff(
  stableId: string,
  baseComponents: DesignTakeoffComponent[],
  targetComponents: DesignTakeoffComponent[]
): ComponentDiffItem {
  const inBase = baseComponents.length;
  const inTarget = targetComponents.length;

  // Duplicate stableComponentId in same run → ambiguous, must review
  if (inBase > 1 || inTarget > 1) {
    return {
      stableComponentId: stableId,
      changeType: 'review_required',
      changes: [],
      baseComponent: baseComponents[0],
      targetComponent: targetComponents[0],
      reviewReason:
        `Duplicate stableComponentId '${stableId}' detected (base: ${inBase}, target: ${inTarget}). ` +
        'Estimator must resolve identity conflict manually.',
    };
  }

  if (inBase === 0 && inTarget === 1) {
    return {
      stableComponentId: stableId,
      changeType: 'added',
      changes: [],
      targetComponent: targetComponents[0],
    };
  }

  if (inBase === 1 && inTarget === 0) {
    return {
      stableComponentId: stableId,
      changeType: 'removed',
      changes: [],
      baseComponent: baseComponents[0],
    };
  }

  // Both sides have exactly one component — compare them
  const base = baseComponents[0];
  const target = targetComponents[0];
  const changes = computeFieldChanges(base, target);

  const changeType: DiffChangeType = changes.length > 0 ? 'modified' : 'unchanged';

  return {
    stableComponentId: stableId,
    changeType,
    changes,
    baseComponent: base,
    targetComponent: target,
  };
}

/**
 * Compute field-level diffs between two versions of the same component.
 * Returns an empty array when no meaningful change is detected.
 */
function computeFieldChanges(
  base: DesignTakeoffComponent,
  target: DesignTakeoffComponent
): ComponentFieldDiff[] {
  const diffs: ComponentFieldDiff[] = [];

  // 1. Unit change — always significant
  if (base.unit !== target.unit) {
    diffs.push({
      fieldName: 'unit',
      oldValue: base.unit,
      newValue: target.unit,
      impactDescription: `Đơn vị tính đã thay đổi từ '${base.unit}' sang '${target.unit}'. Cần kiểm tra lại khối lượng.`,
    });
  }

  // 2. Category change — always significant
  if (base.category !== target.category) {
    diffs.push({
      fieldName: 'category',
      oldValue: base.category,
      newValue: target.category,
      impactDescription: `Loại cấu kiện đã thay đổi từ '${base.category}' sang '${target.category}'. Quy tắc tính chi phí thay đổi.`,
    });
  }

  // 3. Quantity change — always significant
  if (base.quantity !== target.quantity) {
    diffs.push({
      fieldName: 'quantity',
      oldValue: String(base.quantity),
      newValue: String(target.quantity),
      impactDescription: `Số lượng đã thay đổi từ ${base.quantity} sang ${target.quantity} ${target.unit}.`,
    });
  }

  // 4. Dimension changes — category-sensitive thresholding
  const dimDiff = computeDimensionDiff(base.category, base.dimensions, target.dimensions);
  if (dimDiff) diffs.push(dimDiff);

  // 5. Material changes — category-sensitive
  const matDiff = computeMaterialDiff(base.category, base.specifications, target.specifications);
  if (matDiff) diffs.push(matDiff);

  return diffs;
}

/**
 * Compute dimension diff with category-specific thresholds.
 *
 * - cabinetry: any axis (width/depth/height) changing by more than CABINETRY_DIM_THRESHOLD_MM
 *   is MODIFIED. Changes below threshold are ignored (tolerance for measurement rounding).
 * - Other categories: any axis change → MODIFIED (no tolerance).
 */
function computeDimensionDiff(
  category: TakeoffComponentCategory,
  baseDim: DesignTakeoffComponent['dimensions'],
  targetDim: DesignTakeoffComponent['dimensions']
): ComponentFieldDiff | null {
  const axes: Array<keyof typeof baseDim> = ['width', 'depth', 'height', 'thickness', 'diameter'];

  const changedAxes: string[] = [];

  for (const axis of axes) {
    const bVal = baseDim[axis] as number | undefined;
    const tVal = targetDim[axis] as number | undefined;

    if (bVal === tVal) continue; // No change

    // One side has value, the other doesn't
    if (bVal === undefined || tVal === undefined) {
      changedAxes.push(`${axis}: ${bVal ?? 'N/A'} → ${tVal ?? 'N/A'} mm`);
      continue;
    }

    const delta = Math.abs(tVal - bVal);

    if (category === 'cabinetry') {
      // Apply 50mm tolerance for cabinetry
      if (delta > CABINETRY_DIM_THRESHOLD_MM) {
        changedAxes.push(`${axis}: ${bVal} → ${tVal} mm (thay đổi ${delta} mm > ngưỡng ${CABINETRY_DIM_THRESHOLD_MM} mm)`);
      }
      // Below threshold — ignore for cabinetry
    } else {
      // All other categories: any change is significant
      changedAxes.push(`${axis}: ${bVal} → ${tVal} mm`);
    }
  }

  // Check customDimensionText separately (string comparison)
  if (baseDim.customDimensionText !== targetDim.customDimensionText) {
    changedAxes.push(
      `customDimensionText: '${baseDim.customDimensionText ?? ''}' → '${targetDim.customDimensionText ?? ''}'`
    );
  }

  if (changedAxes.length === 0) return null;

  const oldDesc = describeBasicDimensions(baseDim);
  const newDesc = describeBasicDimensions(targetDim);

  return {
    fieldName: 'dimensions',
    oldValue: oldDesc,
    newValue: newDesc,
    impactDescription: `Kích thước đã thay đổi: ${changedAxes.join('; ')}.`,
  };
}

/**
 * Compute material diff with category-sensitive rules.
 *
 * - loose_furniture: upholsteryMaterialName change → always MODIFIED
 * - cabinetry: carcassMaterialName or doorFrontMaterialName change → MODIFIED
 * - all: surfaceFinish or hardwareSpec change → MODIFIED
 */
function computeMaterialDiff(
  category: TakeoffComponentCategory,
  baseSpec: DesignTakeoffComponent['specifications'],
  targetSpec: DesignTakeoffComponent['specifications']
): ComponentFieldDiff | null {
  const changedFields: string[] = [];

  // --- Cabinetry-specific ---
  if (category === 'cabinetry') {
    if (baseSpec.carcassMaterialName !== targetSpec.carcassMaterialName) {
      changedFields.push(
        `carcassMaterial: '${baseSpec.carcassMaterialName ?? 'N/A'}' → '${targetSpec.carcassMaterialName ?? 'N/A'}'`
      );
    }
    if (baseSpec.doorFrontMaterialName !== targetSpec.doorFrontMaterialName) {
      changedFields.push(
        `doorFrontMaterial: '${baseSpec.doorFrontMaterialName ?? 'N/A'}' → '${targetSpec.doorFrontMaterialName ?? 'N/A'}'`
      );
    }
  }

  // --- Loose furniture-specific ---
  if (category === 'loose_furniture') {
    if (baseSpec.upholsteryMaterialName !== targetSpec.upholsteryMaterialName) {
      changedFields.push(
        `upholsteryMaterial: '${baseSpec.upholsteryMaterialName ?? 'N/A'}' → '${targetSpec.upholsteryMaterialName ?? 'N/A'}'`
      );
    }
    if (baseSpec.frameMaterialName !== targetSpec.frameMaterialName) {
      changedFields.push(
        `frameMaterial: '${baseSpec.frameMaterialName ?? 'N/A'}' → '${targetSpec.frameMaterialName ?? 'N/A'}'`
      );
    }
    if (baseSpec.tabletopMaterialName !== targetSpec.tabletopMaterialName) {
      changedFields.push(
        `tabletopMaterial: '${baseSpec.tabletopMaterialName ?? 'N/A'}' → '${targetSpec.tabletopMaterialName ?? 'N/A'}'`
      );
    }
  }

  // --- Common fields (all categories) ---
  if (baseSpec.surfaceFinish !== targetSpec.surfaceFinish) {
    changedFields.push(
      `surfaceFinish: '${baseSpec.surfaceFinish ?? 'N/A'}' → '${targetSpec.surfaceFinish ?? 'N/A'}'`
    );
  }
  if (baseSpec.hardwareSpec !== targetSpec.hardwareSpec) {
    changedFields.push(
      `hardwareSpec: '${baseSpec.hardwareSpec ?? 'N/A'}' → '${targetSpec.hardwareSpec ?? 'N/A'}'`
    );
  }

  if (changedFields.length === 0) return null;

  return {
    fieldName: 'materials',
    oldValue: describeMaterials(baseSpec),
    newValue: describeMaterials(targetSpec),
    impactDescription: `Vật liệu / hoàn thiện đã thay đổi: ${changedFields.join('; ')}.`,
  };
}

// ---------------------------------------------------------------------------
// Utility formatters (pure, no I/O)
// ---------------------------------------------------------------------------

function describeBasicDimensions(dim: DesignTakeoffComponent['dimensions']): string {
  const parts: string[] = [];
  if (dim.width !== undefined) parts.push(`W${dim.width}`);
  if (dim.depth !== undefined) parts.push(`D${dim.depth}`);
  if (dim.height !== undefined) parts.push(`H${dim.height}`);
  if (dim.thickness !== undefined) parts.push(`T${dim.thickness}`);
  if (dim.diameter !== undefined) parts.push(`⌀${dim.diameter}`);
  if (dim.customDimensionText) parts.push(dim.customDimensionText);
  return parts.length > 0 ? `${parts.join(' × ')} mm` : 'N/A';
}

function describeMaterials(spec: DesignTakeoffComponent['specifications']): string {
  const parts: string[] = [];
  if (spec.carcassMaterialName) parts.push(`thùng: ${spec.carcassMaterialName}`);
  if (spec.doorFrontMaterialName) parts.push(`cánh: ${spec.doorFrontMaterialName}`);
  if (spec.frameMaterialName) parts.push(`khung: ${spec.frameMaterialName}`);
  if (spec.upholsteryMaterialName) parts.push(`bọc: ${spec.upholsteryMaterialName}`);
  if (spec.tabletopMaterialName) parts.push(`mặt bàn: ${spec.tabletopMaterialName}`);
  if (spec.surfaceFinish) parts.push(`hoàn thiện: ${spec.surfaceFinish}`);
  if (spec.hardwareSpec) parts.push(`phụ kiện: ${spec.hardwareSpec}`);
  return parts.length > 0 ? parts.join(', ') : 'N/A';
}
