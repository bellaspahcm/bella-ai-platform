'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function RolesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?product=bella_interior&tab=permissions');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
        <ShieldCheck className="w-6 h-6 animate-pulse" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Đang chuyển hướng đến Ma trận Phân quyền & Vai trò (RBAC)...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Ma trận vai trò và quyền hạn đã được tích hợp tập trung trong Cài đặt hệ thống Bella ERP.
        </p>
      </div>
      <Link
        href="/dashboard/settings?product=bella_interior&tab=permissions"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
      >
        Mở Ma trận Phân quyền <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
