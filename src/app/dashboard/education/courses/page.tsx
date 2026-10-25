'use client';

// Read-only catalog; legacy non-Preschool presentation follows trusted server Product resolution.

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import type { EducationCourseDTO } from '@/platform/education/contracts/course.contract';

type CatalogListState =
  | { status: 'loading' | 'error' | 'legacy' }
  | { status: 'ready'; courses: EducationCourseDTO[] };

function isCatalogRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCatalogCourse(value: unknown): value is EducationCourseDTO {
  return isCatalogRecord(value)
    && ['id', 'tenantId', 'courseCode', 'title'].every(key => typeof value[key] === 'string' && value[key].trim().length > 0)
    && typeof value.status === 'string' && ['draft', 'active', 'archived'].includes(value.status)
    && Array.isArray(value.prerequisites) && value.prerequisites.every(code => typeof code === 'string');
}

export default function CoursesPage() {
  const [state, setState] = useState<CatalogListState>({ status: 'loading' });
  const [reloadVersion, setReloadVersion] = useState(0);
  const generation = useRef(0);
  const currentRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    const controller = new AbortController();
    currentRequest.current = controller;
    const isCurrent = () => generation.current === requestGeneration && !controller.signal.aborted;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const response = await fetch('/api/education/courses?view=catalog', { cache: 'no-store', signal: controller.signal });
        if (!isCurrent()) return;
        if (!response.ok) {
          if (response.status === 403) {
            const denial: unknown = await response.json();
            if (isCurrent() && isCatalogRecord(denial) && denial.success === false
              && denial.error === 'COURSE_CATALOG_UNSUPPORTED_PRODUCT') {
              setState({ status: 'legacy' });
              return;
            }
          }
          throw new Error('Catalog unavailable');
        }
        const data: unknown = await response.json();
        if (!isCurrent()) return;
        if (!isCatalogRecord(data) || data.success !== true || !Array.isArray(data.courses)
          || !data.courses.every(isCatalogCourse)) {
          throw new Error('Invalid catalog response');
        }
        const courses = data.courses;
        if (new Set(courses.map(course => course.id)).size !== courses.length
          || courses.some(course => course.tenantId !== courses[0]?.tenantId)) throw new Error('Invalid catalog identity');
        setState({ status: 'ready', courses });
      } catch {
        if (isCurrent()) setState({ status: 'error' });
      }
    })();
    return () => {
      controller.abort();
      generation.current += 1;
      if (currentRequest.current === controller) currentRequest.current = null;
    };
  }, [reloadVersion]);

  const reload = () => {
    currentRequest.current?.abort();
    generation.current += 1;
    setState({ status: 'loading' });
    setReloadVersion(version => version + 1);
  };
  if (state.status === 'legacy') return <LegacyCoursesPage />;

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">Danh mục khóa học</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Thông tin khóa học và điều kiện tiên quyết.</p>
        </div>
        <button type="button" onClick={reload} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">Tải lại dữ liệu</button>
      </div>
      {state.status === 'ready' ? (
        <>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Khóa học trong danh mục: {state.courses.length}</p>
          {state.courses.length === 0 ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Chưa có khóa học trong danh mục.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {state.courses.map(course => (
                <article key={course.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3">
                  <BookOpen aria-hidden="true" className="h-5 w-5 text-[var(--education-brand-ink)]" />
                  <h2 className="font-bold text-slate-900 dark:text-white"><Link href={`/dashboard/education/courses/${encodeURIComponent(course.id)}`}>{course.title}</Link></h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Mã khóa học: {course.courseCode}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Trạng thái: {course.status}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Điều kiện tiên quyết: {course.prerequisites.length ? course.prerequisites.join(', ') : 'Không có'}</p>
                </article>
              ))}
            </div>
          )}
          <p className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5 text-sm text-slate-600 dark:text-slate-300">Thông tin lớp vận hành, phòng học, sức chứa, giáo viên, học sinh, điểm danh và sức khỏe hiện chưa khả dụng trong danh mục này.</p>
        </>
      ) : <p role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite" className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-700 dark:text-slate-200">{state.status === 'loading' ? 'Đang tải danh mục khóa học…' : 'Không thể tải danh mục khóa học. Vui lòng thử lại.'}</p>}
    </div>
  );
}

function LegacyCoursesPage() {
    return (
      <div className="w-full p-6 space-y-6">
        <div className="p-8 rounded-2xl bg-white border border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Quản lý khóa học & Lớp học</h1>
          <p className="text-xs text-slate-500 mt-1">Giao diện đào tạo tiêu chuẩn cho doanh nghiệp và trung tâm.</p>
        </div>
      </div>
    );
}
