'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft, Baby, BookOpen, CalendarCheck, CheckCircle2, Clock, CreditCard, Edit3,
  GraduationCap, Heart, MessageSquare, ShieldCheck, Users,
} from 'lucide-react';
import type { Student360ProfileData } from '@/app/api/education/enrollments/student-360.service';
import AdmissionConfirmModal from '@/app/dashboard/education/components/AdmissionConfirmModal';
import PortalAccessLink from './PortalAccessLink';
import StudentGuardians from './StudentGuardians';
import StudentEditModal from './StudentEditModal';
import StudentHealth from './StudentHealth';
import StudentDevelopment from './StudentDevelopment';
import StudentFinance from './StudentFinance';
import StudentCommunication from './StudentCommunication';

type ProfileTab = 'overview' | 'communication' | 'attendance' | 'grades'
  | 'finance' | 'guardians' | 'health' | 'enrollments';

const tabs: ReadonlyArray<{ id: ProfileTab; label: string; icon: typeof Baby }> = [
  { id: 'overview', label: 'Tổng Quan 360°', icon: Baby },
  { id: 'communication', label: 'Sổ Liên Lạc & Nhật Ký', icon: MessageSquare },
  { id: 'attendance', label: 'Điểm Danh & Đón Trả', icon: CalendarCheck },
  { id: 'grades', label: 'Đánh Giá Phát Triển', icon: GraduationCap },
  { id: 'finance', label: 'Học Phí & Khoản Thu', icon: CreditCard },
  { id: 'guardians', label: 'Cá Nhân & Người Giám Hộ', icon: Users },
  { id: 'health', label: 'Sức Khỏe & Dinh Dưỡng', icon: Heart },
  { id: 'enrollments', label: 'Lịch Sử Ghi Danh', icon: BookOpen },
];

function formatDate(value: string | null): string {
  if (!value) return 'Chưa ghi nhận';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Chưa ghi nhận' : new Intl.DateTimeFormat('vi-VN').format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function genderLabel(value: string | null): string {
  if (value === 'male') return 'Bé trai';
  if (value === 'female') return 'Bé gái';
  if (value === 'other') return 'Khác';
  return 'Chưa ghi nhận';
}

function enrollmentStatusLabel(status: 'active' | 'pending'): string {
  return status === 'active' ? 'Đang học' : 'Chờ nhập học';
}

function attendanceStatusLabel(status: 'present' | 'absent' | 'excused'): string {
  if (status === 'present') return 'Có mặt';
  if (status === 'absent') return 'Vắng';
  return 'Vắng có phép';
}

function UnavailablePanel({ title }: { title: string }) {
  return (
    <section className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-3" role="tabpanel">
      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">Chưa có dữ liệu đã xác minh trong hồ sơ này. Phần nghiệp vụ sẽ được kết nối khi có API và quyền truy cập phù hợp.</p>
    </section>
  );
}

