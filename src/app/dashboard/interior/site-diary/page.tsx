import React from 'react';
import type { Metadata } from 'next';
import SiteDiaryPwaView from '@/components/interior/SiteDiaryPwaView';

export const metadata: Metadata = {
  title: 'Nhật Ký Giám Sát Hiện Trường PWA | Bella Interior OS',
  description: 'Ứng dụng PWA giám sát công trình, ghi nhật ký hàng ngày, tải ảnh lên Cloudflare R2 và đồng bộ hệ thống.',
};

export default function SiteDiaryDashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xl">📲</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            Bạn đang xem trong Dashboard. Khi dùng trên điện thoại tại hiện trường, có thể mở chế độ App Toàn Màn Hình.
          </span>
        </div>
        <a
          href="/site-pwa"
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap transition"
        >
          Mở App Toàn Màn Hình ↗
        </a>
      </div>

      <SiteDiaryPwaView standaloneMode={false} />
    </div>
  );
}
