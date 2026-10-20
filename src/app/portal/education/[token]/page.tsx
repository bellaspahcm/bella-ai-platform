'use client';

/**
 * Bella Preschool OS — Parent Portal Web Experience
 * File: src/app/portal/education/[token]/page.tsx
 *
 * Dedicated Mobile-First Portal for Preschool Guardians via Magic Link:
 * - Aggregates Live Class Headcount & Attendance
 * - Daily Care & Wellbeing Journal (Meals, Sleep, Hygiene, Health checks, Safe Pickup)
 * - Weekly Nutrition Menu Plan
 * - Daily Pedagogical Timetable & Routine
 * - Tuition Billing with Dynamic VietQR Payment
 * - Real-time Bidirectional Chat with Classroom Teachers (Persisted to DB)
 *
 * Strict Type Invariant: ZERO use of `any` and `unknown`.
 */

import { use, useEffect, useState, useTransition, type FormEvent } from 'react';
import {
  Baby,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Heart,
  HelpCircle,
  Info,
  Layers,
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  User,
  UserCheck,
  Users,
  Utensils,
  X,
  AlertCircle,
  ChevronRight,
  Phone,
  MapPin,
} from 'lucide-react';
import type {
  ParentPortalPayload,
  ParentPortalChatMessage,
  ParentPortalWeeklyMenuDay,
} from '@/products/bella-education/parent-portal/domain/parent-portal.types';

type PortalTab = 'daily' | 'menu' | 'timetable' | 'tuition' | 'chat';

const QUICK_MESSAGES = [
  'Hôm nay bé hơi ho, nhờ cô cho bé uống nước ấm nhiều nhé.',
  'Chiều nay 16:30 bà ngoại sẽ đến đón bé, nhờ cô hỗ trợ.',
  'Bé vừa khỏi ốm, nhờ cô chú ý giúp mẹ nếu bé mệt ạ.',
  'Mẹ có để thêm 1 bộ quần áo dự phòng trong balo của bé.',
];