export default function Student360LegacyLayout({
  profile, registryHref, selectedCourseId, tenantId, isAdmin = false, canViewFinance = true, onProfileUpdated,
}: {
  profile: Student360ProfileData;
  registryHref: string;
  selectedCourseId: string | null;
  tenantId: string | null;
  isAdmin?: boolean;
  canViewFinance?: boolean;
  onProfileUpdated?: (updated: Student360ProfileData) => void;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const visibleTabs = useMemo(() => tabs.filter(tab => tab.id !== 'finance' || canViewFinance), [canViewFinance]);
  const activeEnrollment = profile.enrollments.find(enrollment => enrollment.status === 'active' && enrollment.courseId === selectedCourseId)
    ?? profile.enrollments.find(enrollment => enrollment.status === 'active')
    ?? profile.enrollments[0];
  const initial = profile.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? profile.name[0]?.toUpperCase() ?? '?';
  const isBoy = profile.gender === 'male';

  return (
    <main className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-24">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Link href={registryHref} className="hover:text-emerald-700 transition-colors">Quản Lý Trẻ</Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-bold">Hồ sơ 360° ({profile.id})</span>
      </div>

      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-4">
            <Link href={registryHref} aria-label="Quay lại danh sách trẻ" className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0" title="Quay lại Quản lý trẻ">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3.5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm border ${isBoy
                ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-200'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200'}`}>{initial}</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{profile.name}</h1>
                  <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200/60">
                    {activeEnrollment ? enrollmentStatusLabel(activeEnrollment.status) : 'Chưa xác định'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                  Mã Bé: <strong className="text-slate-800 dark:text-slate-200">{profile.id}</strong> • {genderLabel(profile.gender)} • {formatDate(profile.dob)} • {activeEnrollment?.courseTitle ?? 'Chưa có lớp được xác minh'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {isAdmin && activeEnrollment?.status === 'pending' && (
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-600 text-white px-4 py-2.5 text-xs font-extrabold shadow-md hover:bg-amber-700 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />Xác Nhận Nhập Học
              </button>
            )}
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setIsEditModalOpen(true)}
              title={isAdmin ? 'Chỉnh sửa hồ sơ trẻ' : 'Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa hồ sơ trẻ'}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-extrabold shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />Chỉnh Sửa Hồ Sơ
            </button>
          </div>
        </div>

        {activeEnrollment?.status === 'pending' && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Trẻ đang ở trạng thái <strong>Chờ xác nhận nhập học</strong>. Cần xác nhận thu học phí hoặc ghi nhận công nợ để chính thức kích hoạt trạng thái đang học.</span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 transition-colors shadow-sm"
              >
                Xác nhận ngay
              </button>
            )}
          </div>
        )}

        <div role="tablist" aria-label="Hồ sơ 360°" className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {visibleTabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap ${activeTab === tab.id
              ? 'bg-[#064E3B] text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
            {tab.label}{tab.id === 'enrollments' ? ` (${profile.enrollments.length})` : ''}
          </button>)}
        </div>
      </div>

      {activeTab === 'overview' && <div role="tabpanel" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2"><Baby className="w-5 h-5 text-emerald-600" />Tổng Quan Thông Tin Trẻ &amp; Lớp Học</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ['Mã hồ sơ', profile.id], ['Họ tên', profile.name],
                ['Ngày sinh', formatDate(profile.dob)], ['Giới tính', genderLabel(profile.gender)],
                ['Lớp hiện tại', activeEnrollment?.courseTitle ?? 'Chưa được cung cấp'],
                ['Cơ sở', activeEnrollment?.branchName ?? 'Chưa được cung cấp'],
              ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900 dark:text-white">{value}</p>
              </div>)}
            </div>
          </section>
          <section className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Truy cập nhanh</h2>
            <button type="button" onClick={() => setActiveTab('attendance')} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-left text-sm font-bold">Điểm danh &amp; Đón trả</button>
            <button type="button" onClick={() => setActiveTab('guardians')} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-left text-sm font-bold">Người giám hộ</button>
            <p className="text-xs text-slate-500">Các mục chưa có dữ liệu thật hiển thị trạng thái chưa được cung cấp.</p>
          </section>
        </div>
        <StudentGuardians studentId={profile.studentId} />
        {selectedCourseId && tenantId && <PortalAccessLink tenantId={tenantId} courseId={selectedCourseId} studentPartyId={profile.partyId} />}
      </div>}

      {activeTab === 'attendance' && <section role="tabpanel" className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-indigo-500" />Sổ Điểm Danh &amp; Đón Trả An Toàn — {profile.name}</h2>
        <p className="text-xs text-slate-500">Các số dưới đây là sự kiện đã ghi nhận, không phải số ngày học hoặc tỷ lệ chuyên cần.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Tổng sự kiện', profile.attendance.totalRecords], ['Có mặt', profile.attendance.present],
            ['Vắng', profile.attendance.absent], ['Vắng có phép', profile.attendance.excused],
          ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p>
          </div>)}
        </div>
        <h3 className="text-sm font-extrabold">Lịch Sử Sự Kiện Điểm Danh</h3>
        {profile.attendance.records.length === 0
          ? <p className="text-sm text-slate-500">Chưa có sự kiện điểm danh được ghi nhận.</p>
          : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Thời điểm</th><th className="p-3">Lớp</th><th className="p-3">Trạng thái</th><th className="p-3">Mã sự kiện</th></tr></thead>
            <tbody>{profile.attendance.records.map(record => <tr key={record.id} className="border-t border-slate-100 dark:border-slate-700">
              <td className="p-3"><Clock className="inline w-4 h-4 mr-1 text-slate-400" />{formatDateTime(record.rollCallTime)}</td>
              <td className="p-3">{record.courseTitle}</td><td className="p-3">{attendanceStatusLabel(record.status)}</td><td className="p-3 font-mono text-xs">{record.id}</td>
            </tr>)}</tbody></table></div>}
      </section>}

      {activeTab === 'guardians' && <div role="tabpanel" className="space-y-6">
        <StudentGuardians studentId={profile.studentId} />
        {selectedCourseId && tenantId && <PortalAccessLink tenantId={tenantId} courseId={selectedCourseId} studentPartyId={profile.partyId} />}
      </div>}

      {activeTab === 'enrollments' && <section role="tabpanel" className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-extrabold flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-600" />Lịch Sử Ghi Danh</h2>
        {profile.enrollments.length === 0 ? <p className="text-sm text-slate-500">Chưa có lớp được xác minh.</p>
          : profile.enrollments.map(enrollment => <article key={enrollment.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-bold">{enrollment.courseTitle}</p><p className="text-xs text-slate-500">{enrollment.courseCode} · {enrollment.branchName}</p></div>
            <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold">{enrollmentStatusLabel(enrollment.status)}</span>
          </article>)}
      </section>}

      {activeTab === 'communication' && (
        <StudentCommunication studentId={profile.studentId} studentName={profile.name} />
      )}
      {activeTab === 'grades' && (
        <StudentDevelopment
          studentId={profile.studentId}
          enrollmentId={activeEnrollment?.id}
          studentName={profile.name}
        />
      )}
      {activeTab === 'finance' && canViewFinance && (
        <StudentFinance studentId={profile.studentId} studentName={profile.name} />
      )}
      {activeTab === 'finance' && !canViewFinance && (
        <UnavailablePanel title="Không có quyền truy cập thông tin tài chính" />
      )}
      {activeTab === 'health' && (
        <StudentHealth studentId={profile.studentId} studentName={profile.name} />
      )}
      <p className="text-xs text-slate-500 flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Hồ sơ hiển thị dữ liệu được API xác minh; các mục chưa kết nối không có dữ liệu mẫu.</p>
      <StudentEditModal profile={profile} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSaved={updated => onProfileUpdated?.(updated)} />
      {isConfirmModalOpen && activeEnrollment && (
        <AdmissionConfirmModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          enrollmentId={activeEnrollment.id}
          studentName={profile.name}
          studentCode={profile.id}
          className={activeEnrollment.courseTitle}
          onConfirmed={() => {
            const updatedEnrollments = profile.enrollments.map(enr =>
              enr.id === activeEnrollment.id ? { ...enr, status: 'active' as const } : enr
            );
            onProfileUpdated?.({
              ...profile,
              enrollments: updatedEnrollments,
            });
          }}
        />
      )}
    </main>
  );
}
