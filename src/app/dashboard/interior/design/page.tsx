'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  ShieldCheck,
  Plus,
  Palette,
  Maximize2,
} from 'lucide-react';

export default function InteriorDesignStudioPage() {
  const [selectedRev, setSelectedRev] = useState<number>(2);

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
              <h1 className="text-xl font-bold text-white">Studio Quản Lý Thiết Kế & Bản Vẽ</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Design & Specification
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dự án: <span className="text-slate-200 font-medium">Dubai Luxury Villa Fitout (INT-DUBAI-001)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700">
            <Palette className="h-3.5 w-3.5 text-amber-400" />
            Bảng mẫu vật liệu
          </button>
          <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            Tạo Version mới
          </button>
        </div>
      </div>

      {/* Version Selector & Lock Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase text-slate-400">Phiên bản thiết kế:</span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((v) => (
              <button
                key={v}
                onClick={() => setSelectedRev(v)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                  selectedRev === v
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Rev #{v} {v === 2 && '• APPROVED'}
              </button>
            ))}
          </div>
        </div>

        {selectedRev === 2 ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Đã chốt & Khóa bản vẽ (Approved Design Lock) — Căn cứ xuất lệnh sản xuất
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
            <Clock className="h-4 w-4 text-amber-400" />
            Bản vẽ dự thảo — Chưa khóa phê duyệt (Không dùng cho sản xuất)
          </div>
        )}
      </div>

      {/* Design Studio Layout: Rooms, 3D Render & Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Rooms & 3D Renderings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-400" />
                Phối Cảnh 3D & Bản Vẽ Kỹ Thuật (Rev #{selectedRev})
              </h3>
              <span className="text-xs text-slate-400">Phòng Khách Luxury (Floor 1 - 65m2)</span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center group">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10" />
              <div className="text-center p-6 space-y-2 z-20">
                <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Eye className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-white">Phối cảnh 3D Phòng Khách & Bàn Đảo Bếp V2</div>
                <p className="text-xs text-slate-400 max-w-md">
                  Veneer óc chó tự nhiên, vách đá Marble tự nhiên Calacatta, phụ kiện Blum Legrabox
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-900 text-slate-200 border border-slate-700">
                    <Maximize2 className="h-3 w-3 text-amber-400" /> Xem bản vẽ CAD 2D chi tiết
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-500">Mặt cắt kỹ thuật</span>
                <div className="font-semibold text-slate-200">2D-SEC-KIT-01.pdf</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Đã ký duyệt
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-500">Chi tiết phụ kiện</span>
                <div className="font-semibold text-slate-200">BLUM-TANDEM-SPEC.pdf</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Đã chốt mã
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-500">Mặt bằng bố trí</span>
                <div className="font-semibold text-slate-200">LAYOUT-F1-REV2.dwg</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Cốt hiện trạng
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Material Specifications Board */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Palette className="h-4 w-4 text-amber-400" />
                Quy Cách Vật Liệu & Phụ Kiện
              </h3>
              <span className="text-xs text-amber-400">4 vật tư chính</span>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Veneer Óc Chó Bắc Mỹ</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    An Cường
                  </span>
                </div>
                <p className="text-xs text-slate-400">Code: MS 440 EV • Hoàn thiện sơn bóng mờ 50%</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Đá Thạch Anh Nhân Tạo</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Vicostone
                  </span>
                </div>
                <p className="text-xs text-slate-400">Code: BQ8628 Nero Marquina • Dày 20mm bo mòi 45 độ</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Bản Lề Giảm Chấn Thép</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Blum Austria
                  </span>
                </div>
                <p className="text-xs text-slate-400">Code: Clip Top BLUMOTION 110 • Bảo hành 5 năm</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Khung Cánh Kính Slim</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    EuroClass
                  </span>
                </div>
                <p className="text-xs text-slate-400">Kính xám khói cường lực 5mm viền nhôm anode champagne</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

