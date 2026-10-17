'use client';

/**
 * Bella Education — Báo Cáo & Phân Tích Điều Hành
 *
 * Re-designed from Image 1 to Image 2:
 * - Header: "Báo cáo & Phân tích điều hành" with period selector + export button
 * - 4 Clean White KPI Cards (no numbered labels, no colored backgrounds):
 *     1. Tỷ lệ chuyên cần (with progress bar)
 *     2. Tăng trưởng theo WHO (with progress bar)
 *     3. Học phí đã thu (with context sub-labels)
 *     4. Mức hài lòng phụ huynh (with star rating)
 * - Simplified Tab Nav: Tổng quan | Chuyên cần | Tài chính | Tăng trưởng | Phụ huynh | Báo cáo chi tiết
 * - AI Actionable Insights (3-card layout: ổn định / cần theo dõi / cơ hội)
 * - SVG Line Chart for attendance trend (y-axis from 90–100%, no line to 0 for missing data)
 * - SVG Grouped Bar Chart for tuition (phải thu / đã thu / còn nợ)
 * - Class breakdown table (Nhóm lớp, Sĩ số, Chuyên cần, Tăng trưởng, Hài lòng)
 * - Top issues priority list
 * - Monthly highlights + Quick download reports
 *
 * Architecture Rules:
 * - Zero `any` or `unknown` types
 * - Distinguishes data=0 from data=missing/loading
 * - Scoped to bella_education preschool vertical
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ArrowLeft,
  TrendingUp,
  Users,
  Download,
  Sparkles,
  Heart,
  ChevronRight,
  ArrowUpRight,
  Activity,
  FileSpreadsheet,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info,
  Star,
  BookOpen,
  ShieldCheck,
  DollarSign,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportTab = 'overview' | 'attendance' | 'finance' | 'growth' | 'parents' | 'detail';

interface AttendanceTrendPoint {
  readonly month: string;
  readonly val: number | null; // null = no data yet
}

interface FinanceTrendPoint {
  readonly month: string;
  readonly phaiThu: number;
  readonly daThu: number;
  readonly conNo: number;
}

interface ClassRow {
  readonly id: string;
  readonly name: string;
  readonly siSo: number;
  readonly chuyenCan: number; // %
  readonly tangTruong: number; // %
  readonly haiLong: number; // out of 5
}

interface IssueItem {
  readonly id: string;
  readonly level: 'Cao' | 'Trung bình' | 'Thấp';
  readonly title: string;
  readonly desc: string;
  readonly count: number;
}

interface MonthlyEvent {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly date: string;
}

interface QuickReport {
  readonly id: string;
  readonly title: string;
  readonly updated: string;
  readonly type: 'pdf' | 'excel';
  readonly color: string;
}

// ─── Static seed data (mock; real data comes from API in production) ─────────

const ATTENDANCE_TREND: AttendanceTrendPoint[] = [
  { month: 'Tháng 4', val: 95.2 },
  { month: 'Tháng 5', val: 96.0 },
  { month: 'Tháng 6', val: 94.8 },
  { month: 'Tháng 7', val: 95.5 },
  { month: 'Tháng 8', val: 95.7 },
  { month: 'Tháng 9', val: null }, // chưa có dữ liệu đầy đủ
];

const FINANCE_CHART: readonly FinanceTrendPoint[] = [
  { month: 'Tháng 4', phaiThu: 2.0,  daThu: 1.88, conNo: 0.12 },
  { month: 'Tháng 5', phaiThu: 2.0,  daThu: 1.92, conNo: 0.08 },
  { month: 'Tháng 6', phaiThu: 2.0,  daThu: 1.85, conNo: 0.15 },
  { month: 'Tháng 7', phaiThu: 2.0,  daThu: 1.80, conNo: 0.20 },
  { month: 'Tháng 8', phaiThu: 2.05, daThu: 1.89, conNo: 0.16 },
  { month: 'Tháng 9', phaiThu: 1.95, daThu: 1.89, conNo: 0.06 },
];

const CLASS_TABLE: readonly ClassRow[] = [
  { id: 'mam-a1', name: 'Mầm A1', siSo: 28, chuyenCan: 96.4, tangTruong: 93.1, haiLong: 4.9 },
  { id: 'mam-a2', name: 'Mầm A2', siSo: 26, chuyenCan: 94.2, tangTruong: 90.8, haiLong: 4.7 },
  { id: 'choi-b1', name: 'Chồi B1', siSo: 30, chuyenCan: 95.8, tangTruong: 92.5, haiLong: 4.8 },
  { id: 'choi-b2', name: 'Chồi B2', siSo: 28, chuyenCan: 96.1, tangTruong: 93.3, haiLong: 4.9 },
  { id: 'la-c1',   name: 'Lá C1',   siSo: 32, chuyenCan: 95.0, tangTruong: 91.9, haiLong: 4.6 },
  { id: 'la-c2',   name: 'Lá C2',   siSo: 30, chuyenCan: 94.7, tangTruong: 90.1, haiLong: 4.7 },
] as const;

const ISSUES: readonly IssueItem[] = [
  { id: 'i1', level: 'Cao',       title: 'Học phí quá hạn trên 30 ngày', desc: 'Cần liên hệ phụ huynh', count: 5 },
  { id: 'i2', level: 'Trung bình',title: 'Trẻ chưa đạt chuẩn tăng trưởng', desc: 'Cần theo dõi dinh dưỡng', count: 12 },
  { id: 'i3', level: 'Thấp',      title: 'Trẻ vắng học từ 3 ngày liên tiếp', desc: 'Cần xác minh lý do', count: 3 },
  { id: 'i4', level: 'Thấp',      title: 'Phụ huynh chưa phản hồi khảo sát', desc: 'Nhắc phụ huynh tham gia', count: 18 },
] as const;

const MONTHLY_EVENTS: readonly MonthlyEvent[] = [
  { id: 'e1', title: 'Ngày hội Bé vui đến trường', detail: '120 trẻ tham gia', date: '05/09' },
  { id: 'e2', title: 'Khám sức khỏe định kỳ', detail: '280 trẻ đã hoàn thành', date: '12/09' },
  { id: 'e3', title: 'Hội thảo phụ huynh', detail: '85 phụ huynh tham dự', date: '20/09' },
  { id: 'e4', title: 'Hoạt động Trung thu', detail: 'Toàn trường', date: '28/09' },
] as const;

const QUICK_REPORTS: readonly QuickReport[] = [
  { id: 'r1', title: 'Báo cáo tổng hợp tháng 09/2026', updated: 'Cập nhật 01/10/2026', type: 'pdf',   color: 'bg-red-500' },
  { id: 'r2', title: 'Tài liệu chuyên cần',             updated: 'Cập nhật 01/10/2026', type: 'excel', color: 'bg-emerald-500' },
  { id: 'r3', title: 'Báo cáo học phí',                 updated: 'Cập nhật 01/10/2026', type: 'pdf',   color: 'bg-red-500' },
  { id: 'r4', title: 'Báo cáo tăng trưởng theo WHO',    updated: 'Cập nhật 01/10/2026', type: 'excel', color: 'bg-emerald-500' },
] as const;

// ─── KPI static values (demo; production uses real API data) ─────────────────
const KPI_ATTENDANCE     = 95.7;
const KPI_ATTENDANCE_CHG = +1.2;
const KPI_PRESENT        = 268;
const KPI_TOTAL          = 280;

const KPI_GROWTH         = 92.1;
const KPI_GROWTH_CHG     = +0.8;
const KPI_GROWTH_PASS    = 258;

const KPI_FINANCE_VND    = 1.89; // tỷ
const KPI_FINANCE_CHG    = +4.6;
const KPI_FINANCE_PHAITHU = 1.95;
const KPI_FINANCE_CONNO  = 0.06;

const KPI_CSAT           = 4.8;
const KPI_CSAT_CHG       = +0.2;
const KPI_CSAT_SURVEYS   = 240;

// ─── Helper Components ────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-700`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function StarRating({ score }: { score: number }) {
  const full  = Math.floor(score);
  const frac  = score - full;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) {
          return <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />;
        }
        if (i === full && frac >= 0.5) {
          return <Star key={i} className="w-4 h-4 fill-amber-400/50 text-amber-400" />;
        }
        return <Star key={i} className="w-4 h-4 text-slate-300" />;
      })}
    </div>
  );
}

function IssueLevelDot({ level }: { level: IssueItem['level'] }) {
  if (level === 'Cao')         return <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5 block" />;
  if (level === 'Trung bình') return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5 block" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0 mt-0.5 block" />;
}

// ─── SVG Line Chart (attendance) ─────────────────────────────────────────────
// Y axis: 90–100%, only renders points with non-null values
function AttendanceLineChart({ data }: { data: readonly AttendanceTrendPoint[] }) {
  const W = 460; const H = 160;
  const PAD = { top: 24, right: 16, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const Y_MIN = 90; const Y_MAX = 100;

  function xPos(i: number) { return PAD.left + (i / (data.length - 1)) * chartW; }
  function yPos(val: number) { return PAD.top + (1 - (val - Y_MIN) / (Y_MAX - Y_MIN)) * chartH; }

  const validPoints = data
    .map((d, i) => (d.val !== null ? { x: xPos(i), y: yPos(d.val), val: d.val } : null))
    .filter((p): p is { x: number; y: number; val: number } => p !== null);

  const linePath = validPoints.reduce<string>((acc, pt, i) => {
    return acc + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
  }, '');

  const yTicks = [90, 92.5, 95, 97.5, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Y axis grid & labels */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left} x2={W - PAD.right}
            y1={yPos(tick)} y2={yPos(tick)}
            stroke="#e2e8f0" strokeWidth="1"
          />
          <text x={PAD.left - 4} y={yPos(tick) + 4} textAnchor="end"
            fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
            {tick}%
          </text>
        </g>
      ))}

      {/* Line */}
      {linePath && (
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Points */}
      {data.map((d, i) => {
        const x = xPos(i);
        if (d.val === null) {
          // Empty circle = no data
          return (
            <g key={i}>
              <circle cx={x} cy={yPos(95)} r="5" fill="white" stroke="#10b981" strokeWidth="2" strokeDasharray="3 2" />
              <text x={x} y={yPos(95) - 10} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
                --
              </text>
            </g>
          );
        }
        const y = yPos(d.val);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill="white" stroke="#10b981" strokeWidth="2.5" />
            <text x={x} y={y - 10} textAnchor="middle" fontSize="9" fill="#059669" fontWeight="bold" fontFamily="sans-serif">
              {d.val}%
            </text>
          </g>
        );
      })}

      {/* X axis labels */}
      {data.map((d, i) => (
        <text key={i} x={xPos(i)} y={H - 4} textAnchor="middle"
          fontSize="9" fill="#64748b" fontFamily="sans-serif">
          {d.month.replace('Tháng ', 'T')}
        </text>
      ))}
    </svg>
  );
}

