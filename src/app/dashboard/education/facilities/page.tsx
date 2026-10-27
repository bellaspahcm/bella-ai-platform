'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Clock3,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

type FacilitiesTab = 'OVERVIEW' | 'SPACES' | 'ASSETS' | 'INSPECTIONS' | 'MAINTENANCE';

const tabs: ReadonlyArray<{ id: FacilitiesTab; label: string; icon: typeof Activity }> = [
  { id: 'OVERVIEW', label: 'Tổng Quan Facilities', icon: Activity },
  { id: 'SPACES', label: 'Không Gian & Zone Availability', icon: Building2 },
  { id: 'ASSETS', label: 'Danh Mục Tài Sản & QR', icon: QrCode },
  { id: 'INSPECTIONS', label: 'Kiểm Định An Toàn & Sub-Jobs', icon: ShieldAlert },
  { id: 'MAINTENANCE', label: 'Work Orders & Exception Work Queue', icon: Wrench },
];

const unavailable = 'Chưa được cung cấp';

function ValueCard({ title, icon, children }: {
  title: string;
  icon: typeof Activity;
  children: ReactNode;
}) {
  const Icon = icon;
  return (
    <section className="p-5 bg-background border border-border rounded-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h2>
        <Icon aria-hidden="true" className="text-muted-foreground" size={22} />
      </div>
      <div className="mt-2 text-xl font-bold text-foreground">—</div>
      <p className="text-xs text-muted-foreground mt-2">{children}</p>
    </section>
  );
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return <p className="p-8 text-center text-muted-foreground text-sm">{children}</p>;
}

