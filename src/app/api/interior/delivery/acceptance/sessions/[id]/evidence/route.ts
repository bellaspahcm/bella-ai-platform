import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorAcceptanceService } from '@/products/bella-interior/services/interior-acceptance.service';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { createServiceClient } from '@/lib/supabase-service-client';
import type { EvidenceCategory } from '@/products/bella-interior/domain/acceptance-handover.types';
import type { AcceptanceEvidenceObject } from '@/products/bella-interior/domain/acceptance-handover.types';

export const dynamic = 'force-dynamic';

const VALID_EVIDENCE_CATEGORIES = new Set<EvidenceCategory>([
  'OVERALL',
  'DETAIL',
  'COMPLETED_PRODUCT',
  'CUSTOMER_SIGNOFF',
  'REMEDIATION_PROOF',
]);
const ACCEPTANCE_EVIDENCE_BUCKET = 'interior-site-evidence';
const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_REQUEST_BYTES = MAX_EVIDENCE_SIZE_BYTES + 128 * 1024;
const MAX_JSON_REQUEST_BYTES = Math.ceil(MAX_EVIDENCE_SIZE_BYTES / 3) * 4 + 128 * 1024;

class UploadBodyTooLargeError extends Error {}

async function readBoundedRequestBody(request: Request, limitBytes: number): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > limitBytes) {
      await reader.cancel();
      throw new UploadBodyTooLargeError('Upload request exceeds the maximum size');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function detectEvidenceMimeType(fileBuffer: Buffer): string | null {
  if (fileBuffer.length >= 5 && fileBuffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (fileBuffer.length >= 3 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) return 'image/jpeg';
  if (fileBuffer.length >= 8 && fileBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (fileBuffer.length >= 12 && fileBuffer.toString('ascii', 0, 4) === 'RIFF' && fileBuffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (fileBuffer.length >= 12 && fileBuffer.toString('ascii', 4, 8) === 'ftyp'
      && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(fileBuffer.toString('ascii', 8, 12))) {
    return 'image/heic';
  }
  return null;
}

function safeEvidenceFileName(fileName: string): string {
  const basename = fileName.replace(/\\/g, '/').split('/').pop() ?? '';
  const safeName = basename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 120);
  return safeName || 'evidence_file';
}

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
    const evidenceId = new URL(request.url).searchParams.get('evidenceId');
    const session = await service.getSession(ctx.tenantId, sessionId);
    const decision = await ctx.authorization.authorize({
      permissionId: 'interior:acceptance_evidence:read', tenantId: ctx.tenantId, projectId: session.projectId,
    });
    if (decision.status !== 'ALLOW') {
      return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_READ_DENIED' }, {
        status: decision.status === 'UNAVAILABLE' ? 503 : 403,
      });
    }
    if (evidenceId !== null) {
      if (!validInteriorUuid(evidenceId)) {
        return NextResponse.json({ success: false, error: 'Valid evidenceId is required' }, { status: 400 });
      }
      const evidenceList = await service.listEvidence(ctx.tenantId, sessionId);
      const evidence = evidenceList.find((item) => item.id === evidenceId
        && item.tenantId === ctx.tenantId && item.sessionId === sessionId);
      const prefix = `${ctx.tenantId}/${session.projectId}/acceptance/${sessionId}/`;
      if (!evidence || evidence.bucketId !== ACCEPTANCE_EVIDENCE_BUCKET
        || !evidence.storagePath.startsWith(prefix) || evidence.storagePath.slice(prefix.length).includes('/')
        || evidence.storagePath.includes('..') || evidence.storagePath.includes('\\')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_NOT_FOUND' }, { status: 404 });
      }
      const downloaded = await createServiceClient().storage.from(ACCEPTANCE_EVIDENCE_BUCKET).download(evidence.storagePath);
      if (downloaded.error || !downloaded.data) {
        return NextResponse.json({ success: false, error: 'INTERIOR_EVIDENCE_UNAVAILABLE' }, { status: 503 });
      }
      return new NextResponse(downloaded.data, { headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeEvidenceFileName(evidence.fileName)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      } });
    }
    const evidenceList = await service.listEvidence(ctx.tenantId, sessionId);

    return NextResponse.json({ success: true, data: evidenceList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_EVIDENCE_LIST_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  const isMultipart = contentType.includes('multipart/form-data');
  const isJson = contentType.includes('application/json');
  if (!isMultipart && !isJson) {
    return NextResponse.json({ success: false, error: 'Use multipart/form-data or application/json' }, { status: 415 });
  }
  const maxRequestBytes = isMultipart ? MAX_MULTIPART_REQUEST_BYTES : MAX_JSON_REQUEST_BYTES;
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return NextResponse.json({ success: false, error: 'Invalid Content-Length' }, { status: 400 });
    }
    if (contentLength > maxRequestBytes) {
      return NextResponse.json({ success: false, error: 'Upload request exceeds the 10 MB file limit' }, { status: 413 });
    }
  }

  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { id: sessionId } = await context.params;
  if (!sessionId || !validInteriorUuid(sessionId)) {
    return NextResponse.json({ success: false, error: 'Valid sessionId parameter is required' }, { status: 400 });
  }

  try {
    const boundedBody = await readBoundedRequestBody(request, maxRequestBytes);
    let fileBuffer: Buffer;
    let fileName = 'evidence_file';
    let evidenceCategory: EvidenceCategory;
    let noteId: string | null = null;

    if (isMultipart) {
      let formData: FormData;
      try {
        const boundedRequest = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: Buffer.from(boundedBody),
        });
        formData = await boundedRequest.formData();
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid multipart upload body' }, { status: 400 });
      }
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'File is required in multipart upload' }, { status: 400 });
      }
      if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
        return NextResponse.json({ success: false, error: 'Evidence file exceeds the 10 MB limit' }, { status: 413 });
      }
      fileName = safeEvidenceFileName(file.name || 'evidence_file');
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      evidenceCategory = (formData.get('evidenceCategory') as EvidenceCategory) || 'OVERALL';
      const noteIdValue = formData.get('noteId');
      noteId = typeof noteIdValue === 'string' && noteIdValue.length > 0 ? noteIdValue : null;
    } else {
      let body: unknown;
      try {
        body = JSON.parse(Buffer.from(boundedBody).toString('utf8')) as unknown;
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON upload body' }, { status: 400 });
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return NextResponse.json({ success: false, error: 'Invalid JSON upload body' }, { status: 400 });
      }
      const payload = body as Record<string, unknown>;
      const encoded = payload.fileBase64;
      if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
        return NextResponse.json({ success: false, error: 'fileBase64 is required' }, { status: 400 });
      }
      fileBuffer = Buffer.from(encoded, 'base64');
      if (fileBuffer.length > MAX_EVIDENCE_SIZE_BYTES) {
        return NextResponse.json({ success: false, error: 'Evidence file exceeds the 10 MB limit' }, { status: 413 });
      }
      fileName = safeEvidenceFileName(typeof payload.fileName === 'string' ? payload.fileName : 'evidence_file');
      evidenceCategory = payload.evidenceCategory as EvidenceCategory;
      noteId = typeof payload.noteId === 'string' && payload.noteId.length > 0 ? payload.noteId : null;
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

    if (noteId !== null && !validInteriorUuid(noteId)) {
      return NextResponse.json({ success: false, error: 'Valid noteId is required' }, { status: 400 });
    }
    if (fileBuffer.length < 1 || fileBuffer.length > MAX_EVIDENCE_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'Evidence file exceeds the 10 MB limit' }, { status: 413 });
    }
    const mimeType = detectEvidenceMimeType(fileBuffer);
    if (!mimeType) {
      return NextResponse.json({ success: false, error: 'Unsupported or unrecognized evidence file type' }, { status: 415 });
    }

    const trustedClient = createServiceClient();
    const repo = new SupabaseInteriorRepository(ctx.supabase, trustedClient);
    const service = new InteriorAcceptanceService(repo);
    const session = await service.getSession(ctx.tenantId, sessionId);
    const storagePath = `${ctx.tenantId}/${session.projectId}/acceptance/${sessionId}/${randomUUID()}-${fileName}`;
    const storage = trustedClient.storage.from(ACCEPTANCE_EVIDENCE_BUCKET);
    const uploaded = await storage.upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
    if (uploaded.error) throw new Error(`ACCEPTANCE_STORAGE_UPLOAD_FAILED: ${uploaded.error.message}`);

    let evidence: AcceptanceEvidenceObject;
    try {
      evidence = await service.registerEvidenceObject({
        tenantId: ctx.tenantId,
        sessionId,
        noteId,
        evidenceCategory,
        bucketId: ACCEPTANCE_EVIDENCE_BUCKET,
        storagePath,
        fileName,
        fileBuffer,
        mimeType,
        uploadedByUserId: ctx.actor.id,
      });
    } catch (error: unknown) {
      await storage.remove([storagePath]);
      throw error;
    }

    return NextResponse.json({ success: true, data: evidence }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof UploadBodyTooLargeError) {
      return NextResponse.json({ success: false, error: 'Upload request exceeds the 10 MB file limit' }, { status: 413 });
    }
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_EVIDENCE_UPLOAD_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
