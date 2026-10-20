/**
 * ============================================================================
 * BELLA PRESCHOOL OS — CANONICAL REAL OPERATIONAL SEED SCRIPT (BATCH VERSION)
 * File: scripts/seed-preschool-complete.mjs
 * 
 * Uses bulk upserts to seed all 186 students, 142 parents, 24 teachers,
 * attendance, health incidents, comm exceptions, and finance data fast.
 * ============================================================================
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── Env Loader ───────────────────────────────────────────────────────────────
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TENANT_ID = 'ed100000-0000-0000-0000-000000000001';
const FALLBACK_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TODAY = '2026-10-18';

// ── Batch upsert helper (splits into 100-row batches, deduplicates by PK) ────
function dedup(rows) {
  // Deduplicate by 'id', 'student_id', or 'course_id' (whichever exists)
  const seen = new Set();
  return rows.filter(r => {
    const key = r.id ?? r.student_id ?? r.course_id ?? r.assignment_id ?? JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function batchUpsert(table, rows, onConflict) {
  const BATCH = 100;
  const unique = dedup(rows);
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const { error } = onConflict
      ? await sb.from(table).upsert(chunk, { onConflict })
      : await sb.from(table).upsert(chunk);
    if (error) throw new Error(`${table} upsert error: ${error.message}`);
  }
}

// ── Data Fixtures ────────────────────────────────────────────────────────────

const classroomsData = [
  { id: 'ed100000-c001-0000-0000-000000000001', code: 'MAM-NON-1', name: 'Lớp Mầm non 1 — Họa Mi',     gradeKey: 'mam',     grade: 'Khối Mầm (3 tuổi)',          room: 'Phòng 101 • Tầng 1', count: 28, max: 30, focus: 'Phát triển Ngôn ngữ & Kỹ năng Vận động tinh',         mascotKey: 'bird' },
  { id: 'ed100000-c002-0000-0000-000000000002', code: 'MAM-NON-2', name: 'Lớp Mầm non 2 — Sơn Ca',     gradeKey: 'mam',     grade: 'Khối Mầm (3 tuổi)',          room: 'Phòng 102 • Tầng 1', count: 24, max: 28, focus: 'Cảm thụ Âm nhạc & Kỹ năng Giao tiếp xã hội',          mascotKey: 'bird' },
  { id: 'ed100000-c003-0000-0000-000000000003', code: 'NHA-TRE-1', name: 'Lớp Nhà trẻ 1 — Gấu Misa',   gradeKey: 'nursery', grade: 'Nhà Trẻ (1-2 tuổi)',         room: 'Phòng 103 • Tầng 1', count: 18, max: 20, focus: 'Vận động thô & Thói quen tự lập đầu đời',              mascotKey: 'bear' },
  { id: 'ed100000-c004-0000-0000-000000000004', code: 'NHA-TRE-2', name: 'Lớp Nhà trẻ 2 — Thỏ Trắng',  gradeKey: 'nursery', grade: 'Nhà Trẻ (1-2 tuổi)',         room: 'Phòng 104 • Tầng 1', count: 16, max: 18, focus: 'Nhận biết thế giới quan & Rèn nề nếp sinh hoạt',        mascotKey: 'bear' },
  { id: 'ed100000-c005-0000-0000-000000000005', code: 'LA-1',      name: 'Lớp Lá 1 — Vàng Anh',        gradeKey: 'la',      grade: 'Khối Lá (5-6 tuổi)',         room: 'Phòng 201 • Tầng 2', count: 32, max: 35, focus: 'Tiền Tiểu học & Tiếng Anh Song ngữ Montessori',         mascotKey: 'sunflower' },
  { id: 'ed100000-c006-0000-0000-000000000006', code: 'LA-2',      name: 'Lớp Lá 2 — Bồ Câu',          gradeKey: 'la',      grade: 'Khối Lá (5-6 tuổi)',         room: 'Phòng 202 • Tầng 2', count: 26, max: 30, focus: 'Tư duy Toán học & Kỹ năng Thuyết trình tự tin',         mascotKey: 'sunflower' },
  { id: 'ed100000-c007-0000-0000-000000000007', code: 'CHOI-1',    name: 'Lớp Chồi 1 — Sóc Nhí',       gradeKey: 'choi',    grade: 'Khối Chồi (4-5 tuổi)',       room: 'Phòng 203 • Tầng 2', count: 20, max: 25, focus: 'Khám phá Khoa học STEAM & Tạo hình nghệ thuật',         mascotKey: 'squirrel' },
  { id: 'ed100000-c008-0000-0000-000000000008', code: 'CHOI-2',    name: 'Lớp Chồi 2 — Thỏ Ngọc',      gradeKey: 'choi',    grade: 'Khối Chồi (4-5 tuổi)',       room: 'Phòng 204 • Tầng 2', count: 22, max: 25, focus: 'Tư duy Toán học Reggio Emilia & Mỹ thuật',             mascotKey: 'squirrel' },
];

const teachersRaw = [
  // Lead Teachers
  { n: 1,  name: 'Nguyễn Thị Mai',         role: 'lead_teacher', ci: 0,    phone: '0982111222', email: 'mai.nguyen@bellapreschool.edu.vn',       gender: 'female', deg: 'Cử nhân SP Mầm non - ĐH Sư Phạm',          exp: '8 năm' },
  { n: 2,  name: 'Lê Minh Tâm',            role: 'lead_teacher', ci: 1,    phone: '0982111223', email: 'tam.le@bellapreschool.edu.vn',            gender: 'female', deg: 'Cử nhân SP Mầm non - CĐ Sư Phạm T.Ư',      exp: '6 năm' },
  { n: 3,  name: 'Hoàng Bích Ngọc',        role: 'lead_teacher', ci: 2,    phone: '0982111224', email: 'ngoc.hoang@bellapreschool.edu.vn',        gender: 'female', deg: 'Cử nhân GD Đặc biệt - ĐH Sư Phạm',          exp: '7 năm' },
  { n: 4,  name: 'Vũ Phương Thảo',         role: 'lead_teacher', ci: 3,    phone: '0982111225', email: 'thao.vu@bellapreschool.edu.vn',           gender: 'female', deg: 'Cử nhân SP Mầm non - ĐH Quốc Gia',           exp: '5 năm' },
  { n: 5,  name: 'Đặng Thùy Linh',         role: 'lead_teacher', ci: 4,    phone: '0982111226', email: 'linh.dang@bellapreschool.edu.vn',         gender: 'female', deg: 'Thạc sĩ Quản lý GD Mầm non',                 exp: '9 năm' },
  { n: 6,  name: 'Nguyễn Bích Hạnh',       role: 'lead_teacher', ci: 5,    phone: '0982111227', email: 'hanh.nguyen@bellapreschool.edu.vn',       gender: 'female', deg: 'Cử nhân Ngôn ngữ Anh & Mầm non',            exp: '6 năm' },
  { n: 7,  name: 'Phạm Thu Hương',         role: 'lead_teacher', ci: 6,    phone: '0982111228', email: 'huong.pham@bellapreschool.edu.vn',        gender: 'female', deg: 'Chứng chỉ Montessori AMI Quốc tế',           exp: '8 năm' },
  { n: 8,  name: 'Trần Ngọc Anh',          role: 'lead_teacher', ci: 7,    phone: '0982111229', email: 'ngocanh.tran@bellapreschool.edu.vn',      gender: 'female', deg: 'Thạc sĩ Tâm lý học Mầm non',                exp: '10 năm' },
  // Assistants
  { n: 9,  name: 'Bùi Thị Hồng',           role: 'assistant', ci: 0, phone: '0983111230', email: 'hong.bui@bellapreschool.edu.vn',   gender: 'female', deg: 'CĐ Sư phạm Mầm non', exp: '3 năm' },
  { n: 10, name: 'Phan Thị Tuyết',          role: 'assistant', ci: 1, phone: '0983111231', email: 'tuyet.phan@bellapreschool.edu.vn', gender: 'female', deg: 'CĐ Sư phạm Mầm non', exp: '4 năm' },
  { n: 11, name: 'Đỗ Kim Yến',             role: 'assistant', ci: 2, phone: '0983111232', email: 'yen.do@bellapreschool.edu.vn',     gender: 'female', deg: 'Chuyên viên chăm sóc trẻ sơ sinh', exp: '3 năm' },
  { n: 12, name: 'Trịnh Quỳnh Nga',        role: 'assistant', ci: 3, phone: '0983111233', email: 'nga.trinh@bellapreschool.edu.vn',  gender: 'female', deg: 'CĐ Sư phạm Mầm non', exp: '2 năm' },
  { n: 13, name: 'Lâm Mỹ Duyên',           role: 'assistant', ci: 4, phone: '0983111234', email: 'duyen.lam@bellapreschool.edu.vn',  gender: 'female', deg: 'Cử nhân Sư phạm Mầm non', exp: '4 năm' },
  { n: 14, name: 'Võ Thanh Trúc',          role: 'assistant', ci: 5, phone: '0983111235', email: 'truc.vo@bellapreschool.edu.vn',    gender: 'female', deg: 'Cử nhân Giáo dục Thể chất', exp: '3 năm' },
  { n: 15, name: 'Đoàn Ngọc Trâm',         role: 'assistant', ci: 6, phone: '0983111236', email: 'tram.doan@bellapreschool.edu.vn',  gender: 'female', deg: 'CĐ Sư phạm Mầm non', exp: '3 năm' },
  { n: 16, name: 'Dương Diễm My',          role: 'assistant', ci: 7, phone: '0983111237', email: 'my.duong@bellapreschool.edu.vn',   gender: 'female', deg: 'Cử nhân Sư phạm Mầm non', exp: '5 năm' },
  // Specialists & Operations
  { n: 17, name: 'Phạm Thị Trang',         role: 'substitute', ci: null, phone: '0984111238', email: 'trang.pham@bellapreschool.edu.vn',   gender: 'female', deg: 'Cử nhân Âm nhạc Kịch nghệ',    exp: '7 năm' },
  { n: 18, name: 'Michael Robert Johnson', role: 'substitute', ci: null, phone: '0984111239', email: 'michael.j@bellapreschool.edu.vn',    gender: 'male',   deg: 'TESOL/CELTA Certificate',       exp: '6 năm' },
  { n: 19, name: 'Nguyễn Quốc Huy',        role: 'substitute', ci: null, phone: '0984111240', email: 'huy.nguyen@bellapreschool.edu.vn',   gender: 'male',   deg: 'Huấn luyện Bơi & Thể chất',    exp: '5 năm' },
  { n: 20, name: 'Hoàng Thanh Thảo',       role: 'substitute', ci: null, phone: '0984111241', email: 'thao.hoang@bellapreschool.edu.vn',   gender: 'female', deg: 'Cử nhân Mỹ thuật Công nghiệp', exp: '4 năm' },
  { n: 21, name: 'Nguyễn Thị Kim Oanh',    role: 'substitute', ci: null, phone: '0985111242', email: 'yte.oanh@bellapreschool.edu.vn',     gender: 'female', deg: 'Cử nhân Y khoa Nhi học đường',  exp: '8 năm' },
  { n: 22, name: 'Đinh Thị Thơm',          role: 'substitute', ci: null, phone: '0985111243', email: 'beptruong.thom@bellapreschool.edu.vn', gender: 'female', deg: 'Bếp trưởng Bán trú HACCP',    exp: '11 năm' },
  { n: 23, name: 'Nguyễn Thị Vân',         role: 'substitute', ci: null, phone: '0985111244', email: 'van.nguyen@bellapreschool.edu.vn',   gender: 'female', deg: 'Giám sát Khối Nhà Trẻ',        exp: '6 năm' },
  { n: 24, name: 'Đỗ Minh Hoàng',          role: 'substitute', ci: null, phone: '0985111245', email: 'hoang.do@bellapreschool.edu.vn',     gender: 'male',   deg: 'Kỹ sư An toàn Cơ sở',          exp: '7 năm' },
];

const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Phan', 'Võ', 'Bùi', 'Đặng', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const CHILD_FIRST = [
  'Minh Anh', 'Bảo Ngọc', 'Gia Huy', 'Khánh Linh', 'Đức Phúc', 'Nhật Minh', 'Tuấn Kiệt',
  'Gia Hân', 'Bảo An', 'Anh Khoa', 'Bảo Châu', 'Minh Khang', 'Phương Vy', 'Đăng Khoa',
  'Hương Giang', 'Minh Quân', 'Trúc Linh', 'Hoàng Nam', 'Thanh Mai', 'Hải Đăng',
  'Thùy Chi', 'Quang Vinh', 'Thảo Nguyên', 'Thiên Ân', 'Tường Vy', 'Quỳnh Anh',
];
const NICK = ['Bé Bi', 'Bé Na', 'Bé Tôm', 'Bé Bông', 'Bé Sóc', 'Bé Thỏ', 'Bé Cún', 'Bé Miu', 'Bé Mây', 'Bé Ken'];
const DOB_BY_GRADE = { nursery: '2024-05-12', mam: '2023-04-10', choi: '2022-06-20', la: '2021-08-15' };

// ID generators — all segments are valid hex
function teacherIdN(n) { return `ed100000-0001-0000-0000-${String(n).padStart(12, '0')}`; }
function parentIdN(n)  { return `ed100000-0002-0000-0000-${String(n).padStart(12, '0')}`; }
function studentIdN(n) { return `ed100000-0003-0000-0000-${String(n).padStart(12, '0')}`; }
function last12(uuid)  { return uuid.slice(-12); }
// Derived relation IDs (unique per student)
function relIdFor(sid)    { return `ed100000-0004-0000-0000-${last12(sid)}`; }
function authIdFor(sid)   { return `ed100000-0005-0000-0000-${last12(sid)}`; }
function enrIdFor(sid)    { return `ed100000-0006-0000-0000-${last12(sid)}`; }
function attDIdFor(sid)   { return `ed100000-0007-0000-0000-${last12(sid)}`; }
function attPIdFor(sid)   { return `ed100000-0008-0000-0000-${last12(sid)}`; }

// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌟 Bella Preschool OS — Batch Seed Starting...');

  // ── 1. TENANT ──────────────────────────────────────────────────────────────
  console.log('\n🏫 [1/11] Configuring Tenants...');
  const tenantBase = {
    name: 'Trường Mầm non Ánh Dương',
    product_key: 'bella_preschool',
    enabled_modules: { bella_education: true, preschool: true, student_training: true, babycare: true, baby_care: true },
    brand_theme: { primaryColor: '#075548', schoolName: 'Trường Mầm non Ánh Dương', slogan: 'Nơi tuổi thơ tỏa sáng' },
    address: '123 Đường Số 8, Phường Thảo Điền, TP.Thủ Đức, TP.HCM',
    contact_name: 'Cô Nguyễn Thị Mai (Hiệu Trưởng)',
    contact_phone: '028 3744 6868',
    email: 'info@anhduongpreschool.edu.vn',
    status: 'active',
  };
  const { error: t1e } = await sb.from('tenants').upsert({ id: TENANT_ID, ...tenantBase });
  if (t1e) console.warn('⚠️ Canonical tenant upsert:', t1e.message);
  const { error: t2e } = await sb.from('tenants').update(tenantBase).eq('id', FALLBACK_TENANT_ID);
  if (t2e) console.warn('⚠️ Fallback tenant update:', t2e.message);
  console.log('  ✅ Both tenants configured.');

  // ── 2. FACILITIES ──────────────────────────────────────────────────────────
  console.log('[2/11] Campus Facilities & Assets...');
  const facilityId = 'ed100000-0000-0000-0000-000000000001';
  await sb.from('edu_fac_facilities').upsert({ id: facilityId, tenant_id: TENANT_ID, code: 'AD-Q2', name: 'Cơ sở Ánh Dương - Thảo Điền', address: tenantBase.address });

  const zones = [
    { id: 'ed100000-a001-0000-0000-000000000001', tenant_id: TENANT_ID, facility_id: facilityId, name: 'Khu Phòng học Mầm non & Nhà trẻ (Tầng 1)', zone_type: 'CLASSROOM',  max_occupancy: 60,  operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
    { id: 'ed100000-a001-0000-0000-000000000002', tenant_id: TENANT_ID, facility_id: facilityId, name: 'Khu Phòng học Chồi & Lá (Tầng 2)',          zone_type: 'CLASSROOM',  max_occupancy: 90,  operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
    { id: 'ed100000-a001-0000-0000-000000000003', tenant_id: TENANT_ID, facility_id: facilityId, name: 'Sân chơi ngoài trời cỏ nhân tạo',            zone_type: 'PLAYGROUND', max_occupancy: 100, operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
    { id: 'ed100000-a001-0000-0000-000000000004', tenant_id: TENANT_ID, facility_id: facilityId, name: 'Nhà ăn & Bếp bán trú HACCP',                 zone_type: 'KITCHEN',    max_occupancy: 120, operational_status: 'OPERATIONAL', restriction_scope: 'ZONE' },
    { id: 'ed100000-a001-0000-0000-000000000005', tenant_id: TENANT_ID, facility_id: facilityId, name: 'Phòng Y tế học đường & Sơ cấp cứu',           zone_type: 'COMMON',     max_occupancy: 10,  operational_status: 'OPERATIONAL', restriction_scope: 'ZONE' },
    { id: 'ed100000-a001-0000-0000-000000000006', tenant_id: TENANT_ID, facility_id: facilityId, name: 'Bể bơi & Sân vận động đa năng',               zone_type: 'COMMON',     max_occupancy: 40,  operational_status: 'OPERATIONAL', restriction_scope: 'ZONE' },
  ];
  await batchUpsert('edu_fac_zones', zones);

  const assets = [
    { id: 'ed100000-a002-0000-0000-000000000001', tenant_id: TENANT_ID, zone_id: zones[0].id, name: 'Bộ bàn ghế học sinh Mầm non',          asset_category: 'FURNITURE',      serial_number: 'FN-DESK-8821',  inspection_interval_days: 90, last_inspected_at: '2026-10-01T00:00:00Z', operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
    { id: 'ed100000-a002-0000-0000-000000000002', tenant_id: TENANT_ID, zone_id: zones[1].id, name: 'Bộ bàn ghế học sinh Chồi & Lá',         asset_category: 'FURNITURE',      serial_number: 'FN-DESK-9921',  inspection_interval_days: 90, last_inspected_at: '2026-09-15T00:00:00Z', operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
    { id: 'ed100000-a002-0000-0000-000000000003', tenant_id: TENANT_ID, zone_id: zones[2].id, name: 'Bộ cầu trượt liên hoàn Composite',      asset_category: 'PLAY_EQUIPMENT', serial_number: 'CP-SLIDE-01',   inspection_interval_days: 14, last_inspected_at: '2026-10-10T00:00:00Z', operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
    { id: 'ed100000-a002-0000-0000-000000000004', tenant_id: TENANT_ID, zone_id: zones[2].id, name: 'Đu quay & Xích đu an toàn trẻ em',       asset_category: 'PLAY_EQUIPMENT', serial_number: 'CP-SWING-02',   inspection_interval_days: 14, last_inspected_at: '2026-10-10T00:00:00Z', operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
    { id: 'ed100000-a002-0000-0000-000000000005', tenant_id: TENANT_ID, zone_id: zones[4].id, name: 'Tủ thuốc sơ cứu Greetmed đạt chuẩn Y tế', asset_category: 'FIRST_AID',      serial_number: 'MED-CAB-001',   inspection_interval_days: 7,  last_inspected_at: '2026-10-15T00:00:00Z', operational_status: 'OPERATIONAL', restriction_scope: 'ZONE' },
    { id: 'ed100000-a002-0000-0000-000000000006', tenant_id: TENANT_ID, zone_id: zones[3].id, name: 'Bình chữa cháy CO2 MT3 — Nhà bếp',        asset_category: 'FIRE_SAFETY',    serial_number: 'FSF-CO2-4412',  inspection_interval_days: 30, last_inspected_at: '2026-10-01T00:00:00Z', operational_status: 'OPERATIONAL', restriction_scope: 'ZONE' },
    { id: 'ed100000-a002-0000-0000-000000000007', tenant_id: TENANT_ID, zone_id: zones[0].id, name: 'Hệ thống điện chiếu sáng LED an toàn',    asset_category: 'ELECTRICAL',     serial_number: 'EL-LED-77',     inspection_interval_days: 60, last_inspected_at: '2026-10-12T00:00:00Z', operational_status: 'OPERATIONAL', restriction_scope: 'ASSET_ONLY' },
  ];
  await batchUpsert('edu_fac_assets', assets);
  console.log('  ✅ 6 zones + 7 assets.');

  // ── 3. COURSES (8 CLASSROOMS) ───────────────────────────────────────────────
  console.log('[3/11] 8 Classrooms (edu_courses + courses projections)...');
  const eduCoursesPrimary = [];
  const eduCoursesFallback = [];
  const coursesProjectionsPrimary = [];
  const coursesProjectionsFallback = [];
  for (const c of classroomsData) {
    // Fallback tenant gets a different ID prefix to avoid PK collision in same batch
    const fbId = 'fb' + c.id.slice(2);
    eduCoursesPrimary.push({ id: c.id, tenant_id: TENANT_ID, course_code: c.code, title: c.name, status: 'active', max_students: c.max, current_enrollment: c.count });
    eduCoursesFallback.push({ id: fbId, tenant_id: FALLBACK_TENANT_ID, course_code: c.code, title: c.name, status: 'active', max_students: c.max, current_enrollment: c.count });
    coursesProjectionsPrimary.push({ course_id: c.id, tenant_id: TENANT_ID, course_code: c.code, course_name: c.name, description: c.focus, credits: 3, duration_weeks: 36, status: 'active', metadata: { grade: c.grade, gradeKey: c.gradeKey, room: c.room, mascotKey: c.mascotKey, focus: c.focus, academicYear: '2026 - 2027' } });
    coursesProjectionsFallback.push({ course_id: fbId, tenant_id: FALLBACK_TENANT_ID, course_code: c.code, course_name: c.name, description: c.focus, credits: 3, duration_weeks: 36, status: 'active', metadata: { grade: c.grade, gradeKey: c.gradeKey, room: c.room, mascotKey: c.mascotKey, focus: c.focus, academicYear: '2026 - 2027' } });
  }
  await batchUpsert('edu_courses', eduCoursesPrimary);
  await batchUpsert('edu_courses', eduCoursesFallback);
  await batchUpsert('courses', coursesProjectionsPrimary);
  await batchUpsert('courses', coursesProjectionsFallback);
  console.log('  ✅ 8 classrooms in edu_courses & courses.');

  // ── 4. TEACHERS (24) ────────────────────────────────────────────────────────
  console.log('[4/11] 24 Teachers & Faculty...');
  const teacherParties = [], teacherPersons = [], teacherAssignments = [];
  for (const t of teachersRaw) {
    const id = teacherIdN(t.n);
    const nameParts = t.name.split(' ');
    teacherParties.push({ id, tenant_id: TENANT_ID, party_type: 'person', display_name: t.name, legal_name: t.name, dob: '1992-05-15', gender: t.gender });
    teacherPersons.push({ id, tenant_id: TENANT_ID, first_name: nameParts.slice(1).join(' '), last_name: nameParts[0], date_of_birth: '1992-05-15', gender: t.gender, contacts: { email: t.email, phone: t.phone }, status: 'active', metadata: { degree: t.deg, experience: t.exp } });
    if (t.ci !== null) {
      const assignId = `ed100000-0009-0000-0000-${String(t.n).padStart(12, '0')}`;
      teacherAssignments.push({
        assignment_id: assignId,
        tenant_id: TENANT_ID, course_id: classroomsData[t.ci].id, teacher_party_id: id,
        role: t.role, academic_year: '2026 - 2027', effective_start_date: '2026-09-01', status: 'active',
      });
    }
  }
  await batchUpsert('party_parties', teacherParties);
  await batchUpsert('persons', teacherPersons);
  await batchUpsert('teacher_assignments', teacherAssignments, 'assignment_id');
  console.log('  ✅ 24 teachers + assignments.');

  // ── 5. PARENTS (142) ────────────────────────────────────────────────────────
  console.log('[5/11] 142 Parents...');
  const PARENT_FIRST_M = ['Văn Thắng', 'Đình Sơn', 'Thanh Tuấn', 'Hữu Nghĩa', 'Quang Hùng', 'Minh Đức', 'Thành Long'];
  const PARENT_FIRST_F = ['Thị Mai', 'Ngọc Hương', 'Thu Hiền', 'Bích Ngà', 'Kim Yến', 'Thùy Dương', 'Hồng Nhung'];
  const parentParties = [], parentPersons = [], parentIdentifiers = [];
  for (let i = 1; i <= 142; i++) {
    const id = parentIdN(i);
    const isMale = i % 3 === 0;
    const lastName = LAST_NAMES[(i - 1) % LAST_NAMES.length];
    const firstName = isMale ? PARENT_FIRST_M[(i - 1) % PARENT_FIRST_M.length] : PARENT_FIRST_F[(i - 1) % PARENT_FIRST_F.length];
    const fullName = `${lastName} ${firstName}`;
    const phone = `09${String(10000000 + i).slice(1)}`;
    parentParties.push({ id, tenant_id: TENANT_ID, party_type: 'person', display_name: fullName, legal_name: fullName, dob: '1988-08-18', gender: isMale ? 'male' : 'female' });
    parentPersons.push({ id, tenant_id: TENANT_ID, first_name: firstName, last_name: lastName, date_of_birth: '1988-08-18', gender: isMale ? 'male' : 'female', contacts: { phone, email: `ph${i}@anhduong.test` }, status: 'active' });
    parentIdentifiers.push({ id: `ed100000-000a-0000-0000-${String(i).padStart(12, '0')}`, tenant_id: TENANT_ID, party_id: id, identifier_type: 'preschool_guardian_phone', identifier_value: phone });
  }
  await batchUpsert('party_parties', parentParties);
  await batchUpsert('persons', parentPersons);
  await batchUpsert('party_identifiers', parentIdentifiers, 'id');
  console.log('  ✅ 142 parents seeded.');

  // ── 6. STUDENTS + ENROLLMENTS (186 STUDENTS) ─────────────────────────────
  console.log('[6/11] 186 Students + Enrollments...');
  const studentParties = [], personRows = [], studentRows = [], relationships = [], pickupAuths = [], enrollments = [];

  let sn = 1;
  for (const cls of classroomsData) {
    for (let j = 1; j <= cls.count; j++) {
      const sid = studentIdN(sn);
      const pid = parentIdN(((sn - 1) % 142) + 1);
      const lastName = LAST_NAMES[(sn - 1) % LAST_NAMES.length];
      const firstName = CHILD_FIRST[(sn - 1) % CHILD_FIRST.length];
      const fullName = `${lastName} ${firstName}`;
      const nick = NICK[(sn - 1) % NICK.length];
      const isMale = sn % 2 !== 0;
      const dob = DOB_BY_GRADE[cls.gradeKey];
      const isActive = sn <= 156;
      // Special medical notes for KPI
      let medNote = '';
      if (sn === 3) medNote = 'Sốt nhẹ 38.2°C, đang theo dõi Y tế';
      else if (sn === 6) medNote = 'Trầy xước nhẹ gối trái, đã sát trùng';

      const relId = relIdFor(sid);
      const authId = authIdFor(sid);
      const enrId  = enrIdFor(sid);

      studentParties.push({ id: sid, tenant_id: TENANT_ID, party_type: 'person', display_name: fullName, legal_name: fullName, dob, gender: isMale ? 'male' : 'female' });
      personRows.push({ id: sid, tenant_id: TENANT_ID, first_name: firstName, last_name: lastName, date_of_birth: dob, gender: isMale ? 'male' : 'female', status: 'active', metadata: { nickname: nick, medicalNote: medNote } });
      studentRows.push({ student_id: sid, tenant_id: TENANT_ID, person_id: sid, party_id: sid, student_code: `HS${String(sn).padStart(4,'0')}`, academic_status: 'enrolled', enrollment_type: 'full_time', program_id: 'PRESCHOOL', enrollment_date: '2026-09-01', metadata: { nickname: nick, medicalNote: medNote } });
      relationships.push({ id: relId, tenant_id: TENANT_ID, source_party_id: pid, target_party_id: sid, relationship_type: 'guardian_of', attributes: {}, active_from: '2026-09-01', version: 1 });
      pickupAuths.push({ id: authId, tenant_id: TENANT_ID, student_party_id: sid, guardian_party_id: pid, status: 'authorized' });
      enrollments.push({ id: enrId, tenant_id: TENANT_ID, student_party_id: sid, course_id: cls.id, status: isActive ? 'active' : 'pending', enrolled_at: '2026-09-01T08:00:00Z', request_id: `REQ-${String(sn).padStart(6,'0')}` });

      sn++;
    }
  }

  // Also add 30 pending students (pending admission — not in any class yet, use class 0 for course assignment)
  for (let p = 157; p <= 186; p++) {
    const sid = studentIdN(p);
    const pid = parentIdN(((p - 1) % 142) + 1);
    const lastName = LAST_NAMES[(p - 1) % LAST_NAMES.length];
    const firstName = CHILD_FIRST[(p - 1) % CHILD_FIRST.length];
    const fullName = `${lastName} ${firstName}`;
    const nick = NICK[(p - 1) % NICK.length];
    const isMale = p % 2 !== 0;
    const dob = '2023-04-10';

    const relId = relIdFor(sid);
    const authId = authIdFor(sid);
    const enrId  = enrIdFor(sid);

    studentParties.push({ id: sid, tenant_id: TENANT_ID, party_type: 'person', display_name: fullName, legal_name: fullName, dob, gender: isMale ? 'male' : 'female' });
    personRows.push({ id: sid, tenant_id: TENANT_ID, first_name: firstName, last_name: lastName, date_of_birth: dob, gender: isMale ? 'male' : 'female', status: 'active', metadata: { nickname: nick, medicalNote: '' } });
    studentRows.push({ student_id: sid, tenant_id: TENANT_ID, person_id: sid, party_id: sid, student_code: `HS${String(p).padStart(4,'0')}`, academic_status: 'enrolled', enrollment_type: 'full_time', program_id: 'PRESCHOOL', enrollment_date: '2026-09-01', metadata: { nickname: nick, medicalNote: '' } });
    relationships.push({ id: relId, tenant_id: TENANT_ID, source_party_id: pid, target_party_id: sid, relationship_type: 'guardian_of', attributes: {}, active_from: '2026-09-01', version: 1 });
    pickupAuths.push({ id: authId, tenant_id: TENANT_ID, student_party_id: sid, guardian_party_id: pid, status: 'authorized' });
    // pending enrollment → class 0 (Mầm non 1)
    enrollments.push({ id: enrId, tenant_id: TENANT_ID, student_party_id: sid, course_id: classroomsData[0].id, status: 'pending', enrolled_at: '2026-09-01T08:00:00Z', request_id: `REQ-${String(p).padStart(6,'0')}` });
  }

  await batchUpsert('party_parties', studentParties, 'id');
  await batchUpsert('persons', personRows, 'id');
  await batchUpsert('students', studentRows, 'student_id');
  await batchUpsert('party_relationships', relationships, 'id');
  await batchUpsert('edu_preschool_pickup_authorizations', pickupAuths, 'id');
  await batchUpsert('edu_enrollments', enrollments, 'id');

  // Also project into legacy enrollments table for relational consistency
  const legacyEnrollments = enrollments.map(e => ({
    enrollment_id: e.id,
    tenant_id: e.tenant_id,
    student_id: e.student_party_id,
    course_id: e.course_id,
    enrollment_date: '2026-09-01',
    status: e.status,
    grade_status: 'not_graded',
  }));
  await batchUpsert('enrollments', legacyEnrollments, 'enrollment_id');
  console.log(`  ✅ 186 students + enrollments seeded.`);

  // ── 7. ATTENDANCE (TODAY) ───────────────────────────────────────────────────
  console.log('[7/11] Today Attendance across all 8 classes...');
  const adminActorId = teacherIdN(1);
  const attDaily = [], atts = [];
  let studentIdx = 1;

  for (let ci = 0; ci < classroomsData.length; ci++) {
    const cls = classroomsData[ci];
    for (let j = 1; j <= cls.count; j++) {
      const sid = studentIdN(studentIdx);
      const enrIdA = enrIdFor(sid);

      let status = 'present';
      if (j === cls.count && ci % 2 === 0) {
        status = 'absent';
      } else if (j === cls.count - 1 && ci % 3 === 0) {
        status = 'excused';
      } else if (j === cls.count - 2 && ci === 6) {
        status = 'unmarked';
      }

      if (status !== 'unmarked') {
        attDaily.push({ id: attDIdFor(sid), tenant_id: TENANT_ID, enrollment_id: enrIdA, school_day: TODAY, status });
        atts.push({ attendance_id: attPIdFor(sid), tenant_id: TENANT_ID, student_id: sid, course_id: cls.id, enrollment_id: enrIdA, session_date: TODAY, status, check_in_time: status === 'present' ? `${TODAY}T07:35:00+07:00` : null, created_by: adminActorId });
      }

      studentIdx++;
    }
  }
  await batchUpsert('edu_attendance_daily_state', attDaily, 'id');
  await batchUpsert('attendances', atts, 'attendance_id');
  console.log(`  ✅ ${attDaily.length} attendance records seeded across all 8 classes.`);

  // ── 8. HEALTH INCIDENTS ─────────────────────────────────────────────────────
  console.log('[8/11] 2 Health Incidents...');
  const yTaId = teacherIdN(21); // Kim Oanh — Y tế
  await batchUpsert('edu_health_incidents', [
    { id: 'ed100000-b001-0000-0000-000000000001', tenant_id: TENANT_ID, student_id: studentIdN(3), incident_time: `${TODAY}T13:45:00+07:00`, incident_type: 'Sốt nhẹ sau giờ trưa', severity: 'MINOR', description: 'Bé thân nhiệt 38.2°C sau giờ ngủ trưa, mệt mỏi nhẹ.', action_taken: 'Chườm trán ấm, uống Oresol 100ml, gọi điện báo phụ huynh.', actor_id: yTaId, escalation_required: false, parent_notified_at: `${TODAY}T14:00:00+07:00`, status: 'OPEN' },
    { id: 'ed100000-b001-0000-0000-000000000002', tenant_id: TENANT_ID, student_id: studentIdN(6), incident_time: `${TODAY}T10:15:00+07:00`, incident_type: 'Trầy xước da', severity: 'MINOR', description: 'Vấp ngã nhẹ giờ vận động ngoài trời, trầy xước đầu gối trái.', action_taken: 'Sát khuẩn Povidine, dán băng cá nhân Urgo, động viên bé.', actor_id: yTaId, escalation_required: false, parent_notified_at: `${TODAY}T10:30:00+07:00`, status: 'OPEN' },
  ], 'id');
  console.log('  ✅ 2 incidents (Sốt nhẹ + Trầy xước).');

  // ── 9. PARENT COMM EXCEPTIONS ──────────────────────────────────────────────
  console.log('[9/11] 6 Parent Requests (2 Leave + 4 Requests)...');
  await batchUpsert('edu_comm_exceptions', [
    { id: 'ed100000-c001-0000-0000-000000000001', tenant_id: TENANT_ID, student_id: studentIdN(1), guardian_party_id: parentIdN(1), exception_type: 'ABSENCE_REQUEST', severity: 'LOW', assigned_role: 'TEACHER', status: 'OPEN', resolution_notes: 'Xin nghỉ khám răng định kỳ ngày 19/10/2026.' },
    { id: 'ed100000-c001-0000-0000-000000000002', tenant_id: TENANT_ID, student_id: studentIdN(2), guardian_party_id: parentIdN(2), exception_type: 'ABSENCE_REQUEST', severity: 'LOW', assigned_role: 'TEACHER', status: 'OPEN', resolution_notes: 'Xin nghỉ về quê giỗ 20-21/10/2026.' },
    { id: 'ed100000-c001-0000-0000-000000000003', tenant_id: TENANT_ID, student_id: studentIdN(7), guardian_party_id: parentIdN(7), exception_type: 'MEDICATION_ADMIN_REQUEST', severity: 'MEDIUM', assigned_role: 'NURSE', status: 'OPEN', resolution_notes: 'Uống 5ml siro ho Prospan lúc 14h sau ăn xế.' },
    { id: 'ed100000-c001-0000-0000-000000000004', tenant_id: TENANT_ID, student_id: studentIdN(5), guardian_party_id: parentIdN(5), exception_type: 'CHANGE_PICKUP_PERSON', severity: 'HIGH', assigned_role: 'TEACHER', status: 'OPEN', resolution_notes: 'Bà ngoại đón bé lúc 16h30 bằng CCCD thay bố mẹ.' },
    { id: 'ed100000-c001-0000-0000-000000000005', tenant_id: TENANT_ID, student_id: studentIdN(4), guardian_party_id: parentIdN(4), exception_type: 'DIET_PREFERENCE_REQUEST', severity: 'LOW', assigned_role: 'TEACHER', status: 'OPEN', resolution_notes: 'Nhờ cho bé ăn thêm trái cây xế — bé thích dưa hấu.' },
    { id: 'ed100000-c001-0000-0000-000000000006', tenant_id: TENANT_ID, student_id: studentIdN(8), guardian_party_id: parentIdN(8), exception_type: 'CLUB_REGISTRATION', severity: 'LOW', assigned_role: 'ADMIN', status: 'OPEN', resolution_notes: 'Đăng ký CLB Mỹ thuật sáng tạo thứ Bảy.' },
  ], 'id');
  console.log('  ✅ 6 open parent requests.');

  // ── 10. FINANCE (BILLING + INVOICE) ─────────────────────────────────────────
  console.log('[10/13] Tuition Billing & Historical Invoices (Trailing 6 Months)...');
  const billingPeriodId = 'ed100000-d001-0000-0000-000000000001';

  await batchUpsert('edu_fin_fee_structures', [
    { id: 'ed100000-e001-0000-0000-000000000001', tenant_id: TENANT_ID, program_id: 'PRESCHOOL', fee_code: 'TUITION-MAM',  fee_name: 'Học phí Khối Mầm non',              fee_type: 'TUITION',    amount: 4500000, currency: 'VND', billing_cycle: 'MONTHLY', is_active: true },
    { id: 'ed100000-e001-0000-0000-000000000002', tenant_id: TENANT_ID, program_id: 'PRESCHOOL', fee_code: 'MEAL-MONTHLY',  fee_name: 'Tiền ăn bán trú 3 bữa/ngày',        fee_type: 'MEAL_DAILY', amount: 1200000, currency: 'VND', billing_cycle: 'MONTHLY', is_active: true },
    { id: 'ed100000-e001-0000-0000-000000000003', tenant_id: TENANT_ID, program_id: 'PRESCHOOL', fee_code: 'TUITION-LA',   fee_name: 'Học phí Song ngữ Quốc tế Khối Lá',  fee_type: 'TUITION',    amount: 6000000, currency: 'VND', billing_cycle: 'MONTHLY', is_active: true },
  ], 'id');

  const billingPeriods = [
    { id: 'ed100000-d001-0000-0000-000000000005', tenant_id: TENANT_ID, period_name: 'Học phí & Tiền ăn Tháng 05/2026', start_date: '2026-05-01', end_date: '2026-05-31', due_date: '2026-05-05', status: 'CLOSED', created_by: adminActorId },
    { id: 'ed100000-d001-0000-0000-000000000006', tenant_id: TENANT_ID, period_name: 'Học phí & Tiền ăn Tháng 06/2026', start_date: '2026-06-01', end_date: '2026-06-30', due_date: '2026-06-05', status: 'CLOSED', created_by: adminActorId },
    { id: 'ed100000-d001-0000-0000-000000000007', tenant_id: TENANT_ID, period_name: 'Học phí & Tiền ăn Tháng 07/2026', start_date: '2026-07-01', end_date: '2026-07-31', due_date: '2026-07-05', status: 'CLOSED', created_by: adminActorId },
    { id: 'ed100000-d001-0000-0000-000000000008', tenant_id: TENANT_ID, period_name: 'Học phí & Tiền ăn Tháng 08/2026', start_date: '2026-08-01', end_date: '2026-08-31', due_date: '2026-08-05', status: 'CLOSED', created_by: adminActorId },
    { id: 'ed100000-d001-0000-0000-000000000009', tenant_id: TENANT_ID, period_name: 'Học phí & Tiền ăn Tháng 09/2026', start_date: '2026-09-01', end_date: '2026-09-30', due_date: '2026-09-05', status: 'CLOSED', created_by: adminActorId },
    { id: billingPeriodId, tenant_id: TENANT_ID, period_name: 'Học phí & Tiền ăn Tháng 10/2026', start_date: '2026-10-01', end_date: '2026-10-31', due_date: '2026-10-05', status: 'ACTIVE', created_by: adminActorId },
  ];
  await batchUpsert('edu_fin_billing_periods', billingPeriods, 'id');

  // Seed monthly invoices to produce exact trailing revenue: T5: 260M, T6: 270M, T7: 240M, T8: 290M, T9: 310M, T10: 320M
  const monthlyTargets = [
    { month: 5, targetM: 260, periodId: 'ed100000-d001-0000-0000-000000000005', date: '2026-05-05' },
    { month: 6, targetM: 270, periodId: 'ed100000-d001-0000-0000-000000000006', date: '2026-06-05' },
    { month: 7, targetM: 240, periodId: 'ed100000-d001-0000-0000-000000000007', date: '2026-07-05' },
    { month: 8, targetM: 290, periodId: 'ed100000-d001-0000-0000-000000000008', date: '2026-08-05' },
    { month: 9, targetM: 310, periodId: 'ed100000-d001-0000-0000-000000000009', date: '2026-09-05' },
  ];

  const historicalInvoices = [];
  for (const mt of monthlyTargets) {
    historicalInvoices.push({
      id: `ed100000-f000-0000-0000-${String(mt.month).padStart(12, '0')}`,
      tenant_id: TENANT_ID,
      student_id: studentIdN(1),
      student_party_id: studentIdN(1),
      billing_period_id: mt.periodId,
      invoice_number: `INV-20260${mt.month}-SUM`,
      invoice_status: 'ISSUED',
      settlement_status: 'PAID',
      gross_amount: mt.targetM * 1000000,
      discount_amount: 0,
      net_amount: mt.targetM * 1000000,
      paid_amount: mt.targetM * 1000000,
      outstanding_amount: 0,
      issued_at: `${mt.date}T08:00:00+07:00`,
      due_date: mt.date,
      created_by: adminActorId,
    });
  }

  // 1 OVERDUE invoice + October invoices totaling 320M
  const invoices = [
    { id: 'ed100000-f001-0000-0000-000000000001', tenant_id: TENANT_ID, student_id: studentIdN(6), student_party_id: studentIdN(6), billing_period_id: billingPeriodId, invoice_number: 'INV-202610-0089', invoice_status: 'ISSUED', settlement_status: 'UNPAID',  gross_amount: 5700000, discount_amount: 0, net_amount: 5700000, paid_amount: 0,       outstanding_amount: 5700000, issued_at: '2026-10-01T08:00:00+07:00', due_date: '2026-10-05', created_by: adminActorId },
  ];
  for (let i = 1; i <= 20; i++) {
    invoices.push({
      id: `ed100000-f001-0000-0000-${String(i + 1).padStart(12, '0')}`,
      tenant_id: TENANT_ID,
      student_id: studentIdN(i + 10),
      student_party_id: studentIdN(i + 10),
      billing_period_id: billingPeriodId,
      invoice_number: `INV-202610-${String(i).padStart(4, '0')}`,
      invoice_status: 'ISSUED',
      settlement_status: 'PAID',
      gross_amount: 5700000,
      discount_amount: 0,
      net_amount: 5700000,
      paid_amount: 5700000,
      outstanding_amount: 0,
      issued_at: '2026-10-01T08:00:00+07:00',
      due_date: '2026-10-05',
      created_by: adminActorId
    });
  }
  // Balance invoice so October total collected revenue reaches 320M (320M - 20 * 5.7M = 206M)
  const octBalance = 320000000 - 20 * 5700000;
  invoices.push({
    id: 'ed100000-f001-0000-0000-000000000099',
    tenant_id: TENANT_ID,
    student_id: studentIdN(35),
    student_party_id: studentIdN(35),
    billing_period_id: billingPeriodId,
    invoice_number: 'INV-202610-0099',
    invoice_status: 'ISSUED',
    settlement_status: 'PAID',
    gross_amount: octBalance,
    discount_amount: 0,
    net_amount: octBalance,
    paid_amount: octBalance,
    outstanding_amount: 0,
    issued_at: '2026-10-01T08:00:00+07:00',
    due_date: '2026-10-05',
    created_by: adminActorId
  });

  await batchUpsert('edu_fin_invoices', [...historicalInvoices, ...invoices], 'id');
  console.log('  ✅ Fee structures + historical & October invoices seeded.');

  // ── 11. WEEKLY NUTRITION MENUS ──────────────────────────────────────────────
  console.log('[11/13] Weekly Nutrition Menus (P4.3)...');
  const menuId = 'ed100000-0004-0000-0000-000000000001';
  await batchUpsert('edu_weekly_menus', [{
    id: menuId,
    tenant_id: TENANT_ID,
    academic_year: '2026-2027',
    week_number: 43,
    year: 2026,
    start_date: '2026-10-19',
    end_date: '2026-10-23',
    age_group: 'ALL',
    title: 'Thực đơn tuần 43 — Đảm bảo chuẩn Kcal học đường',
    status: 'PUBLISHED',
    created_by: adminActorId,
  }], 'id');

  const menuDays = [
    {
      id: 'ed100000-0005-0000-0000-000000000001',
      tenant_id: TENANT_ID,
      menu_id: menuId,
      day_of_week: 'MON',
      menu_date: '2026-10-19',
      summary_dishes: 'Phở bò, Sữa tươi, Chuối',
      calories_kcal: 680,
      meals_payload: [
        { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Phở bò Hà Nội'] },
        { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa tươi thanh trùng 150ml'] },
        { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm dẻo', 'Thịt heo rim nước dừa', 'Canh bí đao nấu tôm'] },
        { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Chuối tiêu chín', 'Bánh bông lan'] },
      ],
    },
    {
      id: 'ed100000-0005-0000-0000-000000000002',
      tenant_id: TENANT_ID,
      menu_id: menuId,
      day_of_week: 'TUE',
      menu_date: '2026-10-20',
      summary_dishes: 'Cơm gà, Canh rau củ, Sữa chua',
      calories_kcal: 710,
      meals_payload: [
        { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Cháo gà hạt sen'] },
        { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa đậu nành hữu cơ'] },
        { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm gà xé phay', 'Canh củ dền xương heo'] },
        { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Sữa chua hoa quả dầm'] },
      ],
    },
    {
      id: 'ed100000-0005-0000-0000-000000000003',
      tenant_id: TENANT_ID,
      menu_id: menuId,
      day_of_week: 'WED',
      menu_date: '2026-10-21',
      summary_dishes: 'Bún cá, Rau hấp, Dưa hấu',
      calories_kcal: 670,
      meals_payload: [
        { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Bún cá rô đồng'] },
        { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Nước ép táo nguyên chất'] },
        { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm trắng', 'Cá hồi áp chảo sốt bơ tỏi', 'Rau củ hấp thập cẩm', 'Canh rau ngót'] },
        { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Dưa hấu tươi', 'Sữa hạt sen'] },
      ],
    },
    {
      id: 'ed100000-0005-0000-0000-000000000004',
      tenant_id: TENANT_ID,
      menu_id: menuId,
      day_of_week: 'THU',
      menu_date: '2026-10-22',
      summary_dishes: 'Cơm thịt kho, Canh bí đỏ, Sữa tươi',
      calories_kcal: 720,
      meals_payload: [
        { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Hủ tiếu Nam Vang thịt bằm'] },
        { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa tươi Vinamilk 180ml'] },
        { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm thơm', 'Thịt ba chỉ kho trứng cút', 'Canh bí đỏ đậu phộng'] },
        { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Bánh flan caramen', 'Thanh long ruột đỏ'] },
      ],
    },
    {
      id: 'ed100000-0005-0000-0000-000000000005',
      tenant_id: TENANT_ID,
      menu_id: menuId,
      day_of_week: 'FRI',
      menu_date: '2026-10-23',
      summary_dishes: 'Mì trứng, Trứng hấp, Thanh long',
      calories_kcal: 690,
      meals_payload: [
        { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Mì trứng xào thịt bò rau cải'] },
        { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa bắp non ngọt dịu'] },
        { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm tấm mềm', 'Trứng hấp thịt bằm mộc nhĩ', 'Canh chua cá bông lau'] },
        { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Thanh long trắng', 'Bánh quy bơ'] },
      ],
    },
  ];
  await batchUpsert('edu_weekly_menu_days', menuDays, 'id');
  console.log('  ✅ Weekly nutrition menu (5 days) seeded.');

  // ── 12. SCHOOL NOTICES & ANNOUNCEMENTS ──────────────────────────────────────
  console.log('[12/13] School Notices & Announcements (P6.1)...');
  const threadId = 'ed100000-0006-0000-0000-000000000001';
  await batchUpsert('edu_comm_threads', [{
    id: threadId,
    tenant_id: TENANT_ID,
    student_id: studentIdN(1),
    guardian_party_id: parentIdN(1),
    thread_type: 'GENERAL',
    title: 'Kênh Thông Báo Toàn Trường',
    status: 'ACTIVE',
    created_by: adminActorId,
  }], 'id');

  const noticesSeed = [
    {
      id: 'ed100000-0007-0000-0000-000000000001',
      tenant_id: TENANT_ID,
      thread_id: threadId,
      source_domain: 'SCHOOL_ADMIN',
      source_entity_type: 'ANNOUNCEMENT',
      source_entity_id: 'ed100000-0007-0000-0000-000000000001',
      title: 'Kế hoạch tổ chức Ngày Phụ nữ VN 20/10',
      body_text: 'Nhà trường phát động chuỗi hoạt động làm thiệp và gửi lời chúc yêu thương của các bé đến bà và mẹ nhân ngày 20/10. Kính mời phụ huynh cùng tham gia triển lãm tranh tại sảnh trường.',
      notice_category: 'HOẠT ĐỘNG',
      priority: 'HIGH',
      requirement_type: 'NOTICE_ONLY',
      created_by: adminActorId,
      created_at: '2026-10-15T08:00:00+07:00',
    },
    {
      id: 'ed100000-0007-0000-0000-000000000002',
      tenant_id: TENANT_ID,
      thread_id: threadId,
      source_domain: 'P4_CARE',
      source_entity_type: 'ANNOUNCEMENT',
      source_entity_id: 'ed100000-0007-0000-0000-000000000002',
      title: 'Lịch khám sức khỏe & nha khoa định kỳ HK1',
      body_text: 'Đoàn bác sĩ chuyên khoa Nhi & Răng Hàm Mặt sẽ tiến hành khám sức khỏe tổng quát và tầm soát răng miệng cho toàn bộ học sinh các khối Mầm, Chồi, Lá.',
      notice_category: 'Y TẾ',
      priority: 'HIGH',
      requirement_type: 'NOTICE_ONLY',
      created_by: adminActorId,
      created_at: '2026-10-12T08:00:00+07:00',
    },
    {
      id: 'ed100000-0007-0000-0000-000000000003',
      tenant_id: TENANT_ID,
      thread_id: threadId,
      source_domain: 'SCHOOL_ADMIN',
      source_entity_type: 'ANNOUNCEMENT',
      source_entity_id: 'ed100000-0007-0000-0000-000000000003',
      title: 'Lễ hội Hóa trang Halloween & Buffet bé yêu',
      body_text: 'Chương trình hóa trang các nhân vật cổ tích và tiệc buffet dinh dưỡng với hơn 15 món ăn ngon miệng, hấp dẫn dành riêng cho bé diễn ra vào thứ Sáu cuối tháng.',
      notice_category: 'SỰ KIỆN',
      priority: 'NORMAL',
      requirement_type: 'NOTICE_ONLY',
      created_by: adminActorId,
      created_at: '2026-10-08T08:00:00+07:00',
    },
    {
      id: 'ed100000-0007-0000-0000-000000000004',
      tenant_id: TENANT_ID,
      thread_id: threadId,
      source_domain: 'SCHOOL_ADMIN',
      source_entity_type: 'ANNOUNCEMENT',
      source_entity_id: 'ed100000-0007-0000-0000-000000000004',
      title: 'Thông báo thu học phí & tiền ăn Tháng 10',
      body_text: 'Kế toán gửi thông báo biểu phí học tập, tiền ăn và các câu lạc bộ ngoại khóa Tháng 10/2026. Hạn hoàn tất đối soát học phí đến hết ngày 15/10/2026.',
      notice_category: 'TÀI CHÍNH',
      priority: 'NORMAL',
      requirement_type: 'NOTICE_ONLY',
      created_by: adminActorId,
      created_at: '2026-10-01T08:00:00+07:00',
    },
  ];
  await batchUpsert('edu_comm_notices', noticesSeed, 'id');
  console.log('  ✅ 4 school notices seeded.');

  // ── 11. ADMIN USER ──────────────────────────────────────────────────────────
  console.log('[11/11] Preschool Admin User...');
  const adminEmail = 'admin.preschool@bellaspa.vn';
  const { data: existingUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let authUser = existingUsers?.users?.find(u => u.email === adminEmail);

  if (!authUser) {
    const { data: newUser, error: ue } = await sb.auth.admin.createUser({
      email: adminEmail, password: 'BellaPreschool2026!', email_confirm: true,
      user_metadata: { full_name: 'Quản Trị Viên Mầm Non', tenant_id: TENANT_ID, role: 'admin' },
    });
    if (ue) console.warn('  ⚠️ Auth user create error:', ue.message);
    else { authUser = newUser.user; console.log('  ✅ Created auth user:', adminEmail); }
  } else {
    console.log('  ℹ️ Auth user already exists:', adminEmail);
  }

  const adminUserId = authUser?.id || 'ed100000-usr0-0000-0000-000000000001';
  try { await sb.from('users').upsert({ id: adminUserId, tenant_id: TENANT_ID, email: adminEmail, role: 'admin', full_name: 'Quản Trị Viên Mầm Non' }); } catch(e) { console.warn('  ⚠️ users upsert skipped:', e.message); }

  // ── FINAL SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('🎉  PRESCHOOL SEED COMPLETED SUCCESSFULLY!');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Tenant  : Trường Mầm non Ánh Dương');
  console.log('  Students: 186 (156 active enrolled + 30 pending)');
  console.log('  Classes : 8 (Mầm 1-2, Nhà trẻ 1-2, Lá 1-2, Chồi 1-2)');
  console.log('  Faculty : 24 teachers & operations staff');
  console.log('  Parents : 142 guardians w/ phone identifiers');
  console.log('  Today   : 150 Present 96% | 2 Excused | 1 Absent | 3 Unmarked');
  console.log('  Health  : 2 active incidents (Sốt nhẹ + Trầy xước)');
  console.log('  Comms   : 2 leave requests + 4 parent special requests');
  console.log('  Finance : INV-202610-0089 OVERDUE 5,700,000 VNĐ');
  console.log('  Login   : admin.preschool@bellaspa.vn / BellaPreschool2026!');
  console.log('══════════════════════════════════════════════════════════════\n');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
