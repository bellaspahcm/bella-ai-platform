import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...valueParts] = line.split('=');
    env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = { ...readEnvFile('.env.local'), ...process.env };
const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sbAdmin = createClient(supabaseUrl, serviceRoleKey);
const sbAnon = createClient(supabaseUrl, anonKey);

const TENANT_ID = 'ed100000-0000-0000-0000-000000000001';

async function main() {
  console.log('--- 1. Testing Auth Login ---');
  const { data: authData, error: authError } = await sbAnon.auth.signInWithPassword({
    email: 'admin.preschool@bellaspa.vn',
    password: 'BellaPreschool2026!',
  });
  if (authError) {
    console.error('❌ Login failed:', authError.message);
  } else {
    console.log('✅ Auth Login Successful! User:', authData.user.email, '| Tenant:', authData.user.user_metadata?.tenant_id);
  }

  console.log('\n--- 2. Verifying Seed Records in DB ---');
  const [
    { count: studentCount },
    { count: parentCount },
    { count: teacherCount },
    { count: classCount },
    { count: attTodayCount },
    { count: healthCount },
    { count: exceptionCount },
    { count: invoiceCount },
  ] = await Promise.all([
    sbAdmin.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    sbAdmin.from('party_identifiers').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    sbAdmin.from('teacher_assignments').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    sbAdmin.from('edu_courses').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    sbAdmin.from('edu_attendance_daily_state').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    sbAdmin.from('edu_health_incidents').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    sbAdmin.from('edu_comm_exceptions').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    sbAdmin.from('edu_fin_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
  ]);

  console.log(`- Students (Preschool)        : ${studentCount} records`);
  console.log(`- Parents Phone Identifiers  : ${parentCount} records`);
  console.log(`- Teacher Assignments         : ${teacherCount} records`);
  console.log(`- Classrooms (Courses)       : ${classCount} records`);
  console.log(`- Attendance Today (Daily)   : ${attTodayCount} records`);
  console.log(`- Health Incidents           : ${healthCount} records`);
  console.log(`- Parent Comm Exceptions     : ${exceptionCount} records`);
  console.log(`- Tuition Invoices           : ${invoiceCount} records`);

  console.log('\n--- 3. Testing Analytics Aggregation Service ---');
  const { PreschoolAnalyticsRepository } = await import('../src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts');
  const { PreschoolAnalyticsService } = await import('../src/products/bella-education/analytics/services/preschool-analytics.service.ts');

  const repo = new PreschoolAnalyticsRepository(sbAdmin);
  const service = new PreschoolAnalyticsService(repo);
  const dashboard = await service.getExecutiveDashboard(TENANT_ID, '2026-10-18');

  console.log('✅ Executive Dashboard Snapshot:');
  console.log(`  • Total Enrolled Students : ${dashboard.enrollment.totalEnrolledStudents}`);
  console.log(`  • Total Classrooms        : ${dashboard.enrollment.totalClassrooms}`);
  console.log(`  • Today Present Count     : ${dashboard.attendance.todayPresentCount}`);
  console.log(`  • Present vs Enrolled     : ${dashboard.attendance.presentVsEnrolledRate}%`);
  console.log(`  • Today Absent Count      : ${dashboard.attendance.todayAbsentCount}`);
  console.log(`  • Invoiced Gross Total    : ${dashboard.finance.invoicedGrossTotal.toLocaleString('vi-VN')} VND`);
  console.log(`  • Overdue Accounts Count  : ${dashboard.finance.overdueAccountsCount}`);
  console.log(`  • Classroom Utilization   :`);
  for (const c of dashboard.enrollment.classroomUtilization) {
    console.log(`    - ${c.className.padEnd(30)}: ${c.currentEnrollment}/${c.maxCapacity} (${c.utilizationRate}%)`);
  }
}

main().catch(console.error);
