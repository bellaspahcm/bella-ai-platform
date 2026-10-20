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
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
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
  Copy,
} from 'lucide-react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';

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

// ── Static notice seed for Announcements tab (replaces real DB data until API ready) ──
interface NoticeRow {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly target_scope: string;
  readonly notice_type: string;
  readonly published_at: string;
  readonly created_by_name: string;
  readonly read_count: number;
  readonly total_recipients: number;
}

const SAMPLE_NOTICES: readonly NoticeRow[] = [
  {
    id: 'N-001',
    title: 'Thông báo lịch nghỉ Lễ 02/09 — Quốc khánh 2026',
    body: 'Kính gửi quý phụ huynh, nhà trường thông báo học sinh được nghỉ học ngày 02/09/2026 (Thứ Tư) nhân dịp Quốc khánh nước CHXHCN Việt Nam. Trẻ sẽ đi học trở lại bình thường vào thứ Năm 03/09/2026. Nhà trường trân trọng kính báo.',
    target_scope: 'Toàn trường',
    notice_type: 'general',
    published_at: '2026-08-28T08:00:00',
    created_by_name: 'BGH Trường Mầm Non Bella',
    read_count: 274,
    total_recipients: 280,
  },
  {
    id: 'N-002',
    title: 'Biểu mẫu đồng ý tham gia Dã ngoại Tháng 9 — Hạn 10/09',
    body: 'Nhà trường tổ chức chuyến dã ngoại học tập tại Vườn thực vật quận 9 vào ngày 15/09/2026. Kính mời phụ huynh điền xác nhận tham gia cho bé qua ứng dụng hoặc gửi phiếu giấy về cho giáo viên chủ nhiệm trước ngày 10/09/2026. Chi phí đóng góp: 150.000đ/bé (đã bao gồm xe, bảo hiểm và bữa ăn nhẹ).',
    target_scope: 'Toàn trường',
    notice_type: 'consent',
    published_at: '2026-09-01T08:30:00',
    created_by_name: 'Cô Nguyễn Thị Mai (BGH)',
    read_count: 240,
    total_recipients: 280,
  },
  {
    id: 'N-003',
    title: 'Thực đơn tháng 10 — Bổ sung món dinh dưỡng mới',
    body: 'Từ tháng 10/2026, nhà bếp sẽ bổ sung thêm 3 món mới vào thực đơn hàng tuần theo tư vấn của chuyên gia dinh dưỡng: cháo lươn đậu xanh (thứ Hai), súp bí đỏ phô mai (thứ Tư), và mì sốt thịt bò bằm rau củ (thứ Sáu). Phụ huynh có thể xem thực đơn chi tiết từng tuần tại mục Thực đơn tuần trên trang Tổng quan.',
    target_scope: 'Toàn trường',
    notice_type: 'nutrition',
    published_at: '2026-09-25T09:00:00',
    created_by_name: 'Bếp trưởng Trần Văn Minh',
    read_count: 198,
    total_recipients: 280,
  },
  {
    id: 'N-004',
    title: 'Kế hoạch Tết Trung Thu 2026 — Chương trình đêm hội',
    body: 'Nhà trường tổ chức Đêm hội Trung Thu cho toàn trường vào tối ngày 29/09/2026 (14 tháng 8 Âm lịch), từ 17:30–20:00 tại sân trường. Phụ huynh được mời tham dự và chụp ảnh cùng các bé. Trẻ mặc trang phục dân tộc hoặc hóa trang nhân vật đèn lồng yêu thích. Đêm hội bao gồm: múa lân, làm đèn lồng, phá cỗ và tặng quà cho các bé.',
    target_scope: 'Toàn trường',
    notice_type: 'event',
    published_at: '2026-09-20T07:00:00',
    created_by_name: 'BGH Trường Mầm Non Bella',
    read_count: 268,
    total_recipients: 280,
  },
  {
    id: 'N-005',
    title: 'Thông báo học phí tháng 10 — Hạn đóng 15/10',
    body: 'Kính gửi quý phụ huynh, học phí tháng 10/2026 đến hạn thanh toán vào ngày 15/10/2026. Nhà trường hỗ trợ thanh toán qua: chuyển khoản ngân hàng (STK: 9704...1234 — Techcombank), QR Code tại quầy hoặc ứng dụng phụ huynh. Phụ huynh chưa đóng sau ngày 20/10 sẽ được liên hệ trực tiếp. Cảm ơn quý phụ huynh đã phối hợp.',
    target_scope: 'Toàn trường',
    notice_type: 'tuition',
    published_at: '2026-10-01T08:00:00',
    created_by_name: 'Phòng Kế toán',
    read_count: 210,
    total_recipients: 280,
  },
];

