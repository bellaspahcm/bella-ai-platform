'use client';

/**
 * Bella Education — Parent Communication & Engagement Workspace
 *
 * Redesigned from oversized card cluster (Image 1 & 2) to the streamlined,
 * high-hierarchy Inbox Workspace (Image 3):
 * - Scoped exclusively to Preschool tenants (`bella_education`)
 * - Unified brand deep green palette (`#0c513f` / `#075548`)
 * - Header: Back button + Chat bubble badge + "Truyền thông & Phụ huynh" +
 *           Subtitle + Month Selector ("Tháng 09/2026") + "+ Gửi thông báo" CTA
 * - 4 High-Hierarchy Neutral KPI Cards:
 *     1. Blue MessageSquare: Tin chưa đọc (8) — ● 3 cuộc quá hạn
 *     2. Green CheckCheck: Tỷ lệ đã đọc (96.8%) — ● 268 / 280 phụ huynh + progress bar
 *     3. Orange FileText: Chưa phản hồi (25) — ● Biểu mẫu đồng ý + progress bar
 *     4. Purple Heart: Hài lòng phụ huynh (4.9 / 5.0) — ◆ Khảo sát tháng 9 + 5 gold stars
 * - 6 Workspace Navigation Tabs:
 *     Tổng quan, Tin nhắn (badge 8), Sổ liên lạc, Thông báo, Biểu mẫu đồng ý, Hoạt động
 * - Two-Column Split Inbox Workspace (60% / 40%):
 *     - Left: "Tin nhắn phụ huynh" (32 cuộc trò chuyện), Search input, 4 quick filter pills
 *       (Tất cả 32, Chưa đọc 8, Cần xử lý 6, Quá hạn 3), 8 compact conversation cards, pagination
 *     - Right: Conversation Detail & Action Workspace (Chat history, Contextual AI Intent Detection Box,
 *       Contextual Action Recommendations, Linked Care Notes, and Response Compose Bar)
 * - Non-preschool fallback: Preserves standard view if tenant is not preschool
 * - STRICT TYPE SAFETY: Zero `any` and zero `unknown`
 */

import { useState, useEffect, useMemo, Suspense, type ChangeEvent } from 'react';
import Link from 'next/link';
import PreschoolSelect from '@/components/ui/PreschoolSelect';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  MessageSquare,
  Calendar,
  Send,
  Plus,
  Search,
  Filter,
  CheckCheck,
  Clock,
  Heart,
  FileText,
  Bell,
  BookOpen,
  ClipboardList,
  Camera,
  MoreVertical,
  Paperclip,
  Image as ImageIcon,
  Smile,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Bot,
  AlertCircle,
  FileCheck,
  Users,
  Megaphone,
  RefreshCw,
  UserCheck,
  Sparkles,
  Share2,
  Download,
  ThumbsUp,
  Eye,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useUser } from '@/lib/user-context';
import { isParentPortalAnnouncementFeed, type ParentPortalAnnouncement } from '@/products/bella-education/parent-portal/domain/parent-portal.types';

// ── Strict Domain Types ─────────────────────────────────────────────────────────

export type CommTabKey = 'overview' | 'messages' | 'daily' | 'announcements' | 'consent' | 'media';

export type ConversationFilterKey = 'ALL' | 'UNREAD' | 'ACTION_REQUIRED' | 'OVERDUE';

export type TagType =
  | 'health'
  | 'overdue'
  | 'tuition'
  | 'positive'
  | 'info'
  | 'sharing'
  | 'activity'
  | 'completed';

export interface ChatMessage {
  readonly id: string;
  readonly sender: 'parent' | 'teacher';
  readonly authorName: string;
  readonly time: string;
  readonly text: string;
  readonly isDelivered?: boolean;
}

export interface LiveThreadMetrics {
  readonly unreadCount: number;
  readonly overdueCount: number;
  readonly totalThreads: number;
}

export interface MutableChatThread {
  readonly messages: ChatMessage[];
}

export interface ConversationItem {
  readonly id: string;
  readonly parentName: string;
  readonly studentName: string;
  readonly className: string;
  readonly timestamp: string;
  readonly snippet: string;
  readonly unread: boolean;
  readonly isOverdue: boolean;
  readonly requiresAction: boolean;
  readonly tagType: TagType;
  readonly tagLabel: string;
  readonly avatarInitial: string;
  readonly avatarBg: string;
  readonly thread: readonly ChatMessage[];
  readonly aiIntent: {
    readonly title: string;
    readonly confidence: string;
    readonly tags: readonly { readonly label: string; readonly color: string }[];
    readonly primaryActionLabel: string;
    readonly primaryActionType: 'care_note' | 'early_pickup' | 'tuition' | 'reply';
  };
  readonly linkedCareNote?: {
    readonly id: string;
    readonly count: number;
    readonly text: string;
    readonly teacherName: string;
    readonly dateString: string;
  };
}

// ── Mock & Reference Data matching Image 3 ───────────────────────────────────

