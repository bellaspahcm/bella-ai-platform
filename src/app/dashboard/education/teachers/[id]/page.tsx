'use client';

/**
 * Bella Education — Teacher 360° Workspace & Workforce Governance Detail Page
 * 
 * Deep Domain Features:
 * - Teacher 360° Profile Header (Identity, Tenure, Current Assignment, Workload Status)
 * - Tabbed Operational Workspace:
 *   1. Tổng Quan & Hồ Sơ (Overview & Contact)
 *   2. Bằng Cấp & Chứng Chỉ Lifecycle (Certifications, Expiry Warnings & Issuers)
 *   3. Lịch Sử Phân Công (Class Assignment Lifecycle History with Effective Dates)
 *   4. Lịch Giảng Dạy & Tải Công Việc (Weekly Schedule & 32/40h Workload Analysis)
 *   5. Đánh Giá & Năng Lực Sư Phạm (Evaluations, Reviews & Governance Metrics)
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Award,
  BookOpen,
  Calendar,
  Clock,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit,
  Download,
  UserCheck,
  GraduationCap,
  Sparkles,
  ChevronRight,
  History,
  Star,
  Check
} from 'lucide-react';

export default function TeacherDetailPage() {
  const params = useParams();
  const teacherId = (params?.id as string) || 'TEA-001';

  const [activeTab, setActiveTab] = useState<'overview' | 'certifications' | 'assignments' | 'schedule' | 'evaluations'>('overview');
  const [selectedYear, setSelectedYear] = useState('2026 - 2027');

  // Mock Teacher 360 Object
  const teacher = {
    id: teacherId,
    name: 'Cô Nguyễn Thị Mai',
    role: 'Giáo viên Chủ nhiệm Lớp Mầm A1',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
    joinedDate: '01/08/2022 (4 năm làm việc tại Bella)',
    totalExperience: '8 năm kinh nghiệm chuyên môn',
    phone: '0982 111 222',
    email: 'mai.nguyen@bellapreschool.edu.vn',
    address: 'Q. Cầu Giấy, Thành phố Hà Nội',
    currentClass: 'Lớp Mầm A1 — Họa Mi',
    workloadHours: 32,
    maxWorkloadHours: 40,
    degree: 'Cử nhân Sư phạm Mầm non - Đại học Quốc Gia Hà Nội (Tốt nghiệp loại Ưu)',
    
    certifications: [
      {
        id: 'CERT-01',
        title: 'Chứng chỉ Phương pháp Giáo dục Montessori International',
        issuer: 'Association Montessori Internationale (AMI)',
        issuedDate: '15/12/2021',
        expiryDate: '15/12/2028',
        status: 'Valid',
        isExpiringSoon: false,
      },
      {
        id: 'CERT-02',
        title: 'Chứng chỉ Sơ cứu & Y tế Cấp cứu Trẻ em Mầm non',
        issuer: 'Hội Chữ Thập Đỏ Việt Nam',
        issuedDate: '10/10/2024',
        expiryDate: '10/10/2026',
        status: 'Expiring Soon',
        isExpiringSoon: true,
      },
      {
        id: 'CERT-03',
        title: 'Chứng chỉ Tiền Tiểu học & Phát triển Ngôn ngữ Trẻ mầm non',
        issuer: 'Viện Khoa học Giáo dục Việt Nam',
        issuedDate: '20/05/2023',
        expiryDate: 'Vĩnh viễn',
        status: 'Valid',
        isExpiringSoon: false,
      },
    ],

    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Lớp Mầm A1 — Họa Mi',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '32h/tuần',
        status: 'Đang Phụ Trách',
      },
      {
        academicYear: '2025 - 2026',
        classroom: 'Lớp Mầm A2 — Sơn Ca',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2025',
        endDate: '31/05/2026',
        workload: '34h/tuần',
        status: 'Hoàn Thành',
      },
      {
        academicYear: '2024 - 2025',
        classroom: 'Lớp Chồi B1 — Thỏ Ngọc',
        role: 'Giáo viên Trợ giảng',
        startDate: '01/08/2024',
        endDate: '31/05/2025',
        workload: '30h/tuần',
        status: 'Hoàn Thành',
      },
    ],

    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Đón trẻ, Thể dục sáng & Hoạt động Montessori Lớp Mầm A1' },
      { day: 'Thứ Hai', shift: 'Chiều (14:00 - 17:00)', activity: 'Hoạt động Nhóm, Trả trẻ & Trao đổi Phụ huynh' },
      { day: 'Thứ Ba', shift: 'Sáng (07:30 - 11:30)', activity: 'Lớp Sáng tạo Nghệ thuật & Kể chuyện theo chủ đề' },
      { day: 'Thứ Ba', shift: 'Chiều (14:00 - 17:00)', activity: 'Sinh hoạt chuyên môn Khối Mầm' },
      { day: 'Thứ Tư', shift: 'Sáng (07:30 - 11:30)', activity: 'Hoạt động Ngoài trời & Trải nghiệm Giác quan' },
      { day: 'Thứ Tư', shift: 'Chiều (14:00 - 17:00)', activity: 'Rèn luyện kỹ năng tự lập & Trả trẻ' },
      { day: 'Thứ Năm', shift: 'Sáng (07:30 - 11:30)', activity: 'Khám phá Khoa học Mầm non & Montessori' },
      { day: 'Thứ Sáu', shift: 'Sáng (07:30 - 11:30)', activity: 'Tổng kết tuần, Nêu gương bé ngoan & Trả trẻ' },
    ],

    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Xuất sắc (A+)',
        evaluator: 'Ban Giám Hiệu - Cô Hiệu Trưởng Trịnh Thu Hà',
        feedback: 'Cô Mai có năng lực chuyên môn vững vàng, luôn tận tụy với trẻ. Phương pháp Montessori được áp dụng sinh động, phụ huynh đánh giá rất cao.',
        score: 96,
      },
      {
        period: 'Học kỳ II (2024-2025)',
        rating: 'Tốt (A)',
        evaluator: 'Tổ trưởng Chuyên môn Khối Mầm',
        feedback: 'Quản lý lớp học nề nếp, tích cực tham gia các hoạt động ngoại khóa của trường.',
        score: 92,
      },
    ]
  };

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/education/teachers"
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[var(--education-brand-ink)] uppercase tracking-wider">
                Hồ sơ giáo viên 360°
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-bold text-slate-500">{teacher.id}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {teacher.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer">
            <Download className="w-4 h-4 text-slate-500" />
            <span>Xuất Hồ Sơ PDF</span>
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-md transition-all cursor-pointer">
            <Edit className="w-4 h-4" />
            <span>Cập Nhật Hồ Sơ</span>
          </button>
        </div>
      </div>

      {/* ── TEACHER 360 HERO SUMMARY CARD ── */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl ${teacher.avatarBg} flex items-center justify-center font-extrabold text-2xl sm:text-3xl shrink-0 shadow-md`}>
              {teacher.name.split(' ').pop()?.[0]}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {teacher.name}
                </h2>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-[var(--education-brand-ink)] border border-primary/20">
                  {teacher.status}
                </span>
              </div>
              <p className="text-xs font-extrabold text-[var(--education-brand-ink)]">
                {teacher.role}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {teacher.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {teacher.email}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {teacher.address}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Workload & Assignment Badge */}
          <div className="w-full lg:w-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[var(--education-brand-ink)]" />
                Định Mức Tải Công Việc:
              </span>
              <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200/60">
                ● Còn Lịch Trống
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>{teacher.workloadHours} / {teacher.maxWorkloadHours} giờ/tuần</span>
              <span>{Math.round((teacher.workloadHours / teacher.maxWorkloadHours) * 100)}% tải</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(teacher.workloadHours / teacher.maxWorkloadHours) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* ── 360 NAVIGATION TABS ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tổng Quan & Hồ Sơ
          </button>
          <button
            onClick={() => setActiveTab('certifications')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'certifications'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Bằng Cấp & Chứng Chỉ ({teacher.certifications.length})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'assignments'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch Sử Phân Công Lớp
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Thời Khóa Biểu Tuần
          </button>
          <button
            onClick={() => setActiveTab('evaluations')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evaluations'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Đánh Giá Sư Phạm
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT 1: OVERVIEW & PROFILE ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[var(--education-brand-ink)]" />
              Thông Tin Trình Độ & Kinh Nghiệm Sư Phạm
            </h3>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                <span className="text-slate-400 font-medium block">Bằng cấp đào tạo chính quy:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{teacher.degree}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-400 font-medium block">Thâm niên ngành:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{teacher.totalExperience}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-400 font-medium block">Thời gian gia nhập Bella:</span>
                  <span className="font-extrabold text-[var(--education-brand-ink)]">{teacher.joinedDate}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                <span className="text-slate-400 font-medium block">Lớp phụ trách hiện tại (Năm học 2026-2027):</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{teacher.currentClass}</span>
              </div>
            </div>
          </div>

          {/* Side Info Widget */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Tuân Thủ Hồ Sơ & Pháp Lý
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-emerald-800 dark:text-emerald-300 font-bold">
                <span>Hồ sơ nhân sự chính thức</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-emerald-800 dark:text-emerald-300 font-bold">
                <span>Khám sức khỏe định kỳ năm 2026</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 text-amber-800 dark:text-amber-300 font-bold">
                <span>Gia hạn chứng chỉ Sơ cứu y tế</span>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: CERTIFICATIONS LIFECYCLE ── */}
      {activeTab === 'certifications' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--education-brand-ink)]" />
              Danh Sách Bằng Cấp & Chứng Chỉ Chuyên Môn
            </h3>
            <button className="px-4 py-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-all cursor-pointer">
              + Thêm Chứng Chỉ Mới
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teacher.certifications.map((c) => (
              <div
                key={c.id}
                className={`p-6 rounded-3xl border ${
                  c.isExpiringSoon
                    ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                    : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/60'
                } space-y-3 flex flex-col justify-between`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {c.id}
                    </span>
                    {c.isExpiringSoon ? (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                        ⚠️ Sắp hết hạn
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        ✓ Hợp lệ
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {c.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cơ quan cấp: <strong>{c.issuer}</strong>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs flex items-center justify-between text-slate-600 dark:text-slate-400 font-semibold">
                  <span>Ngày cấp: {c.issuedDate}</span>
                  <span>Hạn: <strong>{c.expiryDate}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 3: ASSIGNMENT HISTORY LIFECYCLE ── */}
      {activeTab === 'assignments' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--education-brand-ink)]" />
            Lịch Sử Quan Hệ Phân Công Giảng Dạy (Lifecycle History)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Năm Học</th>
                  <th className="p-3.5">Lớp Phụ Trách</th>
                  <th className="p-3.5">Vai Trò</th>
                  <th className="p-3.5">Thời Gian Áp Dụng</th>
                  <th className="p-3.5">Định Mức Tải</th>
                  <th className="p-3.5 rounded-r-2xl">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teacher.assignmentHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{item.academicYear}</td>
                    <td className="p-3.5 font-extrabold text-[var(--education-brand-ink)]">{item.classroom}</td>
                    <td className="p-3.5 font-semibold text-slate-700 dark:text-slate-300">{item.role}</td>
                    <td className="p-3.5 text-slate-500">{item.startDate} ➔ {item.endDate}</td>
                    <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">{item.workload}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                        item.status === 'Đang Phụ Trách' 
                          ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 4: SCHEDULE & WORKLOAD ── */}
      {activeTab === 'schedule' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--education-brand-ink)]" />
            Thời Khóa Biểu Giảng Dạy Tuần Này
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teacher.schedule.map((s, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[var(--education-brand-ink)]">{s.day}</span>
                  <span className="font-bold text-slate-500">{s.shift}</span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {s.activity}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 5: EVALUATIONS ── */}
      {activeTab === 'evaluations' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Đánh Giá Sư Phạm & Nhận Xét Từ Ban Giám Hiệu
          </h3>

          <div className="space-y-4">
            {teacher.evaluations.map((ev, idx) => (
              <div key={idx} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">{ev.period}</span>
                  <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold border border-amber-300">
                    Xếp loại: {ev.rating} ({ev.score}/100)
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 italic">
                  &quot;{ev.feedback}&quot;
                </p>
                <div className="text-slate-400 font-medium text-[11px] pt-1">
                  Người đánh giá: {ev.evaluator}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