const NOTICE_TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  general:   { label: 'Thông báo chung',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  consent:   { label: 'Biểu mẫu đồng ý', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  nutrition: { label: 'Dinh dưỡng',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  event:     { label: 'Sự kiện',          cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  tuition:   { label: 'Học phí',          cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function PreschoolCommunicationContent() {
  const searchParams = useSearchParams();
  const studentParam = searchParams ? searchParams.get('student') : null;
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const [isPreschoolTenant, setIsPreschoolTenant] = useState<boolean>(true);

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
  const [broadcastScope, setBroadcastScope] = useState<string>('Toàn trường (Tất cả các lớp)');
  const [broadcastCategory, setBroadcastCategory] = useState<string>('INFO');
  const [broadcastContent, setBroadcastContent] = useState<string>('');
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState<boolean>(false);

  // Portal Link Modal State
  const [isPortalModalOpen, setIsPortalModalOpen] = useState<boolean>(false);
  const [generatedPortalUrl, setGeneratedPortalUrl] = useState<string | null>(null);
  const [isGeneratingPortalToken, setIsGeneratingPortalToken] = useState<boolean>(false);
  const [copiedPortalLink, setCopiedPortalLink] = useState<boolean>(false);

  // Auto-focus on student when query param ?student=... is provided
  useEffect(() => {
    if (!studentParam) return;
    const lookup = STUDENT_TO_CONV_MAP[studentParam];
    if (lookup) {
      setSelectedConversationId(lookup.convId);
      setSelectedStudentContext({ id: studentParam, name: lookup.studentName });
      setActiveNavTab('daily');
    } else {
      const found = CONVERSATIONS_DATA.find((c) =>
        c.studentName.toLowerCase().includes(studentParam.toLowerCase()) || c.id === studentParam
      );
      if (found) {
        setSelectedConversationId(found.id);
        setSelectedStudentContext({ id: studentParam, name: found.studentName });
        setActiveNavTab('daily');
      } else {
        setSelectedStudentContext({ id: studentParam, name: `Học sinh ${studentParam}` });
        setActiveNavTab('daily');
      }
    }
  }, [studentParam]);

  // Detect tenant scope
  useEffect(() => {
    async function checkTenant() {
      try {
        const tenant = await getCachedTenantSettings();
        if (tenant) {
          const brand = resolveTenantBrandIdentity({
            enabledModules: tenant.enabled_modules,
            brandTheme: tenant.brand_theme,
            logoUrl: tenant.logo_url,
            tenantName: tenant.name,
            surface: 'app',
          });
          setIsPreschoolTenant(brand.moduleKey === 'bella_education');
        } else {
          setIsPreschoolTenant(true);
        }
      } catch {
        setIsPreschoolTenant(true);
      }
    }
    void checkTenant();
  }, []);

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

  // Current active conversation
  const activeConversation = useMemo(() => {
    const found = CONVERSATIONS_DATA.find((c) => c.id === selectedConversationId);
    return found || CONVERSATIONS_DATA[0];
  }, [selectedConversationId]);

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
    setActionNotice('Chưa gửi phản hồi: tính năng gửi chưa được kết nối. Nội dung vẫn được giữ trên trang; hãy sao chép trước khi rời trang.');
  };

  const handleExecutePrimaryAction = () => {
    if (activeConversation.aiIntent.primaryActionType === 'care_note') {
      setActionNotice('Chưa tạo lưu ý chăm sóc: hành động này chưa được kết nối. Chưa có dữ liệu chăm sóc nào được ghi nhận.');
    } else if (activeConversation.aiIntent.primaryActionType === 'early_pickup') {
      setActionNotice('Chưa xác nhận đón sớm: hành động này chưa được kết nối. Chưa có thay đổi nào trong sổ điểm danh.');
    } else {
      setActionNotice('Chưa thực hiện hành động: tính năng này chưa được kết nối. Chưa có thông tin nào được gửi hoặc lưu.');
    }
  };

  const handleCloseBroadcast = () => {
    setActionNotice(null);
    setIsBroadcastModalOpen(false);
  };

  const handlePublishBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastContent.trim()) {
      setActionNotice('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.');
      return;
    }

    setIsPublishingBroadcast(true);
    setActionNotice(null);

    try {
      const res = await fetch('/api/education/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastSubject,
          bodyText: broadcastContent,
          scope: broadcastScope,
          category: broadcastCategory,
        }),
      });

      const data = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể phát hành thông báo');
      }

      setActionNotice('Đã phát hành thông báo thành công đến toàn trường và lưu vào cơ sở dữ liệu!');
      setBroadcastSubject('');
      setBroadcastContent('');
      setIsBroadcastModalOpen(false);
    } catch (err) {
      setActionNotice(err instanceof Error ? err.message : 'Lỗi phát hành thông báo');
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  const handleGeneratePortalLink = async (studentId = '00000000-0000-0000-0000-000000000011') => {
    setIsGeneratingPortalToken(true);
    try {
      const res = await fetch('/api/education/portal/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentPartyId: studentId }),
      });
      const data = (await res.json()) as { success: boolean; portalUrl?: string; error?: string };
      if (res.ok && data.success && data.portalUrl) {
        const fullUrl = `${window.location.origin}${data.portalUrl}`;
        setGeneratedPortalUrl(fullUrl);
        setIsPortalModalOpen(true);
      } else {
        alert(data.error || 'Lỗi tạo liên kết phụ huynh');
      }
    } catch {
      alert('Không thể tạo liên kết phụ huynh lúc này');
    } finally {
      setIsGeneratingPortalToken(false);
    }
  };

  if (!isPreschoolTenant) {
    return <LegacyCommunicationView />;
  }

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
                Truyền thông & Phụ huynh
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý tin nhắn, thông báo, sổ liên lạc và biểu mẫu đồng ý của phụ huynh
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value)}
              aria-label="Chọn tháng làm việc"
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-2xl pl-4 pr-9 py-2.5 shadow-sm cursor-pointer hover:border-slate-300 focus:outline-none"
            >
              <option>Tháng 09/2026</option>
              <option>Tháng 10/2026</option>
              <option>Tháng 11/2026</option>
            </select>
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => void handleGeneratePortalLink(selectedStudentContext?.id || '00000000-0000-0000-0000-000000000011')}
            disabled={isGeneratingPortalToken}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-[#0c513f] dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 px-4 py-2.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            {isGeneratingPortalToken ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            <span>Tạo link Portal Phụ huynh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActionNotice(null);
              setIsBroadcastModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-[#0c513f]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Gửi thông báo</span>
          </button>
        </div>
      </div>

      <div role="note" className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-900 dark:text-amber-200">
        Dữ liệu minh họa: hội thoại, chỉ số, gợi ý AI và lưu ý chăm sóc trên trang là nội dung mẫu. Chưa kết nối gửi tin, thông báo hoặc cập nhật hồ sơ thật.
      </div>

      {/* ── Active Student Context Banner (From Child Popup Action) ── */}
      {selectedStudentContext && (
        <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/90 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                Đang mở sổ liên lạc điện tử: <span className="text-emerald-700 dark:text-emerald-400">{selectedStudentContext.name} ({selectedStudentContext.id})</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hiển thị trao đổi phụ huynh, phản hồi chăm sóc và dặn dò hàng ngày của bé.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/dashboard/education/enrollments/${selectedStudentContext.id}`}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold hover:bg-emerald-100/60 transition-colors"
            >
              Xem Hồ Sơ 360°
            </Link>
            <button
              type="button"
              onClick={() => setSelectedStudentContext(null)}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 transition-colors"
            >
              Xem tất cả
            </button>
          </div>
        </div>
      )}

      {/* ── 4 KPI STAT CARDS MATCHING IMAGE 3 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Tin chưa đọc */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Tin chưa đọc</div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              8
            </div>
            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              <span>3 cuộc quá hạn</span>
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

      {/* ── ANNOUNCEMENTS TAB VIEW ── */}
      {activeNavTab === 'announcements' && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#0c513f]" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Thông báo điều hành</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0c513f]/10 text-[#0c513f]">
                {SAMPLE_NOTICES.length} thông báo
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setActionNotice(null); setIsBroadcastModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Soạn thông báo mới</span>
            </button>
          </div>

          {/* Notice cards */}
          <div className="space-y-3">
            {SAMPLE_NOTICES.map((notice) => {
              const typeInfo = NOTICE_TYPE_LABEL[notice.notice_type] ?? { label: notice.notice_type, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
              const readPct = notice.total_recipients > 0
                ? Math.round((notice.read_count / notice.total_recipients) * 100)
                : 0;
              const publishedDate = new Date(notice.published_at).toLocaleDateString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              });
              return (
                <div
                  key={notice.id}
                  className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-5 space-y-3"
                >
                  {/* Top row: type badge + date + scope */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${typeInfo.cls}`}>
                      {typeInfo.label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{publishedDate}</span>
                    <span className="text-[11px] text-slate-400 font-medium">• {notice.target_scope}</span>
                    <span className="text-[11px] text-slate-400 font-medium">• {notice.created_by_name}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                    {notice.title}
                  </h3>

                  {/* Body preview */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                    {notice.body}
                  </p>

                  {/* Footer: read progress */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Đã đọc</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {notice.read_count} / {notice.total_recipients} phụ huynh ({readPct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${readPct}%` }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer shrink-0"
                    >
                      Xem toàn văn
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Source note */}
          <p className="text-[11px] text-slate-400 text-center">
            Dữ liệu minh họa — Thực tế lấy từ bảng <code className="font-mono">edu_comm_notices</code> theo tenant.
          </p>
        </div>
      )}

      {/* ── TWO-COLUMN SPLIT INBOX WORKSPACE MATCHING IMAGE 3 ── */}
      {activeNavTab !== 'announcements' && (
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
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {activeConversation.parentName}
                </h3>
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

          {/* AI Intent Detection Box Matching Image 3 */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                AI nhận diện yêu cầu
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#fef3c7] text-[#92400e]">
                Beta
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center shrink-0">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                  {activeConversation.aiIntent.title}
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {activeConversation.aiIntent.confidence}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {activeConversation.aiIntent.tags.map((t, idx) => (
                <span
                  key={idx}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${t.color}`}
                >
                  {t.label}
                </span>
              ))}
            </div>

            {/* Action Recommendations */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
              <span className="text-[11px] font-bold text-slate-500">Gợi ý hành động:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExecutePrimaryAction}
                  className="px-3.5 py-2 rounded-xl bg-[#0c513f] hover:bg-[#083b2e] text-white text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{activeConversation.aiIntent.primaryActionLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReplyInput('Dạ cô đã tiếp nhận thông tin từ gia đình ạ.')}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tạo phản hồi nhanh</span>
                </button>

                <button
                  type="button"
                  title="Thêm tùy chọn"
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

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
                  Soạn thông báo điều hành mới
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
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder="Ví dụ: Kế hoạch tổ chức Lễ hội Trung Thu 2026..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Phạm vi gửi
                  </label>
                  <select
                    value={broadcastScope}
                    onChange={(e) => setBroadcastScope(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option>Toàn trường (Tất cả các lớp)</option>
                    <option>Khối Mầm (Mầm A1, Mầm A2)</option>
                    <option>Khối Chồi (Chồi B1, Chồi B2)</option>
                    <option>Khối Lá (Lá C1, Lá C2)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Loại thông báo
                  </label>
                  <select
                    value={broadcastCategory}
                    onChange={(e) => setBroadcastCategory(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="INFO">Thông báo chung</option>
                    <option value="CONSENT">Biểu mẫu đồng ý (Consent)</option>
                    <option value="EVENT">Hoạt động dã ngoại / Sự kiện</option>
                    <option value="TUITION">Thông báo học phí</option>
                    <option value="CRITICAL">Khẩn cấp</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="broadcast-content" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nội dung chi tiết
                </label>
                <textarea
                  id="broadcast-content"
                  rows={4}
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  placeholder="Nhập nội dung thông báo gửi đến phụ huynh..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCloseBroadcast}
                disabled={isPublishingBroadcast}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => void handlePublishBroadcast()}
                disabled={isPublishingBroadcast || !broadcastSubject.trim() || !broadcastContent.trim()}
                className="px-5 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isPublishingBroadcast ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Phát hành thông báo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PORTAL LINK GENERATION MODAL ── */}
      {isPortalModalOpen && generatedPortalUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#0c513f] flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Liên kết Portal Phụ huynh
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPortalModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Đây là liên kết an toàn (Magic Link) để phụ huynh mở Sổ liên lạc điện tử trên điện thoại. Phụ huynh có thể xem sĩ số lớp, nhật ký ăn ngủ của con, thực đơn tuần, học phí và dặn dò giáo viên.
            </p>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-[11px] break-all select-all text-emerald-800 dark:text-emerald-300">
              {generatedPortalUrl}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(generatedPortalUrl);
                  setCopiedPortalLink(true);
                  setTimeout(() => setCopiedPortalLink(false), 2000);
                }}
                className="flex-1 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedPortalLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPortalLink ? 'Đã sao chép link' : 'Sao chép link'}</span>
              </button>

              <a
                href={generatedPortalUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1"
              >
                <span>Mở xem thử</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreschoolCommunicationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-bold text-slate-500">Đang tải sổ liên lạc...</div>}>
      <PreschoolCommunicationContent />
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
          Trung Tâm Truyền Thông & Tương Tác — Enterprise ERP
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Chế độ xem dành riêng cho trung tâm đào tạo tiêu chuẩn và trường phổ thông liên cấp.
        </p>
      </div>
    </div>
  );
}

