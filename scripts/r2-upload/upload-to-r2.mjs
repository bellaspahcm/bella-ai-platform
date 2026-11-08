/**
 * Bella Interior — Cloudflare R2 Image Upload Script
 *
 * Downloads all Unsplash images used in Bella Interior and uploads them
 * to Cloudflare R2, organised by feature folder.
 *
 * Usage:
 *   node scripts/r2-upload/upload-to-r2.mjs
 *
 * Required env vars (set in .env.local or export before running):
 *   R2_ACCOUNT_ID          = 3c8d589a1d10e0c3a2167a27abd354ab
 *   R2_ACCESS_KEY_ID       = <your R2 access key id>
 *   R2_SECRET_ACCESS_KEY   = <your R2 secret access key>
 *   R2_BUCKET_NAME         = bella-production
 *   R2_PUBLIC_BASE_URL     = https://cdn.bella-interior.com  (or your custom domain / r2.dev URL)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

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
    console.error('\nPlease add them to .env.local or export them before running.\n');
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

// ─── Build S3 client pointed at R2 ───────────────────────────────────────────
function buildR2Client(config) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
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
async function existsInR2(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ─── Upload a file to R2 ──────────────────────────────────────────────────────
async function uploadToR2(client, bucket, key, filePath, contentType = 'image/jpeg') {
  const body = createReadStream(filePath);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      'uploaded-by': 'bella-r2-upload-script',
      'source': 'unsplash',
    },
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await loadEnv();
  const config = getConfig();
  const client = buildR2Client(config);

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
    const alreadyExists = await existsInR2(client, config.bucket, r2Key);
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
      process.stdout.write(` ⬆  Uploading to ${r2Key}...`);
      await uploadToR2(client, config.bucket, r2Key, tmpFile);
      console.log(` ✅`);
      results.push({ photoId, r2Key, r2Url, status: 'uploaded' });
    } catch (err) {
      console.log(` ❌ ${err.message}`);
      results.push({ photoId, r2Key, r2Url, status: 'error', error: err.message });
    }
  }

  // ─── Write URL mapping file for codebase replacement ─────────────────────
  const urlMapping = {};
  for (const r of results) {
    if (r.status !== 'error') {
      const photoId = r.photoId.replace('photo-', '');
      urlMapping[r.photoId] = r.r2Url;
    }
  }
  const mappingPath = join(__dirname, 'r2-url-mapping.json');
  await writeFile(mappingPath, JSON.stringify(urlMapping, null, 2), 'utf-8');

  console.log(`\n📋 Summary:`);
  const uploaded = results.filter((r) => r.status === 'uploaded').length;
  const skipped  = results.filter((r) => r.status === 'skipped').length;
  const errors   = results.filter((r) => r.status === 'error').length;
  console.log(`   ✅ Uploaded : ${uploaded}`);
  console.log(`   ⏭  Skipped  : ${skipped}`);
  console.log(`   ❌ Errors   : ${errors}`);
  console.log(`\n   URL mapping written to: scripts/r2-upload/r2-url-mapping.json`);
  console.log(`\n   Next step: run  node scripts/r2-upload/replace-urls.mjs  to update codebase.\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });

