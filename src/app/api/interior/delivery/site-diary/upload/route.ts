import { NextRequest, NextResponse } from 'next/server';
import { INTERIOR_PERMISSIONS, resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import {
  buildSiteEvidenceR2Key,
  R2StorageConfigError,
  uploadBufferToR2,
} from '@/products/bella-interior/lib/r2-storage';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // Aligned with next.config.ts proxyClientMaxBodySize
const MAX_MULTIPART_REQUEST_BYTES = MAX_FILE_SIZE_BYTES + 128 * 1024;

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
      throw new UploadBodyTooLargeError('Upload request exceeds the 10 MB limit');
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

/**
 * Verifies image file signature (magic bytes) rather than trusting client-supplied MIME types.
 * Explicitly excludes SVG/HTML/XML to prevent stored XSS on CDN origins.
 */
function detectSafeImageMimeType(fileBuffer: Buffer): string | null {
  if (fileBuffer.length >= 3 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (fileBuffer.length >= 8 && fileBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (fileBuffer.length >= 12
    && fileBuffer.toString('ascii', 0, 4) === 'RIFF'
    && fileBuffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (fileBuffer.length >= 6) {
    const header = fileBuffer.toString('ascii', 0, 6);
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  }
  if (fileBuffer.length >= 12
    && fileBuffer.toString('ascii', 4, 8) === 'ftyp'
    && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(fileBuffer.toString('ascii', 8, 12))) {
    return 'image/heic';
  }
  return null;
}

function safeOriginalFileName(rawName: string): string {
  const basename = rawName.replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = basename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 120);
  return cleaned || 'site-photo.jpg';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const reqContentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!reqContentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { success: false, error: 'INVALID_CONTENT_TYPE', message: 'Use multipart/form-data to upload site photos' },
      { status: 415 },
    );
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return NextResponse.json({ success: false, error: 'INVALID_CONTENT_LENGTH' }, { status: 400 });
    }
    if (contentLength > MAX_MULTIPART_REQUEST_BYTES) {
      return NextResponse.json(
        { success: false, error: 'FILE_TOO_LARGE', message: 'Upload request exceeds the 10 MB file limit' },
        { status: 413 },
      );
    }
  }

  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const queryProjectId = new URL(request.url).searchParams.get('projectId');

  let formData: FormData;
  try {
    const boundedBody = await readBoundedRequestBody(request, MAX_MULTIPART_REQUEST_BYTES);
    const boundedRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: Buffer.from(boundedBody),
    });
    formData = await boundedRequest.formData();
  } catch (err) {
    if (err instanceof UploadBodyTooLargeError) {
      return NextResponse.json(
        { success: false, error: 'FILE_TOO_LARGE', message: 'File size must not exceed 10 MB' },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { success: false, error: 'INVALID_FORM_DATA', message: 'Failed to parse multipart form data' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  const formProjectId = formData.get('projectId');

  if (!formProjectId || typeof formProjectId !== 'string' || !validInteriorUuid(formProjectId)) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PROJECT_ID', message: 'Valid projectId is required' },
      { status: 400 },
    );
  }

  if (queryProjectId && queryProjectId.toLowerCase() !== formProjectId.toLowerCase()) {
    return NextResponse.json(
      { success: false, error: 'PROJECT_SCOPE_MISMATCH', message: 'Query projectId does not match form projectId' },
      { status: 400 },
    );
  }

  // Always verify authorization explicitly for the target projectId
  if (!queryProjectId && ctx.authorization) {
    const uploadPermissions = [
      INTERIOR_PERMISSIONS.installationCreate,
      INTERIOR_PERMISSIONS.installationUpdate,
      INTERIOR_PERMISSIONS.qcCreate,
      INTERIOR_PERMISSIONS.acceptanceEvidenceUpload,
    ];
    const decisions = await Promise.all(
      uploadPermissions.map((permissionId) =>
        ctx.authorization.authorize({
          permissionId,
          tenantId: ctx.tenantId,
          projectId: formProjectId,
        }),
      ),
    );
    if (!decisions.some((d) => d.status === 'ALLOW')) {
      return NextResponse.json(
        { success: false, error: 'INTERIOR_PERMISSION_DENIED' },
        { status: decisions.some((d) => d.status === 'UNAVAILABLE') ? 503 : 403 },
      );
    }
  }

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { success: false, error: 'FILE_REQUIRED', message: 'Image file is required' },
      { status: 400 },
    );
  }

  if (file.size < 1 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: 'FILE_TOO_LARGE', message: 'File size must be between 1 byte and 10 MB' },
      { status: 413 },
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const detectedMimeType = detectSafeImageMimeType(buffer);
    if (!detectedMimeType) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_FILE_TYPE',
          message: 'Only valid binary images (JPEG, PNG, WebP, HEIC, GIF) are allowed',
        },
        { status: 415 },
      );
    }

    const originalName = safeOriginalFileName(typeof (file as File).name === 'string' ? (file as File).name : 'site-photo.jpg');
    const r2Key = buildSiteEvidenceR2Key({
      tenantId: ctx.tenantId,
      projectId: formProjectId,
      filename: originalName,
      contentType: detectedMimeType,
    });

    const result = await uploadBufferToR2({
      buffer,
      key: r2Key,
      contentType: detectedMimeType,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          url: result.publicUrl,
          key: result.key,
          filename: originalName,
          size: result.size,
          contentType: result.contentType,
          storageType: 'cloudflare_r2',
          uploadedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof R2StorageConfigError) {
      return NextResponse.json(
        { success: false, error: 'R2_STORAGE_NOT_CONFIGURED', message: err.message },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown R2 upload failure';
    return NextResponse.json(
      { success: false, error: 'R2_UPLOAD_FAILED', message },
      { status: 502 },
    );
  }
}
