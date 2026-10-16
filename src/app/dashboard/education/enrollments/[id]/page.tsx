'use client';

/**
 * Bella Education — Student 360° Comprehensive Profile Workspace
 * 
 * Central Student 360° Architecture:
 * - Domain Convergence: Guardians, Enrollment History, Attendance, Health, Nutrition, Parent Comms
 * - Tabs: Tổng Quan 360° | Cá Nhân & Giám Hộ | Lịch Sử Ghi Danh | Sức Khỏe & Dinh Dưỡng | Sổ Liên Lạc
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
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  FileText, 
  ShieldCheck,
  Phone,
  Mail,
  Home,
  CreditCard,
  Clock,
  Activity,
  Award
} from 'lucide-react';

const STUDENT_360_DETAILS: Record<string, {
  id: string;
  name: string;
  nickname: string;
  dob: string;
  age: string;
  gender: string;
  className: string;
  status: string;
  guardians: Array<{ role: string; name: string; phone: string; email: string; isPrimary: boolean }>;
  enrollmentHistory: Array<{ year: string; className: string; teacher: string; status: string }>;
  healthRecord: {
    height: string;
    weight: string;
    bloodType: string;
    allergies: string;
    medicalNotes: string;
    vaccinations: string;
  };
}> = {
  'STU-001': {
    id: 'STU-001',
    name: 'Nguyễn Minh An',
    nickname: 'Bé Bi',
    dob: '15/05/2023',
    age: '3 Tuổi',
    gender: 'Nam',
    className: 'Lớp Mầm A1 — Họa Mi',
    status: 'Đang Học',
    guardians: [
      { role: 'Bố', name: 'Nguyễn Văn Hùng', phone: '0988 123 456', email: 'hung.nguyen@gmail.com', isPrimary: true },
      { role: 'Mẹ', name: 'Trần Thị Thu Thảo', phone: '0988 654 321', email: 'thao.tran@gmail.com', isPrimary: false },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm A1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai & Cô Lê Thu Trang', status: 'Đang học' },
      { year: '2025 - 2026', className: 'Lớp Nhà Trẻ N2 — Thỏ Con', teacher: 'Cô Hoàng Bích Ngọc', status: 'Hoàn thành' },
    ],
    healthRecord: {
      height: '96 cm',
      weight: '14.5 kg',
      bloodType: 'O+',
      allergies: 'Dị ứng hạt hải sản (Cần ăn chế độ riêng)',
      medicalNotes: 'Tiền sử dị ứng hải sản. Ưu tiên ăn thức ăn thanh đạm.',
      vaccinations: 'Đã hoàn thành 6 mũi vắc-xin cơ bản mầm non.',
    },
  },
};

export default function Student360Page() {
  const params = useParams();
  const studentId = (params?.id as string) || 'STU-001';
  const stu = STUDENT_360_DETAILS[studentId] || STUDENT_360_DETAILS['STU-001'];

  const [activeTab, setActiveTab] = useState<'overview' | 'guardians' | 'enrollments' | 'health' | 'messages'>('overview');

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
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
              <div className="w-14 h-14 rounded-2xl bg-primary/15 text-[var(--education-brand-ink)] flex items-center justify-center font-black text-xl shrink-0 shadow-sm">
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
                  <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
                    {stu.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                  Mã Bé: <strong className="text-slate-800 dark:text-slate-200">{stu.id}</strong> • {stu.gender} • {stu.age} ({stu.dob}) • {stu.className}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/dashboard/education/communication?student=${stu.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Sổ Liên Lạc Điện Tử</span>
            </Link>
          </div>
        </div>

        {/* Student 360 Tab Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tổng Quan 360°
          </button>
          <button
            onClick={() => setActiveTab('guardians')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'guardians'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Cá Nhân & Người Giám Hộ
          </button>
          <button
            onClick={() => setActiveTab('enrollments')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'enrollments'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Lịch Sử Ghi Danh ({stu.enrollmentHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'health'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Sức Khỏe & Dinh Dưỡng
          </button>
        </div>
      </div>

      {/* Tab Content: Overview 360 */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Baby className="w-5 h-5 text-emerald-500" />
              Tổng Quan Thông Tin Trẻ & Lớp Học
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1">
                <span className="text-slate-400 font-medium block">Lớp đang theo học:</span>
                <p className="font-extrabold text-slate-900 dark:text-white text-sm">{stu.className}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1">
                <span className="text-slate-400 font-medium block">Tỷ lệ chuyên cần tháng này:</span>
                <p className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">96% (Có mặt 20/21 ngày)</p>
              </div>
            </div>

            {/* Health Alert Exception Box */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 space-y-1.5 text-xs">
              <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Dặn dò y tế & Chế độ dinh dưỡng đặc biệt:
              </span>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                {stu.healthRecord.allergies}
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--education-brand-ink)]" />
              Người Giám Hộ Chính
            </h3>
            {stu.guardians.map((g, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 dark:text-white">{g.name} ({g.role})</span>
                  {g.isPrimary && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Liên hệ chính</span>}
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5 pt-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <a href={`tel:${g.phone}`} className="hover:underline font-bold text-emerald-600">{g.phone}</a>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Guardians */}
      {activeTab === 'guardians' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4 text-xs">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Danh Sách Người Giám Hộ & Thông Tin Liên Hệ Khẩn Cấp
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stu.guardians.map((g, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-2">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{g.name} — {g.role}</h4>
                <p className="text-slate-600 dark:text-slate-300">SĐT: <strong className="text-emerald-600">{g.phone}</strong></p>
                <p className="text-slate-600 dark:text-slate-300">Email: {g.email}</p>
                <p className="text-slate-500">Địa chỉ: 123 Nguyễn Văn Cừ, Quận 5, TP.HCM</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