export default function FacilitiesPage() {
  const [activeTab, setActiveTab] = useState<FacilitiesTab>('OVERVIEW');

  return (
    <div className="preschool-ui min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/education" aria-label="Quay lại Giáo dục" className="p-2 bg-background hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="preschool-brand-heading text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--education-brand-ink)]">
                Cơ sở vật chất &amp; Tài sản
              </h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1 ml-11">
              Quản lý thiết bị, bảo trì, an toàn và kiểm định định kỳ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
              <ShieldCheck size={14} aria-hidden="true" /> {unavailable}
            </span>
            <button
              type="button"
              disabled
              title="Chưa có nguồn dữ liệu cơ sở vật chất được kết nối"
              className="p-2.5 bg-background text-muted-foreground rounded-lg border border-border transition flex items-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={14} aria-hidden="true" /> Làm mới
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ValueCard title="Trạng Thái Thiết Bị Cá Thể" icon={ShieldCheck}>Mã QR: {unavailable}</ValueCard>
          <ValueCard title="Zone Availability (P3/P8)" icon={Building2}>Read-Only ZoneAvailabilityContract</ValueCard>
          <ValueCard title="Work Order Bảo Trì Active" icon={Wrench}>Trạng thái: {unavailable}</ValueCard>
          <ValueCard title="Cảnh Báo Safety Work Queue" icon={AlertTriangle}>SAFETY_DEFECT: {unavailable}</ValueCard>
        </div>

        <nav aria-label="Quản lý cơ sở vật chất" className="flex border-b border-border gap-8 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              data-testid={`tab-${id.toLowerCase()}`}
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => setActiveTab(id)}
              className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${activeTab === id
                ? 'border-primary/20 text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>

        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <section className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-xl border border-border">
              <span className="text-sm font-semibold text-foreground">Thao Tác Khởi Tạo &amp; Kiểm Định An Toàn Nhanh</span>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled title="Chưa có API và contract tạo dữ liệu tài sản được xác nhận" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60">
                  <Plus size={16} aria-hidden="true" /> Khởi Tạo Cơ Sở Vật Chất Mẫu
                </button>
                <button type="button" disabled title="Chưa có API và contract ghi nhận sự cố được xác nhận" className="px-4 py-2 bg-rose-600 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-lg shadow-rose-950 disabled:cursor-not-allowed disabled:opacity-60">
                  <AlertTriangle size={16} aria-hidden="true" /> Báo Cáo Sự Cố An Toàn (FAIL_CRITICAL)
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-background border border-border rounded-2xl p-6 space-y-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <QrCode className="text-[var(--education-brand-ink)]" size={18} aria-hidden="true" /> Chi Tiết Thiết Bị Giám Sát Cá Thể
                </h2>
                <EmptyPanel>Chưa có dữ liệu thiết bị đã xác minh.</EmptyPanel>
              </section>

              <section className="bg-background border border-border rounded-2xl p-6 space-y-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <Wrench className="text-amber-700 dark:text-amber-400" size={18} aria-hidden="true" /> Quy Trình Phục Hồi An Toàn (Safety Restoration Loop)
                </h2>
                <div className="space-y-3">
                  <div className="p-3 bg-background rounded-xl border border-border text-xs space-y-1">
                    <span className="text-muted-foreground">Bước 1: Hoàn thành sửa chữa bảo trì</span>
                    <button type="button" disabled title="Chưa có API hoàn tất Work Order" className="w-full mt-1.5 py-2 bg-amber-600 text-white rounded-lg font-medium transition text-xs disabled:cursor-not-allowed disabled:opacity-60">
                      Hoàn Thành Work Order Bảo Trì (COMPLETED ➔ UNDER_INSPECTION)
                    </button>
                  </div>
                  <div className="p-3 bg-background rounded-xl border border-border text-xs space-y-1">
                    <span className="text-muted-foreground">Bước 2: Kiểm định an toàn độc lập (Safety Re-Inspection)</span>
                    <button type="button" disabled title="Chưa có API kiểm định được xác nhận" className="w-full mt-1.5 py-2 bg-emerald-600 text-white rounded-lg font-medium transition text-xs disabled:cursor-not-allowed disabled:opacity-60">
                      Kiểm Định An Toàn Đạt Chuẩn (PASS ➔ OPERATIONAL)
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'SPACES' && (
          <section className="bg-background border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="text-[var(--education-brand-ink)]" size={20} aria-hidden="true" /> Cấu Trúc Không Gian &amp; Contract Zone Availability
            </h2>
            <EmptyPanel>Chưa có dữ liệu khu vực đã xác minh.</EmptyPanel>
          </section>
        )}

        {activeTab === 'ASSETS' && (
          <section className="bg-background border border-border rounded-2xl overflow-hidden">
            <h2 className="p-4 border-b border-border font-semibold text-sm text-foreground">Danh Mục Tài Sản Cá Thể &amp; QR Code Identity</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-background text-xs text-muted-foreground uppercase border-b border-border">
                  <tr><th className="px-6 py-3">Mã Asset / QR</th><th className="px-6 py-3">Tên Thiết Bị</th><th className="px-6 py-3">Phân Loại</th><th className="px-6 py-3">Trạng Thái Vận Hành</th><th className="px-6 py-3">Phạm Vi Hạn Chế</th></tr>
                </thead>
                <tbody><tr><td colSpan={5}><EmptyPanel>Chưa có danh mục tài sản đã xác minh.</EmptyPanel></td></tr></tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'INSPECTIONS' && (
          <section className="bg-background border border-border rounded-2xl overflow-hidden p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <ShieldAlert className="text-rose-700 dark:text-rose-400" size={20} aria-hidden="true" /> Nhật Ký Kiểm Định An Toàn &amp; Evidence Log
            </h2>
            <EmptyPanel>Chưa có nhật ký kiểm định đã xác minh.</EmptyPanel>
          </section>
        )}

        {activeTab === 'MAINTENANCE' && (
          <div className="space-y-6">
            <section className="bg-background border border-border rounded-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Clock3 className="text-rose-700 dark:text-rose-400" size={20} aria-hidden="true" /> Platform Candidate Exception Work Queue Engine (#3 Reuse)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Hiển thị cảnh báo an toàn khi dữ liệu và contract Work Queue được kết nối</p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground border border-border px-3 py-1 rounded-full font-mono">Cross-Domain Bridge P9 ➔ Work Queue</span>
              </div>
              <EmptyPanel>Chưa có dữ liệu Work Order hoặc cảnh báo đã xác minh.</EmptyPanel>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
