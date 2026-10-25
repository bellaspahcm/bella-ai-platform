import Link from 'next/link';

// Owner-approved MVP containment: this entry imports no data or mutation adapter.
export default function UnavailablePreschoolWorkspace() {
  return (
    <section className="p-6 space-y-4" aria-labelledby="held-workspace-heading">
      <h1 id="held-workspace-heading" className="text-2xl font-bold">Quản lý giáo viên</h1>
      <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Chưa mở trong MVP Preschool</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">Hồ sơ và phân công giáo viên chưa mở trong MVP Preschool. Danh sách mẫu đã được gỡ; chưa thể tạo hồ sơ hoặc phân công giáo viên từ màn hình này.</p>
      <Link href="/dashboard/education/courses" className="inline-block font-semibold underline">Về danh sách lớp</Link>
    </section>
  );
}
