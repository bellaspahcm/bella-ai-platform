const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MIGRATION_PATH = /^supabase[\\/]migrations[\\/].+\.sql$/i;
const RULES = [
  { code: 'drop-object', pattern: /\bDROP\s+(?:TABLE|SCHEMA|TYPE|VIEW|MATERIALIZED\s+VIEW|FUNCTION|PROCEDURE)\b/gi },
  { code: 'drop-column', pattern: /\bDROP\s+COLUMN\b/gi },
  { code: 'truncate', pattern: /\bTRUNCATE(?:\s+TABLE)?\b/gi },
  { code: 'alter-column-type', pattern: /\bALTER\s+COLUMN\b[^;]*?\bTYPE\b/gi },
  { code: 'rename-table-or-column', pattern: /\bALTER\s+TABLE\b[^;]*?\bRENAME\s+(?:COLUMN|TO)\b/gi },
  { code: 'set-not-null', pattern: /\bALTER\s+COLUMN\b[^;]*?\bSET\s+NOT\s+NULL\b/gi },
  { code: 'validate-constraint', pattern: /\bVALIDATE\s+CONSTRAINT\b/gi },
  { code: 'blocking-index', pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY\b)/gi },
];

function maskRange(chars, start, end) {
  for (let index = start; index < end; index += 1) {
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
  }
}

function maskSqlLiteralsAndComments(sql) {
  const source = String(sql);
  const chars = source.split('');
  let index = 0;
  let dollarTag = null;

  while (index < source.length) {
    if (dollarTag && source.startsWith(dollarTag, index)) {
      maskRange(chars, index, index + dollarTag.length);
      index += dollarTag.length;
      dollarTag = null;
      continue;
    }

    if (!dollarTag && source.startsWith('--', index)) {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      maskRange(chars, index, stop);
      index = stop;
      continue;
    }

    if (!dollarTag && source.startsWith('/*', index)) {
      let depth = 1;
      let cursor = index + 2;
      while (cursor < source.length && depth > 0) {
        if (source.startsWith('/*', cursor)) {
          depth += 1;
          cursor += 2;
        } else if (source.startsWith('*/', cursor)) {
          depth -= 1;
          cursor += 2;
        } else {
          cursor += 1;
        }
      }
      maskRange(chars, index, cursor);
      index = cursor;
      continue;
    }

    if (!dollarTag && source[index] === '$') {
      const tagMatch = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (tagMatch) {
        dollarTag = tagMatch[0];
        maskRange(chars, index, index + dollarTag.length);
        index += dollarTag.length;
        continue;
      }
    }

    if (source[index] === "'" || source[index] === '"') {
      const quote = source[index];
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === quote && source[cursor + 1] === quote) {
          cursor += 2;
          continue;
        }
        if (source[cursor] === quote) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      maskRange(chars, index, cursor);
      index = cursor;
      continue;
    }

    index += 1;
  }

  return chars.join('');
}

function hasAllowAnnotation(sourceLines, lineIndex, code) {
  const nearby = sourceLines.slice(Math.max(0, lineIndex - 2), lineIndex + 1).join('\n');
  return new RegExp('--\\s*zero-downtime:\\s*allow\\s+' + code + '\\s+-\\s+\\S', 'i').test(nearby);
}

function isReviewedAttendanceWriteRevoke(source, offset, migrationPath) {
  // Owner-approved exception for one reviewed revocation, not a TRUNCATE command.
  if (migrationPath.replace(/\\/g, '/') !== 'supabase/migrations/20261026152000_harden_education_attendance_access.sql') return false;
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = source.indexOf('\n', offset);
  const statement = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd).trim();
  if (statement !== 'REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.edu_attendance,public.edu_attendance_daily_state FROM PUBLIC,anon,authenticated;') return false;
  if (lineStart === 0) return false;
  const previousLineStart = source.lastIndexOf('\n', lineStart - 2) + 1;
  return source.slice(previousLineStart, lineStart - 1).trim() === '-- zero-downtime: reviewed-attendance-write-revoke'
    && source.indexOf('TRUNCATE', lineStart) === offset;
}

function analyzeSql(sql, migrationPath = '') {
  const source = String(sql);
  const masked = maskSqlLiteralsAndComments(source);
  const sourceLines = source.split(/\r?\n/);
  const findings = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(masked)) !== null) {
      const line = masked.slice(0, match.index).split(/\r?\n/).length;
      const reviewedRevoke = rule.code === 'truncate'
        && isReviewedAttendanceWriteRevoke(source, match.index, migrationPath);
      if (!reviewedRevoke && !hasAllowAnnotation(sourceLines, line - 1, rule.code)) {
        findings.push({
          code: rule.code,
          line,
          statement: match[0].replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }

  return findings.sort((left, right) => left.line - right.line || left.code.localeCompare(right.code));
}

function gitLines(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    throw new Error('Could not determine changed migrations: ' + error.message);
  }
}

function addChangedEntries(entries, lines, defaultStatus) {
  for (const line of lines) {
    const columns = line.split(/\s+/);
    const status = columns.length > 1 ? columns[0][0] : defaultStatus;
    const file = columns.length > 1 ? columns.at(-1) : columns[0];
    if (!MIGRATION_PATH.test(file)) continue;
    if (status === 'D' || !entries.has(file)) entries.set(file, status);
  }
}

function listChangedMigrations(baseRef = process.env.ZERO_DOWNTIME_BASE_REF || 'HEAD^') {
  const entries = new Map();
  addChangedEntries(entries, gitLines(['diff', '--name-status', '--diff-filter=ACMRD', baseRef, '--', 'supabase/migrations']), 'M');
  addChangedEntries(entries, gitLines(['diff', '--name-status', '--diff-filter=ACMRD', '--cached', '--', 'supabase/migrations']), 'M');
  addChangedEntries(entries, gitLines(['diff', '--name-status', '--diff-filter=ACMRD', '--', 'supabase/migrations']), 'M');
  addChangedEntries(entries, gitLines(['ls-files', '--others', '--exclude-standard', '--', 'supabase/migrations']), 'A');

  return [...entries].map(([file, status]) => ({ file, status })).sort((a, b) => a.file.localeCompare(b.file));
}

function main() {
  const baseArgIndex = process.argv.indexOf('--base');
  const baseRef = baseArgIndex >= 0 ? process.argv[baseArgIndex + 1] : undefined;
  if (baseArgIndex >= 0 && !baseRef) throw new Error('The --base option requires a git ref.');

  const migrations = listChangedMigrations(baseRef);
  if (migrations.length === 0) {
    console.log('No changed Supabase migrations require zero-downtime review.');
    return;
  }

  let failed = false;
  for (const migration of migrations) {
    if (migration.status === 'D' || !existsSync(resolve(migration.file))) {
      failed = true;
      console.error(migration.file + ': deleted migration history is not allowed');
      continue;
    }

    const findings = analyzeSql(readFileSync(resolve(migration.file), 'utf8'), migration.file);
    for (const finding of findings) {
      failed = true;
      console.error(migration.file + ':' + finding.line + ' [' + finding.code + '] ' + finding.statement);
    }
  }

  if (failed) {
    console.error('Zero-downtime migration check failed. Use an expand/contract migration.');
    console.error('A reviewed exception must use: -- zero-downtime: allow <rule-code> - <reason>');
    process.exitCode = 1;
    return;
  }

  console.log('Zero-downtime migration check passed for ' + migrations.length + ' migration(s).');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { analyzeSql, listChangedMigrations, maskSqlLiteralsAndComments };
