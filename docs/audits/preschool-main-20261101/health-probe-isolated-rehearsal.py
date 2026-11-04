import hashlib
import json
import os
import pathlib
import shutil
import socket
import subprocess
import tempfile

ROOT = pathlib.Path(r'D:\CodexWorktrees\preschool-sealed-release-20261102\BELLA SPA ERP')
EVIDENCE = pathlib.Path(__file__).parent
BIN = pathlib.Path(json.loads((EVIDENCE / 'health-postgres-bin-path.json').read_text(encoding='utf-8-sig'))['temp']) / 'node_modules' / '@embedded-postgres' / 'windows-x64' / 'native' / 'bin'
PSQL = pathlib.Path(r'C:\Program Files\PostgreSQL\17\bin\psql.exe')
EXPECTED = '46A11CFF0F380C957C55C118436FD1E3D23D9277BCBE2FEBDB15017E38AF5282'
SQL_PATH = 'supabase/migrations/20261029090000_platform_health_rest_database_probe.sql'
temp = pathlib.Path(tempfile.mkdtemp(prefix='bella-health-pg-'))
data = temp / 'data'
started = False
checks = []

def run(args, *, ok=True, cwd=None, input=None):
    result = subprocess.run([str(x) for x in args], cwd=cwd, input=input,
                            capture_output=True, text=True, timeout=90)
    if ok and result.returncode:
        raise RuntimeError(f'{pathlib.Path(args[0]).name} failed: {result.stderr[-1600:]}')
    return result

try:
    blob = subprocess.run(['git', 'show', 'HEAD:' + SQL_PATH], cwd=ROOT,
                          capture_output=True, check=True).stdout
    if hashlib.sha256(blob).hexdigest().upper() != EXPECTED:
        raise RuntimeError('Git blob does not match reviewed hash')
    (temp / 'migration.sql').write_bytes(blob)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    run([BIN / 'initdb.exe', '-D', data, '-U', 'postgres', '--auth=trust', '--no-locale', '-E', 'UTF8'])
    # Avoid inherited pipe handles keeping communicate() open while postgres runs.
    boot = subprocess.run([str(BIN / 'pg_ctl.exe'), '-D', str(data), '-l', str(temp / 'server.log'), '-o', f'-h 127.0.0.1 -p {port}', '-w', '-t', '40', 'start'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
    if boot.returncode:
        raise RuntimeError('Temporary PostgreSQL failed to start')
    started = True
    base = [PSQL, '-X', '-h', '127.0.0.1', '-p', str(port), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A']
    run(base + ['-d', 'postgres', '-c', 'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;'])
    run(base + ['-d', 'postgres', '-c', 'CREATE DATABASE health_ok;'])
    run(base + ['-d', 'postgres', '-c', 'CREATE DATABASE health_fail;'])
    run(base + ['-d', 'health_ok', '-f', temp / 'migration.sql'])
    result = run(base + ['-d', 'health_ok', '-c', "SELECT json_build_object('anon',has_function_privilege('anon','public.platform_health_database_probe()','EXECUTE'),'authenticated',has_function_privilege('authenticated','public.platform_health_database_probe()','EXECUTE'),'service',has_function_privilege('service_role','public.platform_health_database_probe()','EXECUTE'),'definer',p.prosecdef,'stable',p.provolatile='s','publicExecute',EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) FROM pg_proc p WHERE p.oid='public.platform_health_database_probe()'::regprocedure;"])
    acl = json.loads(result.stdout.strip())
    assert acl == {'anon': True, 'authenticated': False, 'service': False, 'definer': False, 'stable': True, 'publicExecute': False}, acl
    result = run(base + ['-d', 'health_ok', '-c', 'SET ROLE anon; SELECT public.platform_health_database_probe();'])
    assert result.stdout.strip().endswith('t')
    checks.extend(['exact_git_blob_apply', 'anon_executes_true', 'acl_and_invoker_stable'])
    text = blob.decode('utf8')
    assert text.rstrip().endswith('COMMIT;')
    injected = text[:text.rfind('COMMIT;')] + 'SELECT 1/0;\nCOMMIT;\n'
    (temp / 'failure.sql').write_text(injected, encoding='utf8')
    fail = run(base + ['-d', 'health_fail', '-f', temp / 'failure.sql'], ok=False)
    assert fail.returncode != 0 and 'division by zero' in fail.stderr
    absent = run(base + ['-d', 'health_fail', '-c', "SELECT to_regprocedure('public.platform_health_database_probe()') IS NULL;"])
    assert absent.stdout.strip() == 't'
    checks.append('late_failure_rolls_back_function_and_acl')
    run(base + ['-d', 'postgres', '-c', 'CREATE DATABASE executor_ok;'])
    run(base + ['-d', 'postgres', '-c', 'CREATE DATABASE executor_fail;'])
    run(base + ['-d', 'postgres', '-c', 'CREATE DATABASE executor_acl;'])
    run(base + ['-d', 'postgres', '-c', 'CREATE DATABASE executor_identity;'])
    run(base + ['-d', 'postgres', '-c', 'CREATE DATABASE executor_inherit;'])
    executor = run(['node', EVIDENCE / 'health-executor-native-check.cjs', str(port)])
    executor_result = json.loads(executor.stdout.strip())
    assert all(executor_result[key] == 'PASS' for key in ['concurrent', 'onlyApprovedLedgerRow', 'anonCall', 'injectedFailureRollback', 'unexpectedDefaultGrantRejected', 'wrongExecutorRejected', 'unexpectedInheritanceRejected'])
    checks.extend(['executor_concurrency', 'executor_ledger_scope', 'executor_failure_rollback', 'unexpected_default_grant_rejected', 'wrong_executor_rejected', 'unexpected_inheritance_rejected'])
    print(json.dumps({'checks': checks, 'postgres': '17', 'status': 'PASS', 'scope': 'isolated local PostgreSQL, synthetic roles, not Production'}))
    (EVIDENCE / 'health-probe-isolated-rehearsal.json').write_text(json.dumps({'checks': checks, 'status': 'PASS', 'postgres': '17', 'artifactSha256': EXPECTED, 'scope': 'isolated local PostgreSQL, synthetic roles; not Production'}, indent=2), encoding='utf8')
finally:
    if started or (data / 'postmaster.pid').exists():
        run([BIN / 'pg_ctl.exe', '-D', data, '-m', 'fast', '-w', 'stop'], ok=False)
    if temp.resolve().parent != pathlib.Path(tempfile.gettempdir()).resolve() or not temp.name.startswith('bella-health-pg-'):
        raise RuntimeError('Unsafe cleanup target')
    shutil.rmtree(temp)
