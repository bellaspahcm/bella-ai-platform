#!/usr/bin/env bash
set -euo pipefail

# Chi dung project T1 tam thoi trong GitHub runner. Khong ket noi remote.
project='bella-preschool-t1-20261022'
guard_revision='54e599048ebc315416e7a82e85f0af33dc25583d'
# SQL goc chi duoc chuan hoa xuong dong va khoang trang cuoi dong khi dua vao Git.
source_schema_sha='8678ff7209fd509e6015bf84a5ea61714a62215bec3f6bcfd241bac88b536851'
schema_sha='3fefe39b67a8dbca5c3293c0059dcb4bcc9d7fa112aca8caf96935aae29c3a62'
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
schema="$root/scripts/ci/preschool-t1-prerequisites.sql"
workdir="${RUNNER_TEMP:?RUNNER_TEMP_REQUIRED}/$project"
db_container="supabase_db_$project"
export SUPABASE_TELEMETRY_DISABLED=1 SUPABASE_EXPERIMENTAL_STACK=0

check_schema() {
  python3 - "$schema" "$schema_sha" <<'PY'
import hashlib, pathlib, re, sys
data = pathlib.Path(sys.argv[1]).read_bytes()
if hashlib.sha256(data.replace(b'\r\n', b'\n')).hexdigest() != sys.argv[2]:
    raise SystemExit('T1_SCHEMA_SHA_DRIFT')
if not re.search(rb'ROLLBACK;\r?\n?$', data):
    raise SystemExit('SCHEMA_DEFAULT_ROLLBACK_REQUIRED')
# Kiem tra lenh DML cap cao nhat; DML trong body function la metadata cua schema.
sql = data.decode('utf-8')
sql = re.sub(r'\$([A-Za-z0-9_]*)\$.*?\$\1\$', "''", sql, flags=re.S)
sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.S)
sql = re.sub(r'--[^\n]*', '', sql)
sql = re.sub(r"'(?:''|[^'])*'", "''", sql)
if re.search(r'(?im)^-- Data for Name:', data.decode('utf-8')) or any(
    re.match(r'^\s*(COPY|INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b', statement, re.I)
    for statement in sql.split(';')
):
    raise SystemExit('SCHEMA_BUSINESS_ROW_COPY_FORBIDDEN')
PY
}

owned_containers() {
  docker ps -a --format '{{.Names}}' | grep -E "^supabase_[a-z0-9_-]+_${project}$" || true
}

owned_volumes() {
  docker volume ls --format '{{.Name}}' | grep -E "^supabase_[a-z0-9_-]+_${project}$" || true
}

