import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase-service-client';
import { getSupabasePublicKey, getSupabasePublicUrl } from '@/lib/supabase-public-env';
import { interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SIGNATURE_BUCKET = 'interior-customer-signatures';
const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;
const MAX_FORM_BODY_BYTES = MAX_SIGNATURE_BYTES + 64 * 1024;
const ALLOWED_SIGNATURE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

type RouteContext = { params: Promise<{ approvalId: string }> };

function createAnonymousClient(): SupabaseClient<Database> | null {
  try {
    const url = getSupabasePublicUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return null;
    return createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch {
    return null;
  }
}

function headers() {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

function errorResponse(status: number, code: string) {
  return NextResponse.json({ success: false, error: code }, { status, headers: headers() });
}

function signatureBytesMatchMime(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

class HandoverBodyTooLargeError extends Error {}

async function readBoundedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new Error('Handover response body is required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MAX_FORM_BODY_BYTES) {
        await reader.cancel();
        throw new HandoverBodyTooLargeError();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: bodyBytes,
  }).formData();
}

async function readAcceptance(
  client: SupabaseClient<Database>,
  approvalId: string,
  approvalToken: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await interiorRbacRpcClient(client).rpc('interior_read_public_handover_acceptance', {
      p_approval_id: approvalId,
      p_approval_token: approvalToken,
    });
    if (error || !isInteriorRbacRecord(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function customerSafeAcceptance(approval: Record<string, unknown>) {
  return {
    approvalId: approval.approvalId,
    status: approval.status,
    expiresAt: approval.expiresAt,
    canRespond: approval.canRespond === true,
    customerRepresentative: approval.customerRepresentative,
    subject: approval.subject,
  };
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { approvalId } = await params;
  const token = new URL(request.url).searchParams.get('token');
  if (!validInteriorUuid(approvalId) || !validInteriorUuid(token)) {
    return errorResponse(404, 'INTERIOR_HANDOVER_ACCEPTANCE_NOT_FOUND');
  }
  const client = createAnonymousClient();
  if (!client) return errorResponse(503, 'INTERIOR_HANDOVER_ACCEPTANCE_UNAVAILABLE');

  const approval = await readAcceptance(client, approvalId, token);
  if (!approval) return errorResponse(404, 'INTERIOR_HANDOVER_ACCEPTANCE_NOT_FOUND');
  return NextResponse.json({ success: true, data: customerSafeAcceptance(approval) }, { headers: headers() });
}

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { approvalId } = await params;
  const token = new URL(request.url).searchParams.get('token');
  if (!validInteriorUuid(approvalId) || !validInteriorUuid(token)) {
    return errorResponse(404, 'INTERIOR_HANDOVER_ACCEPTANCE_NOT_FOUND');
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return errorResponse(400, 'INTERIOR_HANDOVER_RESPONSE_INVALID');
    }
    if (contentLength > MAX_FORM_BODY_BYTES) return errorResponse(413, 'INTERIOR_HANDOVER_SIGNATURE_TOO_LARGE');
  }

  let form: FormData;
  try {
    form = await readBoundedFormData(request);
  } catch (cause) {
    if (cause instanceof HandoverBodyTooLargeError) {
      return errorResponse(413, 'INTERIOR_HANDOVER_SIGNATURE_TOO_LARGE');
    }
    return errorResponse(400, 'INTERIOR_HANDOVER_RESPONSE_INVALID');
  }

  const decision = form.get('decision');
  const rejectionReason = form.get('rejectionReason');
  const customerNotes = form.get('customerNotes');
  const signature = form.get('signature');
  if ((decision !== 'approved' && decision !== 'rejected')
    || (rejectionReason !== null && typeof rejectionReason !== 'string')
    || (customerNotes !== null && typeof customerNotes !== 'string')
    || (signature !== null && !(signature instanceof File))) {
    return errorResponse(400, 'INTERIOR_HANDOVER_RESPONSE_INVALID');
  }
  if ((typeof rejectionReason === 'string' && rejectionReason.length > 2000)
    || (typeof customerNotes === 'string' && customerNotes.length > 2000)
    || (decision === 'rejected' && (typeof rejectionReason !== 'string' || !rejectionReason.trim()))) {
    return errorResponse(400, 'INTERIOR_HANDOVER_RESPONSE_INVALID');
  }
  if (decision === 'approved' && !(signature instanceof File)) {
    return errorResponse(422, 'INTERIOR_HANDOVER_SIGNATURE_REQUIRED');
  }
  if (decision === 'rejected' && signature !== null) {
    return errorResponse(400, 'INTERIOR_HANDOVER_SIGNATURE_NOT_ALLOWED_FOR_REJECTION');
  }
  if (signature instanceof File && (
    !ALLOWED_SIGNATURE_TYPES.has(signature.type) || signature.size <= 0 || signature.size > MAX_SIGNATURE_BYTES
  )) {
    return errorResponse(400, 'INTERIOR_HANDOVER_SIGNATURE_INVALID');
  }

  const anonymousClient = createAnonymousClient();
  if (!anonymousClient) return errorResponse(503, 'INTERIOR_HANDOVER_ACCEPTANCE_UNAVAILABLE');
  const approval = await readAcceptance(anonymousClient, approvalId, token);
  if (!approval) return errorResponse(404, 'INTERIOR_HANDOVER_ACCEPTANCE_NOT_FOUND');
  if (approval.canRespond !== true) return errorResponse(409, 'INTERIOR_HANDOVER_ACCEPTANCE_NOT_ACTIONABLE');

  let serviceClient: SupabaseClient<Database>;
  try {
    serviceClient = createServiceClient();
  } catch {
    return errorResponse(503, 'INTERIOR_HANDOVER_ACCEPTANCE_UNAVAILABLE');
  }
  let storagePath: string | null = null;
  let signatureMimeType: string | null = null;
  let signatureSize: number | null = null;
  let signatureHash: string | null = null;

  if (signature instanceof File) {
    if (typeof approval.tenantId !== 'string' || !validInteriorUuid(approval.tenantId)) {
      return errorResponse(404, 'INTERIOR_HANDOVER_ACCEPTANCE_NOT_FOUND');
    }
    try {
      const fileBytes = Buffer.from(await signature.arrayBuffer());
      if (!signatureBytesMatchMime(signature.type, fileBytes)) {
        return errorResponse(400, 'INTERIOR_HANDOVER_SIGNATURE_INVALID');
      }
      const extension = signature.type === 'application/pdf' ? 'pdf'
        : signature.type === 'image/jpeg' ? 'jpg' : 'png';
      storagePath = `${approval.tenantId}/${approvalId}/${randomUUID()}.${extension}`;
      signatureHash = createHash('sha256').update(fileBytes).digest('hex');
      signatureMimeType = signature.type;
      signatureSize = fileBytes.byteLength;

      const { error: uploadError } = await serviceClient.storage.from(SIGNATURE_BUCKET).upload(storagePath, fileBytes, {
        contentType: signatureMimeType,
        upsert: false,
      });
      if (uploadError) return errorResponse(503, 'INTERIOR_HANDOVER_SIGNATURE_STORAGE_FAILED');
    } catch {
      return errorResponse(503, 'INTERIOR_HANDOVER_SIGNATURE_STORAGE_UNAVAILABLE');
    }
  }

  try {
    const { data, error } = await interiorRbacRpcClient(serviceClient).rpc(
      'interior_transition_public_handover_acceptance',
      {
        p_approval_id: approvalId,
        p_approval_token: token,
        p_target_status: decision,
        p_rejection_reason: decision === 'rejected' ? String(rejectionReason).trim() : null,
        p_customer_notes: typeof customerNotes === 'string' && customerNotes.trim() ? customerNotes.trim() : null,
        p_signature_storage_path: storagePath,
        p_signature_mime_type: signatureMimeType,
        p_signature_file_size_bytes: signatureSize,
        p_signature_sha256_hash: signatureHash,
      },
    );
    if (error || data !== true) {
      if (serviceClient && storagePath) {
        await serviceClient.storage.from(SIGNATURE_BUCKET).remove([storagePath]).catch(() => undefined);
      }
      if (error?.message?.includes('SIGNATURE')) {
        return errorResponse(422, 'INTERIOR_HANDOVER_SIGNATURE_EVIDENCE_INVALID');
      }
      if (error?.message?.includes('OPEN_QC_ITEMS_REMAIN')) {
        return errorResponse(422, 'INTERIOR_HANDOVER_OPEN_QC_ITEMS_REMAIN');
      }
      return errorResponse(data === false ? 409 : 503, data === false
        ? 'INTERIOR_HANDOVER_ACCEPTANCE_NOT_ACTIONABLE'
        : 'INTERIOR_HANDOVER_ACCEPTANCE_PERSISTENCE_FAILED');
    }
  } catch {
    if (serviceClient && storagePath) {
      await serviceClient.storage.from(SIGNATURE_BUCKET).remove([storagePath]).catch(() => undefined);
    }
    return errorResponse(503, 'INTERIOR_HANDOVER_ACCEPTANCE_PERSISTENCE_FAILED');
  }

  return NextResponse.json({ success: true, data: { approvalId, status: decision } }, { headers: headers() });
}
