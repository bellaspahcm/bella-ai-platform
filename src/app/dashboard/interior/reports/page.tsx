'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, DollarSign, Calendar, ArrowLeft, Download, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function InteriorReportsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/interior"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Tổng quan
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Báo cáo & Phân tích dự án
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Theo dõi tổng quan tài chính, tiến độ thực tế và hiệu quả chi phí chuỗi giá trị nội thất.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert('Xuất báo cáo thành công!')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-amber-600 dark:text-white text-xs font-bold shadow-sm hover:opacity-95 transition-all"
        >
          <Download className="w-4 h-4" /> Xuất báo cáo PDF
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Doanh thu hợp đồng
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">9,28 tỷ đ</p>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-1">
            <TrendingUp className="w-3 h-3" /> +12% so với tháng trước
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Biên lợi nhuận gộp TB
          </p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">40.7%</p>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1 block">
            Vượt chỉ tiêu tối thiểu 38%
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Tỷ lệ đúng tiến độ
          </p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">91.6%</p>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1 block">
            11/12 dự án đạt mốc tiến độ
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Lỗi Punch List bàn giao
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">0 lỗi chí mạng</p>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-1">
            <CheckCircle2 className="w-3 h-3" /> Đạt chuẩn ISO fit-out
          </span>
        </div>
      </div>

      {/* Detail Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Phân tích hiệu quả kinh doanh theo dự án
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 font-bold">Dự án</th>
                <th className="py-2.5 px-3 font-bold">Giá trị HĐ</th>
                <th className="py-2.5 px-3 font-bold">Chi phí vật tư</th>
                <th className="py-2.5 px-3 font-bold">Chi phí nhân công</th>
                <th className="py-2.5 px-3 font-bold">Đã thu</th>
                <th className="py-2.5 px-3 font-bold">Biên LN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">Villa Ciputra Giai Đoạn 2</td>
                <td className="py-3 px-3">2.450.000.000 đ</td>
                <td className="py-3 px-3">980.000.000 đ</td>
                <td className="py-3 px-3">450.000.000 đ</td>
                <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">1.800.000.000 đ</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">41.5%</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">Dubai Luxury Villa Fitout</td>
                <td className="py-3 px-3">3.780.000.000 đ</td>
                <td className="py-3 px-3">1.510.000.000 đ</td>
                <td className="py-3 px-3">640.000.000 đ</td>
                <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">3.000.000.000 đ</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">43.1%</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">Penthouse Metropolis Liễu Giai</td>
                <td className="py-3 px-3">2.200.000.000 đ</td>
                <td className="py-3 px-3">920.000.000 đ</td>
                <td className="py-3 px-3">405.000.000 đ</td>
                <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">2.200.000.000 đ</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">39.8%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
