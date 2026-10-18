"use client";
import { LandPreviewNotice, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { downloadCsvReport } from "@/modules/real_estate/utils/exportUtils";
import {
  Calendar, Clock, Users, Plus, Search, Filter,
  ChevronLeft, ChevronRight, X, CheckCircle2,
  AlertTriangle, MoreHorizontal, Building2,
  MapPin, Bell, Download, ArrowUpRight, ArrowDownRight,
  Briefcase, Star, CalendarCheck,
  CalendarX, UserCheck
} from "lucide-react";

// ── TYPES ──
type ShiftType = "morning" | "afternoon" | "evening" | "full_day" | "off";
type ShiftStatus = "confirmed" | "pending" | "absent" | "late" | "overtime";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  phone: string;
}

interface ShiftEntry {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  department: string;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  shiftLabel: string;
  timeRange: string;
  status: ShiftStatus;
  statusLabel: string;
  project?: string;
  location?: string;
  note?: string;
  isMyShift?: boolean;
  isPendingApproval?: boolean;
}

// ── MOCK DATA ──
const STAFF_LIST: StaffMember[] = [
  { id: "s01", name: "Nguyễn Văn An", role: "Trưởng phòng Kinh doanh", department: "Kinh doanh", avatar: "AN", phone: "0901234567" },
  { id: "s02", name: "Trần Thị Bảo", role: "Chuyên viên Sales", department: "Kinh doanh", avatar: "TB", phone: "0912345678" },
  { id: "s03", name: "Lê Minh Cường", role: "Chuyên viên Pháp lý", department: "Pháp lý", avatar: "LC", phone: "0923456789" },
  { id: "s04", name: "Phạm Thị Dung", role: "Chuyên viên CSKH", department: "CSKH", avatar: "PD", phone: "0934567890" },
  { id: "s05", name: "Hoàng Văn Em", role: "Kỹ thuật viên", department: "Kỹ thuật", avatar: "HE", phone: "0945678901" },
  { id: "s06", name: "Nguyễn Thị Phương", role: "Kế toán", department: "Tài chính", avatar: "NP", phone: "0956789012" },
  { id: "s07", name: "Vũ Đức Giang", role: "Chuyên viên Marketing", department: "Marketing", avatar: "VG", phone: "0967890123" },
  { id: "s08", name: "Đặng Thị Hoa", role: "Giám sát dự án", department: "Dự án", avatar: "DH", phone: "0978901234" },
];

