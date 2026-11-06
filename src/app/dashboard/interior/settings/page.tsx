'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, ArrowLeft, Palette, Sliders, Shield, Database } from 'lucide-react';
import ThemeToggle from '@/components/common/ThemeToggle';

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/interior"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại Tổng quan
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-600" />
          Cài đặt hệ thống Bella Interior OS
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Cấu hình giao diện, quy trình duyệt bản vẽ, thông số xưởng và định mức dự toán
        </p>
      </div>

      <div className="space-y-4">
        {/* Theme Settings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">Giao diện &amp; Theme Preset</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lựa chọn chế độ sáng (Light Theme - Mặc định đề xuất) hoặc tối (Dark Theme)
              </p>
            </div>
          </div>
          <div className="pt-2 max-w-xs">
            <ThemeToggle />
          </div>
        </div>

        {/* Business Invariant Settings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">Quy tắc chốt phương án &amp; Khóa bản vẽ</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quy định nghiêm ngặt: Tuyệt đối không chạy xưởng bản vẽ chưa được Khóa (Approved Revision Lock)
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Yêu cầu chữ ký số gia chủ:</span>
              <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">Bắt buộc (Enforced)</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Kiểm định Punch List trước bàn giao:</span>
              <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">0 lỗi chí mạng (Zero Criticals)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

