import crypto from 'crypto';

export interface R2StorageConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket: string;
  publicBaseUrl: string;
}

export interface R2UploadResult {
  key: string;
  publicUrl: string;
  size: number;
  contentType: string;
}

export class R2StorageConfigError extends Error {
  constructor(message = 'R2_STORAGE_NOT_CONFIGURED') {
    super(message);
    this.name = 'R2StorageConfigError';
  }
}

const DEFAULT_R2_PUBLIC_BASE_URL = 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev';

export function getR2Config(): R2StorageConfig {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || undefined;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || undefined;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || undefined;
  const bucket = process.env.R2_BUCKET_NAME?.trim() || 'bella-production';
  const publicBaseUrl = (
    process.env.NEXT_PUBLIC_R2_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    DEFAULT_R2_PUBLIC_BASE_URL
  ).replace(/\/+$/, '');

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
  };
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sanitizeR2Key(key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..' || !/^[A-Za-z0-9._-]+$/.test(part))) {
    throw new Error('INVALID_R2_OBJECT_KEY');
  }
  return parts.join('/');
}

/**
 * Uploads a binary buffer to Cloudflare R2 using AWS SigV4 authentication.
 * Fails closed when R2 credentials are not configured.
 */
export async function uploadBufferToR2(params: {
  buffer: Buffer;
  key: string;
  contentType?: string;
}): Promise<R2UploadResult> {
  const { buffer, key, contentType = 'image/jpeg' } = params;
  const config = getR2Config();
  const cleanKey = sanitizeR2Key(key);
  const publicUrl = `${config.publicBaseUrl}/${cleanKey}`;

  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey) {
    throw new R2StorageConfigError('R2_STORAGE_NOT_CONFIGURED');
  }

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = sha256Hex(buffer);
  const canonicalUri = `/${config.bucket}/${cleanKey}`;

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

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authHeader =
    `AWS4-HMAC-SHA256 ` +
    `Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const targetUrl = `https://${host}${canonicalUri}`;

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
    const errorText = await response.text();
    throw new Error(`R2 upload failed (${response.status}): ${errorText}`);
  }

  return {
    key: cleanKey,
    publicUrl,
    size: buffer.length,
    contentType,
  };
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
};

/**
 * Builds a scoped R2 key for interior site evidence ensuring strict tenant & project isolation.
 */
export function buildSiteEvidenceR2Key(params: {
  tenantId: string;
  projectId: string;
  filename: string;
  contentType?: string;
}): string {
  const { tenantId, projectId, filename, contentType } = params;
  const extFromMime = contentType ? MIME_EXTENSIONS[contentType] : undefined;
  const extMatch = filename.match(/\.([a-zA-Z0-9]{2,5})$/);
  const candidateExt = extFromMime ?? extMatch?.[1]?.toLowerCase() ?? 'jpg';
  const ext = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(candidateExt) ? candidateExt : 'jpg';
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const timestamp = Date.now();
  return `interior/site-evidence/${tenantId}/${projectId}/${timestamp}-${randomSuffix}.${ext}`;
}

/**
 * Helper to determine if a URL points to configured Cloudflare R2 hosts without query/fragment smuggling.
 */
export function isR2PublicUrl(url: string): boolean {
  if (!url || typeof url !== 'string' || url.includes('?') || url.includes('#') || url.includes('..') || url.includes('\\')) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return parsed.hostname === 'pub-a9633dba6b104c5e951ebd3609e71520.r2.dev'
      || parsed.hostname === 'cdn.bella-interior.com'
      || parsed.hostname.endsWith('.r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}
