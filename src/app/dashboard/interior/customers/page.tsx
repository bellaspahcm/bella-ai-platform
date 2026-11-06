'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Plus, Search, Filter, Phone, Mail, Building, ArrowLeft } from 'lucide-react';

interface ClientItem {
  id: string;
  name: string;
  type: string;
  phone: string;
  email: string;
  projectsCount: number;
  totalValue: string;
  status: string;
}

const CLIENTS: ClientItem[] = [
  {
    id: 'c-1',
    name: 'Nguyễn Văn A',
    type: 'Biệt thự cá nhân',
    phone: '0903 123 456',
    email: 'nguyen.vana@gmail.com',
    projectsCount: 2,
    totalValue: '3,85 tỷ',
    status: 'Đang triển khai',
  },
  {
    id: 'c-2',
    name: 'Sheikh Mansoor',
    type: 'Dinh thự cao cấp',
    phone: '+971 50 123 4567',
    email: 'mansoor.palmvilla@dubai.ae',
    projectsCount: 1,
    totalValue: '3,78 tỷ',
    status: 'Đang triển khai',
  },
  {
    id: 'c-3',
    name: 'Trịnh Thăng Bình',
    type: 'Penthouse',
    phone: '0901 112 222',
    email: 'binh.trinh@metropolis.vn',
    projectsCount: 1,
    totalValue: '2,20 tỷ',
    status: 'Đã bàn giao',
  },
  {
    id: 'c-4',
    name: 'Phạm Hồng Nhung',
    type: 'Duplex Aqua Bay',
    phone: '0912 888 999',
    email: 'nhung.ecopark@aquabay.vn',
    projectsCount: 1,
    totalValue: '850 triệu',
    status: 'Báo giá',
  },
];

export default function CustomersPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
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
            <Users className="w-6 h-6 text-amber-600" />
            Khách hàng &amp; Chủ đầu tư
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý hồ sơ đối tác, chủ nhà và lịch sử giao dịch thiết kế - thi công
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Thêm khách hàng
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tên, SĐT, email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Bộ lọc phân loại
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Phân loại</th>
                <th className="py-3 px-4">Liên hệ</th>
                <th className="py-3 px-4">Số dự án</th>
                <th className="py-3 px-4">Tổng giá trị</th>
                <th className="py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {CLIENTS.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {client.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                    {client.type}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {client.phone}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {client.email}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {client.projectsCount}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-amber-700 dark:text-amber-400">
                    {client.totalValue}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/40">
                      {client.status}
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

