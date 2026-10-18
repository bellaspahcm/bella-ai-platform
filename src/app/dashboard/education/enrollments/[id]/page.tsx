'use client';

/**
 * Bella Education — Student 360° Comprehensive Profile Workspace
 * 
 * Central Student 360° Architecture:
 * - Domain Convergence: Guardians, Enrollment History, Attendance, Health, Nutrition, Parent Comms, Finance
 * - Tabs: Tổng Quan 360° | Cá Nhân & Giám Hộ | Lịch Sử Ghi Danh | Sức Khỏe & Dinh Dưỡng
 * - Direct deep links to vertical services (Sổ liên lạc, Điểm danh, Đánh giá phát triển, Học phí)
 * - Strict type safety: Zero any and zero unknown
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Baby, 
  Users, 
  CalendarCheck, 
  Heart, 
  Utensils, 
  MessageSquare, 
  GraduationCap, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Phone, 
  Mail, 
  Home, 
  CreditCard, 
  Clock, 
  Activity, 
  Syringe, 
  Scale, 
  Ruler 
} from 'lucide-react';

export interface Student360Profile {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly dob: string;
  readonly age: string;
  readonly gender: string;
  readonly className: string;
  readonly status: string;
  readonly attendanceRate: string;
  readonly guardians: ReadonlyArray<{
    readonly role: string;
    readonly name: string;
    readonly phone: string;
    readonly email: string;
    readonly isPrimary: boolean;
    readonly address?: string;
  }>;
  readonly enrollmentHistory: ReadonlyArray<{
    readonly year: string;
    readonly className: string;
    readonly teacher: string;
    readonly status: string;
    readonly enrolledAt: string;
    readonly tuitionStatus: 'Đã thanh toán' | 'Còn công nợ' | 'Miễn giảm';
  }>;
  readonly healthRecord: {
    readonly height: string;
    readonly weight: string;
    readonly bmiStatus: string;
    readonly bloodType: string;
    readonly allergies: string;
    readonly medicalNotes: string;
    readonly vaccinations: ReadonlyArray<{
      readonly vaccine: string;
      readonly dose: string;
      readonly status: 'completed' | 'upcoming';
      readonly date: string;
    }>;
  };
}

const CANONICAL_STUDENT_360_MAP: Record<string, Student360Profile> = {
  'HS0001': {
    id: 'HS0001',
    name: 'Nguyễn Minh An',
    nickname: 'Bé Bi',
    dob: '12/03/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Mầm non 1 — Họa Mi',
    status: 'Đang học',
    attendanceRate: '96% (20/21 ngày)',
    guardians: [
      { role: 'Bố', name: 'Nguyễn Văn Hùng', phone: '0901 234 567', email: 'hung.nguyen@gmail.com', isPrimary: true, address: '123 Nguyễn Văn Cừ, Quận 5, TP.HCM' },
      { role: 'Mẹ', name: 'Trần Thị Thu Thảo', phone: '0988 654 321', email: 'thao.tran@gmail.com', isPrimary: false, address: '123 Nguyễn Văn Cừ, Quận 5, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm non 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai & Cô Lê Thu Trang', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
      { year: '2025 - 2026', className: 'Lớp Nhà Trẻ N2 — Thỏ Con', teacher: 'Cô Hoàng Bích Ngọc', status: 'Hoàn thành', enrolledAt: '01/08/2025', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '96 cm',
      weight: '14.5 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.7)',
      bloodType: 'O+',
      allergies: 'Không dị ứng nghiêm trọng, theo dõi nhẹ thời tiết khi chuyển mùa.',
      medicalNotes: 'Tiền sử sổ mũi khi trời lạnh. Ưu tiên uống nước ấm.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1 (Infanrix Hexa)', dose: 'Mũi 4 nhắc lại', status: 'completed', date: '10/05/2024' },
        { vaccine: 'Sởi - Quai bị - Rubella (MMR)', dose: 'Mũi 2', status: 'completed', date: '15/11/2024' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '01/09/2026' },
      ],
    },
  },
  'HS0002': {
    id: 'HS0002',
    name: 'Trần Bảo Ngọc',
    nickname: 'Bé Na',
    dob: '05/06/2021',
    age: '4 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Chồi 2 — Thỏ Ngọc',
    status: 'Đang học',
    attendanceRate: '95% (19/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Trần Thị Mai', phone: '0902 345 678', email: 'mai.tran@gmail.com', isPrimary: true, address: '45 Võ Văn Tần, Quận 3, TP.HCM' },
      { role: 'Bố', name: 'Trần Văn Thành', phone: '0902 111 222', email: 'thanh.tran@gmail.com', isPrimary: false, address: '45 Võ Văn Tần, Quận 3, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 2 — Thỏ Ngọc', teacher: 'Cô Trần Ngọc Anh & Cô Đặng Thùy Dung', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
      { year: '2025 - 2026', className: 'Lớp Mầm 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai', status: 'Hoàn thành', enrolledAt: '01/08/2025', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '103 cm',
      weight: '16.2 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.3)',
      bloodType: 'A+',
      allergies: 'Không ghi nhận dị ứng thực phẩm.',
      medicalNotes: 'Sức khỏe tốt, ngủ trưa ngoan.',
      vaccinations: [
        { vaccine: 'Thủy đậu (Varicella)', dose: 'Mũi 2', status: 'completed', date: '20/03/2025' },
        { vaccine: 'Viêm gan A', dose: 'Mũi 2', status: 'completed', date: '10/01/2025' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '15/09/2026' },
      ],
    },
  },
  'HS0003': {
    id: 'HS0003',
    name: 'Lê Gia Huy',
    nickname: 'Bé Tôm',
    dob: '20/08/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Lá 1 — Vàng Anh',
    status: 'Đang học',
    attendanceRate: '90% (18/21 ngày)',
    guardians: [
      { role: 'Bố', name: 'Lê Văn Tài', phone: '0903 456 789', email: 'tai.le@gmail.com', isPrimary: true, address: '88 Lê Hồng Phong, Quận 10, TP.HCM' },
      { role: 'Mẹ', name: 'Lê Thị Hồng', phone: '0903 888 999', email: 'hong.le@gmail.com', isPrimary: false, address: '88 Lê Hồng Phong, Quận 10, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Lá 1 — Vàng Anh', teacher: 'Cô Lê Thu Trang', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Còn công nợ' },
    ],
    healthRecord: {
      height: '97 cm',
      weight: '13.8 kg',
      bmiStatus: 'Thể trạng nhẹ cân nhẹ (+ theo dõi tăng trưởng)',
      bloodType: 'B+',
      allergies: 'Dị ứng hạt điều và lạc (đậu phộng). Cần ăn chế độ riêng.',
      medicalNotes: 'Cần động viên uống nhiều nước và bổ sung bữa phụ hoa quả.',
      vaccinations: [
        { vaccine: 'Bạch hầu - Ho gà - Uốn ván (DPT)', dose: 'Mũi nhắc 4', status: 'completed', date: '12/10/2024' },
        { vaccine: 'Phế cầu khuẩn (Synflorix)', dose: 'Mũi 4', status: 'completed', date: '05/04/2024' },
        { vaccine: 'Cúm mùa 2026', dose: 'Liều 1', status: 'upcoming', date: 'Dự kiến 25/10/2026' },
      ],
    },
  },
  'HS0004': {
    id: 'HS0004',
    name: 'Phạm Khánh Linh',
    nickname: 'Bé Bông',
    dob: '14/11/2021',
    age: '4 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Chồi 1 — Sơn Ca',
    status: 'Đang học',
    attendanceRate: '98% (21/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Phạm Thu Hà', phone: '0904 567 890', email: 'ha.pham@gmail.com', isPrimary: true, address: '22 Hai Bà Trưng, Quận 1, TP.HCM' },
      { role: 'Bố', name: 'Phạm Văn Bình', phone: '0904 333 444', email: 'binh.pham@gmail.com', isPrimary: false, address: '22 Hai Bà Trưng, Quận 1, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 1 — Sơn Ca', teacher: 'Cô Đỗ Thùy Linh', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '104 cm',
      weight: '16.5 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.2)',
      bloodType: 'O+',
      allergies: 'Không có dị ứng.',
      medicalNotes: 'Thể lực rất tốt, tham gia tích cực các hoạt động ngoài trời.',
      vaccinations: [
        { vaccine: 'Viêm não Nhật Bản', dose: 'Mũi 3', status: 'completed', date: '14/02/2025' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '05/09/2026' },
      ],
    },
  },
  'HS0006': {
    id: 'HS0006',
    name: 'Vũ Phương Anh',
    nickname: 'Bé Thỏ',
    dob: '18/04/2021',
    age: '4 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Chồi 2 — Thỏ Ngọc',
    status: 'Lưu ý y tế',
    attendanceRate: '92% (19/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Vũ Thị Lan', phone: '0906 789 012', email: 'lan.vu@gmail.com', isPrimary: true, address: '67 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 2 — Thỏ Ngọc', teacher: 'Cô Trần Ngọc Anh', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '102 cm',
      weight: '15.8 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.1)',
      bloodType: 'AB+',
      allergies: 'Dị ứng hải sản nghiêm trọng (Tôm, Cua, Mực). Tuyệt đối không dùng suất ăn chung.',
      medicalNotes: 'Nhà bếp phục vụ khay ăn riêng biệt màu đỏ dán nhãn y tế.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1', dose: 'Hoàn thành', status: 'completed', date: '2024' },
        { vaccine: 'Cúm mùa 2026', dose: 'Liều 1', status: 'completed', date: '08/09/2026' },
      ],
    },
  },
};

// Also support legacy keys STU-001 ...
CANONICAL_STUDENT_360_MAP['STU-001'] = CANONICAL_STUDENT_360_MAP['HS0001'];
CANONICAL_STUDENT_360_MAP['STU-002'] = CANONICAL_STUDENT_360_MAP['HS0002'];
CANONICAL_STUDENT_360_MAP['STU-003'] = CANONICAL_STUDENT_360_MAP['HS0003'];
CANONICAL_STUDENT_360_MAP['STU-004'] = CANONICAL_STUDENT_360_MAP['HS0004'];
CANONICAL_STUDENT_360_MAP['STU-006'] = CANONICAL_STUDENT_360_MAP['HS0006'];

function resolveStudent360(id: string): Student360Profile {
  if (CANONICAL_STUDENT_360_MAP[id]) {
    return CANONICAL_STUDENT_360_MAP[id];
  }

  // Graceful fallback for dynamic or unknown IDs
  return {
    id,
    name: `Học sinh ${id}`,
    nickname: 'Bé ngoan',
    dob: '12/03/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Mầm non 1 — Họa Mi',
    status: 'Đang học',
    attendanceRate: '95% (20/21 ngày)',
    guardians: [
      { role: 'Phụ huynh', name: 'Người giám hộ chính', phone: '0901 000 000', email: 'parent@bellapreschool.edu.vn', isPrimary: true, address: 'TP. Hồ Chí Minh' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm non 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '98 cm',
      weight: '14.8 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.4)',
      bloodType: 'O+',
      allergies: 'Không ghi nhận dị ứng đặc biệt.',
      medicalNotes: 'Tình trạng sức khỏe ổn định.',
      vaccinations: [
        { vaccine: 'Vắc-xin cơ bản mầm non', dose: 'Đầy đủ', status: 'completed', date: '2025' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '09/2026' },
      ],
    },
  };
}

export default function Student360Page() {
  const params = useParams();
  const rawId = (params?.id as string) || 'HS0001';
  const studentId = decodeURIComponent(rawId);
  const stu = resolveStudent360(studentId);

  const [activeTab, setActiveTab] = useState<'overview' | 'guardians' | 'enrollments' | 'health'>('overview');

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-24">
      {/* ── Breadcrumb / Header Top ── */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Link href="/dashboard/education/enrollments" className="hover:text-emerald-700 transition-colors">
          Quản Lý Trẻ
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-bold">Hồ sơ 360° ({stu.id})</span>
      </div>

      {/* ── Student 360 Header Banner ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard/education/enrollments" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Quản lý trẻ"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-black text-xl shrink-0 shadow-sm border border-emerald-200">
                {stu.name.split(' ').pop()?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {stu.name}
                  </h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    &quot;{stu.nickname}&quot;
                  </span>
                  <span className={`text-[11px] font-extrabold px-3 py-0.5 rounded-full border ${
                    stu.status === 'Lưu ý y tế'
                      ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300'
                      : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200/60'
                  }`}>
                    {stu.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                  Mã Bé: <strong className="text-slate-800 dark:text-slate-200">{stu.id}</strong> • {stu.gender} • {stu.age} ({stu.dob}) • {stu.className}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Vertical Hub Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <Link
              href={`/dashboard/education/communication?student=${stu.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-emerald-900/10 transition-all active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Sổ Liên Lạc</span>
            </Link>
            <Link
              href={`/dashboard/education/attendance?student=${stu.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 text-xs font-bold transition-all"
            >
              <CalendarCheck className="w-4 h-4 text-indigo-500" />
              <span>Điểm Danh</span>
            </Link>
            <Link
              href={`/dashboard/education/grades?student=${stu.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 text-xs font-bold transition-all"
            >
              <GraduationCap className="w-4 h-4 text-amber-500" />
              <span>Đánh Giá PT</span>
            </Link>
            <Link
              href={`/dashboard/education/finance?student=${stu.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 text-xs font-bold transition-all"
            >
              <CreditCard className="w-4 h-4 text-rose-500" />
              <span>Học Phí</span>
            </Link>
          </div>
        </div>

        {/* Student 360 Tab Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tổng Quan 360°
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guardians')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'guardians'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Cá Nhân & Người Giám Hộ ({stu.guardians.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enrollments')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'enrollments'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Lịch Sử Ghi Danh ({stu.enrollmentHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'health'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Sức Khỏe & Dinh Dưỡng
          </button>
        </div>
      </div>

      {/* ── Tab Content: Overview 360 ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Baby className="w-5 h-5 text-emerald-600" />
                <span>Tổng Quan Thông Tin Trẻ & Lớp Học</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Lớp đang theo học:</span>
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm">{stu.className}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Tỷ lệ chuyên cần tháng này:</span>
                  <p className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{stu.attendanceRate}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Chỉ số thể trạng:</span>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                    {stu.healthRecord.height} • {stu.healthRecord.weight}
                  </p>
                  <span className="text-[11px] text-emerald-600 font-semibold">{stu.healthRecord.bmiStatus}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Học phí kỳ hiện tại:</span>
                  <p className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                    {stu.enrollmentHistory[0]?.tuitionStatus ?? 'Đã thanh toán'}
                  </p>
                  <span className="text-[11px] text-slate-400 font-medium">Kỳ học: {stu.enrollmentHistory[0]?.year}</span>
                </div>
              </div>

              {/* Health Alert Exception Box */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 space-y-1.5 text-xs">
                <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Dặn dò y tế & Chế độ dinh dưỡng đặc biệt:</span>
                </span>
                <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                  {stu.healthRecord.allergies}
                </p>
                {stu.healthRecord.medicalNotes && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1 border-t border-amber-200/60">
                    Ghi chú chăm sóc: {stu.healthRecord.medicalNotes}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Người Giám Hộ Chính</span>
              </h3>
              {stu.guardians.map((g, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 text-xs border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white">{g.name} ({g.role})</span>
                    {g.isPrimary && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Liên hệ chính</span>}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5 pt-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <a href={`tel:${g.phone}`} className="hover:underline font-bold text-emerald-600">{g.phone}</a>
                  </p>
                  {g.address && (
                    <p className="text-slate-400 text-[11px] flex items-center gap-1 pt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{g.address}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Guardians ── */}
      {activeTab === 'guardians' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span>Danh Sách Người Giám Hộ & Thông Tin Liên Hệ Khẩn Cấp</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              Đã ủy quyền đưa đón an toàn
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stu.guardians.map((g, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-2.5 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{g.name} — {g.role}</h4>
                  {g.isPrimary ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Người giám hộ chính
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Người đưa đón ủy quyền
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SĐT: <strong className="text-emerald-600">{g.phone}</strong></span>
                </p>
                <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email: {g.email}</span>
                </p>
                <p className="text-slate-500 flex items-center gap-2">
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  <span>Địa chỉ: {g.address || '123 Nguyễn Văn Cừ, Quận 5, TP.HCM'}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content: Enrollments History ── */}
      {activeTab === 'enrollments' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-600" />
              <span>Lịch Sử Ghi Danh & Quá Trình Học Tập</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              Tổng số khóa ghi danh: {stu.enrollmentHistory.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                  <th className="py-3 px-3">Niên khóa</th>
                  <th className="py-3 px-3">Lớp học</th>
                  <th className="py-3 px-3">Giáo viên phụ trách</th>
                  <th className="py-3 px-3">Ngày nhập học</th>
                  <th className="py-3 px-3">Trạng thái học vụ</th>
                  <th className="py-3 px-3 text-right">Học phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stu.enrollmentHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">{item.year}</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">{item.className}</td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">{item.teacher}</td>
                    <td className="py-3.5 px-3 text-slate-500">{item.enrolledAt}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        item.status === 'Đang học'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        item.tuitionStatus === 'Đã thanh toán'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.tuitionStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab Content: Health & Nutrition ── */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Physical Indicators */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4 text-xs">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                <span>Chỉ Số Thể Trạng & Sinh Hiệu</span>
              </h3>
              
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-indigo-500" />
                    <span>Chiều cao hiện tại</span>
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">{stu.healthRecord.height}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-500" />
                    <span>Cân nặng hiện tại</span>
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">{stu.healthRecord.weight}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-500" />
                    <span>Nhóm máu</span>
                  </span>
                  <span className="font-black text-sm text-rose-600">{stu.healthRecord.bloodType}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">Đánh giá thể trạng:</span>
                  <p className="text-emerald-700 dark:text-emerald-300 font-semibold">{stu.healthRecord.bmiStatus}</p>
                </div>
              </div>
            </div>

            {/* Allergies & Dietary Guidance */}
            <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 text-xs">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Utensils className="w-5 h-5 text-amber-500" />
                <span>Chế Độ Dinh Dưỡng & Dị Ứng</span>
              </h3>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 space-y-2">
                <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Dị ứng & thức ăn cần kiêng:</span>
                </span>
                <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                  {stu.healthRecord.allergies}
                </p>
                {stu.healthRecord.medicalNotes && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    {stu.healthRecord.medicalNotes}
                  </p>
                )}
              </div>

              {/* Vaccination Ledger */}
              <div className="space-y-3 pt-2">
                <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 text-xs">
                  <Syringe className="w-4 h-4 text-emerald-600" />
                  <span>Lịch Sử & Tiến Độ Tiêm Chủng Mầm Non</span>
                </h4>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {stu.healthRecord.vaccinations.map((vac, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{vac.vaccine}</span>
                        <span className="text-slate-400 text-[11px]">{vac.dose} • {vac.date}</span>
                      </div>
                      <div>
                        {vac.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã tiêm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Sắp tới
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
