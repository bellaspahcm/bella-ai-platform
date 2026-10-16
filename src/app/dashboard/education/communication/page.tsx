'use client';

/**
 * Bella Education — Parent Communication & Engagement Hub
 * 
 * Scalable Architecture:
 * - Operational Metrics: SLA Queue, Read Receipts, Pending Consents, Parent Satisfaction
 * - Intent Detection & Action Shortcuts: Parent Message ➔ Care Note / Attendance / Finance Workflow
 * - Announcement Consent Engine: SENT ➔ DELIVERED ➔ READ ➔ ACKNOWLEDGED ➔ CONSENTED
 * - Sub-Workspace Tabs:
 *   1. Tổng Quan Engagement Hub (Urgent Queue & SLA Trackers)
 *   2. Tin Nhắn & Sổ Liên Lạc (Conversations with Intent Actions)
 *   3. Daily Child Update (Automated Daily Digest of Child Operations)
 *   4. Thông Báo & Form Đồng Ý (Announcements & Consent Engine)
 *   5. Hoạt Động & Thư Viện Ảnh (Media Feed & Privacy Consent Policy)
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Megaphone,
  ArrowLeft,
  Search,
  Bell,
  CheckCheck,
  User,
  Heart,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Bot,
  Plus,
  Send,
  FileCheck,
  Camera,
  ShieldCheck,
  UserCheck,
  X,
  Check,
  Layers,
  Filter,
  Activity,
  Users
} from 'lucide-react';

type CommunicationMessage = {
  id: string;
  parentName: string;
  childName: string;
  className: string;
  timestamp: string;
  content: string;
  unread: boolean;
  slaExceeded: boolean;
  assignedTeacher: string;
  detectedIntent?: string;
  actionDone?: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
  avatarBg: string;
};

type SchoolAnnouncement = {
  id: string;
  title: string;
  category: 'CHUNG' | 'DÃ NGOẠI' | 'HỌC PHÍ' | 'Y TẾ';
  publishDate: string;
  author: string;
  scope: string;
  requiresConsent: boolean;
  stats: {
    totalTarget: number;
    delivered: number;
    read: number;
    consented: number;
    pending: number;
  };
};

export default function CommunicationPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'daily' | 'announcements' | 'media'>('overview');
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  // Parent Messages with Intent Detection & Action Shortcuts
  const [messagesList, setMessagesList] = useState<CommunicationMessage[]>([
    {
      id: 'MSG-001',
      parentName: 'Mẹ Bé Minh An',
      childName: 'Nguyễn Minh An (Bé Bi)',
      className: 'Lớp Mầm A1',
      timestamp: '08:15 Sáng (30 phút trước)',
      content: 'Cô ơi hôm nay bé Bi hơi sụt sịt mũi, nhờ cô cho bé mặc thêm áo khoác và theo dõi giúp em ạ!',
      unread: true,
      slaExceeded: false,
      assignedTeacher: 'Cô Nguyễn Thị Mai',
      detectedIntent: 'Yêu cầu lưu ý sức khỏe & trang phục',
      status: 'NEW',
      avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
    },
    {
      id: 'MSG-002',
      parentName: 'Bố Bé Bảo Ngọc',
      childName: 'Trần Bảo Ngọc (Bé Bắp)',
      className: 'Lớp Chồi B1',
      timestamp: '4 giờ trước',
      content: 'Cô ơi chiều nay gia đình xin phép đón bé sớm lúc 15h30 để đi khám răng định kỳ ạ.',
      unread: true,
      slaExceeded: true,
      assignedTeacher: 'Cô Trần Ngọc Anh',
      detectedIntent: 'Xin đón sớm / Xin nghỉ',
      status: 'NEW',
      avatarBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
    },
    {
      id: 'MSG-003',
      parentName: 'Mẹ Bé Hoàng Nam',
      childName: 'Lê Hoàng Nam (Bé Tí)',
      className: 'Lớp Lá C1',
      timestamp: 'Thứ Ba, 08/09',
      content: 'Cô Linh cho em hỏi lịch đóng học phí tháng 10 hạn chót là ngày nào ạ?',
      unread: false,
      slaExceeded: false,
      assignedTeacher: 'Cô Đặng Thùy Linh',
      actionDone: 'Đã gửi thông tin hạn đóng học phí 15/10',
      status: 'RESOLVED',
      avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    },
  ]);

  // Announcements with Consent Engine Tracking
  const announcementsList: SchoolAnnouncement[] = [
    {
      id: 'ANN-001',
      title: 'Thông Báo & Đơn Đồng Ý Tham Gia Dã Ngoại Nông Trại Sinh Thái Tháng 9',
      category: 'DÃ NGOẠI',
      publishDate: '08/09/2026',
      author: 'Ban Giám Hiệu Bella Preschool',
      scope: 'Toàn Trường (Khối Mầm, Chồi, Lá)',
      requiresConsent: true,
      stats: {
        totalTarget: 280,
        delivered: 272,
        read: 265,
        consented: 247,
        pending: 25,
      },
    },
    {
      id: 'ANN-002',
      title: 'Thư Mời Tham Dự Hội Thảo "Đồng Hành Cùng Con Trong Giới Hạn 0-6 Tuổi"',
      category: 'CHUNG',
      publishDate: '02/09/2026',
      author: 'Chuyên gia Tâm lý & Ban Giám Hiệu',
      scope: 'Toàn Trường',
      requiresConsent: false,
      stats: {
        totalTarget: 280,
        delivered: 280,
        read: 240,
        consented: 240,
        pending: 0,
      },
    },
  ];

  const handleCreateCareNoteFromMessage = (id: string) => {
    setMessagesList((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: 'IN_PROGRESS',
              actionDone: 'Đã chuyển thành Lưu Ý Chăm Sóc cho Cô Chủ Nhiệm & Y Tế',
              unread: false,
            }
          : m
      )
    );
  };

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── UNIFIED PAGE HEADER ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-[var(--education-brand-ink)] shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Truyền Thông & Parent Engagement Hub
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Kênh tương tác trực tiếp 360°, thông báo điều hành toàn trường, sổ liên lạc điện tử & quy trình phản hồi phụ huynh
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsAnnouncementModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Megaphone className="w-4 h-4" />
            <span>Gửi Thông Báo Điều Hành</span>
          </button>
        </div>

        {/* ── ACTIONABLE OPERATIONAL GOVERNANCE METRICS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--education-brand-ink)]">
                Tin Nhắn Phụ Huynh Mới
              </span>
              <MessageSquare className="w-4 h-4 text-[var(--education-brand-ink)]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-indigo-900 dark:text-indigo-200">08 Chưa Đọc</p>
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                🔴 3 cuộc trò chuyện quá 4h SLA
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Tỷ Lệ Đã Đọc Thông Báo
              </span>
              <CheckCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-200">96.8% Đã Đọc</p>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                268 / 280 phụ huynh đã tiếp nhận
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Phản Hồi Consent Dã Ngoại
              </span>
              <FileCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-amber-900 dark:text-amber-200">25 Chưa Phản Hồi</p>
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mt-0.5 cursor-pointer underline">
                👉 Nhắc 25 Phụ Huynh Qua Zalo/App
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Hài Lòng Phụ Huynh
              </span>
              <Heart className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-purple-900 dark:text-purple-200">4.9 / 5.0 ⭐</p>
              <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 mt-0.5">
                Khảo sát định kỳ tháng 9
              </p>
            </div>
          </div>
        </div>

        {/* ── WORKSPACE TABS NAVIGATION ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tổng Quan Communication Center
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'messages'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Tin Nhắn & Intent Workflows ({messagesList.filter((m) => m.unread).length})
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Daily Child Update (Sổ Liên Lạc)
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'announcements'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Thông Báo & Form Đồng Ý (Consent)
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'media'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Hoạt Động & Media Feed
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT 1: OVERVIEW & INTENT WORKFLOW MESSAGES ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Messages Stream with Intent Detection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[var(--education-brand-ink)]" />
                  Tin Nhắn Phụ Huynh Cần Xử Lý & Intent Actions
                </h2>
                <span className="text-xs font-bold text-slate-500">32 Cuộc Trò Chuyện Lớp</span>
              </div>

              <div className="space-y-4">
                {messagesList.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-5 rounded-3xl border ${
                      msg.slaExceeded
                        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/60'
                    } space-y-3`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl ${msg.avatarBg} flex items-center justify-center font-extrabold text-sm shrink-0`}>
                          {msg.parentName.split(' ').pop()?.[0]}
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {msg.parentName} • <span className="text-[var(--education-brand-ink)]">{msg.childName}</span>
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-500">{msg.className} • {msg.assignedTeacher}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {msg.slaExceeded && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                            ⚠️ Quá 4h SLA
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-slate-400">{msg.timestamp}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-1">
                      &quot;{msg.content}&quot;
                    </p>

                    {/* AI Intent Detection Box */}
                    {msg.detectedIntent && (
                      <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[var(--education-brand-ink)] flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-[var(--education-brand-ink)]" />
                            AI Intent Detection: <strong>{msg.detectedIntent}</strong>
                          </span>
                          <span className="text-[10px] text-slate-500">(Cần cô giáo xác nhận)</span>
                        </div>

                        {msg.actionDone ? (
                          <div className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {msg.actionDone}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleCreateCareNoteFromMessage(msg.id)}
                              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-[11px] hover:bg-primary-hover transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tạo Lưu Ý Chăm Sóc (Care Note)</span>
                            </button>
                            <button className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] hover:bg-slate-300 transition-all cursor-pointer">
                              Bỏ Qua
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* School Announcements & Consent Tracker */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-4">
                <Megaphone className="w-5 h-5 text-[var(--education-brand-ink)]" />
                Thông Báo & Form Đồng Ý (Consent)
              </h2>

              <div className="space-y-4">
                {announcementsList.map((ann) => (
                  <div key={ann.id} className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/15 text-[var(--education-brand-ink)]">
                        {ann.category}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">{ann.publishDate}</span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 dark:text-white leading-snug">{ann.title}</h4>

                    {/* Consent Engine Progress */}
                    {ann.requiresConsent && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span className="text-emerald-600">✓ 247 Phụ huynh đồng ý ({Math.round((247 / 280) * 100)}%)</span>
                          <span className="text-amber-600">25 Chưa phản hồi</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(247 / 280) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 3: DAILY CHILD UPDATE DIGEST ── */}
      {activeTab === 'daily' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--education-brand-ink)]" />
            Sổ Liên Lạc Điện Tử Nhật Ký Con Hôm Nay (Daily Child Digest Engine)
          </h3>

          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs space-y-1">
            <span className="font-extrabold text-[var(--education-brand-ink)]">
              Tổng Hợp Dữ Liệu Tự Động Từ Các Domain Vận Hành:
            </span>
            <p className="text-[var(--education-brand-ink)]">
              ✓ Điểm danh 07:42 • 🍱 Bữa trưa 90% • 😴 Giấc ngủ 12:10-13:45 • 🎨 Hoạt động STEAM • 📝 Lời nhắn cô giáo.
            </p>
          </div>
        </div>
      )}

      {/* ── GOVERNED ANNOUNCEMENT MODAL WITH AUDIENCE TARGETING ── */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setIsAnnouncementModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--education-brand-ink)]">
                Khởi tạo thông báo điều hành có phân vùng
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Gửi Thông Báo Toàn Trường / Phân Vùng
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Đối tượng tiếp nhận (Audience Scope)
                </label>
                <select className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring">
                  <option>Toàn Trường (280 Phụ Huynh)</option>
                  <option>Khối Mầm (80 Phụ Huynh)</option>
                  <option>Khối Chồi (90 Phụ Huynh)</option>
                  <option>Khối Lá (110 Phụ Huynh)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Tiêu đề thông báo
                </label>
                <input
                  type="text"
                  placeholder="Nhập tiêu đề thông báo..."
                  className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="requireConsent" className="rounded text-[var(--education-brand-ink)] focus:ring-ring" />
                <label htmlFor="requireConsent" className="text-xs font-extrabold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Yêu cầu Phụ huynh xác nhận / Đồng ý (Form Consent Engine)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Phát Hành Thông Báo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
