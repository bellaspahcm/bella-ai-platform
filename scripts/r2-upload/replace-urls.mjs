/**
 * Bella Interior — R2 URL Replacement Script
 *
 * Reads r2-url-mapping.json and replaces all Unsplash URLs in the codebase
 * with their corresponding Cloudflare R2 CDN URLs.
 *
 * Usage:
 *   node scripts/r2-upload/replace-urls.mjs [--dry-run]
 *
 * Options:
 *   --dry-run   Preview changes without writing files
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

const TARGET_DIRS = [
  'src/app/dashboard/interior',
  'src/products/bella-interior',
];

const TARGET_EXTS = new Set(['.ts', '.tsx', '.json']);

// ─── Walk directory recursively ───────────────────────────────────────────────
async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      yield* walk(full);
    } else if (entry.isFile() && TARGET_EXTS.has(extname(entry.name))) {
      yield full;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const mappingPath = join(__dirname, 'r2-url-mapping.json');
  let mapping;
  try {
    mapping = JSON.parse(await readFile(mappingPath, 'utf-8'));
  } catch {
    console.error('\n❌ r2-url-mapping.json not found. Run upload-to-r2.mjs first.\n');
    process.exit(1);
  }

  const photoIds = Object.keys(mapping);
  if (!photoIds.length) {
    console.log('\n⚠  No URL mappings found — nothing to replace.\n');
    return;
  }

  console.log(`\n🔄 Bella Interior — Replacing Unsplash URLs with R2 CDN URLs`);
  console.log(`   Mode    : ${DRY_RUN ? 'DRY RUN (no files written)' : 'LIVE'}`);
  console.log(`   Mappings: ${photoIds.length} photos\n`);

  let totalFiles = 0;
  let totalReplacements = 0;

  for (const targetDir of TARGET_DIRS) {
    const absDir = join(ROOT, targetDir);
    for await (const filePath of walk(absDir)) {
      const original = await readFile(filePath, 'utf-8');
      let updated = original;
      let fileReplacements = 0;

      for (const [photoId, r2Url] of Object.entries(mapping)) {
        // Match the base photo URL with any query string
        const escapedPhotoId = photoId.replace('-', '\\-');
        const regex = new RegExp(
          `https://images\\.unsplash\\.com/${photoId}[^"'\\s<>]*`,
          'g'
        );

        const before = updated;
        // Replace with R2 URL — strip original query params (size handled by Next.js Image)
        updated = updated.replace(regex, r2Url);
        const replaced = (before.match(regex) || []).length;
        fileReplacements += replaced;
      }

      if (fileReplacements > 0) {
        const relPath = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
        console.log(`  ${DRY_RUN ? '(dry)' : '✍ '} ${relPath} — ${fileReplacements} replacement(s)`);
        totalReplacements += fileReplacements;
        totalFiles++;

        if (!DRY_RUN) {
          await writeFile(filePath, updated, 'utf-8');
        }
      }
    }
  }

  console.log(`\n📋 Summary:`);
  console.log(`   Files modified   : ${totalFiles}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  if (DRY_RUN) {
    console.log(`\n   Re-run without --dry-run to apply changes.\n`);
  } else {
    console.log(`\n   ✅ All Unsplash URLs replaced with R2 CDN URLs.`);
    console.log(`   Run  npx tsc --noEmit  to verify no type errors.\n`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
