import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorAcceptanceService } from '@/products/bella-interior/services/interior-acceptance.service';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import type { EvidenceCategory } from '@/products/bella-interior/domain/acceptance-handover.types';

export const dynamic = 'force-dynamic';

const VALID_EVIDENCE_CATEGORIES = new Set<EvidenceCategory>([
  'OVERALL',
  'DETAIL',
  'COMPLETED_PRODUCT',
  'CUSTOMER_SIGNOFF',
  'REMEDIATION_PROOF',
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { id: sessionId } = await context.params;
  if (!sessionId || !validInteriorUuid(sessionId)) {
    return NextResponse.json({ success: false, error: 'Valid sessionId parameter is required' }, { status: 400 });
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);
    const evidenceList = await service.listEvidence(ctx.tenantId, sessionId);

    return NextResponse.json({ success: true, data: evidenceList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_EVIDENCE_LIST_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { id: sessionId } = await context.params;
  if (!sessionId || !validInteriorUuid(sessionId)) {
    return NextResponse.json({ success: false, error: 'Valid sessionId parameter is required' }, { status: 400 });
  }

  try {
    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;
    let evidenceCategory: EvidenceCategory;
    let storagePath: string;
    let noteId: string | null = null;
    let bucketId: string | undefined;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ success: false, error: 'File is required in multipart upload' }, { status: 400 });
      }

      fileName = file.name || 'evidence_file';
      mimeType = file.type || 'application/octet-stream';
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      evidenceCategory = (formData.get('evidenceCategory') as EvidenceCategory) || 'OVERALL';
      storagePath = (formData.get('storagePath') as string) || `acceptance/${sessionId}/${fileName}`;
      noteId = (formData.get('noteId') as string) || null;
      bucketId = (formData.get('bucketId') as string) || undefined;
    } else {
      const body = await request.json();
      if (!body.fileBase64 || typeof body.fileBase64 !== 'string') {
        return NextResponse.json({ success: false, error: 'fileBase64 is required' }, { status: 400 });
      }

      fileBuffer = Buffer.from(body.fileBase64, 'base64');
      fileName = body.fileName || 'evidence_file';
      mimeType = body.mimeType || 'image/jpeg';
      evidenceCategory = body.evidenceCategory as EvidenceCategory;
      storagePath = body.storagePath || `acceptance/${sessionId}/${fileName}`;
      noteId = body.noteId || null;
      bucketId = body.bucketId;
    }

    if (!evidenceCategory || !VALID_EVIDENCE_CATEGORIES.has(evidenceCategory)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid evidenceCategory. Allowed: ${Array.from(VALID_EVIDENCE_CATEGORIES).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);

    const evidence = await service.registerEvidenceObject({
      tenantId: ctx.tenantId,
      sessionId,
      noteId,
      evidenceCategory,
      bucketId,
      storagePath,
      fileName,
      fileBuffer,
      mimeType,
      uploadedByUserId: ctx.actor?.id || 'unassigned',
    });

    return NextResponse.json({ success: true, data: evidence }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_EVIDENCE_UPLOAD_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
