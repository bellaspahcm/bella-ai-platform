'use client';

import React from 'react';
import Link from 'next/link';
import { UserCheck, Plus, ArrowLeft, Shield } from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
}

const USERS: StaffUser[] = [
  {
    id: 'u-1',
    name: 'Nguyễn Thị Mai',
    email: 'mai.nguyen@bellainterior.vn',
    role: 'Project Manager',
    department: 'Quản trị dự án',
    status: 'Đang hoạt động',
  },
  {
    id: 'u-2',
    name: 'KTS. Hoàng Long',
    email: 'long.hoang@bellainterior.vn',
    role: 'Lead Architect',
    department: 'Thiết kế 3D/2D',
    status: 'Đang hoạt động',
  },
  {
    id: 'u-3',
    name: 'KTS. Lê Hoàng Sơn',
    email: 'son.le@bellainterior.vn',
    role: 'Senior Architect',
    department: 'Thiết kế chi tiết',
    status: 'Đang hoạt động',
  },
  {
    id: 'u-4',
    name: 'Trần Tuấn',
    email: 'tuan.tran@bellainterior.vn',
    role: 'Quản đốc Xưởng',
    department: 'Sản xuất gỗ xưởng',
    status: 'Đang hoạt động',
  },
  {
    id: 'u-5',
    name: 'Đặng Văn Nam',
    email: 'nam.dang@bellainterior.vn',
    role: 'Kỹ sư QS & Bóc tách',
    department: 'Dự toán BOQ',
    status: 'Đang hoạt động',
  },
];

export default function UsersPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-amber-600" />
            Tài khoản người dùng nội bộ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Phân quyền KTS, Quản đốc xưởng, Kỹ sư giám sát công trường và Kế toán dự án
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Thêm nhân sự mới
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Nhân sự</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Vai trò</th>
                <th className="py-3 px-4">Bộ phận</th>
                <th className="py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {USERS.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white font-bold text-xs">
                      {u.name.charAt(0)}
                    </div>
                    {u.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                    {u.email}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-blue-700 dark:text-blue-400">
                    {u.role}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    {u.department}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/40">
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

