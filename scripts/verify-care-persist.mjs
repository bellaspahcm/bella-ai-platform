/**
 * verify-care-persist.mjs
 * Tests that saving care data via POST /api/education/care/bulk (action: save_care)
 * persists in the database and is returned upon reload (hard refresh simulation).
 */

const BASE = 'http://localhost:3000';
const TENANT_HDR = {
  'Content-Type': 'application/json',
  'x-mock-user-email': 'owner@bella.local',
};

const COURSE_ID = 'ed100000-c001-0000-0000-000000000001';
const DATE = '2026-10-18';

async function run() {
  console.log(`\n=== CARE PERSISTENCE TEST ===`);
  console.log(`Date: ${DATE}, CourseId: ${COURSE_ID}\n`);

  // Step 1: GET roster to find first student
  console.log('1. GET initial roster...');
  const getRes = await fetch(`${BASE}/api/education/care/bulk?courseId=${COURSE_ID}&date=${DATE}`, {
    headers: TENANT_HDR,
    cache: 'no-store',
  });
  const getRoster = await getRes.json();
  if (!getRoster.success || !Array.isArray(getRoster.roster) || getRoster.roster.length === 0) {
    console.error('FAIL: No roster returned', getRoster);
    return;
  }

  const firstStudent = getRoster.roster[0];
  console.log(`   Found ${getRoster.roster.length} students. First: ${firstStudent.name} (${firstStudent.studentPartyId})`);
  console.log(`   Initial care record present? ${!!firstStudent.care?.id}`);

  // Step 2: POST save_care with distinctive values
  console.log('\n2. POST save_care with HALF meal, RESTLESS nap, FEVER_MILD health...');
  const saveRes = await fetch(`${BASE}/api/education/care/bulk`, {
    method: 'POST',
    headers: TENANT_HDR,
    body: JSON.stringify({
      action: 'save_care',
      courseId: COURSE_ID,
      date: DATE,
      data: {
        records: [{
          studentPartyId: firstStudent.studentPartyId,
          meal: { portion: 'HALF', notes: 'Test: ate half lunch' },
          nap: { quality: 'RESTLESS', notes: 'Test: restless 45m' },
          health: {
            status: 'warning',
            label: 'Sốt nhẹ (37.8°C)',
            temperature: '37.8',
            isAlert: true,
            alertReason: 'Sốt nhẹ 37.8°C',
            notes: 'Test: mild fever',
          },
          hygiene: { type: 'TOILET', notes: 'Test: normal toilet' },
          note: 'Bé sốt nhẹ cần theo dõi',
        }],
      },
    }),
  });
  const saveResult = await saveRes.json();
  if (!saveResult.success) {
    console.error('FAIL: save_care returned error', saveResult);
    return;
  }
  console.log(`   Save result: ${JSON.stringify(saveResult)}`);

  // Step 3: GET roster again (simulating hard refresh)
  console.log('\n3. GET roster after save (simulating hard refresh)...');
  const getRes2 = await fetch(`${BASE}/api/education/care/bulk?courseId=${COURSE_ID}&date=${DATE}`, {
    headers: TENANT_HDR,
    cache: 'no-store',
  });
  const getRoster2 = await getRes2.json();
  const savedStudent = getRoster2.roster?.find(s => s.studentPartyId === firstStudent.studentPartyId);

  if (!savedStudent) {
    console.error('FAIL: Student not found in refreshed roster');
    return;
  }

  // Validate persisted values
  const care = savedStudent.care;
  const mealOk = care?.mealRecords?.[0]?.portion === 'HALF';
  const napOk = care?.napRecords?.quality === 'RESTLESS';
  const tempOk = care?.healthChecks?.temperature === '37.8';
  const alertOk = care?.healthChecks?.isAlert === true;
  const hygieneOk = care?.hygieneRecords?.[0]?.type === 'TOILET';

  console.log(`\n=== VALIDATION ===`);
  console.log(`   Meal portion HALF: ${mealOk ? '✅ PASS' : '❌ FAIL'} (got: ${care?.mealRecords?.[0]?.portion})`);
  console.log(`   Nap quality RESTLESS: ${napOk ? '✅ PASS' : '❌ FAIL'} (got: ${care?.napRecords?.quality})`);
  console.log(`   Temperature 37.8: ${tempOk ? '✅ PASS' : '❌ FAIL'} (got: ${care?.healthChecks?.temperature})`);
  console.log(`   isAlert true: ${alertOk ? '✅ PASS' : '❌ FAIL'} (got: ${care?.healthChecks?.isAlert})`);
  console.log(`   Hygiene TOILET: ${hygieneOk ? '✅ PASS' : '❌ FAIL'} (got: ${care?.hygieneRecords?.[0]?.type})`);

  const allPass = mealOk && napOk && tempOk && alertOk && hygieneOk;
  console.log(`\n${allPass ? '✅ Insert check passed!' : '❌ Insert check failed!'}`);

  // Step 4: POST update (modify to ALL meal, DEEP nap, 36.5 temp)
  console.log('\n4. POST save_care update with ALL meal, DEEP nap, NORMAL health...');
  const updateRes = await fetch(`${BASE}/api/education/care/bulk`, {
    method: 'POST',
    headers: TENANT_HDR,
    body: JSON.stringify({
      action: 'save_care',
      courseId: COURSE_ID,
      date: DATE,
      data: {
        records: [{
          studentPartyId: firstStudent.studentPartyId,
          meal: { portion: 'ALL', notes: 'Test: finished all meal' },
          nap: { quality: 'DEEP', notes: 'Test: slept well 120m' },
          health: {
            status: 'good',
            label: 'Bình thường',
            temperature: '36.5',
            isAlert: false,
            alertReason: '',
            notes: 'Hạ sốt, sức khỏe tốt',
          },
          hygiene: { type: 'TOILET', notes: 'Bình thường' },
          note: 'Bé đã khỏe lại',
        }],
      },
    }),
  });
  const updateResult = await updateRes.json();
  console.log(`   Update result: ${JSON.stringify(updateResult)}`);

  // Step 5: GET roster again after update
  console.log('\n5. GET roster after update (second hard refresh)...');
  const getRes3 = await fetch(`${BASE}/api/education/care/bulk?courseId=${COURSE_ID}&date=${DATE}`, {
    headers: TENANT_HDR,
    cache: 'no-store',
  });
  const getRoster3 = await getRes3.json();
  const updatedStudent = getRoster3.roster?.find(s => s.studentPartyId === firstStudent.studentPartyId);

  const care2 = updatedStudent?.care;
  const updateMealOk = care2?.mealRecords?.[0]?.portion === 'ALL';
  const updateNapOk = care2?.napRecords?.quality === 'DEEP';
  const updateTempOk = care2?.healthChecks?.temperature === '36.5';
  const updateAlertOk = care2?.healthChecks?.isAlert === false;

  console.log(`\n=== UPDATE VALIDATION ===`);
  console.log(`   Meal portion ALL: ${updateMealOk ? '✅ PASS' : '❌ FAIL'} (got: ${care2?.mealRecords?.[0]?.portion})`);
  console.log(`   Nap quality DEEP: ${updateNapOk ? '✅ PASS' : '❌ FAIL'} (got: ${care2?.napRecords?.quality})`);
  console.log(`   Temperature 36.5: ${updateTempOk ? '✅ PASS' : '❌ FAIL'} (got: ${care2?.healthChecks?.temperature})`);
  console.log(`   isAlert false: ${updateAlertOk ? '✅ PASS' : '❌ FAIL'} (got: ${care2?.healthChecks?.isAlert})`);

  const allUpdatePass = updateMealOk && updateNapOk && updateTempOk && updateAlertOk;
  console.log(`\n${allPass && allUpdatePass ? '🎉 FULL SUITE PASS: Both INSERT and UPDATE persist cleanly across hard refresh!' : '❌ UPDATE FAILED'}`);
}

run().catch(console.error);
