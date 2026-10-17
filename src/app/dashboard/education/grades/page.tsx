'use client';

/**
 * Bella Education — Learning & Child Development Operations Workspace
 *
 * Transformed from cluttered card layout (Image 1 & 2) into the streamlined,
 * high-hierarchy Development Monitoring Workspace (Image 3):
 * - Scoped exclusively to Preschool tenants (`bella_education`)
 * - Unified brand deep green palette (`#0c513f` / `#075548`)
 * - Header: Back button + Purple GraduationCap badge + "Học Tập & Phát Triển Mầm Non" +
 *           Subtitle + Month Picker ("Tháng 09/2026") + "+ Nhập quan sát mới" CTA
 * - 4 High-Hierarchy Neutral KPI Cards:
 *     1. Green Users: Tổng số trẻ (46) — (2 lớp)
 *     2. Purple FileText: Đã đánh giá (38) — 83% + progress bar
 *     3. Amber Clock: Chưa đánh giá (8) — 17% + progress bar
 *     4. Indigo Star: Ghi nhận mới (12) — Trong tháng
 * - Class Progress Overview Card: "Tiến độ đánh giá theo lớp" (Lớp Mầm A1 75%, Lớp Chồi B1 90%)
 * - Workspace Tabs: Tổng quan, Nhật ký & Bằng chứng, Tiến trình NAEYC, Hồ sơ 360°, Khen thưởng
 * - 2 Quick Alert Banners:
 *     - "8 trẻ cần chú ý" (Cần thêm quan sát ở một số lĩnh vực phát triển)
 *     - "Gợi ý từ AI sư phạm" (Tổng hợp 12 gợi ý cá nhân hóa trong tháng 9)
 * - Search & Filter Bar:
 *     - Search ("Tìm tên trẻ, lớp...")
 *     - Class Filter ("Tất cả lớp", "Lớp Mầm A1", "Lớp Chồi B1")
 *     - Status Filter ("Tất cả trạng thái", "Đã đầy đủ", "Cần bổ sung", "Cần chú ý")
 *     - Filter Button ("Bộ lọc")
 * - Student Development Table ("Danh sách trẻ" — 46 trẻ):
 *     - Columns: [x], #, Họ tên, Lớp, Thể chất, Nhận thức, Ngôn ngữ, Tình cảm XH, Vận động, Trạng thái, Thao tác
 *     - Pill indicators: ↑ Đạt (emerald), ↑ Tốt (blue), ! Theo dõi (amber), ! Cần hỗ trợ (amber alert)
 *     - Status badges: ● Đã đầy đủ (green), ● Cần bổ sung (orange), ● Cần chú ý (red)
 *     - Pagination: "Hiển thị 8 / 46 trẻ" + [<] [1] [2] [3] [4] [5] [>]
 * - Bottom Split Cards:
 *     - Left: "Trẻ cần chú ý trong tháng 9 (8)" (Lê Gia Huy, Trần Bảo Ngọc, Vũ Gia Hân) + "Xem tất cả →"
 *     - Right: "Hoạt động gần đây" timeline (10:15, 09:30, 08:45, 08:20) + "Xem thêm →"
 * - Detailed Inspection Drawer & New Observation Modal
 * - Non-preschool fallback: Preserves standard view if tenant is not preschool
 * - STRICT TYPE SAFETY: Zero `any` and zero `unknown`
 */

import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
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

// ── Mock & Reference Data matching Image 3 ───────────────────────────────────

const ROSTER_STUDENTS: readonly ChildDevelopmentRosterItem[] = [
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
      observation: 'Chỉ số tăng trưởng hài hòa theo biểu đồ tham chiếu độ tuổi.',
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
    id: 'STU-002',
    code: 'HS-2026-002',
    orderNumber: 2,
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
    status: 'supplement',
    statusLabel: 'Cần bổ sung',
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
      {
        domain: 'Cảm Thụ Âm Nhạc',
        skillName: 'Gõ đệm theo nhịp bài hát',
        level: 'Đạt kỳ vọng',
        note: 'Gõ phách đúng nhịp 2/4 bài hát quen thuộc, hứng thú tham gia múa minh họa.',
        photos: 2,
        notes: 2,
        nextGoal: 'Làm quen với nhạc cụ gõ tam giác.',
      },
    ],
    teacherComment: 'Bé Bắp có năng khiếu nghệ thuật vượt trội. Bé nhận biết màu sắc và tự tin thể hiện ý tưởng độc đáo.',
    aiDraftSummary: 'Bảo Ngọc phát triển xuất sắc ở mảng Thẩm mỹ & Sáng tạo. Tích cực tham gia thảo luận nhóm Reggio Emilia.',
  },
  {
    id: 'STU-003',
    code: 'HS-2026-003',
    orderNumber: 3,
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
    id: 'STU-004',
    code: 'HS-2026-004',
    orderNumber: 4,
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
    id: 'STU-005',
    code: 'HS-2026-005',
    orderNumber: 5,
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
    status: 'supplement',
    statusLabel: 'Cần bổ sung',
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
    id: 'STU-006',
    code: 'HS-2026-006',
    orderNumber: 6,
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
    id: 'STU-007',
    code: 'HS-2026-007',
    orderNumber: 7,
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
    id: 'STU-008',
    code: 'HS-2026-008',
    orderNumber: 8,
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
];

