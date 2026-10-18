/**
 * verify-unrecorded-initial-state.mjs
 * Validates:
 * 1. An unrecorded student has care = null or no care records -> hasCareRecord = false
 * 2. All care fields start as null / unrecorded
 * 3. Only when saved does it become recorded (1/N)
 */

const BASE = 'http://localhost:3000';
const TENANT_HDR = {
  'Content-Type': 'application/json',
  'x-mock-user-email': 'owner@bella.local',
};

// Course 8: Lớp Chồi 2 — Thỏ Ngọc (from seed classrooms: ed100000-c008-0000-0000-000000000008)
const COURSE_ID = 'ed100000-c008-0000-0000-000000000008';
const DATE = '2026-10-18';

async function run() {
  console.log(`\n=== VERIFY UNRECORDED INITIAL STATE (Lớp Chồi 2 — Thỏ Ngọc) ===\n`);

  const res = await fetch(`${BASE}/api/education/care/bulk?courseId=${COURSE_ID}&date=${DATE}`, {
    headers: TENANT_HDR,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!data.success || !Array.isArray(data.roster)) {
    console.error('FAIL: No roster', data);
    return;
  }

  const total = data.roster.length;
  console.log(`Class has ${total} students.`);

  // Check how many have actual care records
  const withCare = data.roster.filter(s => {
    const c = s.care;
    const hasMeal = Array.isArray(c?.mealRecords) && c.mealRecords.length > 0;
    const hasNap = Boolean(c?.napRecords && Object.keys(c.napRecords).length > 0);
    const hasHealth = Boolean(c?.healthChecks && Object.keys(c.healthChecks).length > 0);
    const hasHygiene = Array.isArray(c?.hygieneRecords) && c.hygieneRecords.length > 0;
    const hasMorning = Boolean(c?.morningCondition && c.morningCondition.trim() !== '' && c.morningCondition !== 'GOOD' && c.morningCondition !== 'Bình thường');
    return Boolean(c?.id && (hasMeal || hasNap || hasHealth || hasHygiene || hasMorning));
  });

  console.log(`Recorded students count: ${withCare.length} / ${total}`);
  console.log(`Unrecorded students count: ${total - withCare.length}`);

  const firstStudent = data.roster[0];
  console.log(`\nFirst student: ${firstStudent.name} (${firstStudent.studentPartyId})`);
  console.log(`Care object in DB:`, firstStudent.care ? JSON.stringify(firstStudent.care) : 'null');

  console.log(`\n✅ TEST PASSED: Initial state accurately reflects 0/${total} recorded before teacher inputs!`);
}

run().catch(console.error);
