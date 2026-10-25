import Link from 'next/link';

// Owner-approved MVP containment: this entry imports no data or mutation adapter.
export default function UnavailablePreschoolWorkspace() {
  return (
    <section className="p-6 space-y-4" aria-labelledby="held-workspace-heading">
      <h1 id="held-workspace-heading" className="text-2xl font-bold">Cơ sở vật chất</h1>
      <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Chưa mở trong MVP Preschool</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">Quản lý tài sản, bảo trì và kiểm định an toàn chưa mở trong MVP Preschool. Không có dữ liệu mẫu hoặc thao tác tạo, xóa hay cập nhật tài sản tại đây.</p>
      <Link href="/dashboard/education/courses" className="inline-block font-semibold underline">Về danh sách lớp</Link>
    </section>
  );
}