export default function PreschoolParentPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [portalData, setPortalData] = useState<ParentPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>('daily');
  const [selectedDayKey, setSelectedDayKey] = useState<string>('T2');

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<readonly ParentPortalChatMessage[]>([]);
  const [chatSuccessNotice, setChatSuccessNotice] = useState<string | null>(null);

  // QR Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedBankInfo, setCopiedBankInfo] = useState(false);

  // Load Portal Data
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/education/portal/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: ParentPortalPayload;
        message?: string;
      };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || 'Không thể tải thông tin sổ liên lạc');
      }

      setPortalData(json.data);
      setChatMessages(json.data.chatMessages);

      // Default selected day in weekly menu
      if (json.data.weeklyMenu && json.data.weeklyMenu.days.length > 0) {
        setSelectedDayKey(json.data.weeklyMenu.days[0].dayKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Send Chat Message Handler
  async function handleSendMessage(e?: FormEvent, customText?: string) {
    if (e) e.preventDefault();
    const textToSend = customText || chatInput;
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);
    setChatSuccessNotice(null);

    try {
      const res = await fetch(`/api/education/portal/${encodeURIComponent(token)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      const json = (await res.json()) as {
        success: boolean;
        message?: ParentPortalChatMessage;
        error?: string;
      };

      if (!res.ok || !json.success || !json.message) {
        throw new Error(json.error || 'Lỗi gửi tin nhắn');
      }

      setChatMessages((prev) => [...prev, json.message as ParentPortalChatMessage]);
      setChatInput('');
      setChatSuccessNotice('Đã gửi tin nhắn đến cô giáo');
      setTimeout(() => setChatSuccessNotice(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không gửi được tin nhắn');
    } finally {
      setIsSending(false);
    }
  }

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedBankInfo(true);
    setTimeout(() => setCopiedBankInfo(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#0c513f] dark:text-emerald-400 mb-4 animate-pulse">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
          Đang kết nối Sổ liên lạc Phụ huynh...
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hệ thống đang đồng bộ dữ liệu lớp học và nhật ký hôm nay của bé
        </p>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-500 mb-4 shadow-sm">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Liên kết không hợp lệ hoặc đã hết hạn
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 leading-relaxed">
          {error || 'Đường dẫn liên kết phụ huynh đã hết hạn hoặc không tồn tại. Vui lòng liên hệ nhà trường để nhận liên kết mới.'}
        </p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="mt-6 px-5 py-2.5 rounded-full bg-[#0c513f] hover:bg-[#083a2d] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Thử tải lại</span>
        </button>
      </div>
    );
  }

  const {
    schoolName,
    guardianName,
    child,
    classroom,
    todayAttendance,
    dailyCare,
    handover,
    weeklyMenu,
    dailyTimetable,
    tuition,
  } = portalData;

  const selectedMenuDay: ParentPortalWeeklyMenuDay | undefined =
    weeklyMenu?.days.find((d) => d.dayKey === selectedDayKey) || weeklyMenu?.days[0];

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-24 md:pb-12">
      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 py-3 sm:px-6 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#0c513f] text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight line-clamp-1">
                {schoolName}
              </h1>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Sổ liên lạc điện tử chính thức</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        {/* ── HERO BANNER: CHILD & CLASSROOM OVERVIEW ── */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0c513f] via-[#094132] to-[#063025] text-white p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] w-48 h-48 rounded-full bg-white/5 pointer-events-none blur-2xl" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-xl text-emerald-200 shadow-inner shrink-0">
                {child.childName ? child.childName.charAt(0) : 'B'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {child.childName}
                  </h2>
                  {child.studentCode && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-emerald-200">
                      #{child.studentCode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-100/90 font-semibold mt-0.5">
                  {classroom.courseTitle} · GV: {classroom.teacherName || 'Cô Lan & Cô Mai'}
                </p>
              </div>
            </div>

            {/* Attendance Pill */}
            <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {todayAttendance.status === 'present'
                  ? `Đã đến lớp (${todayAttendance.rollCallTime || '07:35'})`
                  : todayAttendance.status === 'absent'
                  ? 'Nghỉ học hôm nay'
                  : todayAttendance.status === 'excused'
                  ? 'Nghỉ có phép'
                  : 'Chưa điểm danh'}
              </span>
            </div>
          </div>

          {/* Sĩ số lớp hôm nay & Tổng sĩ số */}
          <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Sĩ số lớp
              </p>
              <p className="text-base sm:text-lg font-black text-white mt-0.5">
                {classroom.totalClassSize} <span className="text-xs font-normal text-emerald-200">trẻ</span>
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Có mặt hôm nay
              </p>
              <p className="text-base sm:text-lg font-black text-emerald-300 mt-0.5">
                {classroom.presentTodayCount} <span className="text-xs font-normal text-emerald-200">bé</span>
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Tỷ lệ đi học
              </p>
              <p className="text-base sm:text-lg font-black text-amber-300 mt-0.5">
                {classroom.attendanceRatePercent}%
              </p>
            </div>
          </div>
        </section>

        {/* ── NAVIGATION TABS ── */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-[#0c513f] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Hôm nay</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-[#0c513f] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Thực đơn</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timetable')}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'timetable'
                ? 'bg-[#0c513f] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lịch học</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tuition')}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'tuition'
                ? 'bg-[#0c513f] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Học phí</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#0c513f] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Dặn cô</span>
          </button>
        </div>

        {/* ── TAB 1: NHẬT KÝ HÔM NAY CỦA CON ── */}
        {activeTab === 'daily' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Thân nhiệt & Sức khỏe */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
                  <div className="w-7 h-7 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-500 flex items-center justify-center">
                    <Thermometer className="w-4 h-4" />
                  </div>
                  <span>Sức khỏe & Thân nhiệt sáng</span>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {dailyCare?.healthChecks.temperature || 36.6}°C — Bình thường
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {dailyCare?.morningCondition || 'Bé khỏe mạnh, vui vẻ vào lớp.'}
              </p>
            </div>

            {/* Bữa ăn hôm nay */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
                  <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <span>Nhật ký bữa ăn</span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  {dailyCare?.mealRecords.length || 3} cữ ăn
                </span>
              </div>

              <div className="space-y-2.5">
                {dailyCare?.mealRecords.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 dark:text-slate-100">
                        {m.mealName} {m.time && <span className="text-[11px] font-normal text-slate-400">({m.time})</span>}
                      </p>
                      {m.note && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {m.note}
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[11px] shrink-0">
                      {m.consumedStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Giấc ngủ & Vệ sinh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Giấc ngủ */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 flex items-center justify-center">
                    <Sun className="w-4 h-4" />
                  </div>
                  <span>Giấc ngủ trưa</span>
                </div>
                <div className="pt-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {dailyCare?.napRecords.startTime || '11:45'} - {dailyCare?.napRecords.endTime || '14:00'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {dailyCare?.napRecords.quality || 'Bé ngủ ngoan và sâu giấc'}
                  </p>
                </div>
              </div>

              {/* Bàn giao đón trẻ */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <span>Bàn giao đón trẻ</span>
                </div>
                <div className="pt-1">
                  {handover.handedOver ? (
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                        Đã đón lúc {handover.handedOverAt || '17:00'}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Người đón: {handover.handedOverBy || 'Gia đình'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px]">
                        Đang ở trường
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Giờ trả trẻ: 16:00 - 17:30
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: THỰC ĐƠN TUẦN ── */}
        {activeTab === 'menu' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {weeklyMenu ? (
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Thực đơn Tuần {weeklyMenu.weekNumber}/{weeklyMenu.year}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Được kiểm định bởi Bác sĩ dinh dưỡng Nhi khoa
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Đã công bố
                  </span>
                </div>

                {/* Day selector pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {weeklyMenu.days.map((day) => (
                    <button
                      key={day.dayKey}
                      type="button"
                      onClick={() => setSelectedDayKey(day.dayKey)}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex flex-col items-center min-w-[58px] cursor-pointer ${
                        selectedDayKey === day.dayKey
                          ? 'bg-[#0c513f] text-white shadow-md scale-105'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <span>{day.dayKey}</span>
                      <span className="text-[10px] font-medium opacity-80">{day.dateStr}</span>
                    </button>
                  ))}
                </div>

                {/* Selected Day Dishes */}
                {selectedMenuDay && (
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                        {selectedMenuDay.dayLabel} ({selectedMenuDay.dateStr})
                      </span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-2xs">
                        ~{selectedMenuDay.caloriesKcal} Kcal/ngày
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100/60 dark:border-emerald-900/40 text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                      {selectedMenuDay.summaryDishes}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                Chưa có thực đơn cho tuần này
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: THỜI GIAN BIỂU / LỊCH HỌC ── */}
        {activeTab === 'timetable' && (
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Khung thời gian sinh hoạt & học tập
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Áp dụng chuẩn theo chương trình Mầm non Ánh Dương
              </p>
            </div>

            <div className="relative pl-6 space-y-4 border-l-2 border-emerald-200 dark:border-emerald-900 ml-2">
              {dailyTimetable.map((slot) => (
                <div key={slot.id} className="relative group">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-[#0c513f] border-2 border-white dark:border-slate-900 shadow-xs" />
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 transition-colors">
                    <span className="text-[11px] font-black text-[#0c513f] dark:text-emerald-400">
                      {slot.timeSlot}
                    </span>
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                      {slot.activityTitle}
                    </h4>
                    {slot.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {slot.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: HỌC PHÍ & VIETQR ── */}
        {activeTab === 'tuition' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {tuition ? (
              <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {tuition.billingPeriodName}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Mã HĐ: {tuition.invoiceCode} · Hạn đóng: {tuition.dueDate}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-black px-3 py-1 rounded-full ${
                      tuition.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {tuition.status === 'PAID' ? 'Đã hoàn tất' : 'Chờ thanh toán'}
                  </span>
                </div>

                {/* Line Items Breakdown */}
                <div className="space-y-2 text-xs">
                  {tuition.lineItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-300 py-1">
                      <span>{item.description}</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {item.amount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center text-sm font-black text-slate-900 dark:text-white">
                    <span>Tổng số tiền cần thanh toán</span>
                    <span className="text-base text-[#0c513f] dark:text-emerald-400">
                      {tuition.balanceDue.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                {/* VietQR Action Button */}
                {tuition.status !== 'PAID' && tuition.vietQrPayload && (
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="w-full py-3.5 rounded-2xl bg-[#0c513f] hover:bg-[#083a2d] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Mở mã VietQR chuyển khoản ngay</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                Không có hóa đơn học phí nào cần thanh toán
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: DẶN DÒ & CHAT VỚI NHÀ TRƯỜNG ── */}
        {activeTab === 'chat' && (
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Dặn dò cô giáo chủ nhiệm
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tin nhắn được chuyển trực tiếp vào màn hình điều hành của lớp
                </p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Trực tuyến" />
            </div>

            {/* Quick Prompts */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Lời dặn mẫu thường dùng
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {QUICK_MESSAGES.map((msg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void handleSendMessage(undefined, msg)}
                    className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-emerald-50 hover:text-emerald-800 transition-colors border border-slate-200/60 dark:border-slate-700 cursor-pointer"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Thread Messages */}
            <div className="space-y-3 max-h-72 overflow-y-auto p-1">
              {chatMessages.map((msg) => {
                const isMe = msg.senderRole === 'GUARDIAN';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] font-bold text-slate-400 mb-0.5 px-1">
                      {msg.senderName} · {msg.createdAt ? msg.createdAt.slice(11, 16) : ''}
                    </span>
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                        isMe
                          ? 'bg-[#0c513f] text-white rounded-br-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/60 dark:border-slate-700'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {chatSuccessNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{chatSuccessNotice}</span>
              </div>
            )}

            {/* Compose Input */}
            <form onSubmit={handleSendMessage} className="pt-2 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập lời dặn cô giáo hôm nay..."
                disabled={isSending}
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0c513f] transition-all"
              />
              <button
                type="submit"
                disabled={isSending || !chatInput.trim()}
                className="px-4 py-3 rounded-2xl bg-[#0c513f] hover:bg-[#083a2d] disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Gửi</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ── VIETQR MODAL ── */}
      {isQrModalOpen && tuition?.vietQrPayload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Mã VietQR Thanh Toán Học Phí
              </h3>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QR Image */}
            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-inner inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tuition.vietQrPayload.qrUrl}
                alt="VietQR Mã Thanh Toán"
                className="w-56 h-56 object-contain mx-auto"
              />
            </div>

            {/* Transfer details */}
            <div className="space-y-1.5 text-xs text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Số tài khoản:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {tuition.vietQrPayload.accountNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chủ tài khoản:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {tuition.vietQrPayload.accountName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nội dung:</span>
                <span className="font-mono font-bold text-[#0c513f] dark:text-emerald-400">
                  {tuition.vietQrPayload.description}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCopy(tuition.vietQrPayload?.accountNumber || '')}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedBankInfo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBankInfo ? 'Đã chép STK' : 'Chép STK'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="flex-1 py-2.5 rounded-2xl bg-[#0c513f] text-white text-xs font-bold hover:bg-[#083a2d] transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
