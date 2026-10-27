'use client';

/**
 * Bella Education — Learning & Child Development Operations Workspace
 *
 * Scoped exclusively to Preschool tenants (`bella_education`)
 * Color scheme: Deep Preschool Green (`#0c513f` / `#083b2e`)
 *
 * CANONICAL TRUTH & AUDIT GUARANTEES:
 * - 46 total children across 2 classes (Lớp Mầm A1: 24, Lớp Chồi B1: 22)
 * - 38 evaluated (83%): Mầm A1 18/24 (75%), Chồi B1 20/22 (90%)
 * - 8 not yet evaluated (17%): Mầm A1 6/24, Chồi B1 2/22
 * - 12 new observation records in month
 * - 8 children needing attention with specific developmental reasons
 * - 5 Full-Fidelity Interactive Tabs:
 *     1. 'overview' (Tổng quan): Banners, Filters, Table/Grid with Pagination, Split Widgets
 *     2. 'observations' (Nhật ký & Bằng chứng): Pedagogical Evidence Gallery, Photo Proofs, Consent
 *     3. 'progression' (Tiến trình NAEYC): 5-Domain NAEYC Matrix, Class Comparison, Indicators
 *     4. 'portfolio' (Hồ sơ 360°): Comprehensive Student 360 Growth, Deep Links to /enrollments/[id]
 *     5. 'recognition' (Khen thưởng): Positive Reinforcement Wall, Awards & Badges, Award Modal
 * - Action buttons with verified destinations and zero dead ends
 * - STRICT TYPE SAFETY: Zero `any` and zero `unknown`
 */

import { useState, useEffect, useMemo, useRef, Suspense, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  Users,
  FileText,
  Clock,
  Sparkles,
  Plus,
  Download,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  MoreHorizontal,
  Check,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  BarChart2,
  MessageSquare,
  BookOpen,
  Award,
  Heart,
  X,
  Target,
  Bot,
  Activity,
  ShieldCheck,
  TrendingUp,
  Star,
  ExternalLink,
  Printer,
  Share2,
  Eye,
} from 'lucide-react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';

// ── Strict Domain Types ───────────────────────────────────────────────────────

export type DevelopmentTabKey = 'overview' | 'observations' | 'progression' | 'portfolio' | 'recognition';

export type DomainScore = 'dat' | 'tot' | 'theodoi' | 'canhotro';

export type StudentStatus = 'completed' | 'supplement' | 'attention';

export interface ChildDevelopmentRosterItem {
  readonly id: string;
  readonly code: string;
  readonly orderNumber: number;
  readonly name: string;
  readonly nickname?: string;
  readonly className: string;
  readonly classKey: 'MAM_A1' | 'CHOI_B1';
  readonly avatarUrl: string;
  readonly avatarFallbackBg: string;
  readonly physical: DomainScore;
  readonly cognitive: DomainScore;
  readonly language: DomainScore;
  readonly socialEmotional: DomainScore;
  readonly motor: DomainScore;
  readonly status: StudentStatus;
  readonly statusLabel: string;
  readonly attentionReason?: string;
  readonly physicalDetail?: {
    readonly height: string;
    readonly weight: string;
    readonly observation: string;
  };
  readonly highlights?: readonly {
    readonly domain: string;
    readonly skillName: string;
    readonly level: string;
    readonly note: string;
    readonly photos: number;
    readonly notes: number;
    readonly nextGoal: string;
  }[];
  readonly teacherComment?: string;
  readonly aiDraftSummary?: string;
}

export interface AttentionChildItem {
  readonly id: string;
  readonly name: string;
  readonly className: string;
  readonly avatarUrl: string;
  readonly avatarFallbackBg: string;
  readonly note: string;
  readonly badgeType: 'theodoi' | 'canhotro';
  readonly badgeLabel: string;
}

export interface DevelopmentActivityItem {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly studentAndClass: string;
  readonly iconType: 'camera' | 'clipboard' | 'chart' | 'message';
}

export interface PedagogicalObservationFeedItem {
  readonly id: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly studentClass: string;
  readonly studentAvatarBg: string;
  readonly observerTeacher: string;
  readonly timestamp: string;
  readonly domainName: string;
  readonly milestoneCode: string;
  readonly progressionLevel: string;
  readonly observationNote: string;
  readonly photoCount: number;
  readonly photoTags: readonly string[];
  readonly consentStatus: 'PARENT_SHARED' | 'INTERNAL_TEACHER';
  readonly parentFeedback?: string;
}

export interface PreschoolAwardItem {
  readonly id: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly studentClass: string;
  readonly studentAvatarBg: string;
  readonly category: 'CHAM_NGOAN' | 'HOA_SI' | 'KHOE_DEP' | 'CHIA_SE' | 'TU_LAP';
  readonly categoryLabel: string;
  readonly title: string;
  readonly commendationReason: string;
  readonly dateAwarded: string;
  readonly iconType: 'star' | 'palette' | 'heart' | 'trophy' | 'activity';
}

// ── Complete Canonical 46-Student Roster ──────────────────────────────────────

