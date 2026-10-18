'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Award,
  Zap,
  Target,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle2,
  Building2,
  ChevronRight,
  MapPin,
  User,
  Users,
  Activity,
  Layers,
  Calendar,
  Filter,
} from 'lucide-react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface CEODashboardChartsProps {
  totalProductsCount: number;
  availableCount: number;
  reservedCount: number;
  depositedCount: number;
  signedCount: number;
  paidCount: number;
  deliveredCount: number;
  selectedProjectName?: string;
  selectedPeriod?: string;
  selectedProjectId?: string;
  units?: { id: string; product_code: string | null; floor: string | null; status: string | null }[];
}

export const CEODashboardCharts: React.FC<CEODashboardChartsProps> = ({
  totalProductsCount = 0,
  availableCount = 0,
  reservedCount = 0,
  depositedCount = 0,
  signedCount = 0,
  paidCount = 0,
  deliveredCount = 0,
  selectedProjectName = 'Tất cả dự án',
  selectedPeriod = 'Tháng 7/2026',
  selectedProjectId,
  units = [],
}) => {
  const router = useRouter();
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState<string>('6 tháng gần nhất');
  const [selectedFunnelMonth, setSelectedFunnelMonth] = useState<string>('Tháng 7/2026');
  const [selectedLeaderboardMonth, setSelectedLeaderboardMonth] = useState<string>('Tháng 7/2026');

  // Calculated Absorption Rate
  const totalOccupied = depositedCount + signedCount + paidCount + deliveredCount;
  const absorptionRate = totalProductsCount > 0 ? ((totalOccupied / totalProductsCount) * 100).toFixed(1) : '0.0';

  // Revenue & Cashflow Monthly Data (Billions VND)
  const monthlyData = [
    { month: 'T1', rev: 72, cash: 62, target: 80 },
    { month: 'T2', rev: 92, cash: 70, target: 100 },
    { month: 'T3', rev: 104, cash: 78, target: 120 },
    { month: 'T4', rev: 118, cash: 96, target: 140 },
    { month: 'T5', rev: 145, cash: 112, target: 160 },
    { month: 'T6', rev: 168, cash: 128, target: 180 },
    { month: 'T7', rev: 162, cash: 142, target: 190 },
  ];

  const maxChartVal = 200;

  // Lead Conversion Funnel
  const funnelData = [
    { label: 'Lead tiếp nhận', count: 1250, pct: 100, color: 'bg-purple-600' },
    { label: 'Phân công Sale (SLA 15m)', count: 1180, pct: 94.4, color: 'bg-blue-600' },
    { label: 'Tương tác & Tư vấn', count: 890, pct: 71.2, color: 'bg-cyan-500' },
    { label: 'Đi xem dự án (Site Visit)', count: 420, pct: 33.6, color: 'bg-teal-500' },
    { label: 'Giữ chỗ & Đặt cọc', count: 180, pct: 14.4, color: 'bg-orange-500' },
    { label: 'Ký HĐMB thành công', count: 142, pct: 11.3, color: 'bg-emerald-600' },
  ];

  // Sales Leaderboard
  const topSales = [
    { rank: 1, name: 'Nguyễn Văn A', team: 'Đội 1 – Shophouse', revenue: '42.5', deals: 14, rate: '18.7%', medal: '🥇' },
    { rank: 2, name: 'Trần Thị B', team: 'Đội 2 – Villa Marina', revenue: '38.0', deals: 11, rate: '16.9%', medal: '🥈' },
    { rank: 3, name: 'Lê Hoàng C', team: 'Đội 1 – Shophouse', revenue: '29.2', deals: 9, rate: '15.2%', medal: '🥉' },
    { rank: 4, name: 'Phạm Thanh D', team: 'Đội 3 – Penthouse', revenue: '24.8', deals: 7, rate: '12.6%', medal: '4' },
    { rank: 5, name: 'Hoàng Thị E', team: 'Đội 2 – Villa Marina', revenue: '18.6', deals: 6, rate: '11.1%', medal: '5' },
  ];

  // Attention Items
  const attentionItems = [
    { id: 1, count: 7, badgeBg: 'bg-red-500 text-white', title: '7 Lead quá SLA', action: 'Cần xử lý ngay', border: 'border-red-200 hover:border-red-400', route: '/dashboard/real-estate/leads' },
    { id: 2, count: 5, badgeBg: 'bg-orange-500 text-white', title: '5 Hợp đồng chờ duyệt', action: 'Chờ phê duyệt', border: 'border-orange-200 hover:border-orange-400', route: '/dashboard/real-estate/contracts' },
    { id: 3, count: 3, badgeBg: 'bg-amber-500 text-white', title: '3 Giữ chỗ sắp hết hạn', action: 'Trong 3 ngày tới', border: 'border-amber-200 hover:border-amber-400', route: '/dashboard/real-estate/apartments' },
    { id: 4, count: 2, badgeBg: 'bg-red-600 text-white', title: '2 Khoản thanh toán quá hạn', action: 'Cần đối soát', border: 'border-red-200 hover:border-red-400', route: '/dashboard/real-estate/contracts' },
    { id: 5, count: 4, badgeBg: 'bg-blue-600 text-white', title: '4 Hồ sơ bàn giao thiếu tài liệu', action: 'Cần bổ sung', border: 'border-blue-200 hover:border-blue-400', route: '/dashboard/real-estate/documents' },
  ];

  const floors = Array.from(new Set(units.map(unit => unit.floor || 'Chưa cập nhật'))).sort();
  const effectiveFloor = floors.includes(selectedFloor) ? selectedFloor : 'all';
  const floorUnits = units.filter(unit => effectiveFloor === 'all' || (unit.floor || 'Chưa cập nhật') === effectiveFloor);
  const inventoryHref = '/dashboard/real-estate/apartments' + (selectedProjectId ? '?projectId=' + encodeURIComponent(selectedProjectId) : '');

  // Recent Activity Feed
  const recentActivities = [
    { time: '10:24', icon: '🔵', text: 'Nguyễn Văn B đã tạo lead mới', sub: 'Khách hàng: Trần Minh Quân' },
    { time: '09:48', icon: '📄', text: 'Hợp đồng CH-0123 đã được ký số', sub: 'Khách hàng: Lê Thị Mai' },
    { time: '09:15', icon: '🟢', text: 'Thanh toán đợt 2 – CH-0805', sub: '1.5 tỷ VNĐ' },
    { time: '08:50', icon: '🟠', text: 'Giữ chỗ căn CH-0506', sub: 'Khách hàng: Nguyễn Hoàng Nam' },
    { time: '08:32', icon: '📄', text: 'Cập nhật tiến độ bàn giao', sub: 'Căn CH-0210 – Đã bàn giao' },
  ];

  return (
    <div className="space-y-6"><aside role="note" className="rounded-xl border border-amber-300 p-4 text-sm text-amber-900 dark:text-amber-200">Kho căn và ma trận bên dưới dùng dữ liệu dự án đang chọn. Doanh thu, dòng tiền, phễu bán hàng, xếp hạng, công việc cần chú ý và lịch sử hoạt động là dữ liệu minh họa, chưa được xác minh.</aside>
      {/* 1. TOP EXECUTIVE METRIC CARDS (4 CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Doanh thu HĐMB */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Doanh thu HĐMB</span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              458.5 <span className="text-sm font-bold text-emerald-600">tỷ VNĐ</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>↗ 18.4% so với tháng trước</span>
            </div>
          </div>
        </div>

        {/* Card 2: Thực thu */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thực thu</span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl border border-blue-200/60 dark:border-blue-900/50">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              371.2 <span className="text-sm font-bold text-blue-600">tỷ VNĐ</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-blue-600 font-bold mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>↗ 12.8% so với tháng trước</span>
            </div>
          </div>
        </div>

        {/* Card 3: Tỷ lệ hấp thụ */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tỷ lệ hấp thụ</span>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl border border-purple-200/60 dark:border-purple-900/50">
              <PieChartIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {absorptionRate}<span className="text-sm font-bold text-purple-600">%</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-purple-600 font-bold mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{totalOccupied}/{totalProductsCount} căn occupied</span>
            </div>
          </div>
        </div>

        {/* Card 4: Lead phản hồi đúng SLA */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lead phản hồi đúng SLA</span>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl border border-amber-200/60 dark:border-amber-900/50">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              96.5<span className="text-sm font-bold text-amber-600">%</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2">
              14.2 phút thời gian phản hồi TB
            </div>
          </div>
        </div>
      </div>

      {/* 2. ROW 1: REVENUE CHART (2/3) + ATTENTION CENTER (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: Revenue & Cash Flow Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Doanh thu HĐMB & Dòng tiền thực thu
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Đơn vị: Tỷ VNĐ
                </p>
              </div>

              <div className="flex items-center gap-3">
                <PremiumSelect disabled
                  value={selectedTrendPeriod}
                  onChange={(val) => setSelectedTrendPeriod(val)}
                  options={[
                    { value: "6 tháng gần nhất", label: "6 tháng gần nhất" },
                    { value: "Năm 2026", label: "Năm 2026" },
                  ]}
                />

                <div className="hidden sm:flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-blue-600">
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-xs" /> Doanh thu HĐMB
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" /> Thực thu
                  </span>
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-3 border-t-2 border-dashed border-blue-400" /> Kế hoạch
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Bar & Line Chart Grid */}
            <div className="relative">
              {/* Plot Area with Y-Axis Grid Lines & 0-Baseline */}
              <div className="relative h-48 border-b border-slate-200 dark:border-slate-700">
                {/* Background Grid Lines (200, 150, 100, 50, 0) */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-slate-400 opacity-60">
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-between"><span>200</span></div>
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-between"><span>150</span></div>
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-between"><span>100</span></div>
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-between"><span>50</span></div>
                  <div className="w-full flex justify-between text-slate-400 font-bold"><span>0</span></div>
                </div>

                {/* Bars Container (Anchored directly to border-b 0-level line) */}
                <div className="absolute inset-0 flex items-end justify-between px-2 gap-3 z-10">
                  {monthlyData.map((d, idx) => {
                    const revH = (d.rev / maxChartVal) * 100;
                    const cashH = (d.cash / maxChartVal) * 100;

                    return (
                      <div key={idx} className="flex-1 flex items-end justify-center gap-1.5 h-full group">
                        {/* Rev Bar */}
                        <div
                          className="w-2/5 bg-blue-600 rounded-t-md transition-all duration-300 group-hover:bg-blue-700 shadow-2xs"
                          style={{ height: `${revH}%` }}
                          title={`Doanh thu HĐMB: ${d.rev} Tỷ`}
                        />
                        {/* Cash Bar */}
                        <div
                          className="w-2/5 bg-emerald-500 rounded-t-md transition-all duration-300 group-hover:bg-emerald-600 shadow-2xs"
                          style={{ height: `${cashH}%` }}
                          title={`Thực thu: ${d.cash} Tỷ`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* X-Axis Month Labels Row (Below 0 Baseline) */}
              <div className="flex items-center justify-between px-2 mt-2 z-10">
                {monthlyData.map((d, idx) => (
                  <div key={idx} className="flex-1 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    {d.month}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Target Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Doanh thu HĐMB</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-black text-slate-900 dark:text-white font-mono">458.5 tỷ</span>
                  <span className="text-xs font-bold text-emerald-600">↑ 18.4%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Thực thu</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-black text-slate-900 dark:text-white font-mono">371.2 tỷ</span>
                  <span className="text-xs font-bold text-emerald-600">↑ 12.8%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Kế hoạch</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-black text-slate-900 dark:text-white font-mono">500.0 tỷ</span>
                  <span className="text-xs font-bold text-rose-600">🔴 Còn thiếu 128.8 tỷ</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1/3: Attention Center (Cần chú ý hôm nay) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Cần chú ý hôm nay
              </h3>
              <button onClick={() => router.push('/dashboard/real-estate/leads')} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer">
                Xem tất cả (21) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(item.route)}
                  className={`flex items-center justify-between p-3 rounded-xl border bg-slate-50/60 dark:bg-slate-800/40 transition-all cursor-pointer ${item.border}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg ${item.badgeBg} font-black text-xs flex items-center justify-center shrink-0`}>
                      {item.count}
                    </span>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{item.action}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. ROW 2: SALES FUNNEL (1/2) + INVENTORY STATUS (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left 1/2: Sales Conversion Funnel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Phễu chuyển đổi Lead & Bán hàng
            </h3>
            <PremiumSelect disabled
              value={selectedFunnelMonth}
              onChange={(val) => setSelectedFunnelMonth(val)}
              options={[
                { value: "Tháng 7/2026", label: "Tháng 7/2026" },
                { value: "Tháng 6/2026", label: "Tháng 6/2026" },
              ]}
            />
          </div>

          <div className="space-y-3.5">
            {funnelData.map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-extrabold">
                  <span className="text-slate-800 dark:text-slate-200">{f.label}</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {f.count.toLocaleString()} <span className="text-slate-400 text-[11px] font-normal">({f.pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className={`${f.color} h-full rounded-full transition-all duration-500`} style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1/2: Inventory Breakdown Donut & List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          {(() => {
            const totalCount = totalProductsCount;
            const pctAvail = totalCount > 0 ? (availableCount / totalCount) * 100 : 0;
            const pctRes = totalCount > 0 ? (reservedCount / totalCount) * 100 : 0;
            const pctDep = totalCount > 0 ? (depositedCount / totalCount) * 100 : 0;
            const pctSig = totalCount > 0 ? (signedCount / totalCount) * 100 : 0;
            const pctPaid = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
            const pctDel = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;

            const offsetAvail = 0;
            const offsetRes = -pctAvail;
            const offsetDep = -(pctAvail + pctRes);
            const offsetSig = -(pctAvail + pctRes + pctDep);
            const offsetPaid = -(pctAvail + pctRes + pctDep + pctSig);
            const offsetDel = -(pctAvail + pctRes + pctDep + pctSig + pctPaid);

            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-emerald-600" />
                    Tồn kho & trạng thái bảng hàng
                  </h3>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng: {totalCount} căn</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Center Donut Ring Graphic */}
                  <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                    {/* Multi-color Donut Ring using Conic Gradient */}
                    <div
                      className="w-44 h-44 rounded-full p-4 flex items-center justify-center shadow-sm transition-all duration-500"
                      style={{
                        background: `conic-gradient(
                          #10b981 0% ${(pctAvail).toFixed(2)}%,
                          #f59e0b ${(pctAvail).toFixed(2)}% ${(pctAvail + pctRes).toFixed(2)}%,
                          #f97316 ${(pctAvail + pctRes).toFixed(2)}% ${(pctAvail + pctRes + pctDep).toFixed(2)}%,
                          #9333ea ${(pctAvail + pctRes + pctDep).toFixed(2)}% ${(pctAvail + pctRes + pctDep + pctSig).toFixed(2)}%,
                          #2563eb ${(pctAvail + pctRes + pctDep + pctSig).toFixed(2)}% ${(pctAvail + pctRes + pctDep + pctSig + pctPaid).toFixed(2)}%,
                          #94a3b8 ${(pctAvail + pctRes + pctDep + pctSig + pctPaid).toFixed(2)}% ${(pctAvail + pctRes + pctDep + pctSig + pctPaid + pctDel).toFixed(2)}%,
                          #e2e8f0 ${(pctAvail + pctRes + pctDep + pctSig + pctPaid + pctDel).toFixed(2)}% 100%
                        )`
                      }}
                    >
                      {/* Inner Hole for Donut Center Text */}
                      <div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex flex-col items-center justify-center text-center shadow-xs">
                        <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{absorptionRate}%</span>
                        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Đã hấp thụ</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Status Breakdown List */}
                  <div className="flex-1 space-y-2 w-full text-xs">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Tự do (Available)
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">{availableCount} <span className="text-slate-400 text-[10px]">{pctAvail.toFixed(1)}%</span></span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Giữ chỗ (Holding)
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">{reservedCount} <span className="text-slate-400 text-[10px]">{pctRes.toFixed(1)}%</span></span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Đã cọc (Deposited)
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">{depositedCount} <span className="text-slate-400 text-[10px]">{pctDep.toFixed(1)}%</span></span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Ký HĐMB
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">{signedCount} <span className="text-slate-400 text-[10px]">{pctSig.toFixed(1)}%</span></span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Thanh toán
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">{paidCount} <span className="text-slate-400 text-[10px]">{pctPaid.toFixed(1)}%</span></span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Bàn giao
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">{deliveredCount} <span className="text-slate-400 text-[10px]">{pctDel.toFixed(1)}%</span></span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* 4. ROW 3: SALES LEADERBOARD (1/2) + PROJECT PERFORMANCE (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left 1/2: Sales Leaderboard */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Bảng xếp hạng Sale
            </h3>
            <div className="flex items-center gap-2">
              <PremiumSelect disabled
                value={selectedLeaderboardMonth}
                onChange={(val) => setSelectedLeaderboardMonth(val)}
                options={[
                  { value: "Tháng 7/2026", label: "Tháng 7/2026" },
                  { value: "Tháng 6/2026", label: "Tháng 6/2026" },
                ]}
              />
              <button onClick={() => router.push('/dashboard/real-estate/people')} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer">
                Xem tất cả ➔
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-2">Nhân viên</th>
                  <th className="py-2.5 px-2">Đội nhóm</th>
                  <th className="py-2.5 px-2 text-right">Doanh số (Tỷ)</th>
                  <th className="py-2.5 px-2 text-center">Giao dịch</th>
                  <th className="py-2.5 px-2 text-right">Tỷ lệ chốt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                {topSales.map((s) => (
                  <tr key={s.rank} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-2 font-mono font-black text-sm text-amber-600">{s.medal}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200">
                          {s.name.charAt(0)}
                        </div>
                        <span className="font-extrabold text-slate-900 dark:text-white">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-slate-500 dark:text-slate-400">{s.team}</td>
                    <td className="py-3 px-2 text-right font-mono font-black text-emerald-600">{s.revenue}</td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">{s.deals}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{s.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1/2: Project Performance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Hiệu suất dự án
              </h3>
              <button onClick={() => router.push('/dashboard/real-estate/projects')} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer">
                Xem chi tiết ➔
              </button>
            </div>

            {/* Project Header Thumbnail Card */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-xs">
                EI
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">{selectedProjectName}</h4>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Trạng thái: Chưa xác minh
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> Vị trí: Chưa xác minh
                </p>
              </div>
            </div>

            {/* Top Stat Cards Grid */}
            <div className="grid grid-cols-3 gap-2.5 text-center mb-4">
              <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Tổng số căn</span>
                <span className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5 block">{totalProductsCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Giá bán bình quân</span>
                <span className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5 block">125.8 tr/m²</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Tỷ lệ hấp thụ</span>
                <span className="text-base font-black text-emerald-600 font-mono mt-0.5 block">{absorptionRate}%</span>
              </div>
            </div>

            {/* Detailed Performance Items List */}
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Doanh thu HĐMB</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">458.5 tỷ <span className="text-emerald-600 font-bold text-[11px]">(↑ 18.4%)</span></span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Thực thu</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">371.2 tỷ <span className="text-emerald-600 font-bold text-[11px]">(↑ 12.8%)</span></span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Số giao dịch</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">142</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Thời gian bán TB</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">32 ngày</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-400">Tỷ lệ hủy cọc</span>
                <span className="font-mono font-black text-emerald-600">1.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. ROW 4: UNIT MATRIX BY FLOOR (1/2) + RECENT ACTIVITY (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left 1/2: Unit Matrix Grid */}
        <section aria-label="Ma trận kho căn" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
<h3 className="font-bold">Sơ đồ ma trận căn hộ theo tầng</h3><PremiumSelect value={effectiveFloor} onChange={setSelectedFloor} ariaLabel="Tầng ma trận tổng quan" options={[{value:'all',label:'Tất cả tầng'},...floors.map(floor => ({value:floor,label:'Tầng '+floor}))]} />
<div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">{floorUnits.map(unit => <button key={unit.id} onClick={() => router.push(inventoryHref)} title="Mở kho căn của dự án" className="rounded-xl border p-3 text-left"><strong>{unit.product_code || 'Chưa cập nhật mã căn'}</strong><p className="text-xs">{unit.status || 'Chưa cập nhật trạng thái'}</p></button>)}</div>{floorUnits.length === 0 && <p>Chưa có căn hộ phù hợp.</p>}
<a className="underline text-sm" href={inventoryHref}>Mở kho căn dự án</a></section>

        {/* Right 1/2: Recent Activity Feed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Hoạt động gần đây
            </h3>
            <button onClick={() => router.push('/dashboard/real-estate/documents')} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer">
              Xem tất cả ➔
            </button>
          </div>

          <div className="space-y-3">
            {recentActivities.map((act, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span className="text-xs font-mono font-extrabold text-slate-400 shrink-0 mt-0.5">{act.time}</span>
                <span className="text-sm shrink-0">{act.icon}</span>
                <div className="flex-1">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{act.text}</h4>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{act.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