const shiftConfig: Record<ShiftType, { label: string; time: string; bg: string; text: string; border: string; dotColor: string }> = {
  morning:   { label: "Ca sáng",   time: "07:00–12:00", bg: "bg-blue-50 dark:bg-blue-950/50",     text: "text-blue-700 dark:text-blue-300",    border: "border-blue-200 dark:border-blue-800",   dotColor: "bg-blue-500" },
  afternoon: { label: "Ca chiều",  time: "12:00–17:00", bg: "bg-amber-50 dark:bg-amber-950/50",   text: "text-amber-700 dark:text-amber-300",  border: "border-amber-200 dark:border-amber-800", dotColor: "bg-amber-500" },
  evening:   { label: "Ca tối",    time: "17:00–22:00", bg: "bg-purple-50 dark:bg-purple-950/50", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800", dotColor: "bg-purple-500" },
  full_day:  { label: "Cả ngày",   time: "07:00–17:00", bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800", dotColor: "bg-emerald-500" },
  off:       { label: "Nghỉ",      time: "—",            bg: "bg-slate-100 dark:bg-slate-800",     text: "text-slate-500 dark:text-slate-400",  border: "border-slate-200 dark:border-slate-700", dotColor: "bg-slate-400" },
};

const statusConfig: Record<ShiftStatus, { label: string; bg: string; text: string }> = {
  confirmed: { label: "Đã xác nhận", bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400" },
  pending:   { label: "Chờ xác nhận", bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400" },
  absent:    { label: "Vắng mặt",    bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-400" },
  late:      { label: "Đi muộn",     bg: "bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-400" },
  overtime:  { label: "Tăng ca",     bg: "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-400" },
};

function generateShifts(): ShiftEntry[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const shifts: ShiftEntry[] = [];
  const types: ShiftType[] = ["morning", "afternoon", "full_day", "off", "evening"];
  const statuses: ShiftStatus[] = ["confirmed", "confirmed", "confirmed", "pending", "absent"];
  const projects = ["The Grand Tower", "Riverside Heights", "Sunrise Villa"];
  const locations = ["Văn phòng HQ", "Showroom Q1", "Công trường TGT", "Showroom Q7"];

  let id = 1;
  STAFF_LIST.forEach((staff, si) => {
    for (let d = 1; d <= 30; d++) {
      const date = new Date(year, month, d);
      if (date.getDay() === 0) continue; // Skip Sundays
      
      const shiftType = types[(si + d) % types.length];
      const status = statuses[(si + d) % statuses.length];
      const cfg = shiftConfig[shiftType];
      const sCfg = statusConfig[status];
      
      shifts.push({
        id: `shift-${id++}`,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        department: staff.department,
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        shiftType,
        shiftLabel: cfg.label,
        timeRange: cfg.time,
        status,
        statusLabel: sCfg.label,
        project: shiftType !== 'off' ? projects[d % projects.length] : undefined,
        location: shiftType !== 'off' ? locations[d % locations.length] : undefined,
        note: d % 7 === 0 ? "Họp nhóm buổi sáng" : d % 11 === 0 ? "Gặp khách hàng VIP" : undefined,
        isMyShift: staff.id === 's01',
        isPendingApproval: status === 'pending',
      });
    }
  });
  return shifts;
}

const ALL_SHIFTS = generateShifts();

// Get week days for current week
function getWeekDays(baseDate: Date): Date[] {
  const day = baseDate.getDay(); // 0=Sun
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEPT_COLORS: Record<string, string> = {
  "Kinh doanh": "text-blue-600 dark:text-blue-400",
  "Pháp lý":    "text-purple-600 dark:text-purple-400",
  "CSKH":       "text-rose-600 dark:text-rose-400",
  "Kỹ thuật":   "text-orange-600 dark:text-orange-400",
  "Tài chính":  "text-emerald-600 dark:text-emerald-400",
  "Marketing":  "text-pink-600 dark:text-pink-400",
  "Dự án":      "text-amber-600 dark:text-amber-400",
};

const AVATAR_COLORS: Record<string, string> = {
  "s01": "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  "s02": "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
  "s03": "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300",
  "s04": "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300",
  "s05": "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300",
  "s06": "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  "s07": "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  "s08": "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300",
};

// ── MAIN COMPONENT ──
export default function SchedulesPage() {
  const [today] = useState(() => new Date());
  const [baseDate, setBaseDate] = useState(today);
  const [viewMode, setViewMode] = useState<"week" | "list">("week");
  const [filterDept, setFilterDept] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [activeTabFilter, setActiveTabFilter] = useState("all");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [shifts, setShifts] = useState<ShiftEntry[]>(ALL_SHIFTS);
  const [modalStaff, setModalStaff] = useState<string>(STAFF_LIST[0]?.id || '');
  const [modalShift, setModalShift] = useState<string>('morning');
  const [modalProject, setModalProject] = useState<string>('The Grand Tower');

  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate]);

  // KPI metrics
  const kpis = useMemo(() => {
    const todayKey = formatDateKey(today);
    const todayShifts = shifts.filter(s => s.date === todayKey);
    return {
      totalStaff: STAFF_LIST.length,
      todayPresent: todayShifts.filter(s => s.status === 'confirmed' && s.shiftType !== 'off').length,
      todayAbsent: todayShifts.filter(s => s.status === 'absent').length,
      pending: shifts.filter(s => s.isPendingApproval).length,
      overtime: shifts.filter(s => s.status === 'overtime').length,
      weekTotal: shifts.filter(s => {
        const d = new Date(s.date);
        return weekDays.some(wd => formatDateKey(wd) === s.date) && s.shiftType !== 'off';
      }).length,
    };
  }, [shifts, weekDays, today]);

  // Filtered list for list view
  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      if (!weekDays.some(day => formatDateKey(day) === s.date)) return false;
      if (activeTabFilter === 'mine' && !s.isMyShift) return false;
      if (activeTabFilter === 'pending' && !s.isPendingApproval) return false;
      if (activeTabFilter === 'absent' && s.status !== 'absent') return false;
      if (activeTabFilter === 'today' && s.date !== formatDateKey(today)) return false;

      if (filterDept !== 'all' && s.department !== filterDept) return false;
      if (filterShift !== 'all' && s.shiftType !== filterShift) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;

      if (search) {
        const q = search.toLowerCase();
        if (!s.staffName.toLowerCase().includes(q) && !s.staffRole.toLowerCase().includes(q) && !s.department.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [shifts, activeTabFilter, filterDept, filterShift, filterStatus, search, weekDays, today]);

  // Build week grid data: staffId -> dateKey -> shift
  const weekGrid = useMemo(() => {
    const grid: Record<string, Record<string, ShiftEntry | null>> = {};
    STAFF_LIST.forEach(st => {
      grid[st.id] = {};
      weekDays.forEach(d => {
        const key = formatDateKey(d);
        grid[st.id][key] = filteredShifts.find(s => s.staffId === st.id && s.date === key) || null;
      });
    });
    return grid;
  }, [filteredShifts, weekDays]);

  const selectedShift = useMemo(() => filteredShifts.find(s => s.id === selectedShiftId) || null, [filteredShifts, selectedShiftId]);

  const goToPrevWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 7);
    setBaseDate(d);
  };

  const goToNextWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    setBaseDate(d);
  };

  const handleConfirmShift = (shiftId: string) => { unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1680px] mx-auto font-sans text-slate-900 dark:text-slate-100 pb-12">
      <LandPreviewNotice />

      {/* ── 1. HEADER BANNER (Light Theme, high contrast) ── */}
      <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 md:p-6 shadow-xs">
        {/* Decorative office/building watermark */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1/2 bg-cover bg-right opacity-[0.07] dark:opacity-[0.15] pointer-events-none mix-blend-multiply dark:mix-blend-luminosity"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-transparent dark:from-slate-900 dark:via-slate-900/92 dark:to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                <Calendar className="w-3.5 h-3.5" /> Quản lý nhân sự
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Lịch Làm Việc
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
              Quản lý ca trực, lịch làm việc theo tuần và phân công nhân sự dự án bất động sản
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2.5">
            <div className="hidden xl:block text-right">
              <div className="font-serif italic text-blue-900/80 dark:text-amber-300 text-sm font-semibold tracking-wide">
                Đội ngũ chuyên nghiệp - Nền tảng vững mạnh
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">
                BELLA LAND · REAL ESTATE FOR A BRIGHTER TOMORROW
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <div className="relative w-44 lg:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  placeholder="Tìm nhân viên..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none shadow-2xs"
                />
              </div>

              <button
                onClick={() => { setFilterStatus('pending'); toast.info("Đã lọc danh sách ca chờ xác nhận!"); }}
                className="relative p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-black text-white flex items-center justify-center">
                  4
                </span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Phân Ca Mới</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          { icon: Users, label: "Tổng nhân viên", value: kpis.totalStaff, trend: null, trendUp: true, bg: "bg-blue-50 dark:bg-blue-950/60", iconColor: "text-blue-600 dark:text-blue-400", border: "border-blue-200/60 dark:border-blue-800/40" },
          { icon: UserCheck, label: "Có mặt hôm nay", value: kpis.todayPresent, trend: "+2", trendUp: true, bg: "bg-emerald-50 dark:bg-emerald-950/60", iconColor: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200/60 dark:border-emerald-800/40" },
          { icon: CalendarX, label: "Vắng mặt", value: kpis.todayAbsent, trend: "-1", trendUp: false, bg: "bg-rose-50 dark:bg-rose-950/60", iconColor: "text-rose-600 dark:text-rose-400", border: "border-rose-200/60 dark:border-rose-800/40" },
          { icon: AlertTriangle, label: "Chờ xác nhận", value: kpis.pending, trend: "+5", trendUp: false, bg: "bg-amber-50 dark:bg-amber-950/60", iconColor: "text-amber-600 dark:text-amber-400", border: "border-amber-200/60 dark:border-amber-800/40" },
          { icon: Star, label: "Tăng ca", value: kpis.overtime, trend: "+3", trendUp: true, bg: "bg-purple-50 dark:bg-purple-950/60", iconColor: "text-purple-600 dark:text-purple-400", border: "border-purple-200/60 dark:border-purple-800/40" },
          { icon: CalendarCheck, label: "Ca tuần này", value: kpis.weekTotal, trend: "+12%", trendUp: true, bg: "bg-slate-100 dark:bg-slate-800", iconColor: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpi.value}</span>
                {kpi.trend && (
                  <span className={`text-[11px] font-extrabold flex items-center ${kpi.trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {kpi.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {kpi.trend}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
            </div>
            <div className={`w-10 h-10 rounded-xl ${kpi.bg} border ${kpi.border} ${kpi.iconColor} flex items-center justify-center shrink-0`}>
              <kpi.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. VIEW MODE + WEEK NAV + FILTERS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Week Navigator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode("week")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
              >
                Tuần
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
              >
                Danh sách
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5">
              <button onClick={goToPrevWeek} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[140px] text-center">
                {weekDays[0]?.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – {weekDays[5]?.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
              <button onClick={goToNextWeek} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setBaseDate(today)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition"
            >
              Hôm nay
            </button>
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <PremiumSelect
              value={filterDept}
              onChange={setFilterDept}
              placeholder="Phòng ban"
              className="w-36"
              options={[
                { value: "all", label: "Phòng ban" },
                { value: "Kinh doanh", label: "Kinh doanh" },
                { value: "Pháp lý", label: "Pháp lý" },
                { value: "CSKH", label: "CSKH" },
                { value: "Kỹ thuật", label: "Kỹ thuật" },
                { value: "Tài chính", label: "Tài chính" },
                { value: "Marketing", label: "Marketing" },
                { value: "Dự án", label: "Dự án" },
              ]}
            />

            <PremiumSelect
              value={filterShift}
              onChange={setFilterShift}
              placeholder="Ca làm việc"
              className="w-36"
              options={[
                { value: "all", label: "Ca làm việc" },
                { value: "morning", label: "Ca sáng" },
                { value: "afternoon", label: "Ca chiều" },
                { value: "evening", label: "Ca tối" },
                { value: "full_day", label: "Cả ngày" },
                { value: "off", label: "Nghỉ" },
              ]}
            />

            <PremiumSelect
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Trạng thái"
              className="w-36"
              options={[
                { value: "all", label: "Trạng thái" },
                { value: "confirmed", label: "Đã xác nhận" },
                { value: "pending", label: "Chờ xác nhận" },
                { value: "absent", label: "Vắng mặt" },
                { value: "late", label: "Đi muộn" },
                { value: "overtime", label: "Tăng ca" },
              ]}
            />

            <button
              onClick={() => { setFilterDept('all'); setFilterShift('all'); setFilterStatus('all'); setSearch(''); setActiveTabFilter('all'); }}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
              title="Đặt lại bộ lọc"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'Tất cả', count: shifts.length.toString() },
              { id: 'today', label: 'Hôm nay', count: shifts.filter(s => s.date === formatDateKey(today)).length.toString() },
              { id: 'mine', label: 'Ca của tôi', count: shifts.filter(s => s.isMyShift).length.toString() },
              { id: 'pending', label: 'Chờ xác nhận', count: kpis.pending.toString() },
              { id: 'absent', label: 'Vắng mặt', count: kpis.todayAbsent.toString() },
            ].map(tab => {
              const isActive = activeTabFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                unavailableLandAction("Xuất tài liệu nghiệp vụ");
                unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. CONTENT AREA ── */}
      {viewMode === 'week' ? (
        /* WEEK GRID VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
                  <th className="p-3 text-left font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] w-[200px] sticky left-0 bg-slate-50/80 dark:bg-slate-800/60 z-10">
                    Nhân viên
                  </th>
                  {weekDays.map(day => {
                    const isToday = formatDateKey(day) === formatDateKey(today);
                    return (
                      <th key={formatDateKey(day)} className={`p-3 text-center font-extrabold uppercase tracking-wider text-[11px] min-w-[120px] ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        <div>{day.toLocaleDateString('vi-VN', { weekday: 'short' })}</div>
                        <div className={`mt-0.5 ${isToday ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto text-[11px] font-black' : ''}`}>
                          {day.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {STAFF_LIST.filter(st => filterDept === 'all' || st.department === filterDept).filter(st => !search || st.name.toLowerCase().includes(search.toLowerCase())).map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                    {/* Staff cell - sticky */}
                    <td className="p-3 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/30 z-10 border-r border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${AVATAR_COLORS[staff.id] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                          {staff.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 dark:text-white text-[12px] leading-tight truncate">{staff.name}</div>
                          <div className={`text-[10px] font-semibold truncate ${DEPT_COLORS[staff.department] || 'text-slate-400'}`}>{staff.department}</div>
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {weekDays.map(day => {
                      const key = formatDateKey(day);
                      const shift = weekGrid[staff.id]?.[key];
                      const isToday = key === formatDateKey(today);
                      const cfg = shift ? shiftConfig[shift.shiftType] : null;
                      const sCfg = shift ? statusConfig[shift.status] : null;

                      return (
                        <td
                          key={key}
                          className={`p-2 text-center align-middle ${isToday ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}
                          onClick={() => { if (shift) { setSelectedShiftId(shift.id); setViewMode("list"); } }}
                        >
                          {shift && shift.shiftType !== 'off' ? (
                            <button className={`w-full px-2 py-2 rounded-xl border text-[10px] font-bold text-left transition hover:shadow-sm ${cfg?.bg} ${cfg?.text} ${cfg?.border} ${shift.status === 'absent' ? 'opacity-60' : ''}`}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg?.dotColor}`} />
                                <span className="font-extrabold truncate">{cfg?.label}</span>
                              </div>
                              <div className="text-[9px] opacity-80 font-mono leading-tight">{cfg?.time}</div>
                              {shift.isPendingApproval && (
                                <div className="mt-1 px-1 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[9px] font-black">
                                  Chờ duyệt
                                </div>
                              )}
                              {shift.status === 'absent' && (
                                <div className="mt-1 px-1 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 text-[9px] font-black">
                                  Vắng
                                </div>
                              )}
                            </button>
                          ) : shift?.shiftType === 'off' ? (
                            <div className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-[10px] font-bold text-center">
                              Nghỉ
                            </div>
                          ) : (
                            <div className="text-slate-200 dark:text-slate-700 text-[10px]">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-4">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Chú thích:</span>
            {Object.entries(shiftConfig).filter(([k]) => k !== 'off').map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} />
                <span className={`text-[11px] font-bold ${cfg.text}`}>{cfg.label} ({cfg.time})</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* List Table */}
          <div className={`${selectedShift ? 'xl:col-span-8' : 'xl:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-3 font-bold">Nhân viên</th>
                    <th className="p-3 font-bold">Ngày</th>
                    <th className="p-3 font-bold">Ca</th>
                    <th className="p-3 font-bold">Dự án / Địa điểm</th>
                    <th className="p-3 font-bold">Trạng thái</th>
                    <th className="p-3 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {filteredShifts.map(shift => {
                    const cfg = shiftConfig[shift.shiftType];
                    const sCfg = statusConfig[shift.status];
                    const isSelected = shift.id === selectedShiftId;
                    return (
                      <tr
                        key={shift.id}
                        onClick={() => setSelectedShiftId(isSelected ? null : shift.id)}
                        className={`group cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}
                      >
                        {/* Staff */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${AVATAR_COLORS[shift.staffId] || 'bg-slate-100 text-slate-600'}`}>
                              {shift.staffName.split(' ').pop()?.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{shift.staffName}</div>
                              <div className={`text-[11px] font-semibold ${DEPT_COLORS[shift.department] || 'text-slate-400'}`}>{shift.department} · {shift.staffRole}</div>
                            </div>
                          </div>
                        </td>
                        {/* Date */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {new Date(shift.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </div>
                          <div className="text-[11px] text-slate-400">{shift.timeRange}</div>
                        </td>
                        {/* Shift type */}
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                            {cfg.label}
                          </span>
                        </td>
                        {/* Project */}
                        <td className="p-3">
                          {shift.project ? (
                            <>
                              <div className="font-bold text-slate-900 dark:text-white">{shift.project}</div>
                              {shift.location && <div className="text-[11px] text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{shift.location}</div>}
                            </>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${sCfg.bg} ${sCfg.text}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {sCfg.label}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            {shift.isPendingApproval && (
                              <button
                                onClick={() => handleConfirmShift(shift.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition"
                              >
                                Duyệt
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedShiftId(shift.id)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredShifts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-500 italic">
                        Không tìm thấy ca làm việc phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Hiển thị {filteredShifts.length} kết quả
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {selectedShiftId && selectedShift && (
              <motion.div
                key="detail-panel"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32 }}
                transition={{ duration: 0.2 }}
                className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5 sticky top-6"
              >
                {/* Detail Header */}
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black shrink-0 ${AVATAR_COLORS[selectedShift.staffId] || 'bg-slate-100 text-slate-600'}`}>
                      {selectedShift.staffName.split(' ').pop()?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white">{selectedShift.staffName}</h2>
                      <div className={`text-xs font-semibold ${DEPT_COLORS[selectedShift.department] || 'text-slate-400'}`}>{selectedShift.staffRole}</div>
                      <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusConfig[selectedShift.status].bg} ${statusConfig[selectedShift.status].text}`}>
                        ● {statusConfig[selectedShift.status].label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedShiftId(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Shift Details */}
                <div className="space-y-3">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">Chi tiết ca làm việc</div>
                  {[
                    { icon: Calendar, label: "Ngày", value: new Date(selectedShift.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) },
                    { icon: Clock, label: "Ca", value: `${shiftConfig[selectedShift.shiftType].label} (${shiftConfig[selectedShift.shiftType].time})` },
                    { icon: Briefcase, label: "Phòng ban", value: selectedShift.department },
                    { icon: Building2, label: "Dự án", value: selectedShift.project || "—" },
                    { icon: MapPin, label: "Địa điểm", value: selectedShift.location || "—" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <item.icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">{item.label}</div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{item.value}</div>
                      </div>
                    </div>
                  ))}
                  {selectedShift.note && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-300">
                      📝 {selectedShift.note}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">Thao tác</div>
                  {selectedShift.isPendingApproval && (
                    <button
                      onClick={() => handleConfirmShift(selectedShift.id)}
                      className="w-full py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Xác nhận ca làm việc
                    </button>
                  )}
                  <button
                    onClick={() => { unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); setShowAddModal(true); setSelectedShiftId(null); }}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition cursor-pointer"
                  >
                    Chỉnh sửa ca
                  </button>
                  <button
                    onClick={() => { unavailableLandAction("Hủy ca làm việc"); }}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition"
                  >
                    Hủy ca làm việc
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── 5. ADD SHIFT MODAL ── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Phân Ca Làm Việc Mới</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Thêm lịch ca cho nhân viên Real Estate</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nhân viên</label>
                  <PremiumSelect
                    value={modalStaff}
                    onChange={setModalStaff}
                    options={STAFF_LIST.map(s => ({ value: s.id, label: `${s.name} – ${s.department}` }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ngày làm việc</label>
                  <input type="date" defaultValue={formatDateKey(today)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ca làm việc</label>
                  <PremiumSelect
                    value={modalShift}
                    onChange={setModalShift}
                    options={[
                      { value: "morning", label: "Ca sáng (07:00–12:00)" },
                      { value: "afternoon", label: "Ca chiều (12:00–17:00)" },
                      { value: "evening", label: "Ca tối (17:00–22:00)" },
                      { value: "full_day", label: "Cả ngày (07:00–17:00)" },
                      { value: "off", label: "Nghỉ" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Dự án phân công</label>
                  <PremiumSelect
                    value={modalProject}
                    onChange={setModalProject}
                    options={[
                      { value: "The Grand Tower", label: "The Grand Tower" },
                      { value: "Riverside Heights", label: "Riverside Heights" },
                      { value: "Sunrise Villa", label: "Sunrise Villa" },
                      { value: "Văn phòng HQ", label: "Văn phòng HQ" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ghi chú</label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú thêm về ca làm việc..."
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition"
                >
                  Xác nhận phân ca
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
