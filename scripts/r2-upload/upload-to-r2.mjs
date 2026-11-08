/**
 * Bella Interior — Cloudflare R2 Image Upload Script
 *
 * Downloads all Unsplash images used in Bella Interior and uploads them
 * to Cloudflare R2, organised by feature folder using native AWS SigV4.
 *
 * Usage:
 *   node scripts/r2-upload/upload-to-r2.mjs
 *
 * Required env vars (set in .env.production, .env.local or export before running):
 *   R2_ACCOUNT_ID          = <your R2 account id>
 *   R2_ACCESS_KEY_ID       = <your R2 access key id>
 *   R2_SECRET_ACCESS_KEY   = <your R2 secret access key>
 *   R2_BUCKET_NAME         = bella-production
 *   R2_PUBLIC_BASE_URL     = https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// ─── Load env from .env.production, .env.local, .env ─────────────────────────
async function loadEnv() {
  const envFiles = ['.env.production', '.env.local', '.env'];
  for (const file of envFiles) {
    const envPath = join(ROOT, file);
    if (!existsSync(envPath)) continue;
    const content = await readFile(envPath, 'utf-8').catch(() => '');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) {
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()] && val) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

// ─── Validate env ─────────────────────────────────────────────────────────────
function getConfig() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('\n❌ Missing required environment variables:');
    missing.forEach((k) => console.error(`   ${k}`));
    console.error('\nPlease add them to .env.production, .env.local or export them before running.\n');
    process.exit(1);
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL ? process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '') : '') || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}`,
  };
}

// ─── Download a URL to a local temp file ─────────────────────────────────────
async function downloadToFile(url, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = createWriteStream(destPath);
    protocol.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadToFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => { file.close(); reject(err); });
    }).on('error', reject);
  });
}

// ─── Check if key already exists in R2 ───────────────────────────────────────
async function existsInR2(config, key) {
  try {
    const res = await fetch(`${config.publicBaseUrl}/${key}`, { method: 'HEAD' });
    return res.status === 200;
  } catch {
    return false;
  }
}

// ─── Upload a file buffer to R2 using AWS SigV4 ─────────────────────────────
async function uploadToR2(config, key, filePath, contentType = 'image/jpeg') {
  const buffer = await readFile(filePath);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = sha256Hex(buffer);
  const canonicalUri = `/${config.bucket}/${key.replace(/^\//, '')}`;

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
    body: buffer,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`R2 upload failed (${response.status}): ${errText}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await loadEnv();
  const config = getConfig();

  const manifestPath = join(__dirname, 'r2-image-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const images = manifest.images;

  const tempDir = join(ROOT, '.r2-upload-tmp');
  mkdirSync(tempDir, { recursive: true });

  const results = [];

  console.log(`\n🚀 Bella Interior → Cloudflare R2 Upload`);
  console.log(`   Bucket  : ${config.bucket}`);
  console.log(`   CDN Base: ${config.publicBaseUrl}`);
  console.log(`   Images  : ${images.length} unique photos\n`);

  for (const image of images) {
    const photoId = image.photo_id;
    const r2Key = image.r2_key;
    const r2Url = `${config.publicBaseUrl}/${r2Key}`;

    // Check if already uploaded (skip if exists)
    const alreadyExists = await existsInR2(config, r2Key);
    if (alreadyExists) {
      console.log(`  ⏭  SKIP  ${r2Key} (already in R2)`);
      results.push({ photoId, r2Key, r2Url, status: 'skipped' });
      continue;
    }

    // Download primary size (largest for quality)
    const primarySize = image.sizes[image.sizes.length - 1];
    const downloadUrl = `${image.unsplash_url}?auto=format&fit=crop&w=${primarySize}&q=90`;
    const tmpFile = join(tempDir, `${photoId}.jpg`);

    try {
      process.stdout.write(`  ⬇  Downloading ${photoId} (${primarySize}px)...`);
      await downloadToFile(downloadUrl, tmpFile);
      process.stdout.write(' done.\n');

      process.stdout.write(`  ⬆  Uploading to R2 (${r2Key})...`);
      await uploadToR2(config, r2Key, tmpFile, 'image/jpeg');
      process.stdout.write(' done.\n');

      results.push({ photoId, r2Key, r2Url, status: 'uploaded' });
    } catch (err) {
      console.error(`\n  ❌ FAILED ${photoId}: ${err.message}`);
      results.push({ photoId, r2Key, r2Url, status: 'failed', error: err.message });
    }
  }

  const uploaded = results.filter((r) => r.status === 'uploaded').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  console.log(`\n✅ Upload complete:`);
  console.log(`   Uploaded: ${uploaded}`);
  console.log(`   Skipped : ${skipped}`);
  console.log(`   Failed  : ${failed}\n`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
