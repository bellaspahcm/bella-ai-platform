/**
 * Bella Interior OS — Cloudflare R2 Direct Upload API Route
 *
 * POST /api/interior/upload
 *
 * Uploads design assets (3D renders, 2D CAD DWG/DXF blueprints, PDF specs)
 * directly to Cloudflare R2 bucket `bella-production` using native AWS SigV4
 * signing (zero external dependencies).
 *
 * Returns the public CDN URL (`https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/...`)
 * with structured file metadata for downstream canonical registration.
 *
 * @module src/app/api/interior/upload/route
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { r2Url } from '@/lib/r2';

export const dynamic = 'force-dynamic';

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

/**
 * Uploads a buffer directly to Cloudflare R2 using AWS Signature Version 4.
 * Zero external SDK dependencies, highly portable and resilient in all environments.
 */
async function putObjectToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<{ success: boolean; status: number; error?: string }> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      '[InteriorUpload] Missing R2 credentials. ' +
      'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME ' +
      'in environment variables. No hardcoded fallback permitted.',
    );
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = sha256Hex(buffer);
  const canonicalUri = `/${bucket}/${key.replace(/^\//, '')}`;

  const canonicalHeaders =
    `cache-control:public, max-age=31536000, immutable\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'cache-control;content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `PUT\n` +
    `${canonicalUri}\n\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${sha256Hex(canonicalRequest)}`;

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authHeader =
    `AWS4-HMAC-SHA256 ` +
    `Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const targetUrl = `https://${host}${canonicalUri}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        host,
        'content-type': contentType,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authHeader,
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, status: response.status, error: errText };
    }

    return { success: true, status: response.status };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network error uploading to R2';
    return { success: false, status: 500, error: errorMsg };
  }
}

function resolveContentType(filename: string, mimeType?: string): string {
  if (mimeType && mimeType !== 'application/octet-stream') {
    return mimeType;
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.dwg')) return 'application/acad';
  if (lower.endsWith('.dxf')) return 'application/dxf';
  if (lower.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string | null) || 'interior/design';
    const category = (formData.get('category') as string | null) || '3d';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FILE', message: 'Vui lòng chọn tệp để tải lên.' },
        { status: 400 },
      );
    }

    const originalName = file.name || 'uploaded-file';
    const cleanName = originalName
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-');
    const timestamp = Date.now();
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const r2Key = `${cleanFolder}/${timestamp}-${cleanName}`;

    const contentType = resolveContentType(originalName, file.type);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await putObjectToR2(buffer, r2Key, contentType);

    if (!uploadResult.success) {
      console.warn('[R2_UPLOAD_WARN]', uploadResult.error);
    }

    const publicUrl = r2Url(r2Key);

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        key: r2Key,
        fileName: originalName,
        fileSize: formatFileSize(file.size),
        fileType: originalName.split('.').pop()?.toUpperCase() || 'FILE',
        category,
        uploadedToR2: uploadResult.success,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định khi upload lên R2';
    return NextResponse.json(
      {
        success: false,
        error: 'UPLOAD_FAILED',
        message,
      },
      { status: 500 },
    );
  }
}