prepare() {
  test "${CI:-}" = 'true' || { echo 'CI_ONLY'; exit 1; }
  test ! -e "$workdir" || { echo 'T1_WORKDIR_ALREADY_EXISTS'; exit 1; }
  test -z "$(owned_containers)" && test -z "$(owned_volumes)" || {
    echo 'T1_STACK_ALREADY_EXISTS'; exit 1;
  }
  check_schema
  mkdir -p "$workdir/receipts"
  # Chi danh dau quyen so huu sau khi chac chan stack cung ten chua ton tai.
  printf '%s\n' "$project" > "$workdir/owner-intent"
  supabase init --workdir "$workdir" --yes > "$workdir/init.log" 2>&1
  python3 - "$workdir/supabase/config.toml" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
for old, new in [
    (r'^project_id = "[^"]+"$', 'project_id = "bella-preschool-t1-20261022"'),
    (r'^port = 54321$', 'port = 24631'),
    (r'^port = 54322$', 'port = 24632'),
    (r'^shadow_port = 54320$', 'shadow_port = 24630'),
    (r'^major_version = 17$', 'major_version = 17'),
]:
    text, count = re.subn(old, new, text, flags=re.M)
    if count != 1:
        raise SystemExit('T1_CONFIG_DRIFT:' + old)
for section in ('db.migrations', 'db.seed'):
    pattern = rf'(?ms)(^\[{re.escape(section)}\]\n(?:(?!^\[).)*?^enabled = )true$'
    text, count = re.subn(pattern, r'\g<1>false', text)
    if count != 1:
        raise SystemExit('T1_CONFIG_DRIFT:' + section)
path.write_text(text)
PY
  test ! -d "$workdir/supabase/migrations" || {
    echo 'T1_MIGRATION_HISTORY_FORBIDDEN'; exit 1;
  }
  if ! supabase start --workdir "$workdir" \
      --exclude 'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor' \
      > "$workdir/start.log" 2>&1; then
    echo 'T1_START_FAILED'; exit 1
  fi
  id="$(docker inspect --format '{{.Id}}' "$db_container")"
  [[ "$id" =~ ^[a-f0-9]{64}$ ]] || { echo 'T1_CONTAINER_ID_INVALID'; exit 1; }
  printf '%s\n' "$id" > "$workdir/owner-container-id"
  before="$(docker exec "$id" psql -XAt -U postgres -d postgres -c \
    "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v')")"
  test "$before" = '0' || { echo 'T1_EMPTY_PUBLIC_REQUIRED'; exit 1; }

  # Rehearsal chay SQL nguyen ban: transaction ket thuc bang ROLLBACK.
  if ! { printf "SET bella.t1_full_scope = 'APPROVED_SECTION7_AB';\n"; cat "$schema"; } |
      docker exec -i "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f - \
      > "$workdir/rehearsal.log" 2>&1; then
    echo 'T1_REHEARSAL_FAILED'; exit 1
  fi
  after_rehearsal="$(docker exec "$id" psql -XAt -U postgres -d postgres -c \
    "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v')")"
  test "$after_rehearsal" = '0' || { echo 'T1_REHEARSAL_DID_NOT_ROLL_BACK'; exit 1; }

  python3 - "$schema" "$workdir/apply.sql" <<'PY'
import pathlib, re, sys
source = pathlib.Path(sys.argv[1]).read_bytes()
candidate, count = re.subn(rb'ROLLBACK;\r?\n?$', b'COMMIT;\n', source)
if count != 1:
    raise SystemExit('T1_COMMIT_VARIANT_INVALID')
pathlib.Path(sys.argv[2]).write_bytes(candidate)
PY
  if ! { printf "SET bella.t1_full_scope = 'APPROVED_SECTION7_AB';\n"; cat "$workdir/apply.sql"; } |
      docker exec -i "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f - \
      > "$workdir/apply.log" 2>&1; then
    echo 'T1_APPLY_FAILED'; exit 1
  fi
  after_apply="$(docker exec "$id" psql -XAt -U postgres -d postgres -c \
    "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v')")"
  test "$after_apply" = '30' || { echo 'T1_RELATION_COUNT_MISMATCH'; exit 1; }

  supabase status --workdir "$workdir" -o env > "$workdir/status.env"
  chmod 600 "$workdir/status.env"
  set -a
  # status.env duoc sinh boi Supabase CLI tren project local vua khoi dong.
  source "$workdir/status.env"
  set +a
  test "${API_URL:-}" = 'http://127.0.0.1:24631' || { echo 'T1_API_IDENTITY_MISMATCH'; exit 1; }
  test -n "${SERVICE_ROLE_KEY:-}" && test -n "${ANON_KEY:-}" || { echo 'T1_LOCAL_KEYS_MISSING'; exit 1; }
  if test "${GITHUB_ACTIONS:-}" = 'true'; then
    echo "::add-mask::$SERVICE_ROLE_KEY"
    echo "::add-mask::$ANON_KEY"
  fi

  revision="$(git -C "$root" rev-parse HEAD)"
  python3 - "$workdir" "$id" "$revision" "$guard_revision" "$schema_sha" "$source_schema_sha" <<'PY'
import hashlib, json, pathlib, sys
from datetime import datetime, timedelta, timezone
workdir, container, revision, guard, schema_hash, source_hash = sys.argv[1:]
directory = pathlib.Path(workdir)
marker = directory / 'owner-marker.json'
marker.write_text(json.dumps(dict(projectId='bella-preschool-t1-20261022', containerId=container,
                                  candidateCommit=revision, schemaSha256=schema_hash,
                                  sourceSchemaSha256=source_hash)))
marker_hash = hashlib.sha256(marker.read_bytes()).hexdigest()
manifest = dict(scope='T1', project='bella-preschool-t1-20261022', projectId='bella-preschool-t1-20261022',
                apiOrigin='http://127.0.0.1:24631', databasePort=24632, sourceRevision=guard,
                fixtureGuardRevision=guard, candidateCommit=revision, schemaSha256=schema_hash,
                sourceSchemaSha256=source_hash,
                containerId=container, markerPath=str(marker), markerSha256=marker_hash,
                expiresAt=(datetime.now(timezone.utc) + timedelta(hours=4)).isoformat())
(directory / 'fixture-manifest.json').write_text(json.dumps(manifest, indent=2))
PY
  {
    echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
    echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
    echo "BELLA_DISPOSABLE_FIXTURE_MANIFEST=$workdir/fixture-manifest.json"
    echo "BELLA_FIXTURE_RECEIPT_DIR=$workdir/receipts"
  } >> "${GITHUB_ENV:?GITHUB_ENV_REQUIRED}"
  echo 'T1_SANDBOX_READY_30_RELATIONS'
}

