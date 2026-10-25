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

import { use, useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { isParentPortalAnnouncementFeed, isParentPortalDailyRead, type ParentPortalDailyRead } from '@/products/bella-education/parent-portal/domain/parent-portal.types';
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
  ParentPortalAnnouncement,
  ParentPortalChatMessage,
  ParentPortalWeeklyMenuDay,
} from '@/products/bella-education/parent-portal/domain/parent-portal.types';

type PortalLegacyPayload = ParentPortalPayload & { readonly announcements: readonly ParentPortalAnnouncement[] };
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

  const [portalData, setPortalData] = useState<PortalLegacyPayload | null>(null);
  const [dailyRead, setDailyRead] = useState<ParentPortalDailyRead | null>(null);
  const [loadedToken, setLoadedToken] = useState('');
  const generation = useRef(0);
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

  // Smart Care Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [, startCopilotTransition] = useTransition();

  // Load Portal Data
  async function loadData() {
    const requestId = ++generation.current;
    setLoadedToken(token); setPortalData(null); setDailyRead(null);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/education/portal/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: PortalLegacyPayload | ParentPortalDailyRead;
        message?: string;
      };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || 'Không thể tải thông tin sổ liên lạc');
      }

      if (requestId !== generation.current) return;
      if ('scope' in json.data) {
        if (!isParentPortalDailyRead(json.data)) throw new Error('Thông tin Portal chưa khả dụng');
        setDailyRead(json.data);
        return;
      }
      if (!isParentPortalAnnouncementFeed({ tenantId: json.data.tenantId, announcements: json.data.announcements })) {
        throw new Error('Thông báo chung chưa khả dụng');
      }
      setPortalData(json.data);
      setChatMessages(json.data.chatMessages);

      // Default selected day in weekly menu
      if (json.data.weeklyMenu && json.data.weeklyMenu.days.length > 0) {
        setSelectedDayKey(json.data.weeklyMenu.days[0].dayKey);
      }
    } catch (err) {
      if (requestId === generation.current) setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }

  function invalidateLoad() { generation.current++; }

  useEffect(() => {
    void loadData();
    return invalidateLoad;
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

  async function handleCopilotAsk(e?: FormEvent) {
    if (e) e.preventDefault();
    const q = copilotQuestion.trim();
    if (!q || isCopilotLoading) return;
    setIsCopilotLoading(true);
    setCopilotAnswer(null);
    try {
      const res = await fetch(`/api/education/portal/${encodeURIComponent(token)}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_copilot',
          question: q,
          studentName: portalData?.child.childName,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { answer?: string };
        message?: string;
      };
      if (json.success && json.data?.answer) {
        startCopilotTransition(() => {
          setCopilotAnswer(json.data?.answer ?? 'Đã nhận câu hỏi của ba mẹ.');
        });
      } else {
        setCopilotAnswer(json.message || 'Trợ lý AI hiện chưa khả dụng. Vui lòng liên hệ nhà trường trực tiếp.');
      }
    } catch {
      setCopilotAnswer('Không thể kết nối trợ lý AI. Vui lòng thử lại sau.');
    } finally {
      setIsCopilotLoading(false);
    }
  }

  if (loading || loadedToken !== token) {
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

  if (!error && dailyRead) {
    const status = { present: 'Có mặt', absent: 'Vắng', excused: 'Có phép', unmarked: 'Chưa điểm danh' }[dailyRead.attendanceStatus];
    return <main className="mx-auto min-h-screen max-w-xl space-y-6 bg-background p-6 text-foreground">
      <header className="space-y-2"><p className="text-sm">{dailyRead.schoolName}</p><h1 className="text-2xl font-bold">Sổ liên lạc phụ huynh</h1><p>Người giám hộ: {dailyRead.guardianName}</p></header>
      <section className="space-y-3 rounded-2xl border p-5" aria-label="Thông tin hôm nay">
        <h2 className="text-xl font-semibold">{dailyRead.childName}</h2>
        <p>{dailyRead.courseTitle} · {dailyRead.courseCode}</p><p>Ngày {dailyRead.schoolDay} (giờ Việt Nam)</p>
        <dl className="space-y-2"><div><dt className="font-semibold">Điểm danh</dt><dd>{status}</dd></div>
          <div><dt className="font-semibold">Sĩ số đang ghi danh</dt><dd>{dailyRead.totalClassSize}</dd></div>
          <div><dt className="font-semibold">Có mặt hôm nay</dt><dd>{dailyRead.presentTodayCount}</dd></div></dl>
        {dailyRead.attendanceUpdatedAt && <p className="text-sm">Cập nhật điểm danh: {new Date(dailyRead.attendanceUpdatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
      </section>
      <section className="space-y-3 rounded-2xl border p-5" aria-label="Thông báo chung của nhà trường">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Thông báo chung của nhà trường</h2>
          <span className="text-sm text-muted-foreground">{dailyRead.announcements.length} thông báo</span>
        </div>
        {dailyRead.announcements.length === 0 ? <p className="text-sm text-muted-foreground">Nhà trường chưa đăng thông báo chung.</p>
          : <ul className="space-y-3">{dailyRead.announcements.map(announcement => <li key={announcement.id} className="rounded-xl border p-4">
            <h3 className="font-semibold">{announcement.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm">{announcement.bodyText}</p>
            <time className="mt-3 block text-xs text-muted-foreground" dateTime={announcement.publishedAt}>
              {new Date(announcement.publishedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
            </time>
          </li>)}</ul>}
      </section>
      <p role="note" className="rounded-xl border p-4 text-sm">Liên kết này chỉ đọc thông tin lớp, điểm danh hôm nay và thông báo chung toàn trường. Nhắn tin riêng, email, thông báo đẩy, nhật ký chăm sóc, bàn giao, học phí, thực đơn, thời khóa biểu và AI chưa khả dụng trong phạm vi này.</p>
      <button type="button" onClick={() => void loadData()} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Tải lại thông tin</button>
    </main>;
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
    aiDailyDigest,
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
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs dark:border-emerald-900 dark:bg-slate-900" aria-label="Thông báo chung của nhà trường">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">Thông báo chung của nhà trường</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">{portalData.announcements.length} thông báo</span>
          </div>
          {portalData.announcements.length === 0 ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nhà trường chưa đăng thông báo chung.</p>
            : <ul className="mt-3 space-y-3">{portalData.announcements.map(announcement => <li key={announcement.id} className="rounded-xl border p-3">
              <h3 className="font-semibold">{announcement.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{announcement.bodyText}</p>
              <time className="mt-3 block text-xs text-slate-500 dark:text-slate-400" dateTime={announcement.publishedAt}>
                {new Date(announcement.publishedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </time>
            </li>)}</ul>}
        </section>
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
                  {classroom.courseTitle}{classroom.teacherName ? ` · GV: ${classroom.teacherName}` : ''}
                </p>
              </div>
            </div>

            {/* Attendance Pill */}
            <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {todayAttendance.status === 'present'
                  ? `Đã đến lớp${todayAttendance.rollCallTime ? ` (${todayAttendance.rollCallTime})` : ''}`
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
                {classroom.totalClassSize ?? '—'} <span className="text-xs font-normal text-emerald-200">trẻ</span>
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Có mặt hôm nay
              </p>
              <p className="text-base sm:text-lg font-black text-emerald-300 mt-0.5">
                {classroom.presentTodayCount ?? '—'} <span className="text-xs font-normal text-emerald-200">bé</span>
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Tỷ lệ đi học
              </p>
              <p className="text-base sm:text-lg font-black text-amber-300 mt-0.5">
                {classroom.attendanceRatePercent === null ? '—' : `${classroom.attendanceRatePercent}%`}
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

            {/* ── AI DAILY DIGEST CARD ── */}
            {aiDailyDigest && (
              <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white p-5 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_60%)] pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-lg shrink-0">
                        {aiDailyDigest.teacherMoodEmoji}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">
                          ✨ AI Daily Digest
                        </p>
                        <h3 className="text-xs font-extrabold text-white leading-tight mt-0.5">
                          {aiDailyDigest.title}
                        </h3>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-purple-100 shrink-0">
                      AI
                    </span>
                  </div>

                  <p className="text-[11px] text-purple-100 leading-relaxed mb-3">
                    {aiDailyDigest.digest}
                  </p>

                  <div className="space-y-1.5">
                    {aiDailyDigest.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-white/90">
                        <span className="text-purple-300 mt-0.5 shrink-0">▸</span>
                        <span className="font-medium">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                  {dailyCare ? `${dailyCare.mealRecords.length} cữ ăn` : 'Chưa có ghi nhận'}
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
                {(!dailyCare || dailyCare.mealRecords.length === 0) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có ghi nhận bữa ăn cho ngày này.</p>
                )}
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
                    {dailyCare?.napRecords?.startTime || '—'} - {dailyCare?.napRecords?.endTime || '—'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {dailyCare?.napRecords?.quality || 'Chưa có ghi nhận giấc ngủ.'}
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
                        Đã đón{handover.handedOverAt ? ` lúc ${handover.handedOverAt}` : ''}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {handover.handedOverBy ? `Người đón: ${handover.handedOverBy}` : 'Chưa có thông tin người đón.'}
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
                        {selectedMenuDay.caloriesKcal === null ? 'Chưa có số liệu năng lượng' : `~${selectedMenuDay.caloriesKcal} Kcal/ngày`}
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
                Thời gian biểu do trường cung cấp
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
              {dailyTimetable.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có thời gian biểu được công bố.</p>
              )}
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
                      {tuition.billingPeriodName || 'Thông tin hóa đơn'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {tuition.invoiceCode ? `Mã HĐ: ${tuition.invoiceCode}` : ''}{tuition.dueDate ? ` · Hạn đóng: ${tuition.dueDate}` : ''}
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
                  {tuition.lineItems.length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có chi tiết khoản thu.</p>
                  )}

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

      {/* ── SMART CARE FLOATING ASSISTANT BUTTON ── */}
      {!isCopilotOpen && (
        <button
          type="button"
          id="smart-care-fab"
          onClick={() => { setIsCopilotOpen(true); setCopilotAnswer(null); setCopilotQuestion(''); }}
          className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer border-2 border-white/30"
          aria-label="Mở trợ lý Smart Care"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* ── SMART CARE COPILOT MODAL OVERLAY ── */}
      {isCopilotOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">Smart Care</p>
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">Trợ lý AI chăm sóc bé</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopilotOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Đóng trợ lý"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Answer area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[80px]">
              {!copilotAnswer && !isCopilotLoading && (
                <div className="text-center py-6">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                    Hỏi về tình trạng sức khỏe, bữa ăn, hoạt động<br/>hay bất kỳ điều gì về con hôm nay.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {['Bé ăn uống hôm nay thế nào?', 'Có hoạt động nào của lớp không?', 'Nhà trường cần lưu ý gì?'].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => { setCopilotQuestion(q); }}
                        className="px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-[10px] font-bold border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isCopilotLoading && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/50">
                  <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin shrink-0" />
                  <p className="text-[11px] text-violet-700 dark:text-violet-300 font-medium">Trợ lý đang phân tích...</p>
                </div>
              )}
              {copilotAnswer && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border border-violet-100 dark:border-violet-900/40">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-wide">Smart Care</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-line">
                    {copilotAnswer}
                  </p>
                </div>
              )}
            </div>

            {/* Input area */}
            <form onSubmit={(e) => { void handleCopilotAsk(e); }} className="px-4 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <input
                  id="copilot-question-input"
                  type="text"
                  value={copilotQuestion}
                  onChange={(e) => setCopilotQuestion(e.target.value)}
                  placeholder="Hỏi về bé hôm nay..."
                  className="flex-1 bg-transparent px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                  disabled={isCopilotLoading}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!copilotQuestion.trim() || isCopilotLoading}
                  className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                  aria-label="Gửi câu hỏi"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
