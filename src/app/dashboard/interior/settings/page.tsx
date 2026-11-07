'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, ArrowRight } from 'lucide-react';

export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?product=bella_interior');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
        <Settings className="w-6 h-6 animate-pulse" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Đang chuyển hướng đến Cài đặt Doanh nghiệp Bella Interior...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Cài đặt hệ thống, giao diện, lương thưởng và quy tắc bản vẽ đã được hợp nhất trong Cài đặt chung Bella ERP.
        </p>
      </div>
      <Link
        href="/dashboard/settings?product=bella_interior"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
      >
        Mở Cài đặt Doanh nghiệp <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