verify() {
  python3 - "$workdir" "${T1_JEST_REPORT:-$root/artifacts/jest-output.json}" <<'PY'
import json, pathlib, sys
directory, report_path = map(pathlib.Path, sys.argv[1:])
manifest = json.loads((directory / 'fixture-manifest.json').read_text())
report = json.loads(report_path.read_text())
for suite in ('verification-gates.test.ts', 'course-contract-real-db.integration.test.ts',
              'kernel-invariants.integration.test.ts'):
    matches = [result for result in report['testResults']
               if result['name'].replace('\\', '/').endswith('/src/platform/education/__tests__/' + suite)]
    if (len(matches) != 1 or matches[0].get('status') != 'passed' or
        not matches[0].get('assertionResults') or
        any(assertion.get('status') != 'passed' for assertion in matches[0]['assertionResults'])):
        raise SystemExit('T1_SUITE_NOT_PROVEN:' + suite)
for suite in ('verification-gates', 'course-contract-real-db'):
    receipts = list((directory / 'receipts').glob(suite + '-*.json'))
    if len(receipts) != 1:
        raise SystemExit('T1_RECEIPT_COUNT_INVALID:' + suite)
    receipt = json.loads(receipts[0].read_text())
    if (receipt.get('lifecycle') != 'QUARANTINED_REQUIRES_OWNED_STACK_DISPOSAL' or
        receipt.get('authorityReadback') != 'NO_ACTIVE_TRACKED_AUTHORITY' or
        receipt.get('target', {}).get('containerId') != manifest['containerId']):
        raise SystemExit('T1_RECEIPT_RECOVERY_FAILED:' + suite)
print('T1_THREE_SUITES_RECEIPTS_AND_AUTHORITY_READBACK_PASS')
PY
}

dispose() {
  if test ! -f "$workdir/owner-intent" ||
      test "$(cat "$workdir/owner-intent")" != "$project"; then
    if test -n "$(owned_containers)" || test -n "$(owned_volumes)"; then
      echo 'T1_UNOWNED_STACK_REFUSE_DISPOSAL'; return 1
    fi
    echo 'T1_NO_OWNED_STACK_TO_DISPOSE'; return
  fi
  if test -f "$workdir/owner-container-id" && docker container inspect "$db_container" > /dev/null 2>&1; then
    actual_id="$(docker inspect --format '{{.Id}}' "$db_container")"
    expected_id="$(cat "$workdir/owner-container-id")"
    if test "$actual_id" != "$expected_id"; then
      echo 'T1_CONTAINER_OWNERSHIP_MISMATCH'; return 1
    fi
  fi
  rm -f "$workdir/status.env"
  if test -z "$(owned_containers)" && test -z "$(owned_volumes)"; then
    echo 'T1_STACK_ALREADY_ABSENT'; return
  fi
  supabase stop --project-id "$project" --no-backup > "$workdir/stop.log" 2>&1 || {
    echo 'T1_DISPOSAL_FAILED'; return 1;
  }
  test -z "$(owned_containers)" && test -z "$(owned_volumes)" || {
    echo 'T1_DISPOSAL_READBACK_FAILED'; return 1;
  }
  echo 'T1_OWNED_STACK_AND_VOLUMES_DISPOSED'
}

case "${1:-}" in
  check) check_schema ;;
  prepare) prepare ;;
  verify) verify ;;
  dispose) dispose ;;
  *) echo 'USAGE: preschool-t1-fixture.sh check|prepare|verify|dispose'; exit 2 ;;
esac