const ATTENTION_CHILDREN: readonly AttentionChildItem[] = [
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
    name: 'Trần Bảo Ngọc',
    className: 'Lớp Chồi B1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    note: 'Tình cảm – xã hội: cần thêm quan sát',
    badgeType: 'canhotro',
    badgeLabel: '! Cần hỗ trợ',
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
];

const RECENT_ACTIVITIES: readonly DevelopmentActivityItem[] = [
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
];

export default function PreschoolDevelopmentGradesPage() {
  const [isPreschoolTenant, setIsPreschoolTenant] = useState<boolean>(true);

  // Filter & Navigation states
  const [activeTab, setActiveTab] = useState<DevelopmentTabKey>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>('Tháng 09/2026');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<'ALL' | 'MAM_A1' | 'CHOI_B1'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'COMPLETED' | 'SUPPLEMENT' | 'ATTENTION'>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedStudentIds, setSelectedStudentIds] = useState<readonly string[]>([]);

  // Modals & Drawers
  const [inspectedStudent, setInspectedStudent] = useState<ChildDevelopmentRosterItem | null>(null);
  const [isNewObservationModalOpen, setIsNewObservationModalOpen] = useState<boolean>(false);
  const [isAiSuggestionsDrawerOpen, setIsAiSuggestionsDrawerOpen] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // New Observation Form State (Strictly typed)
  const [newObsStudentId, setNewObsStudentId] = useState<string>('STU-001');
  const [newObsDomain, setNewObsDomain] = useState<string>('Ngôn Ngữ & Giao Tiếp');
  const [newObsSkill, setNewObsSkill] = useState<string>('');
  const [newObsProgression, setNewObsProgression] = useState<string>('Đạt kỳ vọng');
  const [newObsNote, setNewObsNote] = useState<string>('');
  const [newObsPhotosCount, setNewObsPhotosCount] = useState<number>(1);

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

  // Filtered roster
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
        if (!matchName && !matchClass && !matchNickname) {
          return false;
        }
      }
      return true;
    });
  }, [selectedClass, selectedStatus, searchQuery]);

  // Checkbox handlers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((item) => item !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleExportReport = () => {
    setExportNotice('Đang xuất báo cáo tiến trình phát triển NAEYC (Excel/PDF)...');
    setTimeout(() => {
      setExportNotice(null);
    }, 3000);
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

  if (!isPreschoolTenant) {
    return <LegacyGradesView />;
  }

  return (
    <div className="preschool-grades-workspace w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-36 sm:pb-48">
      {/* ── EXPORT TOAST NOTIFICATION ── */}
      {exportNotice && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{exportNotice}</span>
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
            <div className="w-10 h-10 rounded-2xl bg-[#f0eaff] dark:bg-purple-950/60 text-[#7c3aed] flex items-center justify-center shrink-0 shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Học Tập & Phát Triển Mầm Non
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Theo dõi sự phát triển toàn diện của trẻ theo quan sát, bằng chứng và khung NAEYC
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
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
            onClick={() => setIsNewObservationModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-[#0c513f]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nhập quan sát mới</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI STAT CARDS MATCHING IMAGE 3 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Tổng số trẻ */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">46</div>
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
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">38</div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Đã đánh giá</span>
              <span className="font-extrabold text-slate-500">83%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: '83%' }} />
            </div>
          </div>
        </div>

        {/* Card 3: Chưa đánh giá */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">8</div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Chưa đánh giá</span>
              <span className="font-extrabold text-slate-500">17%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '17%' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Ghi nhận mới */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">12</div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Ghi nhận mới</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Trong tháng</div>
          </div>
        </div>
      </div>

      {/* ── TIẾN ĐỘ ĐÁNH GIÁ THEO LỚP MATCHING IMAGE 3 ── */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Tiến độ đánh giá theo lớp
          </h2>
          <button
            type="button"
            onClick={() => {
              setSelectedClass('ALL');
              setSelectedStatus('ALL');
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
                  <div className="text-xs text-slate-500">18 / 24 trẻ</div>
                </div>
              </div>
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">75%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }} />
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
                  <div className="text-xs text-slate-500">20 / 22 trẻ</div>
                </div>
              </div>
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">90%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden mt-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '90%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE TABS MATCHING IMAGE 3 ── */}
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
          <span>Nhật ký & Bằng chứng</span>
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
              <div className="text-xs font-extrabold text-rose-950 dark:text-rose-100">
                8 trẻ cần chú ý
              </div>
              <div className="text-[11px] font-medium text-rose-700 dark:text-rose-300 mt-0.5">
                Cần thêm quan sát ở một số lĩnh vực phát triển
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-500 shrink-0" />
        </div>

        {/* Banner 2: Gợi ý từ AI sư phạm */}
        <div
          onClick={() => setIsAiSuggestionsDrawerOpen(true)}
          className="rounded-2xl p-4 bg-[#f0f7ff] dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between cursor-pointer hover:bg-blue-100/50 transition-all shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/80 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-blue-950 dark:text-blue-100">
                Gợi ý từ AI sư phạm
              </div>
              <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300 mt-0.5">
                Tổng hợp 12 gợi ý cá nhân hóa trong tháng 9
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-500 shrink-0" />
        </div>
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
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedClass(e.target.value as 'ALL' | 'MAM_A1' | 'CHOI_B1')}
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
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedStatus(e.target.value as 'ALL' | 'COMPLETED' | 'SUPPLEMENT' | 'ATTENTION')}
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
            <span>Bộ lọc</span>
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
              46 trẻ
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

        {/* View Mode: List Table or Grid Cards */}
        {viewMode === 'list' ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả trẻ em trong danh sách"
                      checked={
                        filteredStudents.length > 0 &&
                        selectedStudentIds.length === filteredStudents.length
                      }
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
                {filteredStudents.map((child) => {
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

                      <td className="py-3.5 px-2 text-center text-slate-400 font-bold">
                        {child.orderNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div
                          onClick={() => setInspectedStudent(child)}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <Image
                            src={child.avatarUrl}
                            alt={child.name}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            unoptimized
                            onError={(e) => {
                              // Fallback styling if image fails
                              e.currentTarget.style.display = 'none';
                            }}
                          />
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

                      <td className="py-3.5 px-3 text-center">
                        {renderDomainBadge(child.physical)}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {renderDomainBadge(child.cognitive)}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {renderDomainBadge(child.language)}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {renderDomainBadge(child.socialEmotional)}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {renderDomainBadge(child.motor)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {renderStatusBadge(child.status, child.statusLabel)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setInspectedStudent(child)}
                          title="Tùy chọn thao tác"
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
          /* Grid View Mode: Compact Cards matching the proposed UX */
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((child) => (
              <div
                key={child.id}
                onClick={() => setInspectedStudent(child)}
                className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:shadow-md transition-all cursor-pointer space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src={child.avatarUrl}
                      alt={child.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      unoptimized
                    />
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {child.name}
                      </h3>
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

        {/* Table Footer with Pagination */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{filteredStudents.length}</span> / 46 trẻ
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {[1, 2, 3, 4, 5].map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  currentPage === pageNum
                    ? 'bg-[#0c513f] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === 5}
              onClick={() => setCurrentPage((p) => Math.min(5, p + 1))}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
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
                8
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
                  <Image
                    src={item.avatarUrl}
                    alt={item.name}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                    unoptimized
                  />
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {item.name}
                    </div>
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
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Hoạt động gần đây
              </h2>
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
                className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all flex items-center justify-between gap-3"
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
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {act.title}
                    </div>
                    <div className="text-[11px] text-slate-500">{act.studentAndClass}</div>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-400 shrink-0">{act.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODAL 1: STUDENT PORTFOLIO 360° INSPECTION DRAWER ── */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3.5">
                <Image
                  src={inspectedStudent.avatarUrl}
                  alt={inspectedStudent.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#0c513f]"
                  unoptimized
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      {inspectedStudent.className}
                    </span>
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
                  <span>Dữ liệu thể chất & Tăng trưởng tham chiếu:</span>
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
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {h.skillName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {h.level}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        &quot;{h.note}&quot;
                      </p>
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

            {/* AI Pedagogical Suggestion (Teacher in the loop review) */}
            {inspectedStudent.aiDraftSummary && (
              <div className="p-4 rounded-2xl bg-[#f0f7ff] dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 space-y-1.5 text-xs">
                <div className="font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span>Trợ lý AI gợi ý tổng hợp (Bản thảo sư phạm):</span>
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
                  setInspectedStudent(null);
                  setIsNewObservationModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm quan sát mới</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: NEW OBSERVATION ENTRY ── */}
      {isNewObservationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Nhập quan sát sư phạm mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewObservationModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Chọn trẻ
                </label>
                <select
                  value={newObsStudentId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewObsStudentId(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
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
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Lĩnh vực NAEYC
                  </label>
                  <select
                    value={newObsDomain}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewObsDomain(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option>Thể chất & Vận động</option>
                    <option>Ngôn Ngữ & Giao Tiếp</option>
                    <option>Nhận Thức & Tư Duy</option>
                    <option>Tình Cảm & Kỹ Năng Xã Hội</option>
                    <option>Thẩm Mỹ & Sáng Tạo</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Mức độ tiến trình
                  </label>
                  <select
                    value={newObsProgression}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewObsProgression(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option>Đang làm quen</option>
                    <option>Đang phát triển</option>
                    <option>Đạt kỳ vọng</option>
                    <option>Thành thạo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Kỹ năng quan sát cụ thể
                </label>
                <input
                  type="text"
                  value={newObsSkill}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewObsSkill(e.target.value)}
                  placeholder="Ví dụ: Tự cởi cúc áo, nhận biết thẻ chữ o-ô-ơ..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ghi chép hành vi khách quan
                </label>
                <textarea
                  rows={3}
                  value={newObsNote}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewObsNote(e.target.value)}
                  placeholder="Ghi lại hành vi cụ thể của trẻ trong ngữ cảnh tự nhiên..."
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Số lượng ảnh / video bằng chứng đính kèm
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={newObsPhotosCount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewObsPhotosCount(Number(e.target.value))}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewObservationModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNewObservationModalOpen(false);
                  setExportNotice('Đã lưu quan sát mới vào nhật ký sư phạm thành công!');
                  setTimeout(() => setExportNotice(null), 3000);
                }}
                className="px-5 py-2.5 rounded-2xl bg-[#0c513f] hover:bg-[#083b2e] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Lưu quan sát</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: AI SUGGESTIONS DRAWER ── */}
      {isAiSuggestionsDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/80 text-blue-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Gợi ý từ AI Sư Phạm (Tháng 09/2026)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAiSuggestionsDrawerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                AI đã phân tích 42 nhật ký quan sát sư phạm trong tháng 9 và đưa ra các khuyến nghị có thể ứng dụng trong kế hoạch bài học tuần tới:
              </p>

              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 space-y-1">
                <div className="font-extrabold text-blue-900 dark:text-blue-200">
                  1. Tăng cường hoạt động kể chuyện theo cặp (Lớp Mầm A1)
                </div>
                <p className="text-blue-800 dark:text-blue-300 text-[11px]">
                  3 trẻ có biểu hiện rụt rè khi nói trước vòng tròn lớp (Vũ Gia Hân, Lê Gia Huy). Cần chuyển sang mô hình nhóm 2-3 bạn để tăng sự tự tin.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 space-y-1">
                <div className="font-extrabold text-emerald-900 dark:text-emerald-200">
                  2. Khuyến khích góc sáng tạo Reggio Emilia (Lớp Chồi B1)
                </div>
                <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                  5 trẻ thể hiện vượt chuẩn ở kỹ năng cảm thụ màu sắc và tạo hình (Trần Bảo Ngọc, Phạm Thảo My). Đề xuất bổ sung nguyên vật liệu thiên nhiên tái chế.
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
                Đã tiếp nhận khuyến nghị
              </button>
            </div>
          </div>
        </div>
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
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Sổ Đánh Giá & Điểm Số — Enterprise ERP
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Chế độ xem dành riêng cho trung tâm đào tạo tiêu chuẩn và trường phổ thông liên cấp.
        </p>
      </div>
    </div>
  );
}
