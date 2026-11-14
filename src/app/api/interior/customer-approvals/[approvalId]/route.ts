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

async function readApproval(
  client: SupabaseClient<Database>,
  approvalId: string,
  approvalToken: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await interiorRbacRpcClient(client).rpc('interior_read_public_customer_approval', {
      p_approval_id: approvalId,
      p_approval_token: approvalToken,
    });
    if (!error && isInteriorRbacRecord(data)) return data;
    const addendumResult = await interiorRbacRpcClient(client).rpc(
      'interior_read_public_customer_addendum_approval',
      { p_approval_id: approvalId, p_approval_token: approvalToken },
    );
    if (addendumResult.error || !isInteriorRbacRecord(addendumResult.data)) return null;
    return addendumResult.data;
  } catch {
    return null;
  }
}

function customerSafeApproval(approval: Record<string, unknown>) {
  return {
    approvalId: approval.approvalId,
    subjectType: approval.subjectType,
    status: approval.status,
    expiresAt: approval.expiresAt,
    canRespond: approval.canRespond === true,
    clientRepresentative: approval.clientRepresentative,
    subject: approval.subject,
  };
}

function errorResponse(status: number, code: string) {
  return NextResponse.json({ success: false, error: code }, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

class CustomerApprovalBodyTooLargeError extends Error {}

async function readBoundedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new Error('Customer approval request body is required');
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
        throw new CustomerApprovalBodyTooLargeError();
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

function signatureBytesMatchMime(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { approvalId } = await params;
  const token = new URL(request.url).searchParams.get('token');
  if (!validInteriorUuid(approvalId) || !validInteriorUuid(token)) {
    return errorResponse(404, 'INTERIOR_CUSTOMER_APPROVAL_NOT_FOUND');
  }
  const client = createAnonymousClient();
  if (!client) return errorResponse(503, 'INTERIOR_CUSTOMER_APPROVAL_UNAVAILABLE');

  const approval = await readApproval(client, approvalId, token);
  if (!approval) return errorResponse(404, 'INTERIOR_CUSTOMER_APPROVAL_NOT_FOUND');
  return NextResponse.json({ success: true, data: customerSafeApproval(approval) }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { approvalId } = await params;
  const token = new URL(request.url).searchParams.get('token');
  if (!validInteriorUuid(approvalId) || !validInteriorUuid(token)) {
    return errorResponse(404, 'INTERIOR_CUSTOMER_APPROVAL_NOT_FOUND');
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return errorResponse(400, 'INTERIOR_CUSTOMER_APPROVAL_INPUT_INVALID');
    }
    if (contentLength > MAX_FORM_BODY_BYTES) {
      return errorResponse(413, 'INTERIOR_SIGNATURE_FILE_TOO_LARGE');
    }
  }
  let form: FormData;
  try {
    form = await readBoundedFormData(request);
  } catch (cause) {
    if (cause instanceof CustomerApprovalBodyTooLargeError) {
      return errorResponse(413, 'INTERIOR_SIGNATURE_FILE_TOO_LARGE');
    }
    return errorResponse(400, 'INTERIOR_CUSTOMER_APPROVAL_INPUT_INVALID');
  }

  const decision = form.get('decision');
  const customerNotes = form.get('customerNotes');
  const rejectionReason = form.get('rejectionReason');
  const signature = form.get('signature');
  if ((decision !== 'approved' && decision !== 'rejected')
    || (customerNotes !== null && typeof customerNotes !== 'string')
    || (rejectionReason !== null && typeof rejectionReason !== 'string')
    || (signature !== null && !(signature instanceof File))) {
    return errorResponse(400, 'INTERIOR_CUSTOMER_APPROVAL_INPUT_INVALID');
  }
  if ((typeof customerNotes === 'string' && customerNotes.length > 2000)
    || (typeof rejectionReason === 'string' && rejectionReason.length > 2000)
    || (decision === 'rejected' && (typeof rejectionReason !== 'string' || !rejectionReason.trim()))) {
    return errorResponse(400, 'INTERIOR_CUSTOMER_APPROVAL_INPUT_INVALID');
  }

  const anonymousClient = createAnonymousClient();
  if (!anonymousClient) return errorResponse(503, 'INTERIOR_CUSTOMER_APPROVAL_UNAVAILABLE');
  const approval = await readApproval(anonymousClient, approvalId, token);
  if (!approval) return errorResponse(404, 'INTERIOR_CUSTOMER_APPROVAL_NOT_FOUND');
  if (approval.canRespond !== true) return errorResponse(409, 'INTERIOR_CUSTOMER_APPROVAL_NOT_ACTIONABLE');
  const subjectType = approval.subjectType;

  if (decision === 'rejected' && signature !== null) {
    return errorResponse(400, 'INTERIOR_SIGNATURE_NOT_ALLOWED_FOR_REJECTION');
  }
  if (decision === 'approved' && subjectType === 'contract' && signature === null) {
    return errorResponse(422, 'INTERIOR_CONTRACT_SIGNATURE_REQUIRED');
  }
  if (signature instanceof File
    && (decision !== 'approved' || subjectType !== 'contract'
      || !ALLOWED_SIGNATURE_TYPES.has(signature.type)
      || signature.size <= 0 || signature.size > MAX_SIGNATURE_BYTES)) {
    return errorResponse(400, 'INTERIOR_SIGNATURE_FILE_INVALID');
  }

  let serviceClient: SupabaseClient<Database> | null = null;
  let storagePath: string | null = null;
  let signatureMimeType: string | null = null;
  let signatureSize: number | null = null;
  let signatureHash: string | null = null;
  let signatureUploadedAt: string | null = null;

  if (signature instanceof File) {
    if (typeof approval.tenantId !== 'string' || !validInteriorUuid(approval.tenantId)) {
      return errorResponse(404, 'INTERIOR_CUSTOMER_APPROVAL_NOT_FOUND');
    }
    try {
      serviceClient = createServiceClient();
      const fileBytes = Buffer.from(await signature.arrayBuffer());
      if (!signatureBytesMatchMime(signature.type, fileBytes)) {
        return errorResponse(400, 'INTERIOR_SIGNATURE_FILE_INVALID');
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
      if (uploadError) return errorResponse(503, 'INTERIOR_SIGNATURE_STORAGE_FAILED');
      signatureUploadedAt = new Date().toISOString();
    } catch {
      return errorResponse(503, 'INTERIOR_SIGNATURE_STORAGE_UNAVAILABLE');
    }
  }

  const decisionClient = serviceClient ?? anonymousClient;
  let data: unknown;
  let error: { message?: string } | null;
  try {
    const result = await interiorRbacRpcClient(decisionClient).rpc('interior_transition_public_customer_approval', {
      p_approval_id: approvalId,
      p_approval_token: token,
      p_target_status: decision,
      p_rejection_reason: decision === 'rejected' ? String(rejectionReason).trim() : null,
      p_customer_notes: typeof customerNotes === 'string' && customerNotes.trim() ? customerNotes.trim() : null,
      p_signature_storage_path: storagePath,
      p_signature_mime_type: signatureMimeType,
      p_signature_file_size_bytes: signatureSize,
      p_signature_sha256_hash: signatureHash,
      p_signature_uploaded_at: signatureUploadedAt,
    });
    data = result.data;
    error = result.error;
  } catch {
    if (serviceClient && storagePath) {
      await serviceClient.storage.from(SIGNATURE_BUCKET).remove([storagePath]).catch(() => undefined);
    }
    return errorResponse(503, 'INTERIOR_CUSTOMER_APPROVAL_PERSISTENCE_FAILED');
  }

  if (error || data !== true) {
    if (serviceClient && storagePath) {
      await serviceClient.storage.from(SIGNATURE_BUCKET).remove([storagePath]).catch(() => undefined);
    }
    if (error?.message?.includes('SIGNATURE')) {
      return errorResponse(422, 'INTERIOR_CUSTOMER_APPROVAL_EVIDENCE_INVALID');
    }
    return errorResponse(data === false ? 409 : 503, data === false
      ? 'INTERIOR_CUSTOMER_APPROVAL_NOT_ACTIONABLE'
      : 'INTERIOR_CUSTOMER_APPROVAL_PERSISTENCE_FAILED');
  }

  return NextResponse.json({ success: true, data: { approvalId, status: decision } }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