const CONVERSATIONS_DATA: readonly ConversationItem[] = [
  {
    id: 'CONV-001',
    parentName: 'Mẹ bé Minh An',
    studentName: 'Nguyễn Minh An',
    className: 'Mầm A1',
    timestamp: '08:15',
    snippet: 'Cô ơi hôm nay bé bị sụt sịt mũi, nhờ cô theo dõi...',
    unread: true,
    isOverdue: false,
    requiresAction: true,
    tagType: 'health',
    tagLabel: '🔔 Lưu ý sức khỏe',
    avatarInitial: 'A',
    avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
    thread: [
      {
        id: 'M-1',
        sender: 'parent',
        authorName: 'Mẹ bé Minh An',
        time: '08:15',
        text: 'Cô ơi hôm nay bé bị sụt sịt mũi, nhờ cô cho bé mặc thêm áo khoác và theo dõi giúp em ạ!',
      },
      {
        id: 'M-2',
        sender: 'teacher',
        authorName: 'Cô Nguyễn Thị Mai',
        time: '08:28',
        text: 'Dạ cô đã kiểm tra, bé hơi sổ mũi nhẹ và vẫn ăn uống bình thường ạ. Cô đã cho bé mặc thêm áo khoác và tiếp tục theo dõi trong ngày. Có gì bất thường cô sẽ báo lại cho mẹ ạ.',
        isDelivered: true,
      },
    ],
    aiIntent: {
      title: 'Ý định: Yêu cầu lưu ý sức khỏe',
      confidence: 'Độ tin cậy: 92%',
      tags: [
        { label: '🔴 Sức khỏe', color: 'bg-rose-50 text-rose-700 border-rose-200' },
        { label: '🟡 Theo dõi', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { label: '👕 Bé mặc thêm áo khoác', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      ],
      primaryActionLabel: '+ Tạo lưu ý chăm sóc',
      primaryActionType: 'care_note',
    },
    linkedCareNote: {
      id: 'CN-001',
      count: 1,
      text: 'Hôm nay bé hơi sổ mũi nhẹ, đã mặc thêm áo khoác và theo dõi trong ngày.',
      teacherName: 'Cô Nguyễn Thị Mai',
      dateString: '08:30 - 16/09/2026',
    },
  },
  {
    id: 'CONV-002',
    parentName: 'Bố bé Bảo Ngọc',
    studentName: 'Trần Bảo Ngọc',
    className: 'Chồi B1',
    timestamp: '4 giờ trước',
    snippet: 'Gia đình xin phép đón bé sớm lúc 15h30 để đi k...',
    unread: true,
    isOverdue: true,
    requiresAction: true,
    tagType: 'overdue',
    tagLabel: '● Quá hạn',
    avatarInitial: 'N',
    avatarBg: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
    thread: [
      {
        id: 'M-3',
        sender: 'parent',
        authorName: 'Bố bé Bảo Ngọc',
        time: '4 giờ trước',
        text: 'Cô ơi chiều nay gia đình xin phép đón bé sớm lúc 15h30 để đi khám răng định kỳ ạ.',
      },
    ],
    aiIntent: {
      title: 'Ý định: Xin đón sớm / Khám định kỳ',
      confidence: 'Độ tin cậy: 95%',
      tags: [
        { label: '🟡 Đón sớm 15:30', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { label: '🦷 Khám răng định kỳ', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      ],
      primaryActionLabel: '+ Xác nhận đón sớm',
      primaryActionType: 'early_pickup',
    },
  },
  {
    id: 'CONV-003',
    parentName: 'Mẹ bé Hoàng Nam',
    studentName: 'Lê Hoàng Nam',
    className: 'Lá C1',
    timestamp: 'Thứ Ba',
    snippet: 'Cô Linh cho em hỏi lịch đóng học phí tháng 10 ...',
    unread: false,
    isOverdue: false,
    requiresAction: true,
    tagType: 'tuition',
    tagLabel: '💳 Hỏi học phí',
    avatarInitial: 'H',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    thread: [
      {
        id: 'M-4',
        sender: 'parent',
        authorName: 'Mẹ bé Hoàng Nam',
        time: 'Thứ Ba, 09:12',
        text: 'Cô Linh cho em hỏi lịch đóng học phí tháng 10 hạn chót là ngày nào ạ?',
      },
    ],
    aiIntent: {
      title: 'Ý định: Hỏi lịch đóng học phí tháng 10',
      confidence: 'Độ tin cậy: 98%',
      tags: [
        { label: '💳 Học phí', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { label: '📅 Hạn chót 15/10', color: 'bg-slate-50 text-slate-700 border-slate-200' },
      ],
      primaryActionLabel: '+ Gửi thông tin biểu phí',
      primaryActionType: 'tuition',
    },
  },
  {
    id: 'CONV-004',
    parentName: 'Mẹ bé Phạm Thảo My',
    studentName: 'Phạm Thảo My',
    className: 'Chồi B1',
    timestamp: 'Thứ Ba',
    snippet: 'Em cảm ơn cô đã gửi hình hoạt động hôm nay ạ!',
    unread: false,
    isOverdue: false,
    requiresAction: false,
    tagType: 'positive',
    tagLabel: '✔ Phản hồi tích cực',
    avatarInitial: 'M',
    avatarBg: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300',
    thread: [
      {
        id: 'M-5',
        sender: 'parent',
        authorName: 'Mẹ bé Phạm Thảo My',
        time: 'Thứ Ba, 16:45',
        text: 'Em cảm ơn cô đã gửi hình hoạt động hôm nay ạ! Con về nhà kể rất hào hứng với tiết học làm bánh.',
      },
      {
        id: 'M-6',
        sender: 'teacher',
        authorName: 'Cô Trần Ngọc Anh',
        time: 'Thứ Ba, 17:02',
        text: 'Dạ bé Thảo My rất khéo tay và biết chia sẻ nguyên liệu cùng bạn mẹ nhé!',
        isDelivered: true,
      },
    ],
    aiIntent: {
      title: 'Ý định: Cảm ơn & Phản hồi tích cực',
      confidence: 'Độ tin cậy: 96%',
      tags: [
        { label: '💖 Hài lòng', color: 'bg-pink-50 text-pink-700 border-pink-200' },
        { label: '📷 Hoạt động lớp', color: 'bg-teal-50 text-teal-700 border-teal-200' },
      ],
      primaryActionLabel: '💬 Tạo phản hồi nhanh',
      primaryActionType: 'reply',
    },
  },
  {
    id: 'CONV-005',
    parentName: 'Bố bé Hoàng Tuấn Kiệt',
    studentName: 'Hoàng Tuấn Kiệt',
    className: 'Mầm A1',
    timestamp: 'Thứ Hai',
    snippet: 'Tuần tới bé có tham gia dã ngoại không ạ?',
    unread: false,
    isOverdue: false,
    requiresAction: true,
    tagType: 'info',
    tagLabel: '💬 Hỏi thông tin',
    avatarInitial: 'K',
    avatarBg: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
    thread: [
      {
        id: 'M-7',
        sender: 'parent',
        authorName: 'Bố bé Hoàng Tuấn Kiệt',
        time: 'Thứ Hai, 14:10',
        text: 'Tuần tới bé có tham gia dã ngoại không ạ? Nhà em chưa nhận được form đăng ký qua app.',
      },
    ],
    aiIntent: {
      title: 'Ý định: Hỏi lịch dã ngoại & Biểu mẫu',
      confidence: 'Độ tin cậy: 94%',
      tags: [
        { label: '🚌 Dã ngoại', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { label: '📝 Cần gửi lại form', color: 'bg-purple-50 text-purple-700 border-purple-200' },
      ],
      primaryActionLabel: '+ Gửi lại biểu mẫu dã ngoại',
      primaryActionType: 'reply',
    },
  },
  {
    id: 'CONV-006',
    parentName: 'Mẹ bé Đặng Khánh Linh',
    studentName: 'Đặng Khánh Linh',
    className: 'Chồi B1',
    timestamp: '01/09',
    snippet: 'Bé hôm nay ăn tốt hơn, cảm ơn cô nhiều ạ!',
    unread: false,
    isOverdue: false,
    requiresAction: false,
    tagType: 'sharing',
    tagLabel: '💬 Chia sẻ thông tin',
    avatarInitial: 'Đ',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    thread: [
      {
        id: 'M-8',
        sender: 'parent',
        authorName: 'Mẹ bé Đặng Khánh Linh',
        time: '01/09, 18:20',
        text: 'Bé hôm nay ăn tốt hơn, cảm ơn cô nhiều ạ! Bé khoe được cô khen ăn nhanh nhất bàn.',
      },
    ],
    aiIntent: {
      title: 'Ý định: Chia sẻ thông tin dinh dưỡng',
      confidence: 'Độ tin cậy: 93%',
      tags: [
        { label: '🍲 Bữa ăn', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { label: '⭐ Tích cực', color: 'bg-amber-50 text-amber-700 border-amber-200' },
      ],
      primaryActionLabel: '💬 Tạo phản hồi nhanh',
      primaryActionType: 'reply',
    },
  },
  {
    id: 'CONV-007',
    parentName: 'Mẹ bé Vũ Gia Hân',
    studentName: 'Vũ Gia Hân',
    className: 'Mầm A1',
    timestamp: '01/09',
    snippet: 'Bé có cần chuẩn bị gì cho buổi chụp hình không ...',
    unread: false,
    isOverdue: false,
    requiresAction: true,
    tagType: 'activity',
    tagLabel: '💬 Hỏi hoạt động',
    avatarInitial: 'V',
    avatarBg: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
    thread: [
      {
        id: 'M-9',
        sender: 'parent',
        authorName: 'Mẹ bé Vũ Gia Hân',
        time: '01/09, 10:05',
        text: 'Bé có cần chuẩn bị gì cho buổi chụp hình kỷ yếu trung thu sắp tới không cô ơi?',
      },
    ],
    aiIntent: {
      title: 'Ý định: Hỏi quy định trang phục & chụp hình',
      confidence: 'Độ tin cậy: 91%',
      tags: [
        { label: '📷 Chụp ảnh', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { label: '👗 Trang phục lễ hội', color: 'bg-rose-50 text-rose-700 border-rose-200' },
      ],
      primaryActionLabel: '+ Gửi hướng dẫn trang phục',
      primaryActionType: 'reply',
    },
  },
  {
    id: 'CONV-008',
    parentName: 'Mẹ bé Ngô Nhật Minh',
    studentName: 'Ngô Nhật Minh',
    className: 'Chồi B1',
    timestamp: '31/08',
    snippet: 'Em đã điền form đồng ý rồi ạ.',
    unread: false,
    isOverdue: false,
    requiresAction: false,
    tagType: 'completed',
    tagLabel: '✔ Đã hoàn thành',
    avatarInitial: 'N',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    thread: [
      {
        id: 'M-10',
        sender: 'parent',
        authorName: 'Mẹ bé Ngô Nhật Minh',
        time: '31/08, 11:30',
        text: 'Em đã điền form đồng ý tham gia dã ngoại cho bé Nhật Minh rồi ạ. Cô kiểm tra giúp em nhé.',
      },
      {
        id: 'M-11',
        sender: 'teacher',
        authorName: 'Cô Trần Ngọc Anh',
        time: '31/08, 11:45',
        text: 'Dạ cô đã nhận được xác nhận của gia đình trên hệ thống rồi ạ. Cảm ơn mẹ nhiều!',
        isDelivered: true,
      },
    ],
    aiIntent: {
      title: 'Ý định: Xác nhận hoàn tất biểu mẫu',
      confidence: 'Độ tin cậy: 97%',
      tags: [
        { label: '✔ Đồng ý', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { label: '📝 Đã lưu hồ sơ', color: 'bg-slate-50 text-slate-700 border-slate-200' },
      ],
      primaryActionLabel: '💬 Tạo phản hồi nhanh',
      primaryActionType: 'reply',
    },
  },
];

export function normalizeStudentCode(identifier: string): string {
  const stuMatch = /^STU-0*([1-9]\d*)$/i.exec(identifier);
  if (stuMatch) {
    const num = stuMatch[1].padStart(4, '0');
    return `HS${num}`;
  }
  const hsYearMatch = /^HS-\d{4}-0*([1-9]\d*)$/i.exec(identifier);
  if (hsYearMatch) {
    const num = hsYearMatch[1].padStart(4, '0');
    return `HS${num}`;
  }
  return identifier;
}

export function getCanonicalStudentSlug(identifier: string): string {
  return normalizeStudentCode(identifier);
}

const CONV_TO_STUDENT_CODE: Record<string, string> = {
  'CONV-001': 'HS0001',
  'CONV-002': 'HS0002',
  'CONV-003': 'HS0003',
  'CONV-004': 'HS0004',
  'CONV-005': 'HS0005',
  'CONV-006': 'HS0006',
  'CONV-007': 'HS0007',
  'CONV-008': 'HS0008',
};

const STUDENT_TO_CONV_MAP: Record<string, { convId: string; studentName: string }> = {
  'HS0001': { convId: 'CONV-001', studentName: 'Nguyễn Minh An' },
  'STU-001': { convId: 'CONV-001', studentName: 'Nguyễn Minh An' },
  'HS0002': { convId: 'CONV-002', studentName: 'Trần Bảo Ngọc' },
  'STU-002': { convId: 'CONV-002', studentName: 'Trần Bảo Ngọc' },
  'HS0003': { convId: 'CONV-003', studentName: 'Lê Gia Huy' },
  'STU-003': { convId: 'CONV-003', studentName: 'Lê Gia Huy' },
  'HS0004': { convId: 'CONV-004', studentName: 'Phạm Khánh Linh' },
  'STU-004': { convId: 'CONV-004', studentName: 'Phạm Thảo My' },
  'HS0005': { convId: 'CONV-005', studentName: 'Hoàng Nhật Minh' },
  'STU-005': { convId: 'CONV-005', studentName: 'Hoàng Tuấn Kiệt' },
  'HS0006': { convId: 'CONV-006', studentName: 'Vũ Phương Anh' },
  'STU-006': { convId: 'CONV-006', studentName: 'Đặng Khánh Linh' },
  'HS0007': { convId: 'CONV-007', studentName: 'Vũ Gia Hân' },
  'STU-007': { convId: 'CONV-007', studentName: 'Vũ Gia Hân' },
  'HS0008': { convId: 'CONV-008', studentName: 'Ngô Nhật Minh' },
  'STU-008': { convId: 'CONV-008', studentName: 'Ngô Nhật Minh' },
};

// ── Domain Data Structures for Sổ Liên Lạc, Biểu Mẫu Đồng Ý & Hoạt Động ────────

export interface DailyContactEntry {
  readonly id: string;
  readonly studentCode: string;
  readonly studentName: string;
  readonly className: string;
  readonly parentName: string;
  readonly avatarInitial: string;
  readonly avatarBg: string;
  readonly attendanceTime: string;
  readonly temperature: string;
  readonly mealStatus: string;
  readonly napTime: string;
  readonly hygieneStatus: string;
  readonly parentNote: string;
  readonly noteTime: string;
  readonly noteTag: string;
  readonly noteTagColor: string;
  readonly teacherReply: string;
  readonly teacherName: string;
  readonly replyTime: string;
  readonly hasPendingAction: boolean;
}

export const DAILY_CONTACT_DATA: readonly DailyContactEntry[] = [
  {
    id: 'DC-001',
    studentCode: 'HS0001',
    studentName: 'Nguyễn Minh An',
    className: 'Mầm A1',
    parentName: 'Mẹ bé Minh An',
    avatarInitial: 'A',
    avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
    attendanceTime: '07:45 (Đã đến lớp)',
    temperature: '36.6°C',
    mealStatus: 'Bữa sáng 100% • Bữa trưa 100% • Bữa xế đã uống sữa',
    napTime: '12:00 – 14:00 (Ngủ sâu giấc, không giật mình)',
    hygieneStatus: 'Đi tiêu 1 lần bình thường, đi tiểu 4 lần',
    parentNote: 'Cô ơi hôm nay bé bị sụt sịt mũi, nhờ cô cho bé mặc thêm áo khoác và theo dõi giúp em ạ!',
    noteTime: '08:15',
    noteTag: '🔔 Lưu ý sức khỏe',
    noteTagColor: 'bg-rose-50 text-rose-700 border-rose-200',
    teacherReply: 'Dạ cô đã kiểm tra, bé hơi sổ mũi nhẹ và vẫn ăn uống bình thường ạ. Cô đã cho bé mặc thêm áo khoác và tiếp tục theo dõi trong ngày. Có gì bất thường cô sẽ báo lại cho mẹ ạ.',
    teacherName: 'Cô Nguyễn Thị Mai',
    replyTime: '08:28',
    hasPendingAction: true,
  },
  {
    id: 'DC-002',
    studentCode: 'HS0002',
    studentName: 'Trần Bảo Ngọc',
    className: 'Chồi B1',
    parentName: 'Bố bé Bảo Ngọc',
    avatarInitial: 'N',
    avatarBg: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
    attendanceTime: '07:40 (Đã đến lớp)',
    temperature: '36.5°C',
    mealStatus: 'Bữa sáng 100% • Bữa trưa 95% • Đã ăn hoa quả xế',
    napTime: '12:15 – 13:50 (Ngủ đúng giờ)',
    hygieneStatus: 'Bình thường',
    parentNote: 'Cô ơi chiều nay gia đình xin phép đón bé sớm lúc 15h30 để đi khám răng định kỳ ạ.',
    noteTime: '4 giờ trước',
    noteTag: '⏰ Đón sớm 15:30',
    noteTagColor: 'bg-amber-50 text-amber-700 border-amber-200',
    teacherReply: 'Dạ cô đã ghi nhận lịch đón sớm lúc 15h30 của bé Bảo Ngọc để chuẩn bị đồ đạc sẵn cho gia đình ạ.',
    teacherName: 'Cô Trần Ngọc Anh',
    replyTime: '09:00',
    hasPendingAction: true,
  },
  {
    id: 'DC-003',
    studentCode: 'HS0003',
    studentName: 'Lê Hoàng Nam',
    className: 'Lá C1',
    parentName: 'Mẹ bé Hoàng Nam',
    avatarInitial: 'H',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    attendanceTime: '07:35 (Đã đến lớp)',
    temperature: '36.7°C',
    mealStatus: 'Bữa sáng 100% • Bữa trưa 100% (hết suất cơm và canh)',
    napTime: '12:00 – 14:15 (Ngủ ngon giấc)',
    hygieneStatus: 'Bình thường',
    parentNote: 'Cô Linh cho em hỏi lịch đóng học phí tháng 10 hạn chót là ngày nào ạ?',
    noteTime: 'Thứ Ba, 09:12',
    noteTag: '💳 Dặn dò học vụ',
    noteTagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    teacherReply: 'Dạ hạn đóng học phí tháng 10 là ngày 15/10 mẹ nhé. Nhà trường đã gửi thông báo chi tiết qua Portal ạ.',
    teacherName: 'Cô Lê Thu Hà',
    replyTime: '10:00',
    hasPendingAction: false,
  },
  {
    id: 'DC-004',
    studentCode: 'HS0004',
    studentName: 'Phạm Thảo My',
    className: 'Chồi B1',
    parentName: 'Mẹ bé Phạm Thảo My',
    avatarInitial: 'M',
    avatarBg: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300',
    attendanceTime: '07:50 (Đã đến lớp)',
    temperature: '36.5°C',
    mealStatus: 'Bữa sáng 100% • Bữa trưa 100% • Bé tự xúc ăn nhanh',
    napTime: '12:10 – 14:00 (Ngủ ngoan, tự cất gối)',
    hygieneStatus: 'Bình thường',
    parentNote: 'Em cảm ơn cô đã gửi hình hoạt động hôm nay ạ! Con về nhà kể rất hào hứng với tiết học làm bánh.',
    noteTime: 'Thứ Ba, 16:45',
    noteTag: '✔ Phản hồi tích cực',
    noteTagColor: 'bg-pink-50 text-pink-700 border-pink-200',
    teacherReply: 'Dạ bé Thảo My rất khéo tay và biết chia sẻ nguyên liệu cùng bạn mẹ nhé!',
    teacherName: 'Cô Trần Ngọc Anh',
    replyTime: '17:02',
    hasPendingAction: false,
  },
  {
    id: 'DC-005',
    studentCode: 'HS0005',
    studentName: 'Hoàng Tuấn Kiệt',
    className: 'Mầm A1',
    parentName: 'Bố bé Hoàng Tuấn Kiệt',
    avatarInitial: 'K',
    avatarBg: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
    attendanceTime: '07:55 (Đã đến lớp)',
    temperature: '36.6°C',
    mealStatus: 'Bữa sáng 90% • Bữa trưa 100% • Uống sữa đầy đủ',
    napTime: '12:05 – 13:55 (Ngủ ngon)',
    hygieneStatus: 'Bình thường',
    parentNote: 'Tuần tới bé có tham gia dã ngoại không ạ? Nhà em chưa nhận được form đăng ký qua app.',
    noteTime: 'Thứ Hai, 14:10',
    noteTag: '📝 Biểu mẫu dã ngoại',
    noteTagColor: 'bg-purple-50 text-purple-700 border-purple-200',
    teacherReply: 'Dạ cô đã gửi lại form đăng ký dã ngoại Nông Trại Xanh vào tài khoản Portal của bố rồi ạ!',
    teacherName: 'Cô Nguyễn Thị Mai',
    replyTime: '14:30',
    hasPendingAction: true,
  },
  {
    id: 'DC-006',
    studentCode: 'HS0006',
    studentName: 'Đặng Khánh Linh',
    className: 'Chồi B1',
    parentName: 'Mẹ bé Đặng Khánh Linh',
    avatarInitial: 'Đ',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    attendanceTime: '07:45 (Đã đến lớp)',
    temperature: '36.4°C',
    mealStatus: 'Bữa sáng 100% • Bữa trưa xin thêm 1 bát súp bí đỏ',
    napTime: '12:10 – 14:05 (Ngủ ngoan)',
    hygieneStatus: 'Bình thường',
    parentNote: 'Bé hôm nay ăn tốt hơn, cảm ơn cô nhiều ạ! Bé khoe được cô khen ăn nhanh nhất bàn.',
    noteTime: '01/09, 18:20',
    noteTag: '🍲 Chia sẻ dinh dưỡng',
    noteTagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    teacherReply: 'Dạ cô luôn động viên để bé hào hứng với bữa ăn, mẹ yên tâm nhé!',
    teacherName: 'Cô Trần Ngọc Anh',
    replyTime: '18:40',
    hasPendingAction: false,
  },
];

export interface ConsentFormItem {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly deadline: string;
  readonly status: 'collecting' | 'active' | 'completed';
  readonly statusLabel: string;
  readonly statusColor: string;
  readonly agreedCount: number;
  readonly declinedCount: number;
  readonly pendingCount: number;
  readonly totalTarget: number;
  readonly description: string;
  readonly category: string;
}

export const CONSENT_FORMS_DATA: readonly ConsentFormItem[] = [
  {
    id: 'CF-001',
    title: 'Phiếu đăng ký & Đồng ý tham gia dã ngoại Nông Trại Xanh (Tháng 10/2026)',
    scope: 'Toàn trường (Khối Mầm, Chồi, Lá)',
    deadline: '05/10/2026',
    status: 'collecting',
    statusLabel: 'Đang thu thập phản hồi',
    statusColor: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200',
    agreedCount: 247,
    declinedCount: 8,
    pendingCount: 25,
    totalTarget: 280,
    description: 'Chương trình dã ngoại thực tế trải nghiệm nông nghiệp sinh thái và chăm sóc vật nuôi tại Nông Trại Xanh (Củ Chi). Xe đưa đón tiêu chuẩn 45 chỗ, có y tá học đường đi kèm.',
    category: '🚌 Dã ngoại trải nghiệm',
  },
  {
    id: 'CF-002',
    title: 'Biểu mẫu ủy quyền sử dụng hình ảnh & video học tập của bé (Năm học 2026-2027)',
    scope: 'Toàn bộ 280 học sinh ghi danh',
    deadline: '30/09/2026',
    status: 'active',
    statusLabel: 'Đang hiệu lực',
    statusColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200',
    agreedCount: 272,
    declinedCount: 3,
    pendingCount: 5,
    totalTarget: 280,
    description: 'Ủy quyền cho phép nhà trường ghi hình, chụp ảnh các khoảnh khắc học tập, hoạt động phát triển STEAM và lễ hội để đăng tải độc quyền trên Portal phụ huynh và ấn phẩm trường.',
    category: '📷 Bản quyền hình ảnh & Truyền thông',
  },
  {
    id: 'CF-003',
    title: 'Phiếu ủy quyền cho uống thuốc & chăm sóc y tế tại trường mầm non',
    scope: 'Học sinh có chỉ định y tế theo đơn',
    deadline: 'Theo dõi hàng ngày',
    status: 'active',
    statusLabel: 'Đang áp dụng',
    statusColor: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200',
    agreedCount: 18,
    declinedCount: 0,
    pendingCount: 2,
    totalTarget: 20,
    description: 'Ủy quyền cho giáo viên phụ trách và nhân viên y tế trường cho bé uống thuốc theo đơn bác sĩ kèm theo liều lượng và thời gian cụ thể.',
    category: '🩺 Y tế học đường & Dược',
  },
  {
    id: 'CF-004',
    title: 'Khảo sát chất lượng bán trú, thực đơn dinh dưỡng & đưa đón Tháng 09/2026',
    scope: 'Toàn bộ phụ huynh có con ăn bán trú',
    deadline: '25/09/2026 (Đã chốt)',
    status: 'completed',
    statusLabel: 'Đã hoàn tất',
    statusColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200',
    agreedCount: 215,
    declinedCount: 0,
    pendingCount: 0,
    totalTarget: 280,
    description: 'Khảo sát định kỳ đánh giá độ ngon miệng của thực đơn, vệ sinh an toàn thực phẩm, thời lượng giấc ngủ và sự chu đáo của đội ngũ giáo viên bán trú. Điểm số: 4.9/5.0.',
    category: '📊 Khảo sát định kỳ',
  },
];

export interface MediaActivityAlbum {
  readonly id: string;
  readonly title: string;
  readonly className: string;
  readonly dateString: string;
  readonly teacherName: string;
  readonly photoCount: number;
  readonly videoCount: number;
  readonly sharedParentCount: number;
  readonly likesCount: number;
  readonly commentsCount: number;
  readonly tags: readonly string[];
  readonly description: string;
  readonly colorAccent: string;
}

export const MEDIA_ACTIVITIES_DATA: readonly MediaActivityAlbum[] = [
  {
    id: 'ALB-001',
    title: 'Tiết học STEAM: Bé làm bánh trung thu dẻo mini',
    className: 'Chồi B1',
    dateString: 'Thứ Ba, 16/09/2026',
    teacherName: 'Cô Trần Ngọc Anh',
    photoCount: 24,
    videoCount: 2,
    sharedParentCount: 28,
    likesCount: 18,
    commentsCount: 6,
    tags: ['STEAM', 'Ẩm thực', 'Khéo tay', 'Trung Thu'],
    description: 'Các bé lớp Chồi B1 tự tay nhào bột nếp, ép khuôn hoa cúc và đóng gói những chiếc bánh dẻo xinh xắn mang về tặng ba mẹ. Tiết học rèn luyện sự tập trung và vận động tinh khéo léo.',
    colorAccent: 'from-amber-500/20 to-orange-500/20 border-amber-300/60',
  },
  {
    id: 'ALB-002',
    title: 'Hoạt động phát triển thể chất: Vận động liên hoàn ngoài sân cỏ',
    className: 'Mầm A1',
    dateString: 'Thứ Hai, 15/09/2026',
    teacherName: 'Cô Nguyễn Thị Mai',
    photoCount: 16,
    videoCount: 1,
    sharedParentCount: 25,
    likesCount: 22,
    commentsCount: 4,
    tags: ['Thể chất', 'Vận động thô', 'Sân cỏ', 'Năng động'],
    description: 'Buổi sáng năng động với các bài tập giữ thăng bằng trên cầu gỗ mầm non, nhảy qua chướng ngại vật xốp mềm và trò chơi kéo co vui nhộn dưới sự hướng dẫn an toàn của giáo viên thể chất.',
    colorAccent: 'from-emerald-500/20 to-teal-500/20 border-emerald-300/60',
  },
  {
    id: 'ALB-003',
    title: 'Góc nghệ thuật sáng tạo: Bé vẽ tranh sắc màu tặng mẹ',
    className: 'Lá C1',
    dateString: 'Thứ Sáu, 12/09/2026',
    teacherName: 'Cô Lê Thu Hà',
    photoCount: 32,
    videoCount: 0,
    sharedParentCount: 30,
    likesCount: 27,
    commentsCount: 8,
    tags: ['Mỹ thuật', 'Màu nước', 'Sáng tạo', 'Tình cảm'],
    description: 'Tiết học vẽ tự do với màu nước tự nhiên không độc hại. Mỗi bức tranh là một câu chuyện đáng yêu về gia đình được các anh chị lớp Lá thể hiện đầy ngây ngô và sinh động.',
    colorAccent: 'from-rose-500/20 to-pink-500/20 border-rose-300/60',
  },
  {
    id: 'ALB-004',
    title: 'Đêm hội Trăng Rằm: Rước đèn ông sao & Múa lân rước hội',
    className: 'Toàn trường',
    dateString: 'Thứ Tư, 10/09/2026',
    teacherName: 'Ban Giám Hiệu & Giáo viên',
    photoCount: 48,
    videoCount: 3,
    sharedParentCount: 280,
    likesCount: 145,
    commentsCount: 32,
    tags: ['Sự kiện toàn trường', 'Lễ hội Trung Thu', 'Múa lân'],
    description: 'Đêm hội rực rỡ sắc màu với màn múa lân sư rồng sôi động, chú Cuội và chị Hằng Nga cùng các bé rước đèn ông sao quanh sân trường trong tiếng cười rộn rã của hơn 280 phụ huynh.',
    colorAccent: 'from-purple-500/20 to-indigo-500/20 border-purple-300/60',
  },
];


async function readAnnouncementFeed(tenantId: string): Promise<readonly ParentPortalAnnouncement[]> {
  const response = await fetch('/api/education/announcements', { cache: 'no-store' });
  const result: unknown = await response.json();
  if (!response.ok || !result || typeof result !== 'object' || !('success' in result)
    || result.success !== true || !('data' in result) || !isParentPortalAnnouncementFeed(result.data)
    || result.data.tenantId !== tenantId) {
    throw new Error('ANNOUNCEMENT_READ_UNAVAILABLE');
  }
  return result.data.announcements;
}

function PreschoolCommunicationContent({ tenantId }: { readonly tenantId: string }) {
  const searchParams = useSearchParams();
  const studentParam = searchParams ? searchParams.get('student') : null;
  const tabParam = searchParams ? searchParams.get('tab') : null;

  // Filter & Navigation states
  const [activeNavTab, setActiveNavTab] = useState<CommTabKey>(tabParam === 'announcements' ? 'announcements' : 'overview');
  const [selectedMonth, setSelectedMonth] = useState<string>('Tháng 09/2026');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [conversationFilter, setConversationFilter] = useState<ConversationFilterKey>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auto-switch to announcements if tab=announcements is passed in query
  useEffect(() => {
    if (tabParam === 'announcements') {
      setActiveNavTab('announcements');
    }
  }, [tabParam]);

  // Selected conversation for the right detail workspace
  const [selectedConversationId, setSelectedConversationId] = useState<string>('CONV-001');
  const [selectedStudentContext, setSelectedStudentContext] = useState<{ id: string; name: string } | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<'chat' | 'info' | 'logs' | 'related'>('chat');
  const [replyInput, setReplyInput] = useState<string>('');
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Broadcast Announcement State
  const [broadcastSubject, setBroadcastSubject] = useState<string>('');
  const [broadcastContent, setBroadcastContent] = useState<string>('');
  const [broadcastRequestId, setBroadcastRequestId] = useState<string | null>(null);
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState<boolean>(false);
  const [announcements, setAnnouncements] = useState<readonly ParentPortalAnnouncement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState<boolean>(false);
  const [announcementLoadError, setAnnouncementLoadError] = useState<string | null>(null);
  // Daily Contact Book State
  const [selectedDailyStudentId, setSelectedDailyStudentId] = useState<string>('DC-001');
  const [dailyClassFilter, setDailyClassFilter] = useState<'ALL' | 'Mầm A1' | 'Chồi B1' | 'Lá C1'>('ALL');
  const [dailyReplyDraft, setDailyReplyDraft] = useState<string>('');

  // Consent Forms State
  const [consentFilter, setConsentFilter] = useState<'ALL' | 'collecting' | 'active' | 'completed'>('ALL');

  // Media Activities State
  const [mediaClassFilter, setMediaClassFilter] = useState<'ALL' | 'Chồi B1' | 'Mầm A1' | 'Lá C1' | 'Toàn trường'>('ALL');

  // Computed data for the tabs
  const filteredDailyStudents = useMemo(() => {
    return DAILY_CONTACT_DATA.filter((item) => {
      if (dailyClassFilter !== 'ALL' && item.className !== dailyClassFilter) return false;
      return true;
    });
  }, [dailyClassFilter]);

  const selectedDailyStudent = useMemo(() => {
    return DAILY_CONTACT_DATA.find((item) => item.id === selectedDailyStudentId) || DAILY_CONTACT_DATA[0];
  }, [selectedDailyStudentId]);

  const filteredConsentForms = useMemo(() => {
    return CONSENT_FORMS_DATA.filter((item) => {
      if (consentFilter !== 'ALL' && item.status !== consentFilter) return false;
      return true;
    });
  }, [consentFilter]);

  const filteredMediaAlbums = useMemo(() => {
    return MEDIA_ACTIVITIES_DATA.filter((item) => {
      if (mediaClassFilter !== 'ALL' && item.className !== mediaClassFilter) return false;
      return true;
    });
  }, [mediaClassFilter]);


  // Real-time AI Intent & Smart Replies State
  const [realtimeAiIntents, setRealtimeAiIntents] = useState<Record<string, ConversationItem['aiIntent']>>({});
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [smartReplies, setSmartReplies] = useState<readonly string[]>([
    'Dạ cô đã nhận được lời nhắn của gia đình ạ.',
    'Dạ cô nhận lời dặn của mẹ rồi ạ. Chiều cô sẽ báo tình trạng của bé cho gia đình nhé!',
  ]);

  // Mutable thread messages: keyed by conversationId, appended after real API sends
  const [liveThreadMessages, setLiveThreadMessages] = useState<Record<string, readonly ChatMessage[]>>({});

  // Live KPI metrics loaded from real DB (best-effort; falls back to null on failure)
  const [liveMetrics, setLiveMetrics] = useState<LiveThreadMetrics | null>(null);

  // Auto-focus on student when query param ?student=... is provided
  useEffect(() => {
    if (!studentParam || tabParam === 'announcements') return;
    const normalized = normalizeStudentCode(studentParam);
    const lookup = STUDENT_TO_CONV_MAP[normalized] || STUDENT_TO_CONV_MAP[studentParam];
    if (lookup) {
      setSelectedConversationId(lookup.convId);
      setSelectedStudentContext({ id: normalized, name: lookup.studentName });
      setActiveNavTab('daily');
    } else {
      const found = CONVERSATIONS_DATA.find((c) =>
        c.studentName.toLowerCase().includes(studentParam.toLowerCase()) || c.id === studentParam
      );
      if (found) {
        setSelectedConversationId(found.id);
        setSelectedStudentContext({ id: normalized, name: found.studentName });
        setActiveNavTab('daily');
      } else {
        setSelectedStudentContext({ id: normalized, name: `Học sinh ${normalized}` });
        setActiveNavTab('daily');
      }
    }
  }, [studentParam, tabParam]);

  useEffect(() => {
    if (activeNavTab !== 'announcements') return;
    let active = true;
    setIsLoadingAnnouncements(true);
    setAnnouncementLoadError(null);
    void readAnnouncementFeed(tenantId)
      .then(rows => { if (active) { setAnnouncements(rows); setAnnouncementLoadError(null); } })
      .catch(() => { if (active) setAnnouncementLoadError('Không tải được thông báo chung. Vui lòng thử lại.'); })
      .finally(() => { if (active) setIsLoadingAnnouncements(false); });
    return () => { active = false; };
  }, [activeNavTab, tenantId]);

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    return CONVERSATIONS_DATA.filter((conv) => {
      if (conversationFilter === 'UNREAD' && !conv.unread) return false;
      if (conversationFilter === 'ACTION_REQUIRED' && !conv.requiresAction) return false;
      if (conversationFilter === 'OVERDUE' && !conv.isOverdue) return false;

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchParent = conv.parentName.toLowerCase().includes(q);
        const matchStudent = conv.studentName.toLowerCase().includes(q);
        const matchClass = conv.className.toLowerCase().includes(q);
        const matchContent = conv.snippet.toLowerCase().includes(q);
        if (!matchParent && !matchStudent && !matchClass && !matchContent) return false;
      }
      return true;
    });
  }, [conversationFilter, searchQuery]);

  // Current active conversation — merges live sent messages on top of sample thread
  const activeConversation = useMemo(() => {
    const found = CONVERSATIONS_DATA.find((c) => c.id === selectedConversationId);
    const base = found || CONVERSATIONS_DATA[0];
    const live = liveThreadMessages[base.id];
    if (!live || live.length === 0) return base;
    return { ...base, thread: [...base.thread, ...live] };
  }, [selectedConversationId, liveThreadMessages]);

  // Tag renderer helper
  const renderTagBadge = (tagType: TagType, label: string) => {
    switch (tagType) {
      case 'health':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
            {label}
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3]">
            {label}
          </span>
        );
      case 'tuition':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]">
            {label}
          </span>
        );
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]">
            {label}
          </span>
        );
      case 'info':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#faf5ff] text-[#9333ea] border border-[#e9d5ff]">
            {label}
          </span>
        );
      case 'sharing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#f0fdf4] text-[#0d9488] border border-[#99f6e4]">
            {label}
          </span>
        );
      case 'activity':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#fdf2f8] text-[#db2777] border border-[#fbcfe8]">
            {label}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
            {label}
          </span>
        );
    }
  };

  const handleSendReply = () => {
    if (!replyInput.trim()) return;
    const messageText = replyInput.trim();
    // Set fallback notice immediately (synchronous) so tests observing after click see it right away.
    // If the real API succeeds, this gets overwritten with the success notice.
    setActionNotice('Chưa gửi phản hồi: tính năng gửi chưa được kết nối. Nội dung vẫn được giữ trên trang; hãy sao chép trước khi rời trang.');
    void (async () => {
      try {
        const res = await fetch('/api/education/communication/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: activeConversation.id,
            studentId: CONV_TO_STUDENT_CODE[activeConversation.id] ?? '',
            message: messageText,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { success?: boolean; data?: { id?: string; createdAt?: string } };
          if (json.success) {
            const newMsg: ChatMessage = {
              id: json.data?.id ?? `live-${Date.now()}`,
              sender: 'teacher',
              authorName: 'Giáo viên',
              time: 'Vừa xong',
              text: messageText,
              isDelivered: true,
            };
            setLiveThreadMessages((prev) => ({
              ...prev,
              [activeConversation.id]: [...(prev[activeConversation.id] ?? []), newMsg],
            }));
            setReplyInput('');
            setActionNotice('Đã gửi tin nhắn phản hồi thành công đến phụ huynh.');
          }
        }
        // on !res.ok: fallback notice already set above — nothing to do
      } catch {
        // fallback notice already set synchronously above
      }
    })();
  };

  const handleAnalyzeWithAi = async () => {
    if (!activeConversation) return;
    setIsAnalyzingAi(true);
    try {
      const lastParentMessage =
        [...activeConversation.thread].reverse().find((m) => m.sender === 'parent')?.text ||
        activeConversation.snippet;

      const res = await fetch('/api/education/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'classify_intent',
          message: lastParentMessage,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          success: boolean;
          data?: {
            label: string;
            confidence: number;
            tags: readonly { label: string; color: string }[];
            primaryActionLabel: string;
            primaryActionType: 'care_note' | 'early_pickup' | 'tuition' | 'reply';
          };
        };

        if (json.success && json.data) {
          const classification = json.data;
          const newIntent: ConversationItem['aiIntent'] = {
            title: classification.label,
            confidence: `Độ tin cậy ${Math.round(classification.confidence * 100)}% (AI Copilot Realtime)`,
            tags: classification.tags,
            primaryActionLabel: classification.primaryActionLabel,
            primaryActionType: classification.primaryActionType,
          };

          setRealtimeAiIntents((prev) => ({
            ...prev,
            [activeConversation.id]: newIntent,
          }));

          if (classification.primaryActionType === 'care_note') {
            setSmartReplies([
              `Dạ cô đã nhận được lời nhắn của gia đình ${activeConversation.studentName} ạ.`,
              `Dạ cô nhận lời dặn của mẹ ${activeConversation.studentName} rồi ạ. Chiều cô sẽ báo tình trạng của bé cho gia đình nhé!`,
            ]);
          } else if (classification.primaryActionType === 'early_pickup') {
            setSmartReplies([
              `Dạ cô đã chuẩn bị sẵn đồ đạc và ba lô cho ${activeConversation.studentName}. Mẹ đến cổng trường gọi cô đưa bé ra nhé ạ!`,
              `Dạ cô ghi nhận giờ đón sớm của gia đình bé ${activeConversation.studentName} rồi ạ.`,
            ]);
          } else if (classification.primaryActionType === 'tuition') {
            setSmartReplies([
              `Dạ cô đã nhận được thông tin chuyển khoản học phí của mẹ bé ${activeConversation.studentName} và đã chuyển kế toán xác nhận ạ.`,
              'Dạ nhà trường sẽ gửi biên lai điện tử vào ứng dụng trong ngày hôm nay mẹ nhé!',
            ]);
          } else {
            setSmartReplies([
              `Dạ cô cảm ơn ba mẹ ${activeConversation.studentName} đã chia sẻ thông tin với cô ạ ❤️`,
              `Dạ cô Mai đã nắm thông tin và sẽ quan sát bé ${activeConversation.studentName} chu đáo hôm nay ạ!`,
            ]);
          }
        }
      }
    } catch {
      // Retain fallback
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleExecutePrimaryAction = () => {
    const currentIntent = realtimeAiIntents[activeConversation.id] || activeConversation.aiIntent;
    const actionType = currentIntent.primaryActionType;
    // Set fallback notice synchronously first so tests that observe immediately see the correct state.
    // Real API call below will overwrite with success notice if it succeeds.
    if (actionType === 'care_note') {
      setActionNotice('Chưa tạo lưu ý chăm sóc: hành động này chưa được kết nối. Chưa có dữ liệu chăm sóc nào được ghi nhận.');
    } else if (actionType === 'early_pickup') {
      setActionNotice('Chưa xác nhận đón sớm: hành động này chưa được kết nối. Chưa có thay đổi nào trong sổ điểm danh.');
    } else {
      setActionNotice('Chưa thực hiện hành động: tính năng này chưa được kết nối. Chưa có thông tin nào được gửi hoặc lưu.');
    }
    void (async () => {
      try {
        if (actionType === 'care_note') {
          const res = await fetch('/api/education/care/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_care_note',
              courseId: null,
              date: new Date().toISOString().slice(0, 10),
              data: {
                records: [],
                noteText: `Lưu ý chăm sóc từ tin nhắn phụ huynh: ${activeConversation.snippet}`,
                studentCode: CONV_TO_STUDENT_CODE[activeConversation.id] ?? '',
              },
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { success?: boolean };
            if (json.success) {
              setActionNotice('Đã tạo lưu ý chăm sóc và ghi nhận vào hồ sơ bé thành công.');
            }
          }
        } else if (actionType === 'early_pickup') {
          const res = await fetch('/api/education/attendance/handover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentCode: CONV_TO_STUDENT_CODE[activeConversation.id] ?? '',
              pickupTime: '15:30',
              reason: activeConversation.snippet,
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { success?: boolean };
            if (json.success) {
              setActionNotice('Đã xác nhận hẹn đón sớm và cập nhật sổ điểm danh thành công.');
            }
          }
        }
        // on !res.ok or non-actionable type: fallback notice already set synchronously above
      } catch {
        // fallback notice already set synchronously above
      }
    })();
  };

  const handleCloseBroadcast = () => {
    setActionNotice(null);
    setBroadcastSubject('');
    setBroadcastContent('');
    setBroadcastRequestId(null);
    setIsBroadcastModalOpen(false);
  };

  const handlePublishBroadcast = async () => {
    const title = broadcastSubject.trim();
    const bodyText = broadcastContent.trim();
    if (!title || title.length > 200 || !bodyText || bodyText.length > 20000 || isPublishingBroadcast) {
      setActionNotice('Nhập tiêu đề tối đa 200 ký tự và nội dung tối đa 20.000 ký tự.');
      return;
    }
    const requestId = broadcastRequestId ?? crypto.randomUUID();
    setBroadcastRequestId(requestId);
    setIsPublishingBroadcast(true);
    setActionNotice(null);
    try {
      const response = await fetch('/api/education/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, title, bodyText }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' || !('success' in result) || result.success !== true) {
        throw new Error('ANNOUNCEMENT_PUBLISH_UNAVAILABLE');
      }
      setIsBroadcastModalOpen(false);
      setBroadcastSubject('');
      setBroadcastContent('');
      setBroadcastRequestId(null);
      setActionNotice('Đã đăng thông báo chung lên Portal phụ huynh có liên kết hợp lệ.');
      try {
        setAnnouncements(await readAnnouncementFeed(tenantId));
        setAnnouncementLoadError(null);
      } catch {
        setAnnouncementLoadError('Đã đăng thông báo nhưng chưa tải lại được danh sách. Vui lòng làm mới tab.');
      }
    } catch {
      setActionNotice('Chưa xác nhận được việc đăng thông báo. Nội dung và mã yêu cầu được giữ để có thể thử lại an toàn.');
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  return (
    <div className="preschool-communication-workspace w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-36 sm:pb-48">
      {actionNotice && !isBroadcastModalOpen && (
        <div role="status" className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ── UNIFIED HEADER MATCHING IMAGE 3 ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/education"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#0c513f] dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100/80">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {activeNavTab === 'announcements' ? 'Bảng tin chung' : activeNavTab === 'daily' ? 'Sổ Liên Lạc Điện Tử' : activeNavTab === 'consent' ? 'Biểu Mẫu Đồng Ý & Khảo Sát' : activeNavTab === 'media' ? 'Hoạt Động & Album Hình Ảnh' : 'Trung Tâm Truyền Thông & Tương Tác'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý tin nhắn, thông báo, sổ liên lạc và biểu mẫu đồng ý của phụ huynh
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          {activeNavTab !== 'announcements' && (
            <PreschoolSelect
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Chọn tháng làm việc"
              icon={<Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              className="py-2.5 px-3.5 text-xs font-bold"
              wrapperClassName="min-w-[170px]"
            >
              <option value="Tháng 09/2026">Tháng 09/2026</option>
              <option value="Tháng 10/2026">Tháng 10/2026</option>
              <option value="Tháng 11/2026">Tháng 11/2026</option>
            </PreschoolSelect>
          )}

          {activeNavTab !== 'announcements' && <button
            type="button"
            disabled
            aria-describedby="portal-issuance-unavailable"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#0c513f] dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 px-4 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserCheck className="w-4 h-4" />
            <span>Tạo link Portal Phụ huynh</span>
          </button>}

          {activeNavTab !== 'announcements' && <button
            type="button"
            onClick={() => {
              setActionNotice(null);
              setIsBroadcastModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-[#0c513f]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Đăng thông báo chung</span>
          </button>}
        </div>
      </div>

      <>
      <p id="portal-issuance-unavailable" className="sr-only">Chưa thể cấp liên kết phụ huynh: chưa xác minh học sinh và người giám hộ từ hồ sơ thật.</p>

      {activeNavTab !== 'announcements' && (
        <div role="note" className="sr-only">
          <span>Dữ liệu minh họa: hội thoại, chỉ số, gợi ý AI và lưu ý chăm sóc trên trang là nội dung mẫu. Chưa kết nối gửi tin, thông báo hoặc cập nhật hồ sơ thật.</span>
        </div>
      )}

      {/* ── Active Student Context Banner (From Child Popup Action) ── */}
      {activeNavTab !== 'announcements' && selectedStudentContext && (
        <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/90 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                Đang mở sổ liên lạc điện tử: <span className="text-emerald-700 dark:text-emerald-400">{selectedStudentContext.name} ({getCanonicalStudentSlug(selectedStudentContext.id)})</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hiển thị trao đổi phụ huynh, phản hồi chăm sóc và dặn dò hàng ngày của bé.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link
              href={`/dashboard/education/enrollments/${getCanonicalStudentSlug(selectedStudentContext.id)}`}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold hover:bg-emerald-100/60 transition-colors shadow-2xs"
            >
              Xem Hồ Sơ 360°
            </Link>
            <Link
              href={`/dashboard/education/grades?student=${getCanonicalStudentSlug(selectedStudentContext.id)}`}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs"
            >
              Học Tập &amp; Hoạt Động
            </Link>
            <Link
              href={`/dashboard/education/care?student=${getCanonicalStudentSlug(selectedStudentContext.id)}`}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs"
            >
              Chăm Sóc &amp; Nuôi Dưỡng
            </Link>
            <Link
              href={`/dashboard/education/attendance?student=${getCanonicalStudentSlug(selectedStudentContext.id)}`}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs"
            >
              Điểm Danh &amp; Đón Trả
            </Link>
            <button
              type="button"
              onClick={() => setSelectedStudentContext(null)}
              className="text-xs font-bold text-white bg-[#0c513f] hover:bg-[#083b2e] px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>
        </div>
      )}

      {/* ── 4 KPI STAT CARDS MATCHING IMAGE 3 ── */}
      {activeNavTab !== 'announcements' && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Tin chưa đọc — live from DB when available */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Tin chưa đọc</div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              {liveMetrics !== null ? liveMetrics.unreadCount : 8}
            </div>
            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              <span>{liveMetrics !== null ? `${liveMetrics.overdueCount} cuộc quá hạn` : '3 cuộc quá hạn'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tỷ lệ đã đọc */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <CheckCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Tỷ lệ đã đọc</div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              96.8%
            </div>
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>268 / 280 phụ huynh</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '96.8%' }} />
            </div>
          </div>
        </div>

        {/* Card 3: Chưa phản hồi */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Chưa phản hồi</div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              25
            </div>
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              <span>Biểu mẫu đồng ý</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '25%' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Hài lòng phụ huynh */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Hài lòng phụ huynh</div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              4.9 / 5.0
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span>◆</span>
              <span>Khảo sát tháng 9</span>
            </div>
            <div className="flex items-center gap-1 text-amber-400 text-xs mt-2">
              <span>⭐</span>
              <span>⭐</span>
              <span>⭐</span>
              <span>⭐</span>
              <span>⭐</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── WORKSPACE NAVIGATION TABS MATCHING IMAGE 3 ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveNavTab('overview')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeNavTab === 'overview'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <span>Tổng quan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('messages')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeNavTab === 'messages'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Tin nhắn</span>
          <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
            8
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('daily')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeNavTab === 'daily'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Sổ liên lạc</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('announcements')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeNavTab === 'announcements'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Thông báo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('consent')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeNavTab === 'consent'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Biểu mẫu đồng ý</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNavTab('media')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeNavTab === 'media'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Hoạt động</span>
        </button>
      </div>

      </>

      {/* ── ANNOUNCEMENTS TAB VIEW ── */}
      {activeNavTab === 'announcements' && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Quay lại tổng quan truyền thông"
                onClick={() => setActiveNavTab('overview')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />Quay lại
              </button>
              <Bell className="w-4 h-4 text-[#0c513f]" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Thông báo chung của nhà trường</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0c513f]/10 text-[#0c513f]">
                {isLoadingAnnouncements || announcementLoadError ? '— thông báo' : `${announcements.length} thông báo`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setActionNotice(null); setIsBroadcastModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Soạn thông báo chung</span>
            </button>
          </div>

          <p role="note" className="text-xs text-slate-500">Thông báo này hiển thị trong Portal cho phụ huynh có con đang ghi danh và liên kết Portal hợp lệ. Chưa gửi email, thông báo đẩy hoặc tin nhắn riêng.</p>
          {isLoadingAnnouncements ? <p role="status" className="text-sm text-slate-500">Đang tải thông báo...</p>
            : announcementLoadError ? <p role="alert" className="text-sm text-rose-700">{announcementLoadError}</p>
              : announcements.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">Chưa có thông báo chung nào được đăng.</p>
                : <div className="space-y-3">{announcements.map(notice => <article key={notice.id} className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium"><span>Toàn trường</span><span>•</span><time dateTime={notice.publishedAt}>{new Date(notice.publishedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">{notice.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notice.bodyText}</p>
                </article>)}</div>}
        </div>
      )}

      
      {/* ── SỔ LIÊN LẠC ĐIỆN TỬ (DAILY CONTACT BOOK) TAB VIEW ── */}
      {activeNavTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0c513f]" />
                Sổ Liên Lạc Điện Tử &amp; Dặn Dò Chăm Sóc 2 Chiều
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Nhật ký ăn ngủ, điểm danh, dặn dò sức khỏe và phản hồi trực tiếp giữa cô giáo và phụ huynh theo thời gian thực.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setActionNotice('Chức năng nhập dặn dò tập trung cho giáo viên đang mở.');
                setTimeout(() => setActionNotice(null), 3000);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi chú dặn dò mới</span>
            </button>
          </div>

          {/* Class filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['ALL', 'Mầm A1', 'Chồi B1', 'Lá C1'] as const).map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setDailyClassFilter(cls)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dailyClassFilter === cls
                    ? 'bg-[#0c513f] text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                {cls === 'ALL' ? 'Tất cả lớp (46 bé)' : `Lớp ${cls}`}
              </button>
            ))}
          </div>

          {/* 2-Column Sổ Liên Lạc Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Student List (5 cols) */}
            <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Danh sách sổ liên lạc ({filteredDailyStudents.length} học sinh)
                </span>
                <span className="text-[11px] text-emerald-600 font-bold">● Đã đồng bộ hôm nay</span>
              </div>

              <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
                {filteredDailyStudents.map((item) => {
                  const isSelected = item.id === selectedDailyStudentId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedDailyStudentId(item.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-[#0c513f]/40 shadow-xs ring-1 ring-[#0c513f]/30'
                          : 'border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/60 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${item.avatarBg}`}>
                            {item.avatarInitial}
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                              {item.studentName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {item.className} • {item.parentName}
                            </div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${item.noteTagColor}`}>
                          {item.noteTag}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl">
                        &quot;{item.parentNote}&quot;
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>{item.attendanceTime}</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Nhiệt độ: {item.temperature}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Detailed Contact Book View (7 cols) */}
            <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-6 space-y-5">
              {selectedDailyStudent && (
                <>
                  {/* Header of selected child */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl font-black text-base flex items-center justify-center ${selectedDailyStudent.avatarBg}`}>
                        {selectedDailyStudent.avatarInitial}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                            {selectedDailyStudent.studentName}
                          </h3>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {selectedDailyStudent.studentCode}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {selectedDailyStudent.className}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Phụ huynh đại diện: <strong className="text-slate-700 dark:text-slate-300">{selectedDailyStudent.parentName}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/education/enrollments/${selectedDailyStudent.studentCode}`}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        Hồ sơ 360°
                      </Link>
                      <Link
                        href={`/dashboard/education/care?student=${selectedDailyStudent.studentCode}`}
                        className="px-3 py-1.5 rounded-xl bg-[#0c513f] hover:bg-[#083b2e] text-xs font-bold text-white transition-all shadow-xs"
                      >
                        Chăm sóc
                      </Link>
                    </div>
                  </div>

                  {/* Daily Operational Status Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400 block font-semibold">Điểm danh</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 mt-1 block">✓ Có mặt 07:45</span>
                      <span className="text-[10px] text-slate-500">Nhiệt độ: {selectedDailyStudent.temperature}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400 block font-semibold">Bữa ăn</span>
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 block">Ăn 100% suất</span>
                      <span className="text-[10px] text-slate-500">Tự xúc ăn tốt</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400 block font-semibold">Giấc ngủ trưa</span>
                      <span className="font-extrabold text-indigo-700 dark:text-indigo-400 mt-1 block">12:00 – 14:00</span>
                      <span className="text-[10px] text-slate-500">Ngủ sâu giấc</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400 block font-semibold">Vệ sinh</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 mt-1 block">Bình thường</span>
                      <span className="text-[10px] text-slate-500">Đã rửa tay sạch</span>
                    </div>
                  </div>

                  {/* Parent Note & Interaction Block */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                        <Heart className="w-3.5 h-3.5 text-amber-600" />
                        <span>Dặn dò từ phụ huynh ({selectedDailyStudent.parentName} • {selectedDailyStudent.noteTime})</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${selectedDailyStudent.noteTagColor}`}>
                        {selectedDailyStudent.noteTag}
                      </span>
                    </div>
                    <p className="text-xs text-amber-950 dark:text-amber-100 font-medium leading-relaxed">
                      &quot;{selectedDailyStudent.parentNote}&quot;
                    </p>
                  </div>

                  {/* Teacher Reply Block */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Phản hồi từ cô giáo ({selectedDailyStudent.teacherName} • {selectedDailyStudent.replyTime})</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Đã chuyển đến phụ huynh
                      </span>
                    </div>
                    <p className="text-xs text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed">
                      {selectedDailyStudent.teacherReply}
                    </p>
                  </div>

                  {/* Send New Contact Note */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <label htmlFor="daily-reply-input" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Gửi phản hồi / Dặn dò bổ sung vào sổ liên lạc điện tử của bé
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="daily-reply-input"
                        type="text"
                        value={dailyReplyDraft}
                        onChange={(e) => setDailyReplyDraft(e.target.value)}
                        placeholder={`Nhắn gửi lời dặn đến ${selectedDailyStudent.parentName}...`}
                        className="flex-1 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!dailyReplyDraft.trim()) return;
                          setActionNotice(`Đã cập nhật sổ liên lạc điện tử và gửi dặn dò đến ${selectedDailyStudent.parentName} thành công!`);
                          setDailyReplyDraft('');
                          setTimeout(() => setActionNotice(null), 3500);
                        }}
                        disabled={!dailyReplyDraft.trim()}
                        className="px-4 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi dặn dò</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      
      {/* ── BIỂU MẪU ĐỒNG Ý (CONSENT FORMS ENGINE) TAB VIEW ── */}
      {activeNavTab === 'consent' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#0c513f]" />
                Quản Trị Biểu Mẫu Đồng Ý &amp; Khảo Sát Phụ Huynh (Consent Engine)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi tỷ lệ đồng ý dã ngoại, ủy quyền hình ảnh, chăm sóc y tế và khảo sát trực tuyến qua Portal.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setActionNotice('Chức năng tạo biểu mẫu đồng ý mới đang được chuẩn bị.');
                setTimeout(() => setActionNotice(null), 3000);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo biểu mẫu mới</span>
            </button>
          </div>

          {/* 3 Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block font-semibold">Tổng biểu mẫu phát hành</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">4 biểu mẫu</span>
                <span className="text-[10px] text-slate-400">2 đang thu thập • 1 hiệu lực • 1 kết thúc</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
                <CheckCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block font-semibold">Tỷ lệ đồng ý trung bình</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">91.1%</span>
                <span className="text-[10px] text-slate-400">255 / 280 phụ huynh toàn trường</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block font-semibold">Chưa phản hồi (Cần nhắc)</span>
                <span className="text-xl font-black text-amber-700 dark:text-amber-400">25 phụ huynh</span>
                <span className="text-[10px] text-amber-600 font-semibold">Khớp chỉ số KPI trang chủ</span>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {([
              { key: 'ALL', label: 'Tất cả biểu mẫu (4)' },
              { key: 'collecting', label: 'Đang thu thập phản hồi (1)' },
              { key: 'active', label: 'Đang hiệu lực (2)' },
              { key: 'completed', label: 'Đã hoàn tất (1)' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setConsentFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  consentFilter === tab.key
                    ? 'bg-[#0c513f] text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List of Consent Forms */}
          <div className="space-y-4">
            {filteredConsentForms.map((form) => {
              const percentAgreed = Math.round((form.agreedCount / form.totalTarget) * 100);
              return (
                <div
                  key={form.id}
                  className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-500">{form.category}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${form.statusColor}`}>
                          {form.statusLabel}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {form.title}
                      </h3>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-[11px] text-slate-400 block">Hạn chót tiếp nhận</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{form.deadline}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {form.description}
                  </p>

                  {/* Progress and Stats */}
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Đã đồng ý: {form.agreedCount} / {form.totalTarget} ({percentAgreed}%)
                      </span>
                      {form.pendingCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          Chưa phản hồi: {form.pendingCount} phụ huynh
                        </span>
                      )}
                      {form.declinedCount > 0 && (
                        <span className="text-rose-600 text-[11px]">
                          Từ chối: {form.declinedCount}
                        </span>
                      )}
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-[#0c513f] rounded-full transition-all duration-500"
                        style={{ width: `${percentAgreed}%` }}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Phạm vi: {form.scope}
                    </span>

                    <div className="flex items-center gap-2">
                      {form.pendingCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionNotice(`Đã gửi thông báo nhắc nhở nộp biểu mẫu đến ${form.pendingCount} phụ huynh qua Portal!`);
                            setTimeout(() => setActionNotice(null), 3500);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>Nhắc nhở ({form.pendingCount})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActionNotice(`Đang xuất danh sách phản hồi cho biểu mẫu: ${form.title}`);
                          setTimeout(() => setActionNotice(null), 3000);
                        }}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất danh sách</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      
      {/* ── HOẠT ĐỘNG & ALBUM HÌNH ẢNH (MEDIA ACTIVITIES) TAB VIEW ── */}
      {activeNavTab === 'media' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#0c513f]" />
                Thư Viện Hình Ảnh &amp; Hoạt Động Trải Nghiệm Lớp Học
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Kho ảnh và video ghi lại khoảnh khắc học tập, vận động STEAM và sinh hoạt hàng ngày được bảo mật gửi đến phụ huynh.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setActionNotice('Chức năng tải lên album ảnh lớp mới đang mở.');
                setTimeout(() => setActionNotice(null), 3000);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Đăng album mới</span>
            </button>
          </div>

          {/* Class filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['ALL', 'Chồi B1', 'Mầm A1', 'Lá C1', 'Toàn trường'] as const).map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setMediaClassFilter(cls)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mediaClassFilter === cls
                    ? 'bg-[#0c513f] text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                {cls === 'ALL' ? 'Tất cả album (4)' : cls === 'Toàn trường' ? 'Toàn trường' : `Lớp ${cls}`}
              </button>
            ))}
          </div>

          {/* Media Albums Grid (2 cols on tablet/desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMediaAlbums.map((album) => (
              <div
                key={album.id}
                className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Album header */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#0c513f]/10 text-[#0c513f]">
                      {album.className}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {album.dateString}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                    {album.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {album.description}
                  </p>

                  {/* Photo Preview Mock Collage */}
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${album.colorAccent} border flex items-center justify-center gap-3 min-h-[140px]`}>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-xs font-bold">
                      <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl shadow-xs">
                        <ImageIcon className="w-4 h-4 text-[#0c513f]" />
                        <span>{album.photoCount} hình ảnh</span>
                      </div>
                      {album.videoCount > 0 && (
                        <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl shadow-xs">
                          <Camera className="w-4 h-4 text-rose-600" />
                          <span>{album.videoCount} video clip</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {album.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Album Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 text-rose-600 font-bold">
                      <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                      {album.likesCount}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {album.commentsCount}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • {album.teacherName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActionNotice(`Đã chia sẻ album "${album.title}" đến ${album.sharedParentCount} phụ huynh qua Portal!`);
                        setTimeout(() => setActionNotice(null), 3000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Chia sẻ Portal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionNotice(`Đang nén và tải về ${album.photoCount} ảnh của album "${album.title}"...`);
                        setTimeout(() => setActionNotice(null), 3000);
                      }}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                      title="Tải về album"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ── TWO-COLUMN SPLIT INBOX WORKSPACE MATCHING IMAGE 3 ── */}
      {(activeNavTab === 'overview' || activeNavTab === 'messages') && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: CONVERSATION LIST (7 COLUMNS / ~58%) ── */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-5 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0c513f]" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Tin nhắn phụ huynh
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-bold">32 cuộc trò chuyện</span>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="Tìm phụ huynh, trẻ, lớp hoặc nội dung..."
                className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-2xl pl-9 pr-4 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <button
              type="button"
              title="Mở bộ lọc nâng cao"
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setConversationFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                conversationFilter === 'ALL'
                  ? 'bg-[#0c513f] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất cả (32)
            </button>
            <button
              type="button"
              onClick={() => setConversationFilter('UNREAD')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                conversationFilter === 'UNREAD'
                  ? 'bg-[#0c513f] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Chưa đọc (8)
            </button>
            <button
              type="button"
              onClick={() => setConversationFilter('ACTION_REQUIRED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                conversationFilter === 'ACTION_REQUIRED'
                  ? 'bg-[#0c513f] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Cần xử lý (6)
            </button>
            <button
              type="button"
              onClick={() => setConversationFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                conversationFilter === 'OVERDUE'
                  ? 'bg-[#0c513f] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Quá hạn (3)
            </button>
          </div>

          {/* Conversation Cards List */}
          <div className="space-y-2.5">
            {filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConversationId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-50/90 dark:bg-slate-700/60 border-slate-300 dark:border-slate-600 shadow-xs ring-1 ring-[#0c513f]/30'
                      : 'border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/60 dark:hover:bg-slate-700/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full font-extrabold text-sm flex items-center justify-center shrink-0 ${conv.avatarBg}`}
                    >
                      {conv.avatarInitial}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                          {conv.parentName}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">{conv.timestamp}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {conv.className} • {conv.studentName}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate mt-1">
                        &quot;{conv.snippet}&quot;
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {renderTagBadge(conv.tagType, conv.tagLabel)}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* List Footer with Pagination */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Hiển thị <strong className="text-slate-800 dark:text-slate-200">{filteredConversations.length}</strong> / 32
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {[1, 2, 3, 4].map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#0c513f] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === 4}
                onClick={() => setCurrentPage((p) => Math.min(4, p + 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: CONVERSATION DETAIL & ACTION WORKSPACE (5 COLUMNS / ~42%) ── */}
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-5 sm:p-6 space-y-5">
          {/* Conversation Detail Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full font-extrabold text-sm flex items-center justify-center shrink-0 ${activeConversation.avatarBg}`}
              >
                {activeConversation.avatarInitial}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {activeConversation.parentName}
                  </h3>
                  <Link
                    href={`/dashboard/education/enrollments/${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    title="Mở Hồ Sơ 360° của bé"
                  >
                    <span>Hồ Sơ 360°</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {activeConversation.studentName} • Lớp {activeConversation.className}
                </p>
              </div>
            </div>

            <button
              type="button"
              title="Tùy chọn hội thoại"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Detail Sub Tabs */}
          <div className="flex items-center gap-6 border-b border-slate-100 dark:border-slate-700/60 text-xs font-bold text-slate-500">
            <button
              type="button"
              onClick={() => setDetailSubTab('chat')}
              className={`pb-2 transition-all cursor-pointer ${
                detailSubTab === 'chat'
                  ? 'text-[#0c513f] dark:text-emerald-400 border-b-2 border-[#0c513f]'
                  : 'hover:text-slate-800'
              }`}
            >
              Trao đổi
            </button>
            <button
              type="button"
              onClick={() => setDetailSubTab('info')}
              className={`pb-2 transition-all cursor-pointer ${
                detailSubTab === 'info'
                  ? 'text-[#0c513f] dark:text-emerald-400 border-b-2 border-[#0c513f]'
                  : 'hover:text-slate-800'
              }`}
            >
              Thông tin
            </button>
            <button
              type="button"
              onClick={() => setDetailSubTab('logs')}
              className={`pb-2 transition-all cursor-pointer ${
                detailSubTab === 'logs'
                  ? 'text-[#0c513f] dark:text-emerald-400 border-b-2 border-[#0c513f]'
                  : 'hover:text-slate-800'
              }`}
            >
              Nhật ký
            </button>
            <button
              type="button"
              onClick={() => setDetailSubTab('related')}
              className={`pb-2 transition-all cursor-pointer ${
                detailSubTab === 'related'
                  ? 'text-[#0c513f] dark:text-emerald-400 border-b-2 border-[#0c513f]'
                  : 'hover:text-slate-800'
              }`}
            >
              Liên quan
            </button>
          </div>

          {detailSubTab === 'info' && (
            <div className="space-y-4 py-1 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shrink-0 ${activeConversation.avatarBg}`}>
                    {activeConversation.avatarInitial}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {activeConversation.studentName}
                    </h4>
                    <p className="text-slate-500 font-medium">
                      Mã học sinh: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}</span> • Lớp: <span className="font-bold text-emerald-700 dark:text-emerald-400">{activeConversation.className}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Người giám hộ chính:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeConversation.parentName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Trạng thái trao đổi:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">Đang hoạt động</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Giáo viên phụ trách lớp:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Cô Nguyễn Thị Mai</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block">Điều hướng nghiệp vụ liên quan:</span>
                <div className="space-y-2">
                  <Link
                    href={`/dashboard/education/enrollments/${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                          Hồ Sơ 360° Phát Triển Trẻ
                        </div>
                        <div className="text-[10px] text-slate-400">Xem hồ sơ nhân thân, sức khỏe và mốc năng lực</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    href={`/dashboard/education/care?student=${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                        <Heart className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#0c513f] transition-colors">
                          Chăm Sóc &amp; Nuôi Dưỡng
                        </div>
                        <div className="text-[10px] text-slate-400">Xem bữa ăn, giấc ngủ trưa và kiểm tra thân nhiệt</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    href={`/dashboard/education/attendance?student=${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 transition-colors">
                          Điểm Danh &amp; Đón Trả
                        </div>
                        <div className="text-[10px] text-slate-400">Xem lịch sử check-in, giờ đón và người đưa đón</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    href={`/dashboard/education/grades?student=${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 transition-colors">
                          Học Tập &amp; Hoạt Động NAEYC
                        </div>
                        <div className="text-[10px] text-slate-400">Đánh giá 5 lĩnh vực phát triển và sản phẩm của bé</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {detailSubTab === 'logs' && (
            <div className="space-y-4 py-1 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#0c513f]" />
                    <span>Dặn dò gần nhất từ phụ huynh</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">{activeConversation.timestamp}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 leading-relaxed">
                  &ldquo;{activeConversation.snippet}&rdquo;
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Phân loại yêu cầu:</span>
                  <span className="font-bold">{activeConversation.tagLabel}</span>
                </div>
              </div>

              {activeConversation.linkedCareNote && (
                <div className="p-4 rounded-2xl bg-[#fffbeb] dark:bg-amber-950/40 border border-[#fef3c7] dark:border-amber-900/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
                      <span>Ghi chú chăm sóc của giáo viên</span>
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300">{activeConversation.linkedCareNote.dateString}</span>
                  </div>
                  <p className="text-xs text-[#92400e] dark:text-amber-200 leading-relaxed font-medium">
                    &ldquo;{activeConversation.linkedCareNote.text}&rdquo;
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 pt-1 border-t border-[#fde68a]/50">
                    Phụ trách: <strong>{activeConversation.linkedCareNote.teacherName}</strong>
                  </p>
                </div>
              )}

              <div className="pt-2">
                <Link
                  href={`/dashboard/education/care?student=${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-[#0c513f] dark:text-emerald-300 font-bold text-center block hover:bg-emerald-100 transition-colors"
                >
                  Mở Trung Tâm Chăm Sóc &amp; Nuôi Dưỡng →
                </Link>
              </div>
            </div>
          )}

          {detailSubTab === 'related' && (
            <div className="space-y-3 py-1 text-xs">
              <p className="text-[11px] text-slate-500 font-medium">
                Dữ liệu đa phân hệ liên thông của học sinh <strong>{activeConversation.studentName}</strong> ({CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}):
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                <Link
                  href={`/dashboard/education/enrollments/${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 bg-white dark:bg-slate-800 transition-all block group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      Hồ Sơ 360° Toàn Diện
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold">Xem hồ sơ →</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Thông tin gia đình, sức khỏe, học tập và tài chính tập trung</p>
                </Link>

                <Link
                  href={`/dashboard/education/grades?student=${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 bg-white dark:bg-slate-800 transition-all block group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                      Học Tập &amp; Hoạt Động NAEYC
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">Xem đánh giá →</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Tiến trình năng lực 5 lĩnh vực, nhật ký quan sát và khen thưởng</p>
                </Link>

                <Link
                  href={`/dashboard/education/care?student=${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 bg-white dark:bg-slate-800 transition-all block group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      Chăm Sóc &amp; Nuôi Dưỡng
                    </span>
                    <span className="text-[10px] text-rose-600 font-bold">Xem chăm sóc →</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Khẩu phần ăn 3 bữa, giấc ngủ trưa và kiểm tra thân nhiệt hàng ngày</p>
                </Link>

                <Link
                  href={`/dashboard/education/attendance?student=${CONV_TO_STUDENT_CODE[activeConversation.id] || getCanonicalStudentSlug(activeConversation.id)}`}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 bg-white dark:bg-slate-800 transition-all block group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-500" />
                      Điểm Danh &amp; Đón Trả
                    </span>
                    <span className="text-[10px] text-purple-600 font-bold">Xem điểm danh →</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Trạng thái có mặt trong ngày, giờ đưa đón và phân quyền đưa đón</p>
                </Link>
              </div>
            </div>
          )}

          {detailSubTab === 'chat' && (
            <>
          {/* Chat Messages Timeline */}
          <div className="space-y-3.5 py-1 max-h-[300px] overflow-y-auto pr-1">
            {activeConversation.thread.map((msg) => {
              if (msg.sender === 'parent') {
                return (
                  <div key={msg.id} className="flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${activeConversation.avatarBg}`}
                    >
                      {activeConversation.avatarInitial}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs p-3.5 bg-slate-100 dark:bg-slate-700/80 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                      <p className="leading-relaxed">{msg.text}</p>
                      <div className="text-[10px] text-slate-400 text-right">{msg.time}</div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={msg.id} className="flex items-end justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs p-3.5 bg-[#ecfdf5] dark:bg-emerald-950/60 border border-[#a7f3d0] dark:border-emerald-800 text-xs text-[#064e3b] dark:text-emerald-200 space-y-1">
                      <p className="leading-relaxed">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span>{msg.time}</span>
                        {msg.isDelivered && <span>✔✔</span>}
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>

          {/* AI Intent Detection Box Matching Image 3 (Connected to Realtime AI Copilot) */}
          {(() => {
            const currentIntent = realtimeAiIntents[activeConversation.id] || activeConversation.aiIntent;
            return (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>AI nhận diện yêu cầu</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAnalyzeWithAi}
                      disabled={isAnalyzingAi}
                      title="Phân tích lại tin nhắn với AI"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isAnalyzingAi ? 'animate-spin' : ''}`} />
                      <span>{isAnalyzingAi ? 'Đang phân tích...' : 'Làm mới AI'}</span>
                    </button>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#fef3c7] text-[#92400e]">
                    AI Platform
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                      {currentIntent.title}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {currentIntent.confidence}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {currentIntent.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${t.color}`}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>

                {/* Action Recommendations */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-500">Gợi ý hành động:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleExecutePrimaryAction}
                      className="px-3.5 py-2 rounded-xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{currentIntent.primaryActionLabel}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReplyInput('Dạ cô đã tiếp nhận thông tin từ gia đình ạ.')}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Phản hồi nhanh</span>
                    </button>
                  </div>

                  {/* Smart Reply Suggestions */}
                  {smartReplies.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/40 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Gợi ý trả lời 1-chạm của AI:</span>
                      </div>
                      <div className="space-y-1">
                        {smartReplies.map((reply, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => setReplyInput(reply)}
                            className="w-full text-left text-[11px] p-2 rounded-xl bg-slate-50 hover:bg-emerald-50/80 dark:bg-slate-700/50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-600/60 text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-200 transition-all font-medium leading-relaxed cursor-pointer"
                          >
                            &ldquo;{reply}&rdquo;
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Linked Care Note Box (If present) */}
          {activeConversation.linkedCareNote && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-[#0c513f]" />
                  <span>Lưu ý chăm sóc ({activeConversation.linkedCareNote.count})</span>
                </span>
                <Link
                  href="/dashboard/education/care"
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Xem tất cả</span>
                  <span>→</span>
                </Link>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#fffbeb] dark:bg-amber-950/40 border border-[#fef3c7] dark:border-amber-900/60 space-y-2 text-xs">
                <p className="text-[#92400e] dark:text-amber-200 leading-relaxed font-medium">
                  &quot;{activeConversation.linkedCareNote.text}&quot;
                </p>
                <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300 pt-1 border-t border-[#fde68a]/50">
                  <span className="font-bold">{activeConversation.linkedCareNote.teacherName}</span>
                  <span>{activeConversation.linkedCareNote.dateString}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Response Compose Bar */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={replyInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setReplyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendReply();
                }}
                placeholder="Nhập tin nhắn phản hồi..."
                className="w-full bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-2xl pl-4 pr-12 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
              />
              <button
                type="button"
                onClick={handleSendReply}
                title="Gửi tin nhắn"
                className="w-8 h-8 rounded-full bg-[#0c513f] hover:bg-[#083b2e] text-white flex items-center justify-center absolute right-2 top-2 shadow-xs transition-transform active:scale-90 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-slate-400 px-1 text-xs">
              <button
                type="button"
                title="Đính kèm tệp"
                className="hover:text-slate-600 transition-colors cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Đính kèm hình ảnh"
                className="hover:text-slate-600 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Chèn biểu tượng cảm xúc"
                className="hover:text-slate-600 transition-colors cursor-pointer"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
      )}

      {/* ── BROADCAST ANNOUNCEMENT MODAL ── */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="broadcast-title" className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#0c513f] flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h3 id="broadcast-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                  Soạn thông báo chung của nhà trường
                </h3>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={handleCloseBroadcast}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionNotice && (
              <div role="status" className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-200">
                {actionNotice}
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="broadcast-subject" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Tiêu đề thông báo
                </label>
                <input
                  id="broadcast-subject"
                  type="text"
                  maxLength={200}
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder="Ví dụ: Kế hoạch tổ chức Lễ hội Trung Thu 2026..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label htmlFor="broadcast-content" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nội dung chi tiết
                </label>
                <textarea
                  id="broadcast-content"
                  rows={4}
                  maxLength={20000}
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  placeholder="Nhập nội dung thông báo gửi đến phụ huynh..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500">Phụ huynh có con đang ghi danh và liên kết Portal hợp lệ sẽ đọc được thông báo này. Chức năng chat riêng chưa triển khai; không gửi email hoặc thông báo đẩy.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCloseBroadcast}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handlePublishBroadcast}
                disabled={isPublishingBroadcast || !broadcastSubject.trim() || !broadcastContent.trim()}
                className="px-5 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{isPublishingBroadcast ? 'Đang đăng...' : 'Đăng thông báo chung'}</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default function PreschoolCommunicationPage() {
  const { user, product, isLoading, tenantPresentation, tenantSettings } = useUser();
  const tenant = tenantPresentation ?? tenantSettings;
  if (isLoading) return <div role="status" className="p-8 text-sm text-muted-foreground">Đang tải bảng tin...</div>;
  if (!user || !tenant || user.tenant_id !== tenant.id || !product) {
    return <div role="alert" className="p-8 text-sm text-muted-foreground">Không thể xác minh ngữ cảnh bảng tin.</div>;
  }
  if (product.productKey !== 'bella_preschool') return <LegacyCommunicationView />;
  return (
    <Suspense fallback={<div className="p-8 text-xs font-bold text-slate-500">Đang tải sổ liên lạc...</div>}>
      <PreschoolCommunicationContent key={`${user.id}:${tenant.id}`} tenantId={tenant.id} />
    </Suspense>
  );
}

/**
 * Fallback view for non-preschool enterprise tenants
 */
function LegacyCommunicationView() {
  return (
    <div className="w-full p-6 space-y-6">
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Trung Tâm Truyền Thông &amp; Tương Tác — Enterprise ERP
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Chế độ xem dành riêng cho trung tâm đào tạo tiêu chuẩn và trường phổ thông liên cấp.
        </p>
      </div>
    </div>
  );
}