// ─── SVG Grouped Bar Chart (finance) ─────────────────────────────────────────
function FinanceBarChart({ data }: { data: readonly FinanceTrendPoint[] }) {
  const W = 460; const H = 180;
  const PAD = { top: 24, right: 16, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const MAX_VAL = 2.5;

  const groupW = chartW / data.length;
  const barW   = (groupW - 8) / 3;

  function barH(val: number) { return Math.max(0, (val / MAX_VAL) * chartH); }
  function barY(val: number) { return PAD.top + chartH - barH(val); }

  const yTicks = [0, 0.5, 1.0, 1.5, 2.0, 2.5];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {yTicks.map((tick) => {
        const y = PAD.top + chartH - (tick / MAX_VAL) * chartH;
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
              stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end"
              fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
              {tick > 0 ? `${tick}T` : '0'}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const gx = PAD.left + i * groupW + 4;
        const cx = PAD.left + i * groupW + groupW / 2;
        return (
          <g key={i}>
            {/* Phải thu – slate */}
            <rect x={gx} y={barY(d.phaiThu)} width={barW} height={barH(d.phaiThu)}
              rx="2" fill="#cbd5e1" />
            {/* Đã thu – green */}
            <rect x={gx + barW + 1} y={barY(d.daThu)} width={barW} height={barH(d.daThu)}
              rx="2" fill="#10b981" />
            {/* Còn nợ – red */}
            <rect x={gx + (barW + 1) * 2} y={barY(d.conNo)} width={barW} height={barH(d.conNo)}
              rx="2" fill="#f43f5e" />
            {/* Label above đã thu bar */}
            <text x={gx + barW + 1 + barW / 2} y={barY(d.daThu) - 4}
              textAnchor="middle" fontSize="8" fill="#059669" fontWeight="bold" fontFamily="sans-serif">
              {d.daThu}T
            </text>
            <text x={cx} y={H - 4} textAnchor="middle"
              fontSize="9" fill="#64748b" fontFamily="sans-serif">
              {d.month.replace('Tháng ', 'T')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('Tháng 09/2026');

  const tabs: readonly { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',   label: 'Tổng quan',        icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'attendance', label: 'Chuyên cần',        icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'finance',    label: 'Tài chính',         icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'growth',     label: 'Tăng trưởng',       icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'parents',    label: 'Phụ huynh',         icon: <Heart className="w-3.5 h-3.5" /> },
    { id: 'detail',     label: 'Báo cáo chi tiết',  icon: <FileText className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-16 bg-[#F5F7F9] min-h-screen">

      {/* ── HEADER ── */}
      <div className="w-full rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Left: title */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B38] tracking-tight">
                  Báo cáo &amp; Phân tích điều hành
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng hợp dữ liệu, phát hiện bất thường và hỗ trợ ra quyết định cho nhà trường
                </p>
              </div>
            </div>
          </div>

          {/* Right: period + export */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="appearance-none bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option>Tháng 09/2026</option>
                <option>Tháng 08/2026</option>
                <option>Học kỳ I (2026-2027)</option>
              </select>
            </div>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2.5 text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              <span>Xuất báo cáo</span>
            </button>
          </div>
        </div>

        {/* ── 4 KPI CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* KPI 1: Tỷ lệ chuyên cần */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-emerald-50">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{KPI_ATTENDANCE_CHG}%
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Tỷ lệ chuyên cần</p>
              <p className="text-2xl font-extrabold text-[#172B38]">{KPI_ATTENDANCE}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">So với tháng trước</p>
            </div>
            <ProgressBar pct={KPI_ATTENDANCE} color="bg-emerald-500" />
            <p className="text-[11px] text-slate-500">
              Có mặt: <strong className="text-slate-800">{KPI_PRESENT} / {KPI_TOTAL} trẻ</strong>
            </p>
          </div>

          {/* KPI 2: Tăng trưởng theo WHO */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-sky-50">
                <TrendingUp className="w-4 h-4 text-sky-600" />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{KPI_GROWTH_CHG}%
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Tăng trưởng theo WHO</p>
              <p className="text-2xl font-extrabold text-[#172B38]">{KPI_GROWTH}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">So với tháng trước</p>
            </div>
            <ProgressBar pct={KPI_GROWTH} color="bg-sky-500" />
            <p className="text-[11px] text-slate-500">
              Đạt chuẩn: <strong className="text-slate-800">{KPI_GROWTH_PASS} / {KPI_TOTAL} trẻ</strong>
            </p>
          </div>

          {/* KPI 3: Học phí đã thu */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-rose-50">
                <BookOpen className="w-4 h-4 text-rose-600" />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{KPI_FINANCE_CHG}%
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Học phí đã thu</p>
              <p className="text-2xl font-extrabold text-[#172B38]">{KPI_FINANCE_VND} tỷ</p>
              <p className="text-[10px] text-slate-400 mt-0.5">So với tháng trước</p>
            </div>
            <ProgressBar pct={(KPI_FINANCE_VND / KPI_FINANCE_PHAITHU) * 100} color="bg-rose-500" />
            <p className="text-[11px] text-slate-500">
              Phải thu: <strong className="text-slate-700">{KPI_FINANCE_PHAITHU} tỷ</strong>
              &nbsp;•&nbsp;
              <strong className="text-rose-600">Còn nợ: {KPI_FINANCE_CONNO} tỷ</strong>
            </p>
          </div>

          {/* KPI 4: Mức hài lòng phụ huynh */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-amber-50">
                <Heart className="w-4 h-4 text-amber-500" />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{KPI_CSAT_CHG}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Mức hài lòng phụ huynh</p>
              <p className="text-2xl font-extrabold text-[#172B38]">{KPI_CSAT} / 5.0</p>
              <p className="text-[10px] text-slate-400 mt-0.5">So với tháng trước</p>
            </div>
            <StarRating score={KPI_CSAT} />
            <p className="text-[11px] text-slate-500">
              Khảo sát: <strong className="text-slate-800">{KPI_CSAT_SURVEYS} phản hồi</strong>
            </p>
          </div>
        </div>

        {/* ── TAB NAV ── */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* AI Actionable Insights */}
          <div className="w-full rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-[#172B38] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                Phân tích &amp; Đề xuất từ AI ({selectedPeriod})
              </span>
              <button className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
                Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Insight 1: Ổn định */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/60">
                <div className="p-1.5 rounded-xl bg-emerald-100 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-emerald-800 mb-1">Tình hình ổn định</p>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Tỷ lệ chuyên cần tăng 1.2% so với tháng trước. Không có bất thường đáng kể.
                  </p>
                </div>
              </div>

              {/* Insight 2: Cần theo dõi */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60">
                <div className="p-1.5 rounded-xl bg-amber-100 shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-amber-800 mb-1">Cần theo dõi</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Còn nợ học phí 60 triệu (3.1%). Có 5 khoản quá hạn trên 30 ngày.
                  </p>
                </div>
              </div>

              {/* Insight 3: Cơ hội cải thiện */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-50/80 border border-sky-200/60">
                <div className="p-1.5 rounded-xl bg-sky-100 shrink-0">
                  <Info className="w-4 h-4 text-sky-600" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-sky-800 mb-1">Cơ hội cải thiện</p>
                  <p className="text-[11px] text-sky-700 leading-relaxed">
                    Mức hài lòng phụ huynh tăng 0.2 điểm. Nên tiếp tục duy trì truyền thông hoạt động học tập trong tháng tới.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Attendance Line Chart */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#172B38] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Xu hướng chuyên cần 6 tháng gần đây
                </h3>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">
                  6 tháng gần đây ▾
                </span>
              </div>
              <AttendanceLineChart data={ATTENDANCE_TREND} />
              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-emerald-500 rounded inline-block" />
                  Tỷ lệ chuyên cần
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-emerald-500 border-dashed inline-block" />
                  Chưa có dữ liệu
                </span>
              </div>
            </div>

            {/* Finance Bar Chart */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#172B38] flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Thu học phí: Phải thu vs Đã thu
                </h3>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">
                  6 tháng gần đây ▾
                </span>
              </div>
              <FinanceBarChart data={FINANCE_CHART} />
              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-slate-300 rounded inline-block" />
                  Phải thu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-500 rounded inline-block" />
                  Đã thu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-rose-500 rounded inline-block" />
                  Còn nợ
                </span>
              </div>
            </div>
          </div>

          {/* Bottom: Class table + Issues */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Class breakdown table */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#172B38] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Tình trạng theo nhóm lớp
                </h3>
                <button className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
                  Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-[11px] font-bold text-slate-500">Nhóm lớp</th>
                      <th className="text-right pb-2 text-[11px] font-bold text-slate-500">Sĩ số</th>
                      <th className="text-right pb-2 text-[11px] font-bold text-slate-500">Chuyên cần</th>
                      <th className="text-right pb-2 text-[11px] font-bold text-slate-500">Tăng trưởng</th>
                      <th className="text-right pb-2 text-[11px] font-bold text-slate-500">Hài lòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {CLASS_TABLE.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 font-bold text-[#172B38]">{row.name}</td>
                        <td className="py-2.5 text-right text-slate-600">{row.siSo}</td>
                        <td className="py-2.5 text-right font-bold text-emerald-600">{row.chuyenCan}%</td>
                        <td className="py-2.5 text-right font-bold text-sky-600">{row.tangTruong}%</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-bold ${row.haiLong >= 4.8 ? 'text-emerald-600' : row.haiLong >= 4.5 ? 'text-amber-500' : 'text-red-500'}`}>
                            ● {row.haiLong}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top issues */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#172B38] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  Top vấn đề cần chú ý
                </h3>
                <button className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
                  Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-[11px] font-bold text-slate-500">Mức độ</th>
                      <th className="text-left pb-2 text-[11px] font-bold text-slate-500">Vấn đề</th>
                      <th className="text-right pb-2 text-[11px] font-bold text-slate-500">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ISSUES.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            issue.level === 'Cao'
                              ? 'bg-red-50 text-red-600'
                              : issue.level === 'Trung bình'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}>
                            <IssueLevelDot level={issue.level} />
                            {issue.level}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <p className="font-bold text-slate-800">{issue.title}</p>
                          <p className="text-[10px] text-slate-400">{issue.desc}</p>
                        </td>
                        <td className="py-2.5 text-right font-extrabold text-slate-800">{issue.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom row: Monthly events + Quick reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Monthly highlights */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#172B38] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  Hoạt động nổi bật trong tháng
                </h3>
                <button className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
                  Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {MONTHLY_EVENTS.map((ev, i) => {
                  const colors = ['bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
                  return (
                    <div key={ev.id} className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-2xl ${colors[i % colors.length]} flex items-center justify-center shrink-0`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#172B38] truncate">{ev.title}</p>
                        <p className="text-[10px] text-slate-400">{ev.detail}</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{ev.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick reports download */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#172B38] flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  Tài liệu &amp; Báo cáo nhanh
                </h3>
                <button className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
                  Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {QUICK_REPORTS.map((rep) => (
                  <div key={rep.id} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-2xl ${rep.color} flex items-center justify-center shrink-0 text-white`}>
                      {rep.type === 'pdf'
                        ? <FileText className="w-4 h-4" />
                        : <FileSpreadsheet className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#172B38] truncate">{rep.title}</p>
                      <p className="text-[10px] text-slate-400">{rep.updated}</p>
                    </div>
                    <button className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {activeTab === 'attendance' && (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-[#172B38] flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            Phân Tích Chuyên Cần Theo Khối
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { grade: 'Khối Mầm (3 tuổi)', pct: 98.1, sub: '65 / 66 bé đi học đều', status: 'ok' as const },
              { grade: 'Khối Chồi (4 tuổi)', pct: 96.9, sub: 'Chồi B2 giảm −4.1% • 7 trẻ nghỉ ≥3 ngày', status: 'warn' as const },
              { grade: 'Khối Lá (5 tuổi)',   pct: 97.5, sub: '78 / 80 bé đi học đều', status: 'ok' as const },
            ].map((blk) => (
              <div key={blk.grade} className={`p-5 rounded-2xl border space-y-2 ${blk.status === 'warn' ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="text-xs font-extrabold text-[#172B38]">{blk.grade}</h4>
                <p className={`text-xl font-extrabold ${blk.status === 'warn' ? 'text-rose-600' : 'text-emerald-600'}`}>{blk.pct}%</p>
                <p className={`text-xs ${blk.status === 'warn' ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>{blk.sub}</p>
              </div>
            ))}
          </div>
          <AttendanceLineChart data={ATTENDANCE_TREND} />
        </div>
      )}

      {/* ── FINANCE TAB ── */}
      {activeTab === 'finance' && (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-[#172B38] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Phân Tích Thu Học Phí
          </h3>
          <FinanceBarChart data={FINANCE_CHART} />
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Phải thu (T9)', val: '1.95 tỷ', color: 'text-slate-700' },
              { label: 'Đã thu',        val: '1.89 tỷ', color: 'text-emerald-600' },
              { label: 'Còn nợ',        val: '60 triệu', color: 'text-rose-600' },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-center space-y-1">
                <p className="text-[10px] font-semibold text-slate-400">{s.label}</p>
                <p className={`text-lg font-extrabold ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GROWTH / HEALTH TAB ── */}
      {activeTab === 'growth' && (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-[#172B38] flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-500" />
            Theo Dõi Tăng Trưởng WHO
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Đạt chuẩn chiều cao', val: '258 / 280', pct: 92.1, color: 'text-sky-600' },
              { label: 'Đạt chuẩn cân nặng',  val: '261 / 280', pct: 93.2, color: 'text-sky-600' },
              { label: 'Cần theo dõi dinh dưỡng', val: '12 trẻ', pct: 4.3, color: 'text-amber-600' },
            ].map((s) => (
              <div key={s.label} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <p className="text-[11px] font-semibold text-slate-500">{s.label}</p>
                <p className={`text-xl font-extrabold ${s.color}`}>{s.val}</p>
                <ProgressBar pct={s.pct} color="bg-sky-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PARENTS TAB ── */}
      {activeTab === 'parents' && (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-[#172B38] flex items-center gap-2">
            <Heart className="w-5 h-5 text-amber-500" />
            Hài Lòng &amp; Tương Tác Phụ Huynh
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Điểm hài lòng',     val: '4.8 / 5.0', color: 'text-amber-600' },
              { label: 'Số phản hồi',        val: '240',        color: 'text-slate-800' },
              { label: 'Chưa phản hồi KS',   val: '18 phụ huynh', color: 'text-rose-600' },
            ].map((s) => (
              <div key={s.label} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <p className="text-[11px] font-semibold text-slate-500">{s.label}</p>
                <p className={`text-xl font-extrabold ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
          <StarRating score={KPI_CSAT} />
        </div>
      )}

      {/* ── DETAIL REPORTS TAB ── */}
      {activeTab === 'detail' && (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-[#172B38] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            Báo Cáo Chi Tiết &amp; Tải Xuống
          </h3>
          <div className="space-y-3">
            {QUICK_REPORTS.map((rep) => (
              <div key={rep.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className={`w-10 h-10 rounded-2xl ${rep.color} flex items-center justify-center shrink-0 text-white`}>
                  {rep.type === 'pdf'
                    ? <FileText className="w-5 h-5" />
                    : <FileSpreadsheet className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#172B38] truncate">{rep.title}</p>
                  <p className="text-[11px] text-slate-400">{rep.updated}</p>
                </div>
                <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer">
                  <Download className="w-3.5 h-3.5" />
                  Tải xuống
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
