// Launch a local Next runtime with only credentials belonging to the isolated E2E project.
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('.env.e2e'));
const target = 'bmnbqbcdbuklhopfbopv';
const expectedUrl = `https://${target}.supabase.co`;
function claim(key) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); }
  catch { return {}; }
}
if (env.NEXT_PUBLIC_SUPABASE_URL !== expectedUrl ||
    claim(env.SUPABASE_SERVICE_ROLE_KEY || '').ref !== target ||
    claim(env.SUPABASE_SERVICE_ROLE_KEY || '').role !== 'service_role' ||
    claim(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').ref !== target) {
  throw new Error('E2E_SUPABASE_TARGET_REJECTED');
}
const childEnv = { ...process.env };
for (const name of Object.keys(childEnv)) if (/SUPABASE/i.test(name)) delete childEnv[name];
// Set unused Supabase settings explicitly so Next cannot load another target from .env.local.
Object.assign(childEnv, {
  ...env, NODE_ENV: 'development', SUPABASE_URL: expectedUrl,
  SUPABASE_DB_URL: '', SUPABASE_SECRET_KEY: '', SUPABASE_JWT_SECRET: '',
});
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '4319'], {
  env: childEnv, stdio: 'inherit', windowsHide: true,
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
