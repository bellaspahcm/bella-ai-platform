'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Heart,
  Inbox,
  RefreshCw,
  ShieldCheck,
  Utensils,
} from 'lucide-react';

interface ParentDailyAttendance {
  readonly status: string | null;
  readonly updatedAt: string | null;
}

interface ParentDailyCare {
  readonly arrivalStatus: string | null;
  readonly arrivalTime: string | null;
  readonly morningCondition: string | null;
  readonly mealRecords: readonly unknown[];
  readonly hygieneRecords: readonly unknown[];
  readonly napRecords: Record<string, unknown>;
  readonly healthChecks: Record<string, unknown>;
  readonly updatedAt: string | null;
}

interface ParentDailyHandover {
  readonly handedOver: boolean;
  readonly handoverEventId: string | null;
  readonly guardianPartyId: string | null;
  readonly pickupAuthorizationId: string | null;
  readonly handedOverAt: string | null;
  readonly handedOverBy: string | null;
}

interface ParentDailyChild {
  readonly studentPartyId: string;
  readonly studentCode: string | null;
  readonly childName: string;
  readonly courseId: string | null;
  readonly courseTitle: string | null;
  readonly enrollmentId: string | null;
  readonly attendance: ParentDailyAttendance;
  readonly care: ParentDailyCare | null;
  readonly handover: ParentDailyHandover;
}

interface ParentDailyExperience {
  readonly tenantId: string;
  readonly guardianPartyId: string;
  readonly schoolDay: string;
  readonly children: readonly ParentDailyChild[];
}

interface ParentDailyResponse {
  readonly success: boolean;
  readonly dailyExperience?: ParentDailyExperience;
  readonly error?: string;
}

function todayHoChiMinh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatTime(value: string | null): string {
  if (!value) return 'Chưa ghi nhận';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function napSummary(care: ParentDailyCare | null): string {
  if (!care || Object.keys(care.napRecords).length === 0) return 'Chưa ghi nhận';
  return typeof care.napRecords.quality === 'string' ? care.napRecords.quality : 'đã ghi nhận';
}

function careSummary(child: ParentDailyChild): string {
  const care = child.care;
  if (!care) return 'Chưa có bản ghi care hôm nay';

  return [
    `Đến lớp: ${care.arrivalStatus ?? 'chưa ghi nhận'}`,
    `Bữa ăn: ${care.mealRecords.length}`,
    `Vệ sinh: ${care.hygieneRecords.length}`,
    `Ngủ: ${napSummary(care)}`,
  ].join(' · ');
}

export default function ParentInboxPage() {
  const [schoolDay, setSchoolDay] = useState(todayHoChiMinh());
  const [dailyExperience, setDailyExperience] = useState<ParentDailyExperience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const childCount = dailyExperience?.children.length ?? 0;
  const handedOverCount = useMemo(
    () => dailyExperience?.children.filter((child) => child.handover.handedOver).length ?? 0,
    [dailyExperience],
  );

  async function loadDailyExperience(targetDay = schoolDay) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/education/parent-daily?date=${encodeURIComponent(targetDay)}`, {
        cache: 'no-store',
      });
      const payload = await response.json() as ParentDailyResponse;
      if (!response.ok || !payload.success || !payload.dailyExperience) {
        throw new Error(payload.error ?? 'Không tải được dữ liệu phụ huynh hôm nay');
      }

      setDailyExperience(payload.dailyExperience);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu phụ huynh hôm nay');
      setDailyExperience(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDailyExperience(schoolDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDateChange(value: string) {
    setSchoolDay(value);
    void loadDailyExperience(value);
  }

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-3 rounded-2xl bg-primary/10 text-[var(--education-brand-ink)] shrink-0">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Parent Daily Experience - Nhật Ký Hôm Nay
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Dữ liệu thật từ điểm danh, daily care và bàn giao đã lưu trong DB.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <CalendarDays className="h-4 w-4" />
              <input
                type="date"
                value={schoolDay}
                onChange={(event) => handleDateChange(event.target.value)}
                className="bg-transparent outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadDailyExperience()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary-hover disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 ">
            <p className="text-[11px] font-black uppercase text-[var(--education-brand-ink)]">Trẻ được phép xem</p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--education-brand-ink)]">{childCount}</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60">
            <p className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-300">Đã bàn giao</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">{handedOverCount}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80">
            <p className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">Guardian Party</p>
            <p className="mt-1 break-all text-xs font-mono text-slate-700 dark:text-slate-200">
              {dailyExperience?.guardianPartyId ?? 'Chưa tải'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          Đang tải dữ liệu phụ huynh từ backend...
        </div>
      )}

      {!loading && !error && dailyExperience?.children.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          Chưa có trẻ nào được liên kết với tài khoản phụ huynh này.
        </div>
      )}

      <div className="space-y-4">
        {dailyExperience?.children.map((child) => (
          <article
            key={child.studentPartyId}
            className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{child.childName}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {child.courseTitle ?? 'Chưa có lớp active'} · {child.studentCode ?? child.studentPartyId}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-[11px] font-mono text-slate-500 dark:text-slate-300 break-all">
                Party: {child.studentPartyId}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-[var(--education-brand-ink)]">
                  <CheckCircle2 className="h-4 w-4" />
                  Attendance
                </div>
                <p className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">
                  {child.attendance.status ?? 'Chưa điểm danh'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Cập nhật: {formatTime(child.attendance.updatedAt)}</p>
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-rose-600 dark:text-rose-300">
                  <Heart className="h-4 w-4" />
                  Daily Care
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-900 dark:text-white">
                  {careSummary(child)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Cập nhật: {formatTime(child.care?.updatedAt ?? null)}</p>
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  Handover
                </div>
                <p className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">
                  {child.handover.handedOver ? 'Đã bàn giao' : 'Chưa bàn giao'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Thời gian: {formatTime(child.handover.handedOverAt)}</p>
                {child.handover.guardianPartyId && (
                  <p className="mt-1 break-all text-[11px] font-mono text-slate-400">
                    Guardian: {child.handover.guardianPartyId}
                  </p>
                )}
              </section>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 p-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                <Utensils className="h-4 w-4" />
                DB read-back summary
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                Enrollment: {child.enrollmentId ?? 'chưa có'} · Course: {child.courseId ?? 'chưa có'} · School day: {dailyExperience.schoolDay}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm">
        <div className="flex items-start gap-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            QR, SMS/push notification, medication, temperature và billing không thuộc parent daily slice này. Trang này chỉ hiển thị dữ liệu ngày học đã được backend ghi nhận và đọc lại từ DB.
          </p>
        </div>
      </div>
    </div>
  );
}
