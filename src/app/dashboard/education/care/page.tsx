'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Heart,
  Loader2,
  Moon,
  RefreshCcw,
  ShieldAlert,
  Utensils,
  Waves,
} from 'lucide-react';

type CourseOption = {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive' | 'archived';
};

type DailyCareRecord = {
  arrivalStatus: 'PRESENT' | 'ABSENT' | 'LATE' | null;
  mealRecords: unknown[];
  hygieneRecords: unknown[];
  napRecords: Record<string, unknown>;
  updatedAt: string;
};

type CareRosterStudent = {
  enrollmentId: string;
  studentPartyId: string;
  studentCode: string | null;
  name: string;
  gender: string | null;
  dob: string | null;
  care: DailyCareRecord | null;
};

type CareAction = 'arrival' | 'meal' | 'hygiene' | 'nap';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getActionLabel(action: CareAction): string {
  switch (action) {
    case 'arrival':
      return 'Đến lớp';
    case 'meal':
      return 'Ăn đủ';
    case 'hygiene':
      return 'Vệ sinh';
    case 'nap':
      return 'Ngủ tốt';
  }
}

function careSummary(student: CareRosterStudent): string {
  const care = student.care;
  if (!care) return 'Chưa có ghi nhận chăm sóc hôm nay';

  const parts = [
    care.arrivalStatus ? `Đầu ngày: ${care.arrivalStatus}` : null,
    care.mealRecords.length > 0 ? `Bữa ăn: ${care.mealRecords.length}` : null,
    care.hygieneRecords.length > 0 ? `Vệ sinh: ${care.hygieneRecords.length}` : null,
    Object.keys(care.napRecords).length > 0 ? 'Giấc ngủ: đã ghi nhận' : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Chưa có ghi nhận chăm sóc hôm nay';
}

export default function CarePage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [roster, setRoster] = useState<CareRosterStudent[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setError(null);

    try {
      const response = await fetch('/api/education/courses', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Không tải được danh sách lớp');
      }

      const activeCourses: CourseOption[] = (payload.classrooms ?? [])
        .filter((course: CourseOption) => course.status === 'active')
        .map((course: CourseOption) => ({
          id: course.id,
          name: course.name,
          code: course.code,
          status: course.status,
        }));

      setCourses(activeCourses);
      setSelectedCourseId((current) => current || activeCourses[0]?.id || '');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không tải được danh sách lớp';
      setError(message);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const loadRoster = useCallback(async () => {
    if (!selectedCourseId || !selectedDate) {
      setRoster([]);
      return;
    }

    setLoadingRoster(true);
    setError(null);

    try {
      const params = new URLSearchParams({ courseId: selectedCourseId, date: selectedDate });
      const response = await fetch(`/api/education/care/bulk?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Không tải được dữ liệu chăm sóc');
      }

      setRoster(payload.roster ?? []);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không tải được dữ liệu chăm sóc';
      setError(message);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedCourseId, selectedDate]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  async function recordCare(student: CareRosterStudent, action: CareAction) {
    if (!selectedCourseId) return;

    const key = `${student.studentPartyId}:${action}`;
    setSavingKey(key);
    setError(null);
    setSuccess(null);

    const data = (() => {
      switch (action) {
        case 'arrival':
          return {
            arrivals: [{ studentPartyId: student.studentPartyId, status: 'PRESENT', condition: 'GOOD' }],
          };
        case 'meal':
          return {
            mealType: 'LUNCH',
            students: [{ studentPartyId: student.studentPartyId, portion: 'ALL' }],
          };
        case 'hygiene':
          return {
            hygieneEntries: [{ studentPartyId: student.studentPartyId, type: 'TOILET' }],
          };
        case 'nap':
          return {
            napEntries: [{ studentPartyId: student.studentPartyId, quality: 'DEEP' }],
          };
      }
    })();

    try {
      const response = await fetch('/api/education/care/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          courseId: selectedCourseId,
          date: selectedDate,
          data,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.result?.exceptions?.[0]?.errorMessage || 'Ghi nhận chăm sóc thất bại');
      }

      await loadRoster();
      setSuccess(`${getActionLabel(action)} đã được lưu cho ${student.name}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Ghi nhận chăm sóc thất bại';
      setError(message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-3 rounded-2xl bg-primary/10 text-[var(--education-brand-ink)] shrink-0">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Care Command Center — Hôm Nay
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Ghi nhận chăm sóc thật theo lớp, học sinh canonical và dữ liệu đọc lại từ DB.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(220px,1fr)_auto_auto] gap-3">
            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              disabled={loadingCourses}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white"
            >
              {courses.length === 0 ? (
                <option value="">Chưa có lớp active</option>
              ) : courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white"
            />
            <button
              type="button"
              onClick={() => void loadRoster()}
              disabled={!selectedCourseId || loadingRoster}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-extrabold disabled:opacity-50"
            >
              {loadingRoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Làm mới
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60">
            <p className="text-[11px] font-extrabold uppercase text-slate-500">Lớp thật</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white truncate">
              {selectedCourse?.name ?? 'Chưa chọn'}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80">
            <p className="text-[11px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300">Học sinh roster</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-900 dark:text-emerald-200">{roster.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80">
            <p className="text-[11px] font-extrabold uppercase text-indigo-700 dark:text-indigo-300">Đã có care record</p>
            <p className="mt-1 text-lg font-extrabold text-indigo-900 dark:text-indigo-200">
              {roster.filter((student) => student.care).length}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80">
            <p className="text-[11px] font-extrabold uppercase text-amber-700 dark:text-amber-300">Temperature</p>
            <p className="mt-1 text-sm font-bold text-amber-900 dark:text-amber-200">Chưa có input UI trong slice này</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {success}
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Danh sách chăm sóc theo lớp</h2>
            <p className="text-xs text-slate-500 mt-1">
              Dữ liệu đến từ enrollment canonical: edu_enrollments.student_party_id → party_parties.
            </p>
          </div>
          {loadingRoster && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
        </div>

        {roster.length === 0 ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">
            {selectedCourseId ? 'Lớp này chưa có học sinh enrolled hoặc chưa tải được roster.' : 'Chọn một lớp active để bắt đầu.'}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-2xl">Học sinh</th>
                  <th className="p-3">Party ID</th>
                  <th className="p-3">Care hôm nay</th>
                  <th className="p-3 rounded-r-2xl text-right">Ghi nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {roster.map((student) => (
                  <tr key={student.studentPartyId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3">
                      <div className="font-extrabold text-slate-900 dark:text-white">{student.name}</div>
                      <div className="text-xs text-slate-500">{student.studentCode ?? 'Chưa có mã học sinh'}</div>
                    </td>
                    <td className="p-3">
                      <code className="text-[11px] font-bold text-slate-500 break-all">{student.studentPartyId}</code>
                    </td>
                    <td className="p-3">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{careSummary(student)}</div>
                      {student.care?.updatedAt && (
                        <div className="mt-1 text-[11px] text-slate-400">
                          Cập nhật: {new Date(student.care.updatedAt).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {([
                          ['arrival', Check],
                          ['meal', Utensils],
                          ['hygiene', Waves],
                          ['nap', Moon],
                        ] as const).map(([action, Icon]) => {
                          const key = `${student.studentPartyId}:${action}`;
                          return (
                            <button
                              key={action}
                              type="button"
                              onClick={() => void recordCare(student, action)}
                              disabled={savingKey !== null}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                            >
                              {savingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                              {getActionLabel(action)}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Medication & Parent Digest</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Medication safety service và Parent Digest hiện được giữ nguyên. Slice này chỉ hoàn tất daily care truth cho roster canonical;
              không publish digest và không tạo medication authorization mới.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
