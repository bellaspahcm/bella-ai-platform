'use client';

import CanonicalClassroomCatalog from './CanonicalClassroomCatalog';

export default function CoursesPage() {
  return <CanonicalClassroomCatalog legacy={<LegacyCoursesPage />} />;
}

function LegacyCoursesPage() {
  return (
    <div className="w-full p-6 space-y-6">
      <div className="p-8 rounded-2xl bg-white border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Quản lý khóa học &amp; Lớp học</h1>
        <p className="text-xs text-slate-500 mt-1">Giao diện đào tạo tiêu chuẩn cho doanh nghiệp và trung tâm.</p>
      </div>
    </div>
  );
}
