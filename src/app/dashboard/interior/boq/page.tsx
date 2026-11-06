'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Plus,
  Coins,
  ArrowRight,
} from 'lucide-react';

interface MockBOQItem {
  id: string;
  itemCode: string;
  roomName: string;
  itemName: string;
  dimensions: string;
  specifications: string;
  unit: string;
  quantity: number;
  internalUnitCost: number;
  internalTotalCost: number;
  clientUnitPrice: number;
  clientTotalPrice: number;
  grossMarginPercent: number;
}

const BOQ_ITEMS: MockBOQItem[] = [
  {
    id: 'boq-1',
    itemCode: 'LIV-PANEL-01',
    roomName: 'Phòng Khách Luxury',
    itemName: 'Hệ vách ốp nan gỗ óc chó kết hợp đá Marble',
    dimensions: '6000x150x3200 mm',
    specifications: 'Khung sắt + Plywood + Nan gỗ óc chó tự nhiên sơn bóng mờ 50%',
    unit: 'bộ',
    quantity: 1,
    internalUnitCost: 120000000,
    internalTotalCost: 120000000,
    clientUnitPrice: 195000000,
    clientTotalPrice: 195000000,
    grossMarginPercent: 38.5,
  },
  {
    id: 'boq-2',
    itemCode: 'KIT-ISLAND-01',
    roomName: 'Bếp Đảo Master',
    itemName: 'Bàn đảo bếp mặt đá Vicostone và tủ rượu cánh kính',
    dimensions: '3200x1100x880 mm',
    specifications: 'MDF lõi xanh An Cường + Mặt đá Vicostone BQ8628 + Ray Blum Legrabox',
    unit: 'bộ',
    quantity: 1,
    internalUnitCost: 95000000,
    internalTotalCost: 95000000,
    clientUnitPrice: 165000000,
    clientTotalPrice: 165000000,
    grossMarginPercent: 42.4,
  },
  {
    id: 'boq-3',
    itemCode: 'MAS-BED-01',
    roomName: 'Phòng Ngủ Master',
    itemName: 'Giường ngủ 2mx2m2 bọc da bò Ý cao cấp',
    dimensions: '2000x2200x1100 mm',
    specifications: 'Khung gỗ sồi tự nhiên + Da bò Mastrotto nhập khẩu Ý + Đệm mút D40',
    unit: 'cái',
    quantity: 1,
    internalUnitCost: 35000000,
    internalTotalCost: 35000000,
    clientUnitPrice: 58000000,
    clientTotalPrice: 58000000,
    grossMarginPercent: 39.7,
  },
];

export default function InteriorBOQPage() {
  const [items] = useState<MockBOQItem[]>(BOQ_ITEMS);

  const totalInternalCost = items.reduce((acc, i) => acc + i.internalTotalCost, 0);
  const totalClientPrice = items.reduce((acc, i) => acc + i.clientTotalPrice, 0);
  const totalGrossMargin = totalClientPrice - totalInternalCost;
  const overallMarginPercent = ((totalGrossMargin / totalClientPrice) * 100).toFixed(1);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 font-sans">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/interior"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Bóc Tách Khối Lượng BOQ & Dự Toán Giá Vốn</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Commercial & Costing
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              BOQ Number: <span className="text-slate-200 font-mono font-medium">BOQ-DUBAI-001 (Rev #2 Approved)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700">
            <Download className="h-3.5 w-3.5" />
            Xuất Excel dự toán
          </button>
          <Link
            href="/dashboard/interior/contracts"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
          >
            Tạo Báo giá & Hợp đồng
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Tripartite Costing Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold uppercase text-slate-400">1. Tổng Giá Vốn Nội Bộ (COGS)</span>
          <div className="text-xl font-bold font-mono text-slate-200 mt-1">{formatCurrency(totalInternalCost)}</div>
          <p className="text-xs text-slate-400 mt-1">Bao gồm: Vật tư ván/đá + Phụ kiện + Công thợ xưởng</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold uppercase text-slate-400">2. Tổng Giá Bán Khách Hàng</span>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">{formatCurrency(totalClientPrice)}</div>
          <p className="text-xs text-slate-400 mt-1">Đơn giá niêm yết theo cấu kiện & định mức</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/40 bg-emerald-950/20">
          <span className="text-xs font-semibold uppercase text-emerald-400">3. Lợi Nhuận Gộp Dự Kiến</span>
          <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
            {formatCurrency(totalGrossMargin)} ({overallMarginPercent}%)
          </div>
          <p className="text-xs text-emerald-400/80 mt-1">Tỷ suất lợi nhuận gộp toàn bộ dự án</p>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-400" />
            Chi Tiết Danh Mục Cấu Kiện & Định Mức Chi Phí
          </h3>
          <span className="text-xs text-slate-400 font-mono">3 hạng mục chính</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase text-slate-400 border-b border-slate-800 font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Khu vực & Hạng mục</th>
                <th className="py-3 px-4">Quy cách & Kích thước</th>
                <th className="py-3 px-4">ĐVT</th>
                <th className="py-3 px-4 text-center">SL</th>
                <th className="py-3 px-4 text-right">Đơn giá vốn</th>
                <th className="py-3 px-4 text-right">Giá vốn tổng</th>
                <th className="py-3 px-4 text-right">Đơn giá khách</th>
                <th className="py-3 px-4 text-right">Thành tiền khách</th>
                <th className="py-3 px-4 text-right">Lợi nhuận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-200">{item.itemName}</div>
                    <div className="text-[11px] text-amber-500 font-mono mt-0.5">{item.roomName} • {item.itemCode}</div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="font-mono text-slate-300">{item.dimensions}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.specifications}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono">{item.unit}</td>
                  <td className="py-3.5 px-4 text-center font-mono">{item.quantity}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-400">{formatCurrency(item.internalUnitCost)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-300">{formatCurrency(item.internalTotalCost)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-amber-400/90">{formatCurrency(item.clientUnitPrice)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-300">{formatCurrency(item.clientTotalPrice)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-medium">
                    {item.grossMarginPercent}%
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