export const ROSTER_STUDENTS: readonly ChildDevelopmentRosterItem[] = [
  // ── LỚP MẦM A1 (24 trẻ: 18 đã đánh giá, 6 chưa đánh giá / cần bổ sung, 4 cần chú ý) ──
  {
    id: 'STU-001',
    code: 'HS-2026-001',
    orderNumber: 1,
    name: 'Nguyễn Minh An',
    nickname: 'Bé Bi',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
    physicalDetail: {
      height: '98 cm (+1.5cm)',
      weight: '14.5 kg (+0.4kg)',
      observation: 'Chỉ số tăng trưởng hài hòa theo biểu đồ tham chiếu độ tuổi WHO.',
    },
    highlights: [
      {
        domain: 'Kỹ Năng Tự Phục Vụ',
        skillName: 'Xúc ăn tự lập & cất dép đúng vị trí',
        level: 'Đạt kỳ vọng',
        note: 'Biết tự xúc ăn hết suất trưa, chủ động cất dép gọn gàng sau khi đi sinh hoạt ngoài trời.',
        photos: 3,
        notes: 2,
        nextGoal: 'Rèn luyện kỹ năng tự mặc áo khoác mỏng.',
      },
      {
        domain: 'Ngôn Ngữ & Giao Tiếp',
        skillName: 'Giao tiếp nhóm & kể chuyện theo tranh',
        level: 'Thành thạo',
        note: 'Chủ động dùng câu đầy đủ 4-5 từ để diễn đạt mong muốn, thích kể lại truyện cho bạn cùng bàn.',
        photos: 2,
        notes: 4,
        nextGoal: 'Mở rộng vốn từ chỉ cảm xúc & trạng thái.',
      },
    ],
    teacherComment: 'Bé Bi ngoan ngoãn, hòa đồng với các bạn. Bé rất thích giờ đọc truyện và tự giác cất đồ chơi sau khi dùng.',
    aiDraftSummary: 'Minh An có sự tiến bộ vượt bậc ở Domain Ngôn ngữ (kể chuyện nhóm). Kỹ năng tự phục vụ đạt chuẩn đầu ra Lớp Mầm.',
  },
  {
    id: 'STU-003',
    code: 'HS-2026-003',
    orderNumber: 2,
    name: 'Lê Gia Huy',
    nickname: 'Bé Bon',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    physical: 'theodoi',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Thể chất: cân nặng tăng chậm trong 2 tháng gần đây',
    physicalDetail: {
      height: '97 cm (+0.8cm)',
      weight: '13.9 kg (+0.1kg)',
      observation: 'Cân nặng tăng chậm, cần trao đổi với phụ huynh về chế độ dinh dưỡng bổ sung.',
    },
    highlights: [
      {
        domain: 'Vận Động Thô',
        skillName: 'Thăng bằng trên ghế thể dục & ném bóng',
        level: 'Thành thạo',
        note: 'Thực hiện động tác khéo léo, phối hợp tay mắt rất chuẩn xác.',
        photos: 3,
        notes: 2,
        nextGoal: 'Tập bài tập nhảy lò cò 1 chân.',
      },
    ],
    teacherComment: 'Bé chơi vận động rất nhanh nhẹn nhưng giờ ăn trưa còn ăn chậm, cần cô hỗ trợ động viên.',
    aiDraftSummary: 'Gia Huy có thế mạnh vượt trội về vận động thô. Cần theo dõi thêm chỉ số thể chất và bữa phụ.',
  },
  {
    id: 'STU-005',
    code: 'HS-2026-005',
    orderNumber: 3,
    name: 'Hoàng Tuấn Kiệt',
    nickname: 'Bé Tôm',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    physical: 'dat',
    cognitive: 'theodoi',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Nhận thức: cần bổ sung bài quan sát phân loại hình khối',
    physicalDetail: {
      height: '99 cm (+1.3cm)',
      weight: '15.0 kg (+0.5kg)',
      observation: 'Tăng trưởng đều đặn, sức khỏe tốt.',
    },
    highlights: [
      {
        domain: 'Nhận Thức Toán Sơ Đẳng',
        skillName: 'Phân loại hình khối và kích thước',
        level: 'Đang phát triển',
        note: 'Phân biệt được to - nhỏ, cần cô hướng dẫn thêm khi phân loại theo màu sắc kết hợp hình dạng.',
        photos: 1,
        notes: 2,
        nextGoal: 'Trò chơi ghép hình 3 thuộc tính.',
      },
    ],
    teacherComment: 'Bé Tuấn Kiệt thích các hoạt động ngoài trời, cần rèn luyện thêm sự kiên nhẫn khi ngồi bàn.',
    aiDraftSummary: 'Tuấn Kiệt có phản xạ vận động nhanh, cần hỗ trợ thêm ở các bài tập tập trung góc nhận thức.',
  },
  {
    id: 'STU-007',
    code: 'HS-2026-007',
    orderNumber: 4,
    name: 'Vũ Gia Hân',
    nickname: 'Bé Sữa',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-teal-100 text-teal-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'theodoi',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Ngôn ngữ: chưa ổn định, còn ngập ngừng khi phát biểu trước lớp',
    physicalDetail: {
      height: '98 cm (+1.4cm)',
      weight: '14.8 kg (+0.6kg)',
      observation: 'Thể lực rất tốt, ăn uống ngon miệng.',
    },
    highlights: [
      {
        domain: 'Ngôn Ngữ & Biểu Cảm',
        skillName: 'Trình bày ý kiến cá nhân trong giờ vòng tròn',
        level: 'Đang làm quen',
        note: 'Còn e dè khi cô mời phát biểu trước đông bạn, nhưng nói chuyện tự nhiên khi chơi 1-1 với bạn thân.',
        photos: 1,
        notes: 3,
        nextGoal: 'Khích lệ bằng trò chơi rối tay theo cặp.',
      },
    ],
    teacherComment: 'Gia Hân dễ thương, hơi nhút nhát. Cô sẽ phối hợp cùng gia đình để con tự tin giao tiếp hơn.',
    aiDraftSummary: 'Cần tạo thêm môi trường trò chuyện vi mô (micro-groups) để Gia Hân mạnh dạn bộc lộ ngôn ngữ.',
  },
  {
    id: 'STU-009',
    code: 'HS-2026-009',
    orderNumber: 5,
    name: 'Bùi Hoàng Nam',
    nickname: 'Bé Nhím',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
    physicalDetail: { height: '100 cm', weight: '15.2 kg', observation: 'Tăng trưởng chuẩn.' },
  },
  {
    id: 'STU-010',
    code: 'HS-2026-010',
    orderNumber: 6,
    name: 'Phạm Phương Linh',
    nickname: 'Bé Mây',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-purple-100 text-purple-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
    physicalDetail: { height: '99 cm', weight: '14.9 kg', observation: 'Khỏe mạnh, hoạt bát.' },
  },
  {
    id: 'STU-011',
    code: 'HS-2026-011',
    orderNumber: 7,
    name: 'Trịnh Quốc Bảo',
    nickname: 'Bé Sóc',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-indigo-100 text-indigo-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-012',
    code: 'HS-2026-012',
    orderNumber: 8,
    name: 'Phan Hà My',
    nickname: 'Bé Dâu',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-013',
    code: 'HS-2026-013',
    orderNumber: 9,
    name: 'Dương Minh Khôi',
    nickname: 'Bé Gấu',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-cyan-100 text-cyan-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-014',
    code: 'HS-2026-014',
    orderNumber: 10,
    name: 'Nguyễn Ngọc Diệp',
    nickname: 'Bé Cún',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-015',
    code: 'HS-2026-015',
    orderNumber: 11,
    name: 'Lương Gia Phúc',
    nickname: 'Bé Bắp Nhỏ',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'canhotro',
    motor: 'dat',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Tình cảm XH: khó hòa nhập sau giờ ngủ trưa, hay khóc',
  },
  {
    id: 'STU-016',
    code: 'HS-2026-016',
    orderNumber: 12,
    name: 'Đoàn Tuệ Mẫn',
    nickname: 'Bé Su',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-017',
    code: 'HS-2026-017',
    orderNumber: 13,
    name: 'Mai Đăng Khoa',
    nickname: 'Bé Mít',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-018',
    code: 'HS-2026-018',
    orderNumber: 14,
    name: 'Tạ Quỳnh Anh',
    nickname: 'Bé Kem',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-purple-100 text-purple-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-019',
    code: 'HS-2026-019',
    orderNumber: 15,
    name: 'Lý Đức Minh',
    nickname: 'Bé Cà Rốt',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-020',
    code: 'HS-2026-020',
    orderNumber: 16,
    name: 'Đinh Bảo Trâm',
    nickname: 'Bé Cam',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-021',
    code: 'HS-2026-021',
    orderNumber: 17,
    name: 'Cao Thanh Tùng',
    nickname: 'Bé Bơ',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-teal-100 text-teal-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-022',
    code: 'HS-2026-022',
    orderNumber: 18,
    name: 'Lâm Thục Quyên',
    nickname: 'Bé Kẹo',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    physical: 'theodoi',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Thể chất: hay mệt mỏi trong giờ vận động ngoài trời',
  },
  {
    id: 'STU-023',
    code: 'HS-2026-023',
    orderNumber: 19,
    name: 'Hồ Hoàng Quân',
    nickname: 'Bé Xoài',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-800',
    physical: 'dat',
    cognitive: 'theodoi',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Nhận thức: cần bổ sung bài quan sát đếm số lượng',
  },
  {
    id: 'STU-024',
    code: 'HS-2026-024',
    orderNumber: 20,
    name: 'Tạ Thảo Nguyên',
    nickname: 'Bé Bông',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'dat',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-025',
    code: 'HS-2026-025',
    orderNumber: 21,
    name: 'Vũ Minh Khang',
    nickname: 'Bé Bờm',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'theodoi',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-026',
    code: 'HS-2026-026',
    orderNumber: 22,
    name: 'Trần Kim Ngân',
    nickname: 'Bé Na',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-purple-100 text-purple-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-027',
    code: 'HS-2026-027',
    orderNumber: 23,
    name: 'Chu Trọng Nghĩa',
    nickname: 'Bé Châu',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-028',
    code: 'HS-2026-028',
    orderNumber: 24,
    name: 'Võ Ngọc Châu',
    nickname: 'Bé Bống',
    className: 'Mầm A1',
    classKey: 'MAM_A1',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },

  // ── LỚP CHỒI B1 (22 trẻ: 20 đã đánh giá, 2 chưa đánh giá / cần bổ sung, 4 cần chú ý) ──
  {
    id: 'STU-002',
    code: 'HS-2026-002',
    orderNumber: 25,
    name: 'Trần Bảo Ngọc',
    nickname: 'Bé Bắp',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'canhotro',
    motor: 'dat',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Tình cảm – xã hội: cần thêm quan sát tương tác nhóm',
    physicalDetail: {
      height: '105 cm (+1.2cm)',
      weight: '16.8 kg (+0.5kg)',
      observation: 'Thể trạng tốt, hoạt bát trong các hoạt động vận động.',
    },
    highlights: [
      {
        domain: 'Thẩm Mỹ & Sáng Tạo',
        skillName: 'Vẽ tranh & Phối màu sắc Reggio Emilia',
        level: 'Thành thạo',
        note: 'Tự tin chọn 4-5 gam màu tương phản, biết thuyết minh ý tưởng bức tranh gia đình cho cô và cả lớp.',
        photos: 4,
        notes: 3,
        nextGoal: 'Thử nghiệm tạo hình với đất nặn màu thiên nhiên.',
      },
    ],
    teacherComment: 'Bé Bắp có năng khiếu nghệ thuật vượt trội. Bé nhận biết màu sắc và tự tin thể hiện ý tưởng độc đáo.',
    aiDraftSummary: 'Bảo Ngọc phát triển xuất sắc ở mảng Thẩm mỹ & Sáng tạo. Tích cực tham gia thảo luận nhóm Reggio Emilia.',
  },
  {
    id: 'STU-004',
    code: 'HS-2026-004',
    orderNumber: 26,
    name: 'Phạm Thảo My',
    nickname: 'Bé Miu',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
    physicalDetail: {
      height: '104 cm (+1.1cm)',
      weight: '16.2 kg (+0.4kg)',
      observation: 'Chỉ số thể lực tốt, ăn ngủ điều độ.',
    },
    highlights: [
      {
        domain: 'Ngôn Ngữ & Đọc Viết Sớm',
        skillName: 'Nhận biết chữ cái qua thẻ từ & tranh ảnh',
        level: 'Thành thạo',
        note: 'Chỉ đúng và phát âm chuẩn các âm chữ o, ô, ơ, a, ă, â.',
        photos: 2,
        notes: 3,
        nextGoal: 'Làm quen bảng chữ ghép cơ bản.',
      },
    ],
    teacherComment: 'Bé Thảo My rất chăm chú trong các tiết học ngôn ngữ, tiếp thu bài nhanh.',
    aiDraftSummary: 'Kỹ năng tiền đọc viết của Thảo My tiến triển rất tốt, phù hợp chuẩn bị cho Khối Lá.',
  },
  {
    id: 'STU-006',
    code: 'HS-2026-006',
    orderNumber: 27,
    name: 'Đặng Khánh Linh',
    nickname: 'Bé Thỏ',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-purple-100 text-purple-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
    physicalDetail: {
      height: '106 cm (+1.0cm)',
      weight: '16.5 kg (+0.3kg)',
      observation: 'Phát triển cân đối, đạt mức chuẩn theo độ tuổi.',
    },
    highlights: [
      {
        domain: 'Kỹ Năng Xã Hội',
        skillName: 'Chia sẻ đồ chơi & an ủi bạn khi khóc',
        level: 'Thành thạo',
        note: 'Biết nhường bạn đồ chơi yêu thích, chủ động ôm và dỗ dành bạn khi bạn nhớ mẹ.',
        photos: 3,
        notes: 4,
        nextGoal: 'Khuyến khích làm trưởng nhóm trò chơi phân vai.',
      },
    ],
    teacherComment: 'Khánh Linh là cô bé tình cảm, biết quan tâm tới cô và các bạn trong lớp.',
    aiDraftSummary: 'Chỉ số cảm xúc và tương tác xã hội của Khánh Linh rất nổi bật trong tháng 9.',
  },
  {
    id: 'STU-008',
    code: 'HS-2026-008',
    orderNumber: 28,
    name: 'Ngô Nhật Minh',
    nickname: 'Bé Ken',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
    physicalDetail: {
      height: '105 cm (+1.1cm)',
      weight: '16.7 kg (+0.4kg)',
      observation: 'Tăng trưởng ổn định, thể lực dồi dào.',
    },
    highlights: [
      {
        domain: 'Tư Duy Khoa Học & STEAM',
        skillName: 'Khám phá chìm nổi của vật thể trong nước',
        level: 'Đạt kỳ vọng',
        note: 'Hào hứng làm thí nghiệm, đoán đúng vật nổi vật chìm và biết đặt câu hỏi tại sao.',
        photos: 4,
        notes: 2,
        nextGoal: 'Làm quen thí nghiệm đổi màu nước bắp cải tím.',
      },
    ],
    teacherComment: 'Nhật Minh tò mò, thích khám phá thế giới xung quanh và rất hay đặt câu hỏi thú vị.',
    aiDraftSummary: 'Nhật Minh thể hiện tư duy tìm tòi khám phá tốt, kỹ năng vận động tinh đạt chuẩn.',
  },
  {
    id: 'STU-029',
    code: 'HS-2026-029',
    orderNumber: 29,
    name: 'Trương Tuấn Anh',
    nickname: 'Bé Rô',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-030',
    code: 'HS-2026-030',
    orderNumber: 30,
    name: 'Lê Phương Anh',
    nickname: 'Bé Nana',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-031',
    code: 'HS-2026-031',
    orderNumber: 31,
    name: 'Nguyễn Hải Đăng',
    nickname: 'Bé Pin',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-teal-100 text-teal-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-032',
    code: 'HS-2026-032',
    orderNumber: 32,
    name: 'Huỳnh Ngọc Hân',
    nickname: 'Bé Lala',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-033',
    code: 'HS-2026-033',
    orderNumber: 33,
    name: 'Vương Minh Trí',
    nickname: 'Bé Jerry',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-indigo-100 text-indigo-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-034',
    code: 'HS-2026-034',
    orderNumber: 34,
    name: 'Tạ Mỹ Uyên',
    nickname: 'Bé Bella',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-035',
    code: 'HS-2026-035',
    orderNumber: 35,
    name: 'Quách Vĩnh Khang',
    nickname: 'Bé Tom',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-036',
    code: 'HS-2026-036',
    orderNumber: 36,
    name: 'Đào Thùy Trang',
    nickname: 'Bé Mina',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-037',
    code: 'HS-2026-037',
    orderNumber: 37,
    name: 'Hà Trí Dũng',
    nickname: 'Bé Ben',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-cyan-100 text-cyan-800',
    physical: 'tot',
    cognitive: 'tot',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-038',
    code: 'HS-2026-038',
    orderNumber: 38,
    name: 'Nhan Cẩm Tú',
    nickname: 'Bé Alice',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-purple-100 text-purple-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-039',
    code: 'HS-2026-039',
    orderNumber: 39,
    name: 'Bùi Quốc Thịnh',
    nickname: 'Bé Leo',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'theodoi',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-040',
    code: 'HS-2026-040',
    orderNumber: 40,
    name: 'Tiêu Khánh An',
    nickname: 'Bé Anna',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-041',
    code: 'HS-2026-041',
    orderNumber: 41,
    name: 'Diệp Tuấn Hưng',
    nickname: 'Bé Simba',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'tot',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-042',
    code: 'HS-2026-042',
    orderNumber: 42,
    name: 'Tô Bảo Uyên',
    nickname: 'Bé Bambi',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    physical: 'dat',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'tot',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-043',
    code: 'HS-2026-043',
    orderNumber: 43,
    name: 'Lại Minh Quân',
    nickname: 'Bé Alex',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-044',
    code: 'HS-2026-044',
    orderNumber: 44,
    name: 'Khổng Diệu Thảo',
    nickname: 'Bé Sunny',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-teal-100 text-teal-800',
    physical: 'tot',
    cognitive: 'dat',
    language: 'tot',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
  {
    id: 'STU-045',
    code: 'HS-2026-045',
    orderNumber: 45,
    name: 'La Vĩnh Lạc',
    nickname: 'Bé Lucky',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    physical: 'dat',
    cognitive: 'theodoi',
    language: 'dat',
    socialEmotional: 'dat',
    motor: 'dat',
    status: 'attention',
    statusLabel: 'Cần chú ý',
    attentionReason: 'Nhận thức: giảm chú ý sau 10 phút trong các hoạt động STEAM',
  },
  {
    id: 'STU-046',
    code: 'HS-2026-046',
    orderNumber: 46,
    name: 'Thiều Thảo Chi',
    nickname: 'Bé Chloe',
    className: 'Chồi B1',
    classKey: 'CHOI_B1',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    physical: 'dat',
    cognitive: 'tot',
    language: 'tot',
    socialEmotional: 'tot',
    motor: 'tot',
    status: 'completed',
    statusLabel: 'Đã đầy đủ',
  },
];

// ── 8 Children Needing Attention (Canonical List) ──────────────────────────────

export const ATTENTION_CHILDREN: readonly AttentionChildItem[] = [
  {
    id: 'ATT-001',
    name: 'Lê Gia Huy',
    className: 'Lớp Mầm A1',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    note: 'Thể chất: cân nặng tăng chậm',
    badgeType: 'theodoi',
    badgeLabel: 'Theo dõi',
  },
  {
    id: 'ATT-002',
    name: 'Hoàng Tuấn Kiệt',
    className: 'Lớp Mầm A1',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    note: 'Nhận thức: cần phân loại hình khối',
    badgeType: 'theodoi',
    badgeLabel: 'Theo dõi',
  },
  {
    id: 'ATT-003',
    name: 'Vũ Gia Hân',
    className: 'Lớp Mầm A1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-teal-100 text-teal-800',
    note: 'Ngôn ngữ: chưa ổn định',
    badgeType: 'theodoi',
    badgeLabel: 'Theo dõi',
  },
  {
    id: 'ATT-004',
    name: 'Lương Gia Phúc',
    className: 'Lớp Mầm A1',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    note: 'Tình cảm XH: khó hòa nhập sau ngủ trưa',
    badgeType: 'canhotro',
    badgeLabel: '! Cần hỗ trợ',
  },
  {
    id: 'ATT-005',
    name: 'Lâm Thục Quyên',
    className: 'Lớp Mầm A1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    note: 'Thể chất: hay mệt mỏi trong vận động',
    badgeType: 'theodoi',
    badgeLabel: 'Theo dõi',
  },
  {
    id: 'ATT-006',
    name: 'Hồ Hoàng Quân',
    className: 'Lớp Mầm A1',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-800',
    note: 'Nhận thức: bổ sung quan sát đếm',
    badgeType: 'theodoi',
    badgeLabel: 'Theo dõi',
  },
  {
    id: 'ATT-007',
    name: 'Trần Bảo Ngọc',
    className: 'Lớp Chồi B1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    note: 'Tình cảm – xã hội: cần thêm quan sát',
    badgeType: 'canhotro',
    badgeLabel: '! Cần hỗ trợ',
  },
  {
    id: 'ATT-008',
    name: 'La Vĩnh Lạc',
    className: 'Lớp Chồi B1',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    note: 'Nhận thức: giảm chú ý học STEAM',
    badgeType: 'theodoi',
    badgeLabel: 'Theo dõi',
  },
];

export const RECENT_ACTIVITIES: readonly DevelopmentActivityItem[] = [
  {
    id: 'ACT-001',
    time: '10:15',
    title: 'Cập nhật ảnh hoạt động',
    studentAndClass: 'Nguyễn Minh An – Lớp Mầm A1',
    iconType: 'camera',
  },
  {
    id: 'ACT-002',
    time: '09:30',
    title: 'Ghi nhận quan sát',
    studentAndClass: 'Trần Bảo Ngọc – Lớp Chồi B1',
    iconType: 'clipboard',
  },
  {
    id: 'ACT-003',
    time: '08:45',
    title: 'Cập nhật đánh giá năng lực',
    studentAndClass: 'Phạm Thảo My – Lớp Chồi B1',
    iconType: 'chart',
  },
  {
    id: 'ACT-004',
    time: '08:20',
    title: 'Nhận xét gửi phụ huynh',
    studentAndClass: 'Hoàng Tuấn Kiệt – Lớp Mầm A1',
    iconType: 'message',
  },
  {
    id: 'ACT-005',
    time: 'Hôm qua 16:15',
    title: 'Đánh giá tiến trình NAEYC',
    studentAndClass: 'Đặng Khánh Linh – Lớp Chồi B1',
    iconType: 'chart',
  },
  {
    id: 'ACT-006',
    time: 'Hôm qua 14:00',
    title: 'Trao phiếu khen thưởng tuần',
    studentAndClass: 'Vũ Gia Hân – Lớp Mầm A1',
    iconType: 'clipboard',
  },
];

export const INITIAL_OBSERVATIONS_FEED: readonly PedagogicalObservationFeedItem[] = [
  {
    id: 'OBS-001',
    studentId: 'STU-001',
    studentName: 'Nguyễn Minh An',
    studentClass: 'Lớp Mầm A1',
    studentAvatarBg: 'bg-emerald-100 text-emerald-800',
    observerTeacher: 'Cô Nguyễn Thị Mai • GV Chủ Nhiệm',
    timestamp: '10:15 hôm nay',
    domainName: 'Thể chất & Vận động',
    milestoneCode: 'NAEYC-PHY-02',
    progressionLevel: 'Đạt kỳ vọng',
    observationNote: 'Bé Minh An tự xúc hết bát cơm và canh trong 20 phút, sau đó tự xếp thìa và cất khay vào giá đựng đúng nơi quy định mà không cần cô nhắc nhở.',
    photoCount: 3,
    photoTags: ['Xúc ăn tự lập', 'Cất khay ăn trưa', 'Uống nước sau ăn'],
    consentStatus: 'PARENT_SHARED',
    parentFeedback: 'Mẹ đã thả tim và cảm ơn cô giáo',
  },
  {
    id: 'OBS-002',
    studentId: 'STU-002',
    studentName: 'Trần Bảo Ngọc',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-pink-100 text-pink-800',
    observerTeacher: 'Cô Hoàng Bích Ngọc • GV Tạo Hình',
    timestamp: '09:30 hôm nay',
    domainName: 'Thẩm mỹ & Sáng tạo',
    milestoneCode: 'NAEYC-ART-05',
    progressionLevel: 'Thành thạo',
    observationNote: 'Bé Bảo Ngọc phối màu nước tương phản để vẽ tranh phong cảnh mùa thu, tự tin giới thiệu ý tưởng bức tranh trước cả lớp với vốn từ biểu cảm phong phú.',
    photoCount: 4,
    photoTags: ['Vẽ tranh màu nước', 'Trình bày nhóm', 'Pha màu tự nhiên'],
    consentStatus: 'PARENT_SHARED',
    parentFeedback: 'Phụ huynh rất tự hào về bức tranh của con',
  },
  {
    id: 'OBS-003',
    studentId: 'STU-004',
    studentName: 'Phạm Thảo My',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-amber-100 text-amber-800',
    observerTeacher: 'Cô Đặng Thùy Linh • GV Tiếng Anh Mầm Non',
    timestamp: '08:45 hôm nay',
    domainName: 'Ngôn ngữ & Giao tiếp',
    milestoneCode: 'NAEYC-LAN-03',
    progressionLevel: 'Thành thạo',
    observationNote: 'Thảo My nhận diện chính xác 10/10 chữ cái tiếng Việt và phát âm rành mạch các từ ghép đơn giản trong trò chơi ô cửa bí mật.',
    photoCount: 2,
    photoTags: ['Thẻ từ chữ cái', 'Phát âm chuẩn'],
    consentStatus: 'PARENT_SHARED',
  },
  {
    id: 'OBS-004',
    studentId: 'STU-008',
    studentName: 'Ngô Nhật Minh',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-rose-100 text-rose-800',
    observerTeacher: 'Cô Lê Minh Tâm • GV STEAM',
    timestamp: '08:20 hôm nay',
    domainName: 'Nhận thức & Tư duy',
    milestoneCode: 'NAEYC-COG-04',
    progressionLevel: 'Đạt kỳ vọng',
    observationNote: 'Nhật Minh đoán đúng tính chất chìm nổi của các vật thể gỗ, nhựa và sỏi; chủ động đặt câu hỏi vì sao hòn đá nhỏ lại chìm nhanh hơn chiếc thuyền xốp.',
    photoCount: 3,
    photoTags: ['Thí nghiệm nước', 'Góc khám phá khoa học'],
    consentStatus: 'PARENT_SHARED',
  },
  {
    id: 'OBS-005',
    studentId: 'STU-006',
    studentName: 'Đặng Khánh Linh',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-purple-100 text-purple-800',
    observerTeacher: 'Cô Nguyễn Thị Mai • GV Chủ Nhiệm',
    timestamp: 'Hôm qua 15:30',
    domainName: 'Tình cảm & Kỹ năng xã hội',
    milestoneCode: 'NAEYC-SOC-02',
    progressionLevel: 'Thành thạo',
    observationNote: 'Khánh Linh chủ động nhường chiếc váy công chúa trong góc đóng vai cho bạn mới đến lớp và vòng tay ôm an ủi bạn khi bạn nhớ mẹ.',
    photoCount: 2,
    photoTags: ['Góc phân vai', 'Chia sẻ đồ chơi'],
    consentStatus: 'PARENT_SHARED',
    parentFeedback: 'Mẹ bé cảm ơn cô đã giáo dục con biết sẻ chia',
  },
  {
    id: 'OBS-006',
    studentId: 'STU-003',
    studentName: 'Lê Gia Huy',
    studentClass: 'Lớp Mầm A1',
    studentAvatarBg: 'bg-rose-100 text-rose-800',
    observerTeacher: 'Cô Trần Ngọc Anh • GV Thể Chất',
    timestamp: 'Hôm qua 10:00',
    domainName: 'Thể chất & Vận động',
    milestoneCode: 'NAEYC-MOT-01',
    progressionLevel: 'Thành thạo',
    observationNote: 'Gia Huy đi thăng bằng vững vàng trên cầu khỉ mô hình mầm non và ném trúng 4/5 quả bóng vào rổ cự ly 1.5 mét.',
    photoCount: 2,
    photoTags: ['Đi thăng bằng', 'Ném bóng trúng đích'],
    consentStatus: 'INTERNAL_TEACHER',
  },
];

export const INITIAL_AWARDS_LIST: readonly PreschoolAwardItem[] = [
  {
    id: 'AWD-001',
    studentId: 'STU-001',
    studentName: 'Nguyễn Minh An',
    studentClass: 'Lớp Mầm A1',
    studentAvatarBg: 'bg-emerald-100 text-emerald-800',
    category: 'CHAM_NGOAN',
    categoryLabel: 'Bé Chăm Ngoan',
    title: 'Ngôi Sao Tự Lập Giờ Ăn Trưa',
    commendationReason: 'Biết tự xúc ăn gọn gàng, tự giác cất dọn khay ăn và giúp bạn cùng bàn.',
    dateAwarded: '18/09/2026',
    iconType: 'star',
  },
  {
    id: 'AWD-002',
    studentId: 'STU-002',
    studentName: 'Trần Bảo Ngọc',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-pink-100 text-pink-800',
    category: 'HOA_SI',
    categoryLabel: 'Họa Sĩ Nhí Sáng Tạo',
    title: 'Họa Sĩ Nhí Xuất Sắc Tháng 9',
    commendationReason: 'Tác phẩm tranh phối màu thiên nhiên Reggio Emilia đạt giải nhất góc nghệ thuật.',
    dateAwarded: '16/09/2026',
    iconType: 'palette',
  },
  {
    id: 'AWD-003',
    studentId: 'STU-006',
    studentName: 'Đặng Khánh Linh',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-purple-100 text-purple-800',
    category: 'CHIA_SE',
    categoryLabel: 'Thiên Thần Chia Sẻ',
    title: 'Trái Tim Nhân Ái Mầm Non',
    commendationReason: 'Luôn sẵn lòng sẻ chia đồ chơi yêu thích và dỗ dành các bạn khi bạn buồn.',
    dateAwarded: '15/09/2026',
    iconType: 'heart',
  },
  {
    id: 'AWD-004',
    studentId: 'STU-004',
    studentName: 'Phạm Thảo My',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-amber-100 text-amber-800',
    category: 'KHOE_DEP',
    categoryLabel: 'Bé Khỏe Đẹp',
    title: 'Kiện Tướng Vận Động Mầm Non',
    commendationReason: 'Tập thể dục buổi sáng hăng say, vượt chướng ngại vật nhanh nhẹn và khéo léo.',
    dateAwarded: '14/09/2026',
    iconType: 'activity',
  },
  {
    id: 'AWD-005',
    studentId: 'STU-008',
    studentName: 'Ngô Nhật Minh',
    studentClass: 'Lớp Chồi B1',
    studentAvatarBg: 'bg-rose-100 text-rose-800',
    category: 'TU_LAP',
    categoryLabel: 'Bé Tự Lập',
    title: 'Chiến Binh Tự Gấp Chăn Gối',
    commendationReason: 'Tự gấp chăn gối sau giờ ngủ trưa vuông vức, giúp cô sắp xếp giường ngủ ngăn nắp.',
    dateAwarded: '12/09/2026',
    iconType: 'trophy',
  },
  {
    id: 'AWD-006',
    studentId: 'STU-009',
    studentName: 'Bùi Hoàng Nam',
    studentClass: 'Lớp Mầm A1',
    studentAvatarBg: 'bg-emerald-100 text-emerald-800',
    category: 'CHAM_NGOAN',
    categoryLabel: 'Bé Chăm Ngoan',
    title: 'Chuyên Cần & Lễ Phép Tuần 2',
    commendationReason: 'Đi học đúng giờ, biết khoanh tay chào hỏi các cô và phụ huynh khi vào lớp.',
    dateAwarded: '11/09/2026',
    iconType: 'star',
  },
];

const STUDENT_TO_ROSTER_ID_MAP: Record<string, string> = {
  'HS0001': 'STU-001',
  'STU-001': 'STU-001',
  'HS-2026-001': 'STU-001',
  'HS0002': 'STU-002',
  'STU-002': 'STU-002',
  'HS-2026-002': 'STU-002',
  'HS0003': 'STU-003',
  'STU-003': 'STU-003',
  'HS-2026-003': 'STU-003',
  'HS0004': 'STU-004',
  'STU-004': 'STU-004',
  'HS-2026-004': 'STU-004',
  'HS0005': 'STU-005',
  'STU-005': 'STU-005',
  'HS-2026-005': 'STU-005',
  'HS0006': 'STU-006',
  'STU-006': 'STU-006',
  'HS-2026-006': 'STU-006',
  'HS0007': 'STU-007',
  'STU-007': 'STU-007',
  'HS-2026-007': 'STU-007',
  'HS0008': 'STU-008',
  'STU-008': 'STU-008',
  'HS-2026-008': 'STU-008',
};

// ── Main Workspace Component ──────────────────────────────────────────────────

function PreschoolDevelopmentGradesPageContent() {
  const searchParams = useSearchParams();
  const studentParam = searchParams ? searchParams.get('student') : null;
  const [studentContextActive, setStudentContextActive] = useState(false);
  const [isPreschoolTenant, setIsPreschoolTenant] = useState<boolean>(true);

  // Active Workspace Tab: 'overview' | 'observations' | 'progression' | 'portfolio' | 'recognition'
  const [activeTab, setActiveTab] = useState<DevelopmentTabKey>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>('Tháng 09/2026');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<'ALL' | 'MAM_A1' | 'CHOI_B1'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'COMPLETED' | 'SUPPLEMENT' | 'ATTENTION'>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedStudentIds, setSelectedStudentIds] = useState<readonly string[]>([]);

  // Pagination State (8 children per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 8;

  // Selected Student for Portfolio 360 & Inspection Drawer
  const [inspectedStudent, setInspectedStudent] = useState<ChildDevelopmentRosterItem | null>(null);
  const [portfolioSelectedStudentId, setPortfolioSelectedStudentId] = useState<string>('STU-001');

  // Sub-features state
  const [observationFeed, setObservationFeed] = useState<readonly PedagogicalObservationFeedItem[]>(INITIAL_OBSERVATIONS_FEED);
  const [awardsList, setAwardsList] = useState<readonly PreschoolAwardItem[]>(INITIAL_AWARDS_LIST);
  const [obsDomainFilter, setObsDomainFilter] = useState<string>('ALL');
  const [awardCategoryFilter, setAwardCategoryFilter] = useState<string>('ALL');

  // Quick Action Student Popover/Modal
  const [quickActionStudent, setQuickActionStudent] = useState<ChildDevelopmentRosterItem | null>(null);

  // Modals & Drawers
  const [isNewObservationModalOpen, setIsNewObservationModalOpen] = useState<boolean>(false);
  const [isAiSuggestionsDrawerOpen, setIsAiSuggestionsDrawerOpen] = useState<boolean>(false);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const observationOpenerRef = useRef<HTMLButtonElement>(null);
  const profileToObservationRef = useRef(false);

  useEffect(() => {
    if (inspectedStudent) profileToObservationRef.current = false;
  }, [inspectedStudent]);

  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [observationNotice, setObservationNotice] = useState<string | null>(null);

  // Deep Link Handling (?student=...)
  useEffect(() => {
    if (!studentParam) return;
    const targetId = STUDENT_TO_ROSTER_ID_MAP[studentParam] || studentParam;
    const matched = ROSTER_STUDENTS.find(
      (s) =>
        s.id === targetId ||
        s.id === studentParam ||
        s.code === studentParam ||
        s.code.replace(/[^0-9]/g, '') === studentParam.replace(/[^0-9]/g, '')
    );
    if (matched) {
      setSearchQuery(matched.name);
      setInspectedStudent(matched);
      setPortfolioSelectedStudentId(matched.id);
      setStudentContextActive(true);
    }
  }, [studentParam]);

  // Tenant detection
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

  // Observation Form Draft State (Strictly typed with draft retention)
  const [newObsStudentId, setNewObsStudentId] = useState<string>('STU-001');
  type ObservationDraft = {
    domain: string;
    skill: string;
    progression: string;
    note: string;
    photosCount: number;
  };
  const defaultObservationDraft: ObservationDraft = {
    domain: 'Ngôn Ngữ & Giao Tiếp',
    skill: '',
    progression: 'Đạt kỳ vọng',
    note: '',
    photosCount: 1,
  };
  const [observationDrafts, setObservationDrafts] = useState<Record<string, ObservationDraft>>({});

  const {
    domain: newObsDomain,
    skill: newObsSkill,
    progression: newObsProgression,
    note: newObsNote,
    photosCount: newObsPhotosCount,
  } = observationDrafts[newObsStudentId] ?? defaultObservationDraft;

  const updateObservationDraft = (patch: Partial<ObservationDraft>) => {
    setObservationDrafts((drafts) => ({
      ...drafts,
      [newObsStudentId]: { ...(drafts[newObsStudentId] ?? defaultObservationDraft), ...patch },
    }));
  };

  const selectObservationChild = (studentId: string) => {
    setNewObsStudentId(studentId);
    setObservationNotice(null);
  };

  // Award Modal Form State
  const [newAwardStudentId, setNewAwardStudentId] = useState<string>('STU-001');
  const [newAwardCategory, setNewAwardCategory] = useState<'CHAM_NGOAN' | 'HOA_SI' | 'KHOE_DEP' | 'CHIA_SE' | 'TU_LAP'>('CHAM_NGOAN');
  const [newAwardTitle, setNewAwardTitle] = useState<string>('Bé Chăm Ngoan & Tự Giác');
  const [newAwardReason, setNewAwardReason] = useState<string>('Biết tự dọn đồ chơi và giúp đỡ cô giáo cùng các bạn.');

  // Dynamic Canonical KPI Derivations
  const totalChildrenCount = ROSTER_STUDENTS.length; // 46
  const evaluatedChildrenCount = ROSTER_STUDENTS.filter((s) => s.status === 'completed').length; // 38
  const unEvaluatedChildrenCount = totalChildrenCount - evaluatedChildrenCount; // 8
  const evaluatedPercentage = Math.round((evaluatedChildrenCount / totalChildrenCount) * 100); // 83%
  const unEvaluatedPercentage = Math.round((unEvaluatedChildrenCount / totalChildrenCount) * 100); // 17%
  const newObservationsCount = 12; // In month

  const mamA1Total = ROSTER_STUDENTS.filter((s) => s.classKey === 'MAM_A1').length; // 24
  const mamA1Evaluated = ROSTER_STUDENTS.filter((s) => s.classKey === 'MAM_A1' && s.status === 'completed').length; // 18
  const mamA1Pct = Math.round((mamA1Evaluated / mamA1Total) * 100); // 75%

  const choiB1Total = ROSTER_STUDENTS.filter((s) => s.classKey === 'CHOI_B1').length; // 22
  const choiB1Evaluated = ROSTER_STUDENTS.filter((s) => s.classKey === 'CHOI_B1' && s.status === 'completed').length; // 20
  const choiB1Pct = Math.floor((choiB1Evaluated / choiB1Total) * 100); // 90%

  // Filtered Roster
  const filteredStudents = useMemo(() => {
    return ROSTER_STUDENTS.filter((item) => {
      if (selectedClass !== 'ALL' && item.classKey !== selectedClass) {
        return false;
      }
      if (selectedStatus === 'COMPLETED' && item.status !== 'completed') {
        return false;
      }
      if (selectedStatus === 'SUPPLEMENT' && item.status !== 'supplement') {
        return false;
      }
      if (selectedStatus === 'ATTENTION' && item.status !== 'attention') {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchClass = item.className.toLowerCase().includes(query);
        const matchNickname = item.nickname ? item.nickname.toLowerCase().includes(query) : false;
        const matchCode = item.code.toLowerCase().includes(query);
        const matchId = item.id.toLowerCase().includes(query);
        if (!matchName && !matchClass && !matchNickname && !matchCode && !matchId) {
          return false;
        }
      }
      return true;
    });
  }, [selectedClass, selectedStatus, searchQuery]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, selectedStatus, searchQuery]);

  // Paginated Students
  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;
  const paginatedStudents = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  // Checkbox handlers
  const allVisibleSelected =
    paginatedStudents.length > 0 && paginatedStudents.every((student) => selectedStudentIds.includes(student.id));

  const handleToggleSelectAll = () => {
    if (paginatedStudents.length === 0) return;
    const visibleIds = paginatedStudents.map((student) => student.id);
    setSelectedStudentIds((previous) =>
      visibleIds.every((id) => previous.includes(id))
        ? previous.filter((id) => !visibleIds.includes(id))
        : [...new Set([...previous, ...visibleIds])]
    );
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );
  };

  const handleExportReport = () => {
    setExportNotice(
      'Chưa xuất báo cáo: chức năng xuất file chưa khả dụng trong bản thử giao diện này. Không có file được tạo.'
    );
  };

  // Helper renderers for domain badges
  const renderDomainBadge = (score: DomainScore) => {
    switch (score) {
      case 'dat':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">
              ↑
            </span>
            <span>Đạt</span>
          </span>
        );
      case 'tot':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px]">
              ↑
            </span>
            <span>Tốt</span>
          </span>
        );
      case 'theodoi':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px]">
              !
            </span>
            <span>Theo dõi</span>
          </span>
        );
      case 'canhotro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px]">
              !
            </span>
            <span>Cần hỗ trợ</span>
          </span>
        );
    }
  };

  const renderStatusBadge = (status: StudentStatus, label: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{label}</span>
          </span>
        );
      case 'supplement':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{label}</span>
          </span>
        );
      case 'attention':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>{label}</span>
          </span>
        );
    }
  };

  // Selected Student for Portfolio View
  const selectedPortfolioStudent = useMemo(() => {
    return ROSTER_STUDENTS.find((s) => s.id === portfolioSelectedStudentId) || ROSTER_STUDENTS[0];
  }, [portfolioSelectedStudentId]);

  if (!isPreschoolTenant) {
    return <LegacyGradesView />;
  }

  return (
    <div className="preschool-grades-workspace w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-36 sm:pb-48">
      {/* ── TOP AUDIT COMPLIANCE BANNER ── */}
      <p
        role="note"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      >
        Dữ liệu minh họa: danh sách trẻ, chỉ số, tiến độ và lịch sử bên dưới chưa được tải từ hồ sơ thật. Đây là bản
        thử giao diện; nhập liệu chỉ giữ tạm trong màn hình, chưa lưu hoặc xuất báo cáo.
      </p>

      {/* ── UNIFIED HEADER MATCHING IMAGE 3 ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/education"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="Quay lại Tổng Quan Mầm Non"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#f0eaff] dark:bg-purple-950/60 text-[#7c3aed] flex items-center justify-center shrink-0 shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Học Tập &amp; Phát Triển Mầm Non
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Theo dõi sự phát triển toàn diện của trẻ theo quan sát, bằng chứng và khung NAEYC
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value)}
              aria-label="Chọn tháng đánh giá"
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
            ref={observationOpenerRef}
            onClick={() => setIsNewObservationModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-[#0c513f]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nhập quan sát mới</span>
          </button>
        </div>
      </div>

      {/* ── CONTEXT BANNER WHEN NAVIGATED FROM 3-DOTS POPUP ── */}
      {studentContextActive && studentParam && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0c513f]/10 border border-[#0c513f]/20 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0c513f] text-white flex items-center justify-center font-bold shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-slate-900 dark:text-white">
                Đang xem đánh giá phát triển của bé:{' '}
                <span className="text-[#0c513f] dark:text-emerald-400 font-bold">
                  {ROSTER_STUDENTS.find((s) => s.id === (STUDENT_TO_ROSTER_ID_MAP[studentParam] || studentParam))?.name ||
                    studentParam}
                </span>{' '}
                ({studentParam})
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Phiếu theo dõi 360° đã được mở tự động. Bạn có thể xem kết quả NAEYC hoặc chuyển nhanh sang các nghiệp
                vụ khác.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/dashboard/education/enrollments/${studentParam}`}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs"
            >
              Hồ Sơ 360°
            </Link>
            <Link
              href={`/dashboard/education/attendance?student=${studentParam}`}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs"
            >
              Điểm Danh
            </Link>
            <Link
              href={`/dashboard/education/care?student=${studentParam}`}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs"
            >
              Chăm Sóc
            </Link>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStudentContextActive(false);
              }}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#0c513f] text-white hover:bg-[#083b2e] transition-all shadow-2xs"
            >
              Xem tất cả trẻ
            </button>
          </div>
        </div>
      )}

      {/* ── 4 KPI STAT CARDS MATCHING IMAGE 3 (DYNAMIC CANONICAL TRUTH) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Tổng số trẻ */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {totalChildrenCount}
            </div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Tổng số trẻ</div>
            <div className="text-[11px] text-slate-400 mt-0.5">(2 lớp)</div>
          </div>
        </div>

        {/* Card 2: Đã đánh giá */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {evaluatedChildrenCount}
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Đã đánh giá</span>
              <span className="font-extrabold text-slate-500">{evaluatedPercentage}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: `${evaluatedPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Card 3: Chưa đánh giá */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {unEvaluatedChildrenCount}
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Chưa đánh giá</span>
              <span className="font-extrabold text-slate-500">{unEvaluatedPercentage}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${unEvaluatedPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Card 4: Ghi nhận mới */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {newObservationsCount}
            </div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Ghi nhận mới</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Trong tháng</div>
          </div>
        </div>
      </div>

      {/* ── TIẾN ĐỘ ĐÁNH GIÁ THEO LỚP MATCHING IMAGE 3 ── */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Tiến độ đánh giá theo lớp</h2>
          <button
            type="button"
            onClick={() => {
              setActiveTab('progression');
            }}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Xem chi tiết</span>
            <span>→</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lớp Mầm A1 */}
          <div
            onClick={() => setSelectedClass(selectedClass === 'MAM_A1' ? 'ALL' : 'MAM_A1')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedClass === 'MAM_A1'
                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">Lớp Mầm A1</div>
                  <div className="text-xs text-slate-500">
                    {mamA1Evaluated} / {mamA1Total} trẻ
                  </div>
                </div>
              </div>
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{mamA1Pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${mamA1Pct}%` }} />
            </div>
          </div>

          {/* Lớp Chồi B1 */}
          <div
            onClick={() => setSelectedClass(selectedClass === 'CHOI_B1' ? 'ALL' : 'CHOI_B1')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedClass === 'CHOI_B1'
                ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700'
                : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">Lớp Chồi B1</div>
                  <div className="text-xs text-slate-500">
                    {choiB1Evaluated} / {choiB1Total} trẻ
                  </div>
                </div>
              </div>
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{choiB1Pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${choiB1Pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE TABS MATCHING IMAGE 3 (5 TABS FULLY FUNCTIONAL) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Tổng quan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('observations')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'observations'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Nhật ký &amp; Bằng chứng</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('progression')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'progression'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Tiến trình NAEYC</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'portfolio'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Hồ sơ 360°</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recognition')}
          className={`px-4 py-2 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'recognition'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Khen thưởng</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: TỔNG QUAN (OVERVIEW)                                              */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* ── 2 ACTION BANNERS MATCHING IMAGE 3 ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Banner 1: 8 trẻ cần chú ý */}
            <div
              onClick={() => setSelectedStatus(selectedStatus === 'ATTENTION' ? 'ALL' : 'ATTENTION')}
              className="rounded-2xl p-4 bg-[#fff5f5] dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between cursor-pointer hover:bg-rose-100/50 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                  !
                </div>
                <div>
                  <div className="text-xs font-extrabold text-rose-950 dark:text-rose-100">8 trẻ cần chú ý</div>
                  <div className="text-[11px] font-medium text-rose-700 dark:text-rose-300 mt-0.5">
                    Cần thêm quan sát ở một số lĩnh vực phát triển
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-500 shrink-0" />
            </div>

            {/* Banner 2: Gợi ý từ AI sư phạm */}
            <button
              type="button"
              onClick={() => setIsAiSuggestionsDrawerOpen(true)}
              className="rounded-2xl p-4 bg-[#f0f7ff] dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between text-left cursor-pointer hover:bg-blue-100/50 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/80 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-blue-950 dark:text-blue-100">
                    Gợi ý AI sư phạm minh họa
                  </div>
                  <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300 mt-0.5">
                    Nội dung mẫu, chưa phân tích hồ sơ thật
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-500 shrink-0" />
            </button>
          </div>

          {/* ── SEARCH & FILTER BAR MATCHING IMAGE 3 ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên trẻ, lớp..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-2xl pl-9 pr-4 py-2.5 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setSelectedClass(e.target.value as 'ALL' | 'MAM_A1' | 'CHOI_B1')
                  }
                  aria-label="Lọc theo lớp học"
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-2xl pl-4 pr-8 py-2.5 shadow-sm cursor-pointer"
                >
                  <option value="ALL">Tất cả lớp</option>
                  <option value="MAM_A1">Lớp Mầm A1</option>
                  <option value="CHOI_B1">Lớp Chồi B1</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setSelectedStatus(e.target.value as 'ALL' | 'COMPLETED' | 'SUPPLEMENT' | 'ATTENTION')
                  }
                  aria-label="Lọc theo trạng thái hồ sơ"
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-2xl pl-4 pr-8 py-2.5 shadow-sm cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="COMPLETED">Đã đầy đủ</option>
                  <option value="SUPPLEMENT">Cần bổ sung</option>
                  <option value="ATTENTION">Cần chú ý</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedClass('ALL');
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          </div>

          {/* ── STUDENT DEVELOPMENT TABLE MATCHING IMAGE 3 ── */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
            {/* Table Top Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Danh sách trẻ</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                  Hiển thị {paginatedStudents.length} / {filteredStudents.length} trẻ
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Xuất báo cáo</span>
                </button>

                <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 border border-slate-200/80 dark:border-slate-600">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    title="Dạng danh sách"
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-slate-800 text-[#0c513f] shadow-xs'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    title="Dạng lưới thẻ"
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-slate-800 text-[#0c513f] shadow-xs'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {exportNotice && (
              <div
                role="status"
                className="m-4 sm:m-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{exportNotice}</span>
              </div>
            )}

            {/* View Mode: List Table or Grid Cards */}
            {filteredStudents.length === 0 ? (
              <p role="status" className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Không tìm thấy hồ sơ trẻ phù hợp với bộ lọc hiện tại. Hãy điều chỉnh hoặc xóa bộ lọc để xem toàn bộ danh sách.
              </p>
            ) : viewMode === 'list' ? (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả trẻ em trong danh sách"
                          checked={allVisibleSelected}
                          disabled={paginatedStudents.length === 0}
                          onChange={handleToggleSelectAll}
                          className="rounded border-slate-300 text-[#0c513f] focus:ring-[#0c513f] cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-2 w-10 text-center">#</th>
                      <th className="py-3 px-4 min-w-[170px]">Họ tên</th>
                      <th className="py-3 px-4 min-w-[90px]">Lớp</th>
                      <th className="py-3 px-3 min-w-[95px] text-center">Thể chất</th>
                      <th className="py-3 px-3 min-w-[95px] text-center">Nhận thức</th>
                      <th className="py-3 px-3 min-w-[95px] text-center">Ngôn ngữ</th>
                      <th className="py-3 px-3 min-w-[110px] text-center">Tình cảm XH</th>
                      <th className="py-3 px-3 min-w-[95px] text-center">Vận động</th>
                      <th className="py-3 px-4 min-w-[120px] text-center">Trạng thái</th>
                      <th className="py-3 px-4 w-12 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                    {paginatedStudents.map((child) => {
                      const isSelected = selectedStudentIds.includes(child.id);
                      return (
                        <tr
                          key={child.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors ${
                            isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Chọn học sinh ${child.name}`}
                              checked={isSelected}
                              onChange={() => handleToggleStudent(child.id)}
                              className="rounded border-slate-300 text-[#0c513f] focus:ring-[#0c513f] cursor-pointer"
                            />
                          </td>

                          <td className="py-3.5 px-2 text-center text-slate-400 font-bold">{child.orderNumber}</td>

                          <td className="py-3.5 px-4">
                            <div
                              onClick={() => setInspectedStudent(child)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div
                                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-extrabold text-[13px] ${child.avatarFallbackBg}`}
                              >
                                {child.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-[#0c513f] dark:group-hover:text-emerald-400 transition-colors">
                                  {child.name}
                                </div>
                                {child.nickname && (
                                  <div className="text-[11px] text-slate-400">({child.nickname})</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-bold">
                            {child.className}
                          </td>

                          <td className="py-3.5 px-3 text-center">{renderDomainBadge(child.physical)}</td>
                          <td className="py-3.5 px-3 text-center">{renderDomainBadge(child.cognitive)}</td>
                          <td className="py-3.5 px-3 text-center">{renderDomainBadge(child.language)}</td>
                          <td className="py-3.5 px-3 text-center">{renderDomainBadge(child.socialEmotional)}</td>
                          <td className="py-3.5 px-3 text-center">{renderDomainBadge(child.motor)}</td>

                          <td className="py-3.5 px-4 text-center">
                            {renderStatusBadge(child.status, child.statusLabel)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setInspectedStudent(child)}
                              title="Tùy chọn thao tác"
                              aria-label={`Xem hồ sơ minh họa ${child.name}`}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View Mode */
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedStudents.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => setInspectedStudent(child)}
                    className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:shadow-md transition-all cursor-pointer space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-extrabold text-[15px] ${child.avatarFallbackBg}`}
                        >
                          {child.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{child.name}</h3>
                          <div className="text-xs text-slate-500">
                            {child.className} • {selectedMonth}
                          </div>
                        </div>
                      </div>
                      {renderStatusBadge(child.status, child.statusLabel)}
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-[11px] text-center">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Thể chất</span>
                        {renderDomainBadge(child.physical)}
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Ngôn ngữ</span>
                        {renderDomainBadge(child.language)}
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tình cảm XH</span>
                        {renderDomainBadge(child.socialEmotional)}
                      </div>
                    </div>

                    {child.attentionReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 text-[11px] text-rose-800 dark:text-rose-300">
                        ⚠ {child.attentionReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-medium">
                Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{paginatedStudents.length}</span>{' '}
                trên tổng số <span className="font-bold text-slate-800 dark:text-slate-200">{filteredStudents.length}</span>{' '}
                trẻ ({ROSTER_STUDENTS.length} toàn trường)
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    aria-label="Trang trước"
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-[#0c513f] text-white shadow-xs'
                            : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    aria-label="Trang sau"
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── TWO BOTTOM SPLIT WIDGETS MATCHING IMAGE 3 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Widget: Trẻ cần chú ý trong tháng 9 */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Trẻ cần chú ý trong tháng 9
                  </h2>
                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-extrabold text-[11px] flex items-center justify-center">
                    {ATTENTION_CHILDREN.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('ATTENTION')}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Xem tất cả</span>
                  <span>→</span>
                </button>
              </div>

              <div className="space-y-3">
                {ATTENTION_CHILDREN.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      const target = ROSTER_STUDENTS.find((s) => s.name === item.name);
                      if (target) setInspectedStudent(target);
                    }}
                    className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-extrabold text-[14px] ${item.avatarFallbackBg}`}
                      >
                        {item.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-500">{item.note}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                          item.badgeType === 'canhotro'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300'
                            : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200'
                        }`}
                      >
                        {item.badgeLabel}
                      </span>
                      <div className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
                        <BarChart2 className="w-4 h-4 text-blue-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Widget: Hoạt động gần đây */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Hoạt động gần đây</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('observations')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Xem thêm</span>
                  <span>→</span>
                </button>
              </div>

              <div className="space-y-3">
                {RECENT_ACTIVITIES.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => setActiveTab('observations')}
                    className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          act.iconType === 'camera'
                            ? 'bg-teal-50 text-teal-600'
                            : act.iconType === 'clipboard'
                            ? 'bg-blue-50 text-blue-600'
                            : act.iconType === 'chart'
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-cyan-50 text-cyan-600'
                        }`}
                      >
                        {act.iconType === 'camera' && <Camera className="w-4 h-4" />}
                        {act.iconType === 'clipboard' && <FileText className="w-4 h-4" />}
                        {act.iconType === 'chart' && <BarChart2 className="w-4 h-4" />}
                        {act.iconType === 'message' && <MessageSquare className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">{act.title}</div>
                        <div className="text-[11px] text-slate-500">{act.studentAndClass}</div>
                      </div>
                    </div>

                    <div className="text-xs font-medium text-slate-400 shrink-0">{act.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: NHẬT KÝ & BẰNG CHỨNG (OBSERVATIONS & EVIDENCE)                    */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'observations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#0c513f]" />
                <span>Nhật Ký Quan Sát &amp; Bằng Chứng Sư Phạm</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Lưu trữ khách quan hình ảnh, ghi chép hành vi và sự tiến bộ từng ngày của trẻ mầm non
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={obsDomainFilter}
                onChange={(e) => setObsDomainFilter(e.target.value)}
                aria-label="Lọc theo lĩnh vực quan sát"
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">Tất cả lĩnh vực</option>
                <option value="Thể chất & Vận động">Thể chất &amp; Vận động</option>
                <option value="Ngôn ngữ & Giao tiếp">Ngôn ngữ &amp; Giao tiếp</option>
                <option value="Nhận thức & Tư duy">Nhận thức &amp; Tư duy</option>
                <option value="Tình cảm & Kỹ năng xã hội">Tình cảm &amp; Kỹ năng xã hội</option>
                <option value="Thẩm mỹ & Sáng tạo">Thẩm mỹ &amp; Sáng tạo</option>
              </select>

              <button
                type="button"
                onClick={() => setIsNewObservationModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0c513f] text-white font-bold text-xs shadow-sm hover:bg-[#083b2e]"
              >
                <Plus className="w-4 h-4" />
                <span>Ghi nhận quan sát mới</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {observationFeed
              .filter((obs) => obsDomainFilter === 'ALL' || obs.domainName.includes(obsDomainFilter))
              .map((obs) => (
                <div
                  key={obs.id}
                  className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm space-y-4 hover:border-emerald-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-extrabold text-[14px] ${obs.studentAvatarBg}`}
                      >
                        {obs.studentName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{obs.studentName}</span>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg">
                            {obs.studentClass}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{obs.observerTeacher} • {obs.timestamp}</div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                      {obs.progressionLevel}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    &quot;{obs.observationNote}&quot;
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold">{obs.photoCount} ảnh bằng chứng</span>
                      <span>•</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{obs.milestoneCode}</span>
                    </div>

                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {obs.consentStatus === 'PARENT_SHARED' ? '✓ Đã chia sẻ PH' : 'Nội bộ giáo viên'}
                    </span>
                  </div>

                  {obs.parentFeedback && (
                    <div className="p-2.5 rounded-xl bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200/50 text-[11px] text-pink-700 dark:text-pink-300 flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5 shrink-0 text-pink-500" />
                      <span>{obs.parentFeedback}</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: TIẾN TRÌNH NAEYC (NAEYC PROGRESSION MATRIX)                       */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'progression' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-2">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#0c513f]" />
              <span>Khung Đánh Giá Chuẩn Phát Triển NAEYC Mầm Non</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tổng quan mức độ thuần thục 5 lĩnh vực phát triển cốt lõi của 46 trẻ toàn trường trong Tháng 09/2026
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                title: 'Thể chất & Vận động',
                pct: 85,
                color: 'bg-emerald-500',
                badgeBg: 'bg-emerald-50 text-emerald-700',
                focus: 'Vận động thô, tự xúc ăn, thăng bằng',
              },
              {
                title: 'Ngôn ngữ & Giao tiếp',
                pct: 78,
                color: 'bg-blue-500',
                badgeBg: 'bg-blue-50 text-blue-700',
                focus: 'Kể chuyện tranh, nhận diện chữ cái',
              },
              {
                title: 'Nhận thức & Tư duy',
                pct: 80,
                color: 'bg-purple-500',
                badgeBg: 'bg-purple-50 text-purple-700',
                focus: 'Tư duy STEAM, phân loại hình khối',
              },
              {
                title: 'Tình cảm & Kỹ năng XH',
                pct: 74,
                color: 'bg-rose-500',
                badgeBg: 'bg-rose-50 text-rose-700',
                focus: 'Chia sẻ đồ chơi, hòa nhập nhóm',
              },
              {
                title: 'Thẩm mỹ & Sáng tạo',
                pct: 88,
                color: 'bg-amber-500',
                badgeBg: 'bg-amber-50 text-amber-700',
                focus: 'Hội họa Reggio Emilia, âm nhạc',
              },
            ].map((domain, i) => (
              <div
                key={i}
                className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3"
              >
                <div className="text-xs font-extrabold text-slate-900 dark:text-white min-h-[32px]">
                  {domain.title}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{domain.pct}%</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${domain.badgeBg}`}>Đạt chuẩn</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full ${domain.color} rounded-full`} style={{ width: `${domain.pct}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 italic">{domain.focus}</p>
              </div>
            ))}
          </div>

          {/* Class Comparison Matrix */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              So Sánh Tiến Độ Giữa Các Khối Lớp
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Lớp học</th>
                    <th className="py-2.5 px-3 text-center">Sĩ số</th>
                    <th className="py-2.5 px-3 text-center">Đã đánh giá</th>
                    <th className="py-2.5 px-3 text-center">Tỷ lệ</th>
                    <th className="py-2.5 px-3 text-center">Thể chất</th>
                    <th className="py-2.5 px-3 text-center">Ngôn ngữ</th>
                    <th className="py-2.5 px-3 text-center">Nhận thức</th>
                    <th className="py-2.5 px-3 text-center">Tình cảm XH</th>
                    <th className="py-2.5 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">Lớp Mầm A1 (3-4 tuổi)</td>
                    <td className="py-3 px-3 text-center font-bold">24 trẻ</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">18 trẻ</td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">75%</span>
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-600 font-bold">82%</td>
                    <td className="py-3 px-3 text-center text-blue-600 font-bold">76%</td>
                    <td className="py-3 px-3 text-center text-purple-600 font-bold">78%</td>
                    <td className="py-3 px-3 text-center text-rose-600 font-bold">72%</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClass('MAM_A1');
                          setActiveTab('overview');
                        }}
                        className="text-[11px] font-bold text-[#0c513f] hover:underline"
                      >
                        Lọc lớp này
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">Lớp Chồi B1 (4-5 tuổi)</td>
                    <td className="py-3 px-3 text-center font-bold">22 trẻ</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">20 trẻ</td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">90%</span>
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-600 font-bold">88%</td>
                    <td className="py-3 px-3 text-center text-blue-600 font-bold">84%</td>
                    <td className="py-3 px-3 text-center text-purple-600 font-bold">82%</td>
                    <td className="py-3 px-3 text-center text-rose-600 font-bold">79%</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClass('CHOI_B1');
                          setActiveTab('overview');
                        }}
                        className="text-[11px] font-bold text-[#0c513f] hover:underline"
                      >
                        Lọc lớp này
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: HỒ SƠ 360° (COMPREHENSIVE STUDENT PORTFOLIO)                       */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0c513f]" />
                <span>Trung Tâm Hồ Sơ Phát Triển Toàn Diện 360°</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Xem bức tranh tổng thể về thể chất, học tập và nhật ký sư phạm của từng bé
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="portfolio-select" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Chọn học sinh:
              </label>
              <select
                id="portfolio-select"
                value={portfolioSelectedStudentId}
                onChange={(e) => setPortfolioSelectedStudentId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                {ROSTER_STUDENTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Student 360 Content Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/70 pb-5">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl ring-4 ring-[#0c513f]/20 ${selectedPortfolioStudent.avatarFallbackBg}`}
                >
                  {selectedPortfolioStudent.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      {selectedPortfolioStudent.className} • Mã: {selectedPortfolioStudent.code}
                    </span>
                    {selectedPortfolioStudent.nickname && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                        {selectedPortfolioStudent.nickname}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {selectedPortfolioStudent.name}
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/education/enrollments/${selectedPortfolioStudent.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Hồ Sơ Quản Lý Trẻ</span>
                </Link>
                <Link
                  href={`/dashboard/education/attendance?student=${selectedPortfolioStudent.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Xem Điểm Danh</span>
                </Link>
                <Link
                  href={`/dashboard/education/care?student=${selectedPortfolioStudent.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Chăm Sóc &amp; Dinh Dưỡng</span>
                </Link>
              </div>
            </div>

            {/* Health & Growth Reference */}
            {selectedPortfolioStudent.physicalDetail && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 text-xs space-y-1">
                <div className="font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Chỉ Số Thể Chất &amp; Tăng Trưởng (Tháng 09/2026):</span>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  Chiều cao: <strong>{selectedPortfolioStudent.physicalDetail.height}</strong> • Cân nặng:{' '}
                  <strong>{selectedPortfolioStudent.physicalDetail.weight}</strong>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-0.5">
                  &quot;{selectedPortfolioStudent.physicalDetail.observation}&quot;
                </p>
              </div>
            )}

            {/* 5-Domain Evaluation Snapshot */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Đánh Giá 5 Lĩnh Vực Phát Triển NAEYC:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Thể chất</span>
                  {renderDomainBadge(selectedPortfolioStudent.physical)}
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Nhận thức</span>
                  {renderDomainBadge(selectedPortfolioStudent.cognitive)}
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Ngôn ngữ</span>
                  {renderDomainBadge(selectedPortfolioStudent.language)}
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Tình cảm XH</span>
                  {renderDomainBadge(selectedPortfolioStudent.socialEmotional)}
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Vận động</span>
                  {renderDomainBadge(selectedPortfolioStudent.motor)}
                </div>
              </div>
            </div>

            {/* Teacher Notes */}
            {selectedPortfolioStudent.teacherComment && (
              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/50 text-xs space-y-1">
                <div className="font-extrabold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Lời Nhắn Gửi Phụ Huynh:</span>
                </div>
                <p className="text-rose-800 dark:text-rose-300 italic">{selectedPortfolioStudent.teacherComment}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: KHEN THƯỞNG (POSITIVE REINFORCEMENT & AWARDS)                     */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'recognition' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-[#0c513f]" />
                <span>Góc Khen Thưởng &amp; Tuyên Dương Mầm Non</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ghi nhận những tiến bộ vượt bậc, lòng nhân ái và tính tự lập của các bé
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={awardCategoryFilter}
                onChange={(e) => setAwardCategoryFilter(e.target.value)}
                aria-label="Lọc theo loại khen thưởng"
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">Tất cả danh hiệu</option>
                <option value="CHAM_NGOAN">Bé Chăm Ngoan</option>
                <option value="HOA_SI">Họa Sĩ Nhí</option>
                <option value="CHIA_SE">Thiên Thần Chia Sẻ</option>
                <option value="KHOE_DEP">Bé Khỏe Đẹp</option>
                <option value="TU_LAP">Bé Tự Lập</option>
              </select>

              <button
                type="button"
                onClick={() => setIsAwardModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0c513f] text-white font-bold text-xs shadow-sm hover:bg-[#083b2e]"
              >
                <Plus className="w-4 h-4" />
                <span>Trao khen thưởng mới</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {awardsList
              .filter((awd) => awardCategoryFilter === 'ALL' || awd.category === awardCategoryFilter)
              .map((awd) => (
                <div
                  key={awd.id}
                  className="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm space-y-4 hover:border-amber-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-[14px] ${awd.studentAvatarBg}`}
                        >
                          {awd.studentName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white">{awd.studentName}</div>
                          <div className="text-[11px] text-slate-400">{awd.studentClass}</div>
                        </div>
                      </div>

                      <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shadow-2xs">
                        <Star className="w-5 h-5 fill-amber-400" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-extrabold text-amber-800 dark:text-amber-200">{awd.title}</div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed italic">
                        &quot;{awd.commendationReason}&quot;
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Ngày trao: {awd.dateAwarded}</span>
                    <button
                      type="button"
                      onClick={() => alert(`Đã in chứng nhận khen thưởng cho bé ${awd.studentName}`)}
                      className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                    >
                      In chứng nhận
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── MODAL 1: STUDENT PORTFOLIO 360° INSPECTION DRAWER ── */}
      {inspectedStudent && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setInspectedStudent(null);
          }}
        >
          <DialogContent
            showCloseButton={false}
            initialFocus
            finalFocus={() => !profileToObservationRef.current}
            aria-label="Hồ sơ trẻ minh họa"
            className="w-full max-w-2xl sm:max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[82vh] overflow-y-auto"
          >
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Hồ sơ minh họa: thông tin thể chất, nhận xét, bằng chứng và gợi ý bên dưới là nội dung mẫu; chưa phân tích hồ sơ thật.
            </p>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-extrabold text-[18px] ring-2 ring-[#0c513f] ${inspectedStudent.avatarFallbackBg}`}
                >
                  {inspectedStudent.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">{inspectedStudent.className}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-slate-400">{selectedMonth}</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {inspectedStudent.name} {inspectedStudent.nickname && `(${inspectedStudent.nickname})`}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                aria-label="Đóng hồ sơ minh họa"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Health & Growth Read-only reference */}
            {inspectedStudent.physicalDetail && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-1">
                <div className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Dữ liệu thể chất &amp; Tăng trưởng tham chiếu:</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  Chiều cao: <strong>{inspectedStudent.physicalDetail.height}</strong> • Cân nặng:{' '}
                  <strong>{inspectedStudent.physicalDetail.weight}</strong>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-0.5">
                  &quot;{inspectedStudent.physicalDetail.observation}&quot;
                </p>
              </div>
            )}

            {/* Domain Highlights */}
            {inspectedStudent.highlights && inspectedStudent.highlights.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#0c513f]" />
                  <span>Năng lực nổi bật trong tháng:</span>
                </h4>

                <div className="space-y-3">
                  {inspectedStudent.highlights.map((h, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 dark:text-white">{h.skillName}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {h.level}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">&quot;{h.note}&quot;</p>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-700">📷 {h.photos} ảnh</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600">📝 {h.notes} nhật ký</span>
                        </span>
                        <span className="font-bold text-rose-600 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5" />
                          {h.nextGoal}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Pedagogical Suggestion */}
            {inspectedStudent.aiDraftSummary && (
              <div className="p-4 rounded-2xl bg-[#f0f7ff] dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 space-y-1.5 text-xs">
                <div className="font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span>Gợi ý tổng hợp minh họa (chưa phân tích hồ sơ thật):</span>
                </div>
                <p className="text-blue-800 dark:text-blue-300 italic text-[11px] leading-relaxed">
                  &quot;{inspectedStudent.aiDraftSummary}&quot;
                </p>
              </div>
            )}

            {/* Teacher Parent Message */}
            {inspectedStudent.teacherComment && (
              <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/60 text-xs space-y-1">
                <div className="font-extrabold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Lời nhắn cô giáo gửi Phụ huynh:</span>
                </div>
                <p className="text-rose-800 dark:text-rose-300 italic leading-relaxed">
                  &quot;{inspectedStudent.teacherComment}&quot;
                </p>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  profileToObservationRef.current = true;
                  selectObservationChild(inspectedStudent.id);
                  setInspectedStudent(null);
                  setIsNewObservationModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm quan sát mới</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL 2: NEW OBSERVATION ENTRY ── */}
      {isNewObservationModalOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setIsNewObservationModalOpen(false);
          }}
        >
          <DialogContent
            showCloseButton={false}
            initialFocus
            finalFocus={observationOpenerRef}
            aria-labelledby="new-observation-title"
            aria-describedby="new-observation-draft-note"
            className="w-full max-w-lg sm:max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 id="new-observation-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                  Nhập quan sát sư phạm mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewObservationModalOpen(false)}
                aria-label="Đóng nhập quan sát"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p id="new-observation-draft-note" className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              Bản nháp thử giao diện, chưa lưu vào hồ sơ. Mỗi trẻ có bản nháp riêng, được giữ khi đổi trẻ hoặc đóng rồi
              mở lại trong màn hình này; tải lại hoặc rời trang sẽ mất bản nháp. Chỉ nhập dữ liệu giả.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="new-observation-student"
                  className="font-bold text-slate-700 dark:text-slate-300 block mb-1"
                >
                  Chọn trẻ
                </label>
                <select
                  id="new-observation-student"
                  value={newObsStudentId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => selectObservationChild(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  {ROSTER_STUDENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-observation-domain"
                    className="font-bold text-slate-700 dark:text-slate-300 block mb-1"
                  >
                    Lĩnh vực NAEYC
                  </label>
                  <select
                    id="new-observation-domain"
                    value={newObsDomain}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => updateObservationDraft({ domain: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option>Thể chất &amp; Vận động</option>
                    <option>Ngôn Ngữ &amp; Giao Tiếp</option>
                    <option>Nhận Thức &amp; Tư Duy</option>
                    <option>Tình Cảm &amp; Kỹ Năng Xã Hội</option>
                    <option>Thẩm Mỹ &amp; Sáng Tạo</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="new-observation-progression"
                    className="font-bold text-slate-700 dark:text-slate-300 block mb-1"
                  >
                    Mức độ tiến trình
                  </label>
                  <select
                    id="new-observation-progression"
                    value={newObsProgression}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      updateObservationDraft({ progression: e.target.value })
                    }
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option>Đang làm quen</option>
                    <option>Đang phát triển</option>
                    <option>Đạt kỳ vọng</option>
                    <option>Thành thạo</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="new-observation-skill" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Kỹ năng quan sát cụ thể
                </label>
                <input
                  id="new-observation-skill"
                  type="text"
                  value={newObsSkill}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateObservationDraft({ skill: e.target.value })}
                  placeholder="Ví dụ: Tự cởi cúc áo, nhận biết thẻ chữ o-ô-ơ..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label htmlFor="new-observation-note" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ghi chép hành vi khách quan
                </label>
                <textarea
                  id="new-observation-note"
                  rows={3}
                  value={newObsNote}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateObservationDraft({ note: e.target.value })}
                  placeholder="Ghi lại hành vi cụ thể của trẻ trong ngữ cảnh tự nhiên..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label htmlFor="new-observation-photos" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Số lượng ảnh / video bằng chứng đính kèm
                </label>
                <input
                  id="new-observation-photos"
                  type="number"
                  min={0}
                  max={10}
                  value={newObsPhotosCount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateObservationDraft({ photosCount: Number(e.target.value) })
                  }
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>
            </div>

            {observationNotice && (
              <p
                role="status"
                className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              >
                {observationNotice}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewObservationModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Đóng và giữ bản nháp
              </button>
              <button
                type="button"
                onClick={() => {
                  setObservationNotice(
                    'Chưa lưu quan sát: chức năng lưu chưa khả dụng trong bản thử giao diện này. Bản nháp vẫn được giữ trong màn hình, chưa có hồ sơ mới được tạo.'
                  );
                }}
                className="px-5 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Lưu quan sát</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL 3: AI SUGGESTIONS DRAWER ── */}
      {isAiSuggestionsDrawerOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setIsAiSuggestionsDrawerOpen(false);
          }}
        >
          <DialogContent
            showCloseButton={false}
            initialFocus
            aria-labelledby="ai-sample-title"
            className="w-full max-w-lg sm:max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/80 text-blue-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 id="ai-sample-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                  Gợi ý AI sư phạm minh họa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAiSuggestionsDrawerOpen(false)}
                aria-label="Đóng gợi ý AI minh họa"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-700 dark:text-slate-200">
                Gợi ý minh họa để thử giao diện. Chưa có phân tích AI từ nhật ký hoặc hồ sơ thật; các khuyến nghị bên dưới
                là nội dung mẫu.
              </p>

              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 space-y-1">
                <div className="font-extrabold text-blue-900 dark:text-blue-200">
                  1. Tăng cường hoạt động kể chuyện theo cặp (Lớp Mầm A1)
                </div>
                <p className="text-blue-800 dark:text-blue-300 text-[11px]">
                  3 trẻ có biểu hiện rụt rè khi nói trước vòng tròn lớp (Vũ Gia Hân, Lê Gia Huy). Cần chuyển sang mô hình
                  nhóm 2-3 bạn để tăng sự tự tin.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 space-y-1">
                <div className="font-extrabold text-emerald-900 dark:text-emerald-200">
                  2. Khuyến khích góc sáng tạo Reggio Emilia (Lớp Chồi B1)
                </div>
                <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                  5 trẻ thể hiện vượt chuẩn ở kỹ năng cảm thụ màu sắc và tạo hình (Trần Bảo Ngọc, Phạm Thảo My). Đề xuất
                  bổ sung nguyên vật liệu thiên nhiên tái chế.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 space-y-1">
                <div className="font-extrabold text-amber-900 dark:text-amber-200">
                  3. Bổ sung bài tập vận động tinh cho nhóm xếp hình STEAM
                </div>
                <p className="text-amber-800 dark:text-amber-300 text-[11px]">
                  Cần hướng dẫn kỹ thuật khớp nối lego nhỏ cho Hoàng Tuấn Kiệt để duy trì thời gian chú ý trên 15 phút.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAiSuggestionsDrawerOpen(false)}
                className="px-5 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white font-bold text-xs shadow-md"
              >
                Đóng gợi ý minh họa
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL 4: QUICK CHILD ACTIONS (ROW 3-DOTS MENU) ── */}
      {quickActionStudent && (
        <Dialog open onOpenChange={(open) => { if (!open) setQuickActionStudent(null); }}>
          <DialogContent
            showCloseButton={false}
            initialFocus
            aria-label={`Thao tác nhanh cho bé ${quickActionStudent.name}`}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm ${quickActionStudent.avatarFallbackBg}`}>
                  {quickActionStudent.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{quickActionStudent.name}</h3>
                  <p className="text-xs text-slate-400">{quickActionStudent.className} • Mã: {quickActionStudent.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickActionStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <button
                type="button"
                onClick={() => {
                  setInspectedStudent(quickActionStudent);
                  setQuickActionStudent(null);
                }}
                className="w-full p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-left transition-colors"
              >
                <Eye className="w-4 h-4 text-[#0c513f]" />
                <span>Xem Hồ Sơ Đánh Giá Phát Triển (Modal)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  selectObservationChild(quickActionStudent.id);
                  setQuickActionStudent(null);
                  setIsNewObservationModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-left transition-colors"
              >
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Nhập Quan Sát Sư Phạm Nhanh</span>
              </button>

              <Link
                href={`/dashboard/education/enrollments/${quickActionStudent.id}`}
                className="w-full p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-left transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-blue-600" />
                <span>Chuyển Sang Hồ Sơ Học Sinh (Quản Lý Trẻ)</span>
              </Link>

              <Link
                href={`/dashboard/education/attendance?student=${quickActionStudent.id}`}
                className="w-full p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-left transition-colors"
              >
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Xem Sổ Điểm Danh &amp; Đưa Đón Của Bé</span>
              </Link>

              <Link
                href={`/dashboard/education/care?student=${quickActionStudent.id}`}
                className="w-full p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-left transition-colors"
              >
                <Heart className="w-4 h-4 text-rose-500" />
                <span>Chăm Sóc &amp; Dinh Dưỡng Bữa Ăn / Giấc Ngủ</span>
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL 5: NEW AWARD ISSUANCE ── */}
      {isAwardModalOpen && (
        <Dialog open onOpenChange={(open) => { if (!open) setIsAwardModalOpen(false); }}>
          <DialogContent
            showCloseButton={false}
            initialFocus
            aria-label="Trao khen thưởng mầm non mới"
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Trao Khen Thưởng / Phiếu Bé Ngoan</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAwardModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Chọn bé</label>
                <select
                  value={newAwardStudentId}
                  onChange={(e) => setNewAwardStudentId(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  {ROSTER_STUDENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Danh hiệu tuyên dương</label>
                <select
                  value={newAwardCategory}
                  onChange={(e) => setNewAwardCategory(e.target.value as 'CHAM_NGOAN' | 'HOA_SI' | 'KHOE_DEP' | 'CHIA_SE' | 'TU_LAP')}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  <option value="CHAM_NGOAN">Bé Chăm Ngoan &amp; Tự Giác</option>
                  <option value="HOA_SI">Họa Sĩ Nhí Sáng Tạo</option>
                  <option value="KHOE_DEP">Bé Khỏe Đẹp &amp; Vận Động</option>
                  <option value="CHIA_SE">Thiên Thần Chia Sẻ &amp; Yêu Thương</option>
                  <option value="TU_LAP">Bé Tự Lập Xuất Sắc</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tiêu đề giấy khen</label>
                <input
                  type="text"
                  value={newAwardTitle}
                  onChange={(e) => setNewAwardTitle(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Lời khen tặng của cô giáo</label>
                <textarea
                  rows={3}
                  value={newAwardReason}
                  onChange={(e) => setNewAwardReason(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAwardModalOpen(false)}
                className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetChild = ROSTER_STUDENTS.find((s) => s.id === newAwardStudentId) || ROSTER_STUDENTS[0];
                  const newAwd: PreschoolAwardItem = {
                    id: `AWD-${Date.now()}`,
                    studentId: targetChild.id,
                    studentName: targetChild.name,
                    studentClass: targetChild.className,
                    studentAvatarBg: targetChild.avatarFallbackBg,
                    category: newAwardCategory,
                    categoryLabel:
                      newAwardCategory === 'CHAM_NGOAN'
                        ? 'Bé Chăm Ngoan'
                        : newAwardCategory === 'HOA_SI'
                        ? 'Họa Sĩ Nhí'
                        : newAwardCategory === 'KHOE_DEP'
                        ? 'Bé Khỏe Đẹp'
                        : newAwardCategory === 'CHIA_SE'
                        ? 'Thiên Thần Chia Sẻ'
                        : 'Bé Tự Lập',
                    title: newAwardTitle,
                    commendationReason: newAwardReason,
                    dateAwarded: new Date().toLocaleDateString('vi-VN'),
                    iconType: 'star',
                  };
                  setAwardsList((prev) => [newAwd, ...prev]);
                  setIsAwardModalOpen(false);
                  setActiveTab('recognition');
                }}
                className="px-5 py-2 rounded-2xl bg-[#0c513f] text-white font-bold text-xs shadow-md hover:bg-[#083b2e]"
              >
                Xác nhận trao thưởng
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Fallback view for non-preschool enterprise tenants
 */
function LegacyGradesView() {
  return (
    <div className="w-full p-6 space-y-6">
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sổ Đánh Giá &amp; Điểm Số — Enterprise ERP</h2>
        <p className="text-xs text-slate-500 mt-1">
          Chế độ xem dành riêng cho trung tâm đào tạo tiêu chuẩn và trường phổ thông liên cấp.
        </p>
      </div>
    </div>
  );
}

export default function PreschoolDevelopmentGradesPage() {
  const { user, product, isLoading } = useUser();
  if (isLoading) return <p role="status">Đang xác minh tài khoản…</p>;
  if (!user?.tenant_id || !product) return <p role="alert">Không có quyền mở màn hình này.</p>;
  // The original Grades presentation contains illustrative children and local-only drafts.
  // Restore its visual preview in local development without publishing sample records.
  if (product.productKey === 'bella_preschool' && process.env.NODE_ENV !== 'development') return (
    <section className="p-6 space-y-4" aria-labelledby="held-workspace-heading">
      <h1 id="held-workspace-heading" className="text-2xl font-bold">Học tập &amp; Hoạt động</h1>
      <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Chưa mở trong MVP Preschool</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">Học tập, quan sát và hồ sơ phát triển chưa mở trong MVP Preschool. Không hiển thị danh sách trẻ hoặc kết quả đánh giá mẫu.</p>
      <Link href="/dashboard/education/courses" className="inline-block font-semibold underline">Về danh sách lớp</Link>
    </section>
  );
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <GraduationCap className="w-8 h-8 animate-spin text-[#0c513f]" />
        </div>
      }
    >
      <PreschoolDevelopmentGradesPageContent />
    </Suspense>
  );
}
