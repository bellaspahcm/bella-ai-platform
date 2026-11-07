'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Key, Lock, Check } from 'lucide-react';

interface RoleDef {
  id: string;
  roleName: string;
  description: string;
  permissions: string[];
}

const ROLES: RoleDef[] = [
  {
    id: 'r-1',
    roleName: 'Project Manager (PM)',
    description: 'Quyền điều hành toàn diện chuỗi dự án, ký duyệt lệnh sản xuất, nghiệm thu và đối soát thanh toán.',
    permissions: ['Xem P&L', 'Khóa bản vẽ', 'Lệnh xưởng', 'Ký nghiệm thu', 'Bảo hành'],
  },
  {
    id: 'r-2',
    roleName: 'Kiến trúc sư (Architect)',
    description: 'Phụ trách hồ sơ thiết kế 3D, bóc tách 2D, upload bản vẽ và đề xuất phiên bản Revision Lock.',
    permissions: ['Tạo bản vẽ', 'Upload 3D/2D', 'Yêu cầu duyệt Revision'],
  },
  {
    id: 'r-3',
    roleName: 'Quản đốc Xưởng (Workshop Supervisor)',
    description: 'Chỉ tiếp nhận lệnh sản xuất khi bản vẽ đã có Approved Lock, cập nhật tiến độ máy cắt CNC, dán cạnh và đóng gói.',
    permissions: ['Tiếp nhận Lệnh xưởng', 'Cập nhật tiến độ gia công', 'Báo cáo xuất xưởng'],
  },
  {
    id: 'r-4',
    roleName: 'Giám sát thi công (Site Engineer)',
    description: 'Quản lý lắp đặt tại công trình, ghi nhật ký Site Diary và lập danh mục Punch List sửa lỗi.',
    permissions: ['Nhật ký công trình', 'Tạo Punch List', 'Biên bản nghiệm thu đợt'],
  },
];

export default function RolesPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <Link
          href="/dashboard/interior"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại Tổng quan
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-600" />
          Vai trò &amp; Quyền hạn (RBAC Matrix)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Thiết lập ma trận phân quyền theo vai trò trong quy trình thiết kế và thi công
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLES.map((role) => (
          <div
            key={role.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
          >
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Key className="w-4 h-4" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">{role.roleName}</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {role.description}
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Quyền hạn cấp phép:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                  >
                    <Check className="w-3 h-3 text-emerald-600" />
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

