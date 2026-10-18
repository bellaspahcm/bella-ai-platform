import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(path) {
  if (!fs.existsSync(path)) return {};
  const lines = fs.readFileSync(path, 'utf8').split('\n');
  const res = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [k, ...v] = trimmed.split('=');
    res[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return res;
}

const env = { ...readEnv('.env.local'), ...readEnv('.env'), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const sb = createClient(url, key);

const TENANT_ID = 'ed100000-0000-0000-0000-000000000001';

async function run() {
  const { data: courses, error: cErr } = await sb.from('edu_courses').select('id, name, code, tenant_id').eq('tenant_id', TENANT_ID);
  console.log('Courses count for preschool tenant:', courses?.length, 'error:', cErr?.message);
  if (courses && courses.length > 0) {
    console.log('Sample course:', courses[0]);
  }

  const { data: enrollments } = await sb.from('edu_enrollments').select('id, course_id, student_party_id, status').eq('tenant_id', TENANT_ID).limit(5);
  console.log('Enrollments for preschool tenant:', enrollments?.length);
  if (enrollments && enrollments.length > 0) {
    console.log('Sample enrollment:', enrollments[0]);
  }
}

run();
