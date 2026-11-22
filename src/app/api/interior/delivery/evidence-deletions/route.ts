import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { createServiceClient } from '@/lib/supabase-service-client';
import { EvidenceDeletionError, executeEvidenceDeletion, type EvidenceDeletionPlan } from '@/products/bella-interior/services/evidence-deletion.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!validInteriorUuid(projectId)) return NextResponse.json({ success: false, error: 'INVALID_PROJECT' }, { status: 400 });
  const decision = await ctx.authorization.authorize({ tenantId: ctx.tenantId, projectId, permissionId: 'interior:evidence:delete' });
  if (decision.status !== 'ALLOW') {
    return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_DENIED' }, {
      status: decision.status === 'UNAVAILABLE' ? 503 : 403,
    });
  }
  try {
    const result = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_evidence_deletion_requests', { p_project: projectId });
    if (result.error || !Array.isArray(result.data)) throw new Error('LIST_FAILED');
    return NextResponse.json({ success: true, data: result.data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_LIST_FAILED' }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (!isInteriorRbacRecord(payload) || !validInteriorUuid(payload.projectId) || payload.contractReviewed !== true) {
    return NextResponse.json({ success: false, error: 'INVALID_EVIDENCE_DELETE_REQUEST' }, { status: 400 });
  }

  const decision = await ctx.authorization.authorize({
    tenantId: ctx.tenantId, projectId: payload.projectId, permissionId: 'interior:evidence:delete',
  });
  if (decision.status !== 'ALLOW') {
    return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_DENIED' }, {
      status: decision.status === 'UNAVAILABLE' ? 503 : 403,
    });
  }
  const projectId = payload.projectId;
  const rpc = interiorRbacRpcClient(ctx.supabase);
  if (payload.action === 'execute') {
    if (!validInteriorUuid(payload.requestId)) {
      return NextResponse.json({ success: false, error: 'INVALID_EVIDENCE_DELETE_REQUEST' }, { status: 400 });
    }
    try {
      await executeEvidenceDeletion(payload.requestId, {
        async prepare(requestId) {
          const result = await rpc.rpc('interior_prepare_evidence_deletion', {
            p_request: requestId, p_project: projectId, p_contract_confirm: true,
          });
          if (result.error || !isInteriorRbacRecord(result.data)) throw new Error('PREPARE_FAILED');
          const value = result.data;
          if (value.tenantId !== ctx.tenantId || value.projectId !== projectId
            || typeof value.requestId !== 'string' || typeof value.storagePath !== 'string'
            || typeof value.bucketId !== 'string' || typeof value.objectPresent !== 'boolean' || !['DELETE_PENDING', 'DELETED'].includes(String(value.status))
            || !['KEEP_OBJECT', 'DELETE_OBJECT'].includes(String(value.mode))) throw new Error('INVALID_PLAN');
          return value as EvidenceDeletionPlan;
        },
        async finish(requestId) {
          const result = await rpc.rpc('interior_finish_evidence_deletion', { p_request: requestId, p_project: projectId });
          if (result.error) throw new Error('FINALIZE_FAILED');
        },
        async fail(requestId, stage) {
          const result = await rpc.rpc('interior_fail_evidence_deletion', { p_request: requestId, p_project: projectId, p_stage: stage });
          if (result.error) throw new Error('FAILURE_AUDIT_UNAVAILABLE');
        },
      }, {
        async remove(bucketId, path) {
          const result = await createServiceClient().storage.from(bucketId).remove([path]);
          if (result.error) throw new Error('STORAGE_FAILED');
        },
      });
      return NextResponse.json({ success: true, data: { requestId: payload.requestId, status: 'DELETED' } }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    } catch (error: unknown) {
      const stage = error instanceof EvidenceDeletionError ? error.stage : 'PREPARE';
      return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_FAILED', stage }, { status: 503 });
    }
  }
  if ((payload.action !== undefined && payload.action !== 'request') || !validInteriorUuid(payload.recordId)
    || !['O3', 'O4'].includes(String(payload.kind))
    || typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.length > 2000
    || typeof payload.contractReviewReference !== 'string' || !payload.contractReviewReference.trim()
    || payload.contractReviewReference.length > 2000
    || (payload.kind === 'O3' && (typeof payload.photoIndex !== 'number'
      || !Number.isSafeInteger(payload.photoIndex) || payload.photoIndex < 0))) {
    return NextResponse.json({ success: false, error: 'INVALID_EVIDENCE_DELETE_REQUEST' }, { status: 400 });
  }
  let storagePath: string | null = null;
  if (payload.kind === 'O3') {
    try {
      const diaries = await rpc.rpc('interior_list_site_diaries', { p_project_id: projectId });
      if (diaries.error || !Array.isArray(diaries.data)) throw new Error('DIARY_UNAVAILABLE');
      const diary = diaries.data.filter(isInteriorRbacRecord).find((item) => item.id === payload.recordId
        && item.tenantId === ctx.tenantId && item.projectId === projectId);
      const path = Array.isArray(diary?.photoUrls) ? diary.photoUrls[payload.photoIndex as number] : null;
      if (typeof path !== 'string' || !path.startsWith(`${ctx.tenantId}/${projectId}/`)
        || path.includes('..') || path.includes('\\')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_TARGET_INVALID' }, { status: 404 });
      }
      storagePath = path;
    } catch {
      return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_REQUEST_FAILED' }, { status: 503 });
    }
  }
  let result: Awaited<ReturnType<ReturnType<typeof interiorRbacRpcClient>['rpc']>>;
  try {
    result = await rpc.rpc('interior_request_evidence_deletion', {
      p_kind: payload.kind, p_project: payload.projectId, p_record: payload.recordId,
      p_storage_path: storagePath,
      p_reason: payload.reason.trim(), p_contract_review: payload.contractReviewReference.trim(), p_contract_confirm: true,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_REQUEST_FAILED' }, { status: 503 });
  }
  if (result.error || !validInteriorUuid(result.data)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_DELETE_REQUEST_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ success: true, data: { requestId: result.data, status: 'DELETE_PENDING' } }, {
    status: 201, headers: { 'Cache-Control': 'private, no-store' },
  });
}
