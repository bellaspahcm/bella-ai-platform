'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';

export default function UsersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?product=bella_interior&tab=staff');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
        <Users className="w-6 h-6 animate-pulse" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Đang chuyển hướng đến Quản lý Nhân sự & Đội ngũ Dự án...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Hệ thống tài khoản và phân quyền người dùng đã được hợp nhất vào Cài đặt hệ thống Bella ERP.
        </p>
      </div>
      <Link
        href="/dashboard/settings?product=bella_interior&tab=staff"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
      >
        Mở Cài đặt Nhân sự <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
