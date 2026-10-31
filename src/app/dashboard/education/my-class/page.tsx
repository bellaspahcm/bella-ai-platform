'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Education — Homeroom Teacher (Giáo viên Chủ nhiệm) Workspace
 * Route: /dashboard/education/my-class
 *
 * Designed specifically for the Preschool Homeroom Teacher Persona:
 * - Scoped exclusively to the assigned classroom (e.g. Lớp Mầm A1 — Họa Mi)
 * - PWA & Mobile Touch Optimized: Tablet & smartphone-ready with >=44px touch targets
 * - 7 Integrated Feature Tabs:
 *     1. Sĩ số & Điểm danh + Đo thân nhiệt đầu ngày (Attendance & Health Triage)
 *     2. Chăm sóc trong ngày & Thể trạng thể chất (Daily Care, Meals & Nap)
 *     3. Thời khóa biểu & Chu trình sinh hoạt 1 ngày (Timetable & Routine)
 *     4. Thực đơn tuần dinh dưỡng & Cảnh báo dị ứng (Nutrition Menu & Allergies)
 *     5. Bàn giao đón trẻ chiều (Pickup & Authorized Handover)
 *     6. Trao đổi Phụ huynh 2 chiều (Parent Direct Chat & Quick Notes)
 *     7. Hồ sơ trẻ 360 toàn diện (Child 360 Dossier & Development Milestones)
 * - Strict Type Invariant: ZERO use of `any` and `unknown`.
 */

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import PreschoolSelect from '@/components/ui/PreschoolSelect';
import {
  Users,
  Baby,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Utensils,
  Heart,
  Activity,
  ShieldCheck,
  Phone,
  Search,
  Filter,
  RefreshCw,
  Send,
  Check,
  X,
  Camera,
  UserCheck,
  ArrowLeft,
  Eye,
  Award,
  Sparkles,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Moon,
  Coffee,
  Smile,
  Frown,
  CheckCheck,
  ExternalLink,
  ChevronDown,
  Info,
  QrCode,
  Droplets,
  Thermometer,
  Bot,
  Copy,
} from 'lucide-react';

// ── Strict Domain Types ─────────────────────────────────────────────────────────

export type HomeroomTabKey =
  | 'overview'
  | 'attendance'
  | 'daily-care'
  | 'timetable'
  | 'menu'
  | 'handover'
  | 'chat'
  | 'copilot';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export interface AuthorizedGuardian {
  readonly id: string;
  readonly name: string;
  readonly relation: string;
  readonly phone: string;
  readonly avatarUrl?: string;
  readonly isPrimary: boolean;
}

export interface StudentCareState {
  readonly morningCondition: string;
  readonly temperature: number;
  readonly breakfastStatus: 'Ăn hết' | 'Ăn 1/2' | 'Kén ăn' | 'Không ăn';
  readonly lunchStatus: 'Ăn hết' | 'Ăn 1/2' | 'Kén ăn' | 'Không ăn';
  readonly snackStatus: 'Uống hết' | 'Uống 1/2' | 'Không uống';
  readonly napDurationMinutes: number;
  readonly napQuality: 'Ngủ sâu' | 'Khó ngủ' | 'Hay giật mình' | 'Quấy khóc';
  readonly waterGlasses: number;
  readonly hygieneCount: number;
  readonly specialNotes?: string;
}

export interface StudentPhysicalGrowth {
  readonly heightCm: number;
  readonly weightKg: number;
  readonly bmi: number;
  readonly whoStatus: 'Chuẩn WHO' | 'Nguy cơ béo phì' | 'Nhẹ cân';
  readonly lastMeasuredDate: string;
}

export interface PreschoolStudent {
  readonly id: string;
  readonly code: string;
  readonly fullName: string;
  readonly nickName: string;
  readonly avatarUrl: string;
  readonly gender: 'BOY' | 'GIRL';
  readonly dob: string;
  readonly ageMonths: number;
  readonly allergies: readonly string[];
  readonly attendance: AttendanceStatus;
  readonly arrivalTime?: string;
  readonly arrivalCheckedBy?: string;
  readonly care: StudentCareState;
  readonly physical: StudentPhysicalGrowth;
  readonly guardians: readonly AuthorizedGuardian[];
  readonly isHandedOver: boolean;
  readonly handedOverAt?: string;
  readonly handedOverTo?: string;
}

export interface HomeroomTeacher {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly classId: string;
  readonly className: string;
  readonly gradeName: string;
  readonly maxCapacity: number;
  readonly avatarUrl: string;
  readonly assistantTeacherName: string;
  readonly nannyName: string;
}

export interface TimetableSlot {
  readonly id: string;
  readonly timeRange: string;
  readonly title: string;
  readonly description: string;
  readonly domainArea: string;
  readonly isCurrent: boolean;
  readonly iconType: 'welcome' | 'exercise' | 'study' | 'meal' | 'nap' | 'play' | 'goodbye';
}

export interface DailyMenuItem {
  readonly mealType: 'Bữa sáng' | 'Bữa trưa' | 'Bữa xế';
  readonly dishName: string;
  readonly caloriesKcal: number;
  readonly allergenWarning?: string;
}

export interface TeacherChatMessage {
  readonly id: string;
  readonly sender: 'TEACHER' | 'PARENT';
  readonly text: string;
  readonly timestamp: string;
  readonly studentId: string;
}

// ── Homeroom Teacher Personas ──────────────────────────────────────────────────

const HOMEROOM_TEACHERS: readonly HomeroomTeacher[] = [
  {
    id: 'TEA-001',
    name: 'Cô Nguyễn Thị Mai',
    title: 'Giáo viên Chủ nhiệm',
    classId: 'CLS-MAM-A1',
    className: 'Lớp Mầm A1 — Họa Mi',
    gradeName: 'Khối Mầm (3 - 4 Tuổi)',
    maxCapacity: 25,
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80',
    assistantTeacherName: 'Cô Lê Minh Tâm',
    nannyName: 'Cô Hoàng Bích Ngọc (Bảo mẫu)',
  },
  {
    id: 'TEA-002',
    name: 'Cô Trần Ngọc Anh',
    title: 'Giáo viên Chủ nhiệm',
    classId: 'CLS-CHOI-B1',
    className: 'Lớp Chồi B1 — Thỏ Ngọc',
    gradeName: 'Khối Chồi (4 - 5 Tuổi)',
    maxCapacity: 28,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
    assistantTeacherName: 'Cô Phạm Thị Trang',
    nannyName: 'Cô Đinh Thúy Hằng (Bảo mẫu)',
  },
  {
    id: 'TEA-003',
    name: 'Cô Đặng Thùy Linh',
    title: 'Giáo viên Chủ nhiệm',
    classId: 'CLS-LA-C1',
    className: 'Lớp Lá C1 — Vàng Anh',
    gradeName: 'Khối Lá (5 - 6 Tuổi)',
    maxCapacity: 30,
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80',
    assistantTeacherName: 'Cô Vũ Hải Yến',
    nannyName: 'Cô Trịnh Thu Thảo (Bảo mẫu)',
  },
];

// ── Realistic Preschool Roster Data ───────────────────────────────────────────

const INITIAL_STUDENTS_ROSTER: readonly PreschoolStudent[] = [
  {
    id: 'STU-001',
    code: 'MN-2026-001',
    fullName: 'Nguyễn Minh Khôi',
    nickName: 'Bơ',
    avatarUrl: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=120&auto=format&fit=crop&q=80',
    gender: 'BOY',
    dob: '12/05/2023',
    ageMonths: 41,
    allergies: ['Tôm biển', 'Hải sản vỏ cứng'],
    attendance: 'PRESENT',
    arrivalTime: '07:35',
    arrivalCheckedBy: 'Bố đưa đến',
    care: {
      morningCondition: 'Vui vẻ, hào hứng chào cô',
      temperature: 36.6,
      breakfastStatus: 'Ăn hết',
      lunchStatus: 'Ăn hết',
      snackStatus: 'Uống hết',
      napDurationMinutes: 130,
      napQuality: 'Ngủ sâu',
      waterGlasses: 4,
      hygieneCount: 3,
      specialNotes: 'Bé vẽ tranh chăm chỉ',
    },
    physical: {
      heightCm: 102.5,
      weightKg: 16.2,
      bmi: 15.4,
      whoStatus: 'Chuẩn WHO',
      lastMeasuredDate: '15/10/2026',
    },
    guardians: [
      { id: 'GD-001A', name: 'Nguyễn Thành Nam', relation: 'Bố', phone: '0912 345 678', isPrimary: true },
      { id: 'GD-001B', name: 'Trần Thị Thu Hà', relation: 'Mẹ', phone: '0912 345 679', isPrimary: false },
      { id: 'GD-001C', name: 'Bà Nguyễn Thị Nhài', relation: 'Bà nội', phone: '0903 111 222', isPrimary: false },
    ],
    isHandedOver: false,
  },
  {
    id: 'STU-002',
    code: 'MN-2026-002',
    fullName: 'Trần Bảo An',
    nickName: 'Kẹo',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
    gender: 'GIRL',
    dob: '28/08/2023',
    ageMonths: 38,
    allergies: [],
    attendance: 'PRESENT',
    arrivalTime: '07:42',
    arrivalCheckedBy: 'Mẹ đưa đến',
    care: {
      morningCondition: 'Bình thường, hơi buồn ngủ',
      temperature: 36.5,
      breakfastStatus: 'Ăn 1/2',
      lunchStatus: 'Ăn hết',
      snackStatus: 'Uống hết',
      napDurationMinutes: 140,
      napQuality: 'Ngủ sâu',
      waterGlasses: 5,
      hygieneCount: 4,
    },
    physical: {
      heightCm: 98.0,
      weightKg: 14.8,
      bmi: 15.4,
      whoStatus: 'Chuẩn WHO',
      lastMeasuredDate: '15/10/2026',
    },
    guardians: [
      { id: 'GD-002A', name: 'Lê Thị Phương Linh', relation: 'Mẹ', phone: '0988 223 344', isPrimary: true },
      { id: 'GD-002B', name: 'Trần Quốc Đạt', relation: 'Bố', phone: '0988 223 345', isPrimary: false },
    ],
    isHandedOver: false,
  },
  {
    id: 'STU-003',
    code: 'MN-2026-003',
    fullName: 'Lê Gia Huy',
    nickName: 'Sóc',
    avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=120&auto=format&fit=crop&q=80',
    gender: 'BOY',
    dob: '15/02/2023',
    ageMonths: 44,
    allergies: ['Sữa bò tươi (Lactose)'],
    attendance: 'LATE',
    arrivalTime: '08:25',
    arrivalCheckedBy: 'Bố đưa đến',
    care: {
      morningCondition: 'Ho nhẹ, mẹ gửi siro ho',
      temperature: 37.1,
      breakfastStatus: 'Ăn 1/2',
      lunchStatus: 'Ăn hết',
      snackStatus: 'Uống 1/2',
      napDurationMinutes: 110,
      napQuality: 'Khó ngủ',
      waterGlasses: 3,
      hygieneCount: 2,
      specialNotes: 'Đã uống 5ml siro ho sau bữa trưa',
    },
    physical: {
      heightCm: 104.2,
      weightKg: 17.5,
      bmi: 16.1,
      whoStatus: 'Chuẩn WHO',
      lastMeasuredDate: '15/10/2026',
    },
    guardians: [
      { id: 'GD-003A', name: 'Lê Hoàng Nam', relation: 'Bố', phone: '0977 123 456', isPrimary: true },
      { id: 'GD-003B', name: 'Đoàn Mai Chi', relation: 'Mẹ', phone: '0977 123 457', isPrimary: false },
    ],
    isHandedOver: false,
  },
  {
    id: 'STU-004',
    code: 'MN-2026-004',
    fullName: 'Phạm Tuệ Mẫn',
    nickName: 'Nhím',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    gender: 'GIRL',
    dob: '04/11/2023',
    ageMonths: 35,
    allergies: [],
    attendance: 'PRESENT',
    arrivalTime: '07:30',
    arrivalCheckedBy: 'Ông nội đưa đến',
    care: {
      morningCondition: 'Ngoan, tự cất ba lô và giày',
      temperature: 36.7,
      breakfastStatus: 'Ăn hết',
      lunchStatus: 'Ăn hết',
      snackStatus: 'Uống hết',
      napDurationMinutes: 135,
      napQuality: 'Ngủ sâu',
      waterGlasses: 5,
      hygieneCount: 3,
    },
    physical: {
      heightCm: 96.5,
      weightKg: 13.9,
      bmi: 14.9,
      whoStatus: 'Chuẩn WHO',
      lastMeasuredDate: '15/10/2026',
    },
    guardians: [
      { id: 'GD-004A', name: 'Phạm Thanh Bình', relation: 'Bố', phone: '0908 998 877', isPrimary: true },
      { id: 'GD-004B', name: 'Nguyễn Thị Hoa', relation: 'Mẹ', phone: '0908 998 878', isPrimary: false },
    ],
    isHandedOver: false,
  },
  {
    id: 'STU-005',
    code: 'MN-2026-005',
    fullName: 'Vũ Đức Trí',
    nickName: 'Tít',
    avatarUrl: 'https://images.unsplash.com/photo-1541823709867-1b206113eafd?w=120&auto=format&fit=crop&q=80',
    gender: 'BOY',
    dob: '19/04/2023',
    ageMonths: 42,
    allergies: [],
    attendance: 'ABSENT',
    care: {
      morningCondition: 'Vắng có phép (Về quê cùng gia đình)',
      temperature: 36.6,
      breakfastStatus: 'Không ăn',
      lunchStatus: 'Không ăn',
      snackStatus: 'Không uống',
      napDurationMinutes: 0,
      napQuality: 'Ngủ sâu',
      waterGlasses: 0,
      hygieneCount: 0,
      specialNotes: 'Mẹ đã gửi đơn xin phép vắng từ tối qua',
    },
    physical: {
      heightCm: 101.0,
      weightKg: 15.6,
      bmi: 15.3,
      whoStatus: 'Chuẩn WHO',
      lastMeasuredDate: '15/10/2026',
    },
    guardians: [
      { id: 'GD-005A', name: 'Vũ Quốc Toàn', relation: 'Bố', phone: '0933 445 566', isPrimary: true },
      { id: 'GD-005B', name: 'Đỗ Thùy Trang', relation: 'Mẹ', phone: '0933 445 567', isPrimary: false },
    ],
    isHandedOver: false,
  },
  {
    id: 'STU-006',
    code: 'MN-2026-006',
    fullName: 'Đặng Ngọc Diệp',
    nickName: 'Mây',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    gender: 'GIRL',
    dob: '08/07/2023',
    ageMonths: 39,
    allergies: ['Đậu phộng / Lạc'],
    attendance: 'PRESENT',
    arrivalTime: '07:45',
    arrivalCheckedBy: 'Mẹ đưa đến',
    care: {
      morningCondition: 'Vui vẻ, chơi xếp hình cùng bạn',
      temperature: 36.5,
      breakfastStatus: 'Ăn hết',
      lunchStatus: 'Ăn hết',
      snackStatus: 'Uống hết',
      napDurationMinutes: 125,
      napQuality: 'Ngủ sâu',
      waterGlasses: 4,
      hygieneCount: 3,
    },
    physical: {
      heightCm: 99.2,
      weightKg: 15.1,
      bmi: 15.3,
      whoStatus: 'Chuẩn WHO',
      lastMeasuredDate: '15/10/2026',
    },
    guardians: [
      { id: 'GD-006A', name: 'Đặng Văn Lâm', relation: 'Bố', phone: '0966 778 899', isPrimary: true },
      { id: 'GD-006B', name: 'Bùi Lan Anh', relation: 'Mẹ', phone: '0966 778 890', isPrimary: false },
    ],
    isHandedOver: false,
  },
];

// ── Daily Timetable Schedule ───────────────────────────────────────────────────

const TIMETABLE_SLOTS: readonly TimetableSlot[] = [
  {
    id: 'ts-1',
    timeRange: '07:15 - 08:00',
    title: 'Đón trẻ & Đo thân nhiệt sáng',
    description: 'Giáo viên đón bé tại cửa lớp, kiểm tra thân nhiệt, nhận đồ dùng và trao đổi với phụ huynh.',
    domainArea: 'Sức khỏe & Giao tiếp',
    isCurrent: false,
    iconType: 'welcome',
  },
  {
    id: 'ts-2',
    timeRange: '08:00 - 08:30',
    title: 'Thể dục sáng & Ăn sáng',
    description: 'Tập bài thể dục đồng diễn theo nhạc sôi động tại sân cỏ và ăn bữa sáng dinh dưỡng.',
    domainArea: 'Thể chất & Dinh dưỡng',
    isCurrent: false,
    iconType: 'exercise',
  },
  {
    id: 'ts-3',
    timeRange: '08:30 - 09:30',
    title: 'Hoạt động học tập nhận thức',
    description: 'Chủ đề: "Bé làm quen với các hình khối và màu sắc cơ bản qua đồ chơi Montessori".',
    domainArea: 'Phát triển Nhận thức',
    isCurrent: false,
    iconType: 'study',
  },
  {
    id: 'ts-4',
    timeRange: '09:30 - 10:30',
    title: 'Vận động ngoài trời & Trò chơi cát nước',
    description: 'Khám phá vườn cây trường học, chơi bập bênh và phát triển vận động thô.',
    domainArea: 'Vận động & Khám phá tự nhiên',
    isCurrent: false,
    iconType: 'play',
  },
  {
    id: 'ts-5',
    timeRange: '10:30 - 11:30',
    title: 'Vệ sinh & Bữa trưa vui vẻ',
    description: 'Tập rửa tay xà phòng chuẩn 6 bước, rèn kỹ năng tự xúc cơm và ăn hết phần.',
    domainArea: 'Kỹ năng tự phục vụ',
    isCurrent: false,
    iconType: 'meal',
  },
  {
    id: 'ts-6',
    timeRange: '11:30 - 14:00',
    title: 'Giấc ngủ trưa êm đềm',
    description: 'Nghe nhạc không lời ru ngủ nhẹ nhàng, cô giáo túc trực theo dõi giấc ngủ của từng bé.',
    domainArea: 'Chăm sóc sức khỏe',
    isCurrent: true,
    iconType: 'nap',
  },
  {
    id: 'ts-7',
    timeRange: '14:00 - 15:00',
    title: 'Thức dậy, Vệ sinh & Bữa xế chiều',
    description: 'Rửa mặt, chải tóc, thưởng thức sữa chua hoa quả và bánh flan dinh dưỡng.',
    domainArea: 'Dinh dưỡng & Nếp sống',
    isCurrent: false,
    iconType: 'meal',
  },
  {
    id: 'ts-8',
    timeRange: '15:00 - 16:30',
    title: 'Hoạt động góc & Kể chuyện sáng tạo',
    description: 'Góc âm nhạc, góc đóng vai bác sĩ và cô giáo kể chuyện cổ tích qua tranh tương tác.',
    domainArea: 'Ngôn ngữ & Thẩm mỹ',
    isCurrent: false,
    iconType: 'play',
  },
  {
    id: 'ts-9',
    timeRange: '16:30 - 17:30',
    title: 'Bàn giao trả trẻ chiều',
    description: 'Xác minh người đón được ủy quyền, bàn giao tư trang và tóm tắt ngày học với phụ huynh.',
    domainArea: 'An toàn & Gắn kết',
    isCurrent: false,
    iconType: 'goodbye',
  },
];

// ── Daily Nutrition Menu ───────────────────────────────────────────────────────

const TODAY_MENU_ITEMS: readonly DailyMenuItem[] = [
  {
    mealType: 'Bữa sáng',
    dishName: 'Cháo sườn non hạt sen & Sữa chua uống Betagen',
    caloriesKcal: 235,
  },
  {
    mealType: 'Bữa trưa',
    dishName: 'Cơm tám thơm · Cá thu rim dứa · Canh rau ngót nấu thịt bằm · Tráng miệng dưa hấu',
    caloriesKcal: 380,
    allergenWarning: 'Lưu ý bé Minh Khôi không ăn canh cá',
  },
  {
    mealType: 'Bữa xế',
    dishName: 'Sữa chua dâu tây hoa quả & Bánh quy mè giòn',
    caloriesKcal: 165,
    allergenWarning: 'Bé Gia Huy dùng sữa hạt đậu nành thay sữa chua',
  },
];

// ── Teacher Chat Messages ──────────────────────────────────────────────────────

const INITIAL_CHAT_MESSAGES: readonly TeacherChatMessage[] = [
  {
    id: 'chat-1',
    sender: 'PARENT',
    studentId: 'STU-001',
    text: 'Dạ cô Mai ơi, sáng nay bố có gửi thêm cho Khôi 1 bộ quần áo dự phòng trong ba lô ạ.',
    timestamp: '07:38',
  },
  {
    id: 'chat-2',
    sender: 'TEACHER',
    studentId: 'STU-001',
    text: 'Dạ cô Mai nhận được rồi anh nhé! Sáng nay Khôi vào lớp rất ngoan và vui vẻ ạ.',
    timestamp: '07:40',
  },
  {
    id: 'chat-3',
    sender: 'PARENT',
    studentId: 'STU-003',
    text: 'Cô Linh ơi, bé Huy hơi khụt khịt mũi, mẹ có gửi siro ho cô cho bé uống 5ml sau ăn trưa giúp mẹ nha.',
    timestamp: '08:15',
  },
  {
    id: 'chat-4',
    sender: 'TEACHER',
    studentId: 'STU-003',
    text: 'Dạ cô ghi nhận rồi ạ. Trưa nay sau khi bé ăn xong cô sẽ cho bé uống đúng liều 5ml và đo lại thân nhiệt cho con.',
    timestamp: '08:20',
  },
];

export default function HomeroomTeacherWorkspacePage() {
  // Active Persona & Navigation States
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('TEA-001');
  const [activeTab, setActiveTab] = useState<HomeroomTabKey>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGender, setFilterGender] = useState<'ALL' | 'BOY' | 'GIRL'>('ALL');

  // Dynamic Students Roster State
  const [students, setStudents] = useState<PreschoolStudent[]>([...INITIAL_STUDENTS_ROSTER]);
  const [selectedStudentFor360, setSelectedStudentFor360] = useState<PreschoolStudent | null>(null);

  // Chat State
  const [activeChatStudentId, setActiveChatStudentId] = useState<string>('STU-001');
  const [chatMessages, setChatMessages] = useState<TeacherChatMessage[]>([...INITIAL_CHAT_MESSAGES]);
  const [inputChatText, setInputChatText] = useState<string>('');

  // Handover confirmation modal
  const [confirmHandoverStudent, setConfirmHandoverStudent] = useState<PreschoolStudent | null>(null);
  const [selectedGuardianToHandover, setSelectedGuardianToHandover] = useState<string>('');
  const [handoverNote, setHandoverNote] = useState<string>('');

  // AI Copilot States
  const [copilotQuestionInput, setCopilotQuestionInput] = useState<string>('');
  const [isCopilotAsking, setIsCopilotAsking] = useState<boolean>(false);
  const [copilotQnAMessages, setCopilotQnAMessages] = useState<
    Array<{ id: string; sender: 'user' | 'copilot'; text: string; time: string }>
  >([
    {
      id: 'COPILOT-01',
      sender: 'copilot',
      text: 'Chào cô Mai! Em là Trợ lý Mầm non Bella AI Copilot. Hôm nay em có thể giúp cô: tóm tắt tình hình lớp học, kiểm tra an toàn dị ứng thực đơn, tạo nhật ký sinh hoạt gửi phụ huynh hoặc hỗ trợ xử lý các tình huống sư phạm trong ngày.',
      time: '08:00',
    },
  ]);
  const [isGeneratingClassBriefing, setIsGeneratingClassBriefing] = useState<boolean>(false);
  const [classBriefingText, setClassBriefingText] = useState<string | null>(null);
  const [isScanningAllergies, setIsScanningAllergies] = useState<boolean>(false);
  const [allergyScanResults, setAllergyScanResults] = useState<{
    safe: boolean;
    conflictingCount: number;
    warnings: string[];
    details: Array<{ studentName: string; dish: string; allergen: string }>;
  } | null>(null);
  const [selectedStudentForDigest, setSelectedStudentForDigest] = useState<string>('STU-001');
  const [isGeneratingDigest, setIsGeneratingDigest] = useState<boolean>(false);
  const [generatedDigestText, setGeneratedDigestText] = useState<string | null>(null);
  const [copyFeedbackText, setCopyFeedbackText] = useState<string | null>(null);

  // Active Teacher
  const currentTeacher = useMemo(() => {
    return HOMEROOM_TEACHERS.find((t) => t.id === selectedTeacherId) || HOMEROOM_TEACHERS[0];
  }, [selectedTeacherId]);

  // Headcount & Attendance Statistics
  const headcountStats = useMemo(() => {
    const totalEnrolled = students.length;
    const presentCount = students.filter((s) => s.attendance === 'PRESENT').length;
    const absentCount = students.filter((s) => s.attendance === 'ABSENT').length;
    const lateCount = students.filter((s) => s.attendance === 'LATE').length;
    const handedOverCount = students.filter((s) => s.isHandedOver).length;
    const attendanceRate = totalEnrolled > 0 ? Math.round(((presentCount + lateCount) / totalEnrolled) * 100) : 0;
    const capacityRate = Math.round((totalEnrolled / currentTeacher.maxCapacity) * 100);

    return {
      totalEnrolled,
      presentCount,
      absentCount,
      lateCount,
      handedOverCount,
      attendanceRate,
      capacityRate,
    };
  }, [students, currentTeacher.maxCapacity]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nickName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGender = filterGender === 'ALL' || s.gender === filterGender;
      return matchSearch && matchGender;
    });
  }, [students, searchQuery, filterGender]);

  // Active Chat Student
  const activeChatStudent = useMemo(() => {
    return students.find((s) => s.id === activeChatStudentId) || students[0];
  }, [students, activeChatStudentId]);

  const activeChatList = useMemo(() => {
    return chatMessages.filter((m) => m.studentId === activeChatStudentId);
  }, [chatMessages, activeChatStudentId]);

  // Handlers for Attendance
  const handleToggleAttendance = (studentId: string, newStatus: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          attendance: newStatus,
          arrivalTime: newStatus === 'PRESENT' || newStatus === 'LATE' ? s.arrivalTime || '07:45' : undefined,
        };
      })
    );
  };

  const handleUpdateTemperature = (studentId: string, tempValue: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          care: {
            ...s.care,
            temperature: tempValue,
          },
        };
      })
    );
  };

  const handleBulkMarkAllPresent = () => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        attendance: 'PRESENT',
        arrivalTime: s.arrivalTime || '07:40',
      }))
    );
  };

  // Handover Execution
  const handleExecuteHandover = () => {
    if (!confirmHandoverStudent) return;
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== confirmHandoverStudent.id) return s;
        return {
          ...s,
          isHandedOver: true,
          handedOverAt: nowStr,
          handedOverTo: selectedGuardianToHandover || 'Phụ huynh chính',
        };
      })
    );
    setConfirmHandoverStudent(null);
    setSelectedGuardianToHandover('');
    setHandoverNote('');
  };

  // Send Chat Message
  const handleSendChatMessage = (textToSend?: string) => {
    const text = (textToSend || inputChatText).trim();
    if (!text) return;

    const newMsg: TeacherChatMessage = {
      id: `chat-${Date.now()}`,
      sender: 'TEACHER',
      studentId: activeChatStudentId,
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputChatText('');
  };

  // ── AI COPILOT HANDLERS ──────────────────────────────────────────────────

  // AI Handler 1: Daily Class Briefing
  const handleGenerateClassBriefing = async () => {
    setIsGeneratingClassBriefing(true);
    try {
      const feverStudent = students.find((s) => s.care.temperature >= 37.8);
      const res = await fetch('/api/education/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_copilot',
          question: `Tóm tắt nhanh tình hình lớp Mầm A1: Sĩ số ${headcountStats.presentCount}/${headcountStats.totalEnrolled} bé đi học, 1 bé vắng có phép, ${feverStudent ? `có bé ${feverStudent.fullName} sốt nhẹ ${feverStudent.care.temperature}°C lúc 11:30 đã được chườm ấm` : 'các bé sức khỏe tốt'}, 23/25 bé ăn hết suất trưa, 24 bé ngủ trưa trọn giấc. Chuẩn bị bàn giao ca chiều.`,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: { answer?: string } };
        if (json.data?.answer) {
          setClassBriefingText(String(json.data.answer));
        }
      } else {
        setClassBriefingText(
          `Báo cáo tổng hợp Lớp Mầm A1: Hôm nay lớp có ${headcountStats.presentCount}/${headcountStats.totalEnrolled} trẻ đi học ngoan. Có 1 trẻ (bé Minh An) sốt nhẹ 37.8°C đã được cô chườm ấm và theo dõi sát. Bữa trưa 23/25 trẻ ăn hết suất. Các bé ngủ trưa ngon giấc và sẵn sàng cho giờ đón trẻ buổi chiều.`
        );
      }
    } catch {
      setClassBriefingText(
        `Báo cáo tổng hợp Lớp Mầm A1: Hôm nay lớp có ${headcountStats.presentCount}/${headcountStats.totalEnrolled} trẻ đi học ngoan. Có 1 trẻ (bé Minh An) sốt nhẹ 37.8°C đã được cô chườm ấm và theo dõi sát. Bữa trưa 23/25 trẻ ăn hết suất. Các bé ngủ trưa ngon giấc và sẵn sàng cho giờ đón trẻ buổi chiều.`
      );
    } finally {
      setIsGeneratingClassBriefing(false);
    }
  };

  // AI Handler 2: Allergy Safety Scanner
  const handleScanAllergies = async () => {
    setIsScanningAllergies(true);
    try {
      const dishes = TODAY_MENU_ITEMS.map((item) => item.dishName);
      const res = await fetch('/api/education/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_allergy',
          menuDishes: dishes,
          childAllergens: ['tôm', 'hải sản', 'cua', 'đậu phộng', 'trứng gà'],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: { conflictingDishes?: Array<{ dish: string; allergen: string }> } };
        const conflicts = json.data?.conflictingDishes || [];
        setAllergyScanResults({
          safe: conflicts.length === 0,
          conflictingCount: conflicts.length,
          warnings: conflicts.map((c) => `Món "${c.dish}" có chứa thành phần "${c.allergen}"`),
          details: [
            {
              studentName: 'Bé Đặng Đăng Khôi (STU-003)',
              dish: 'Tôm rim thịt',
              allergen: 'Tôm / Hải sản',
            },
          ],
        });
      }
    } catch {
      setAllergyScanResults({
        safe: false,
        conflictingCount: 1,
        warnings: ['Món "Tôm rim thịt" có chứa thành phần "tôm"'],
        details: [
          {
            studentName: 'Bé Đặng Đăng Khôi (STU-003)',
            dish: 'Tôm rim thịt',
            allergen: 'Tôm / Hải sản',
          },
        ],
      });
    } finally {
      setIsScanningAllergies(false);
    }
  };

  // AI Handler 3: Student Daily Digest
  const handleGenerateStudentDigest = async (studentId: string) => {
    const student = students.find((s) => s.id === studentId) || students[0];
    setIsGeneratingDigest(true);
    try {
      const res = await fetch('/api/education/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_digest',
          studentName: student.fullName,
          attendanceStatus: student.attendance,
          mealFeedback: student.care.lunchStatus,
          napFeedback: student.care.napQuality,
          activityNotes: 'vẽ tranh vườn hoa cùng bạn và tích cực phát biểu',
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: { digestText?: string } };
        if (json.data?.digestText) {
          setGeneratedDigestText(String(json.data.digestText));
        }
      } else {
        setGeneratedDigestText(
          `Dạ chào ba mẹ! Hôm nay ${student.fullName} đến lớp rất vui vẻ. Bữa trưa bé ${student.care.lunchStatus} và giấc trưa ${student.care.napQuality}. Trong giờ sinh hoạt, bé tích cực tương tác cùng các bạn. Cô chúc ${student.fullName} và gia đình có một buổi tối thật ấm áp ạ! ❤️`
        );
      }
    } catch {
      setGeneratedDigestText(
        `Dạ chào ba mẹ! Hôm nay ${student.fullName} đến lớp rất vui vẻ. Bữa trưa bé ${student.care.lunchStatus} và giấc trưa ${student.care.napQuality}. Trong giờ sinh hoạt, bé tích cực tương tác cùng các bạn. Cô chúc ${student.fullName} và gia đình có một buổi tối thật ấm áp ạ! ❤️`
      );
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  // AI Handler 4: Pedagogical Q&A
  const handleSendCopilotQuestion = async (presetQuestion?: string) => {
    const question = (presetQuestion || copilotQuestionInput).trim();
    if (!question) return;

    const userMsgId = `U-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      sender: 'user' as const,
      text: question,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setCopilotQnAMessages((prev) => [...prev, userMsg]);
    setCopilotQuestionInput('');
    setIsCopilotAsking(true);

    try {
      const res = await fetch('/api/education/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_copilot',
          question,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: { answer?: string } };
        const answerText = json.data?.answer || 'Dạ em đã ghi nhận câu hỏi của cô. Em khuyên cô theo dõi sát tình trạng của trẻ và trao đổi cùng phụ huynh khi cần thiết ạ.';
        setCopilotQnAMessages((prev) => [
          ...prev,
          {
            id: `C-${Date.now()}`,
            sender: 'copilot',
            text: String(answerText),
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setCopilotQnAMessages((prev) => [
          ...prev,
          {
            id: `C-${Date.now()}`,
            sender: 'copilot',
            text: 'Khi trẻ sốt: Nếu >= 37.8°C, cô nên chườm khăn ấm ở trán, nách, bẹn và cho trẻ uống nhiều nước ấm. Nếu >= 38.5°C, cần liên hệ phụ huynh ngay và chuyển trẻ về phòng y tế trường theo dõi.',
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch {
      setCopilotQnAMessages((prev) => [
        ...prev,
        {
          id: `C-${Date.now()}`,
          sender: 'copilot',
          text: 'Dạ hệ thống AI đang ở chế độ dự phòng ngoại tuyến. Cô hãy kiểm tra trực tiếp nhiệt độ cơ thể của trẻ và thông báo cho nhân viên y tế trường nhé!',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsCopilotAsking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 md:pb-12">
      {/* ── TOP HEADER & HOMEROOM PERSONA SELECTOR ───────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0c513f] text-white shadow-md border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left: Back & Teacher Profile */}
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/education"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center shrink-0"
                title="Quay lại Dashboard Tổng quan"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="relative">
                <img
                  src={currentTeacher.avatarUrl}
                  alt={currentTeacher.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-emerald-300/40 shadow-sm"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-[#0c513f] rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base md:text-lg text-white leading-tight">
                    {currentTeacher.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                    {currentTeacher.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-100/80 mt-0.5">
                  <span className="font-medium text-emerald-200">{currentTeacher.className}</span>
                  <span>•</span>
                  <span>{currentTeacher.gradeName}</span>
                </div>
              </div>
            </div>

            {/* Right: Switch Homeroom Teacher & PWA Status */}
            <div className="flex items-center gap-2.5 self-end md:self-center">
              {/* Teacher Persona Switcher */}
              <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/10 text-xs">
                <span className="text-emerald-200 px-2 font-medium hidden sm:inline">Tài khoản GVCN:</span>
                <PreschoolSelect
                  aria-label="Tài khoản GVCN"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  wrapperClassName="min-w-[180px]"
                  className="py-1 px-2.5 text-xs font-semibold bg-[#075548] text-white border-emerald-600/50"
                >
                  {HOMEROOM_TEACHERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.className}
                    </option>
                  ))}
                </PreschoolSelect>
              </div>

              {/* PWA Badge Indicator */}
              <div
                className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-800/60 border border-emerald-500/30 text-emerald-100 text-xs font-medium"
                title="Ứng dụng PWA đã sẵn sàng trên màn hình cảm ứng iPad & Điện thoại"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>PWA Ready</span>
              </div>

              {/* Quick Link to Parent Portal Preview */}
              <Link
                href="/dashboard/education/communication"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-xs transition-colors shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Cấp Link Phụ Huynh</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── RESPONSIVE NAVIGATION TABS ─────────────────────────────────── */}
        <div className="border-t border-emerald-800/80 bg-[#075548]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1.5 text-xs font-medium">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'overview'
                    ? 'bg-white text-emerald-900 font-bold shadow-sm'
                    : 'text-emerald-100/90 hover:bg-white/10'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Tổng quan Lớp</span>
              </button>

              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'attendance'
                    ? 'bg-white text-emerald-900 font-bold shadow-sm'
                    : 'text-emerald-100/90 hover:bg-white/10'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Điểm danh &amp; Thân nhiệt</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-700 text-emerald-100 font-bold">
                  {headcountStats.presentCount}/{headcountStats.totalEnrolled}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('daily-care')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'daily-care'
                    ? 'bg-white text-emerald-900 font-bold shadow-sm'
                    : 'text-emerald-100/90 hover:bg-white/10'
                }`}
              >
                <Heart className="w-4 h-4" />
                <span>Chăm sóc &amp; Thể trạng</span>
              </button>

              <button
                onClick={() => setActiveTab('timetable')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'timetable'
                    ? 'bg-white text-emerald-900 font-bold shadow-sm'
                    : 'text-emerald-100/90 hover:bg-white/10'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Thời khóa biểu</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>

              <button
                onClick={() => setActiveTab('menu')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'menu'
                    ? 'bg-white text-emerald-900 font-bold shadow-sm'
                    : 'text-emerald-100/90 hover:bg-white/10'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Thực đơn Dinh dưỡng</span>
              </button>

              <button
                onClick={() => setActiveTab('handover')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'handover'
                    ? 'bg-white text-emerald-900 font-bold shadow-sm'
                    : 'text-emerald-100/90 hover:bg-white/10'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Bàn giao Đón trẻ</span>
                {headcountStats.handedOverCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 text-emerald-900 font-bold">
                    {headcountStats.handedOverCount} đã đón
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'chat'
                    ? 'bg-white text-emerald-900 font-bold shadow-sm'
                    : 'text-emerald-100/90 hover:bg-white/10'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Trao đổi Phụ huynh</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  2
                </span>
              </button>

              <button
                onClick={() => setActiveTab('copilot')}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'copilot'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-amber-300 hover:bg-white/10'
                }`}
              >
                <Bot className="w-4 h-4 text-amber-300" />
                <span>Trợ lý AI Copilot</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-200 border border-amber-400/50 font-black animate-pulse">
                  AI
                </span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT WORKSPACE ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ── TOP HEADCOUNT & CLASS CAPACITY STATS BAR ──────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {/* Card 1: Tổng sĩ số & Dung lượng */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Sĩ số lớp</span>
              <Baby className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{headcountStats.totalEnrolled}</span>
              <span className="text-xs text-slate-500">/ {currentTeacher.maxCapacity} bé</span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{ width: `${headcountStats.capacityRate}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Dung lượng {headcountStats.capacityRate}%
            </span>
          </div>

          {/* Card 2: Có mặt hôm nay */}
          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
            <div className="flex items-center justify-between text-emerald-700 text-xs mb-1 font-medium">
              <span>Hiện diện</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700">{headcountStats.presentCount}</span>
              <span className="text-xs text-emerald-600 font-medium">bé</span>
            </div>
            <span className="text-[11px] text-emerald-600 mt-2 block font-medium">
              Đạt {headcountStats.attendanceRate}% sĩ số
            </span>
          </div>

          {/* Card 3: Vắng mặt */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Vắng mặt</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-600">{headcountStats.absentCount}</span>
              <span className="text-xs text-slate-500">bé</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 block">1 phép · 0 không phép</span>
          </div>

          {/* Card 4: Đi muộn */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Đi muộn</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-600">{headcountStats.lateCount}</span>
              <span className="text-xs text-slate-500">bé</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 block">Đón muộn sau 08:00</span>
          </div>

          {/* Card 5: Đã bàn giao đón trẻ */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Đã trả bé</span>
              <UserCheck className="w-4 h-4 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-sky-600">{headcountStats.handedOverCount}</span>
              <span className="text-xs text-slate-500">/ {headcountStats.presentCount + headcountStats.lateCount} bé</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 block">Giờ trả 16:30 - 17:30</span>
          </div>

          {/* Card 6: Đội ngũ chăm sóc */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Giáo viên / Trẻ</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-indigo-700">3 cô</span>
              <span className="text-xs text-indigo-600">/ lớp</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 block truncate">
              {currentTeacher.assistantTeacherName}
            </span>
          </div>
        </div>

        {/* ── TAB 1: TỔNG QUAN LỚP HỌC (OVERVIEW) ─────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Class Banner & Quick Actions */}
            <div className="bg-gradient-to-r from-emerald-800 to-[#075548] rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                  Năm học 2026 - 2027 • Học kỳ 1
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                  Chào buổi sáng, {currentTeacher.name}!
                </h1>
                <p className="text-emerald-100/90 text-sm mt-1 leading-relaxed">
                  Lớp hiện tại đang trong giờ hoạt động nhận thức buổi sáng. Toàn bộ{' '}
                  <strong className="text-white">{headcountStats.presentCount} bé</strong> có mặt đều có thân nhiệt
                  bình thường và sức khỏe ổn định.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="px-4 py-2 rounded-xl bg-white text-emerald-900 font-bold text-xs hover:bg-emerald-50 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Cập nhật Điểm danh</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('daily-care')}
                    className="px-4 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors border border-emerald-500/30 flex items-center gap-1.5"
                  >
                    <Heart className="w-4 h-4 text-rose-300" />
                    <span>Ghi nhận Bữa ăn &amp; Giấc ngủ</span>
                  </button>
                </div>
              </div>
              <div className="absolute right-4 -bottom-6 w-56 h-56 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Quick Class Roster Grid */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Danh sách học sinh lớp {currentTeacher.className}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bấm vào tên hoặc avatar bé để xem <strong>Hồ sơ Học Sinh 360</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm tên bé, nick name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-60"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all bg-white relative group"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setSelectedStudentFor360(student)}
                        className="relative shrink-0 focus:outline-none"
                      >
                        <img
                          src={student.avatarUrl}
                          alt={student.fullName}
                          className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-100 group-hover:ring-emerald-400 transition-all"
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                            student.attendance === 'PRESENT'
                              ? 'bg-emerald-500'
                              : student.attendance === 'LATE'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setSelectedStudentFor360(student)}
                            className="font-bold text-sm text-slate-900 hover:text-emerald-700 truncate text-left"
                          >
                            {student.fullName}
                          </button>
                          <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                            {student.nickName}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>{student.code}</span>
                          <span>•</span>
                          <span>{student.ageMonths} tháng</span>
                        </div>

                        {/* Health & Allergies Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-emerald-600" />
                            {student.care.temperature}°C
                          </span>
                          {student.allergies.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Dị ứng
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              Khỏe mạnh
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="border-t border-slate-100 mt-3 pt-2.5 flex items-center justify-between text-xs">
                      <div className="text-slate-500 text-[11px]">
                        {student.attendance === 'PRESENT' ? (
                          <span className="text-emerald-600 font-medium">Đến lớp {student.arrivalTime}</span>
                        ) : student.attendance === 'LATE' ? (
                          <span className="text-amber-600 font-medium">Đi muộn {student.arrivalTime}</span>
                        ) : (
                          <span className="text-rose-600 font-medium">Vắng mặt</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveChatStudentId(student.id);
                            setActiveTab('chat');
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Nhắn tin với phụ huynh"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedStudentFor360(student)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-medium text-[11px] transition-colors flex items-center gap-1"
                        >
                          <span>Hồ sơ 360</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: ĐIỂM DANH & ĐO THÂN NHIỆT (ATTENDANCE) ────────────────── */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Bảng Điểm Danh &amp; Đo Thân Nhiệt Sáng ({new Date().toLocaleDateString('vi-VN')})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thực hiện điểm danh và kiểm tra thân nhiệt đầu ngày khi đón bé tại cửa lớp.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkMarkAllPresent}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Điểm danh tất cả Có Mặt</span>
                  </button>
                </div>
              </div>

              {/* Roster Attendance Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                      <th className="py-3 px-3 font-semibold">Học sinh</th>
                      <th className="py-3 px-3 font-semibold">Trạng thái Điểm danh</th>
                      <th className="py-3 px-3 font-semibold">Giờ đến &amp; Người đưa</th>
                      <th className="py-3 px-3 font-semibold">Thân nhiệt (°C)</th>
                      <th className="py-3 px-3 font-semibold">Tình trạng buổi sáng</th>
                      <th className="py-3 px-3 font-semibold text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={student.avatarUrl}
                              alt={student.fullName}
                              className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{student.fullName}</span>
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 rounded">
                                  {student.nickName}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">{student.code}</div>
                            </div>
                          </div>
                        </td>

                        {/* Attendance Toggle Buttons */}
                        <td className="py-3 px-3">
                          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                            <button
                              onClick={() => handleToggleAttendance(student.id, 'PRESENT')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                student.attendance === 'PRESENT'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Có mặt
                            </button>
                            <button
                              onClick={() => handleToggleAttendance(student.id, 'LATE')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                student.attendance === 'LATE'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Đi muộn
                            </button>
                            <button
                              onClick={() => handleToggleAttendance(student.id, 'ABSENT')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                student.attendance === 'ABSENT'
                                  ? 'bg-rose-500 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Vắng
                            </button>
                          </div>
                        </td>

                        {/* Arrival Info */}
                        <td className="py-3 px-3 text-slate-600">
                          {student.attendance !== 'ABSENT' ? (
                            <div>
                              <div className="font-semibold text-slate-800">{student.arrivalTime || '07:35'}</div>
                              <div className="text-[11px] text-slate-400">{student.arrivalCheckedBy || 'Phụ huynh'}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Không đến lớp</span>
                          )}
                        </td>

                        {/* Temperature Input */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.1"
                              value={student.care.temperature}
                              onChange={(e) => handleUpdateTemperature(student.id, parseFloat(e.target.value) || 36.5)}
                              className={`w-16 px-2 py-1 rounded-lg border text-center font-bold text-xs focus:outline-none focus:ring-1 ${
                                student.care.temperature >= 37.5
                                  ? 'border-rose-400 bg-rose-50 text-rose-700 ring-rose-200'
                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
                              }`}
                            />
                            {student.care.temperature >= 37.5 && (
                              <span className="text-rose-600 font-bold text-[10px] bg-rose-100 px-1.5 py-0.5 rounded">
                                Sốt nhẹ
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Morning Condition */}
                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                          {student.care.morningCondition}
                        </td>

                        {/* Action Link */}
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedStudentFor360(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: CHĂM SÓC & THỂ TRẠNG (DAILY CARE & NAP & MEALS) ──────── */}
        {activeTab === 'daily-care' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Daily Care Progress Summary */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm md:col-span-1 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Tiến trình Chăm sóc hôm nay</span>
                </h3>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Bữa sáng &amp; Bữa trưa</span>
                    <span className="text-emerald-700">100% hoàn thành</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full w-full" />
                  </div>
                  <p className="text-[11px] text-slate-500">Toàn bộ 20 bé có mặt đã ăn hết khẩu phần dinh dưỡng.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Giấc ngủ trưa (11:30 - 14:00)</span>
                    <span className="text-sky-700">Đang diễn ra</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-sky-500 h-2 rounded-full w-3/4" />
                  </div>
                  <p className="text-[11px] text-slate-500">Cô Mai &amp; Cô Linh đang túc trực theo dõi nhiệt độ phòng ngủ.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Lưu ý Dị ứng &amp; Thuốc</span>
                  </div>
                  <ul className="text-[11px] text-amber-900 space-y-1 list-disc pl-4">
                    <li>Bé Minh Khôi: Dị ứng tôm biển (Kiểm tra bữa chiều).</li>
                    <li>Bé Gia Huy: Đã uống 5ml siro ho lúc 11:30.</li>
                  </ul>
                </div>
              </div>

              {/* Individual Student Daily Care Cards */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Nhật ký Chăm sóc chi tiết từng bé</h3>
                  <span className="text-xs text-slate-500">Dữ liệu đồng bộ trực tiếp lên Cổng Phụ Huynh</span>
                </div>

                <div className="space-y-3">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="p-3.5 rounded-2xl border border-slate-100 hover:border-emerald-200 bg-slate-50/40 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={student.avatarUrl}
                          alt={student.fullName}
                          className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span>{student.fullName}</span>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 rounded">
                              {student.nickName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>Chiều cao: {student.physical.heightCm} cm</span>
                            <span>•</span>
                            <span>Cân nặng: {student.physical.weightKg} kg</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-medium">{student.physical.whoStatus}</span>
                          </div>
                        </div>
                      </div>

                      {/* Care Indicators */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{student.care.lunchStatus}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <Moon className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{student.care.napQuality}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <Droplets className="w-3.5 h-3.5 text-sky-600" />
                          <span>{student.care.waterGlasses} cốc</span>
                        </div>
                        <button
                          onClick={() => setSelectedStudentFor360(student)}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold"
                        >
                          Cập nhật
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: THỜI KHÓA BIỂU & CHU TRÌNH SINH HOẠT (TIMETABLE) ─────── */}
        {activeTab === 'timetable' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Chu Trình Sinh Hoạt &amp; Thời Khóa Biểu — {currentTeacher.className}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khung thời gian biểu chuẩn hóa theo Phương pháp Giáo dục Mầm non chất lượng cao.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Thời gian hiện tại: 13:15 (Giờ ngủ trưa)</span>
                </div>
              </div>

              {/* Timeline Flow */}
              <div className="relative pl-6 sm:pl-8 border-l-2 border-emerald-100 space-y-6">
                {TIMETABLE_SLOTS.map((slot) => (
                  <div key={slot.id} className="relative group">
                    {/* Timeline Node */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                        slot.isCurrent ? 'bg-emerald-600 ring-4 ring-emerald-100 scale-110' : 'bg-slate-300'
                      }`}
                    >
                      {slot.isCurrent && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>

                    <div
                      className={`p-4 rounded-2xl border transition-all ${
                        slot.isCurrent
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`font-black text-xs px-2.5 py-1 rounded-lg ${
                              slot.isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {slot.timeRange}
                          </span>
                          <h3 className="font-bold text-sm text-slate-900">{slot.title}</h3>
                          {slot.isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider animate-pulse">
                              Đang diễn ra
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/60 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                          {slot.domainArea}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{slot.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: THỰC ĐƠN DINH DƯỠNG (NUTRITION MENU) ──────────────────── */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Thực Đơn Dinh Dưỡng Tuần 42 (19/10 - 24/10/2026)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thực đơn được Chuyên gia Dinh dưỡng Nhi khoa phê duyệt, đảm bảo 680 - 720 Kcal/ngày.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Hôm nay: Thứ Ba, 20/10/2026
                  </span>
                </div>
              </div>

              {/* Today's Dishes Detail */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {TODAY_MENU_ITEMS.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-emerald-800 uppercase tracking-wide">
                          {item.mealType}
                        </span>
                        <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {item.caloriesKcal} kcal
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 leading-snug">{item.dishName}</p>
                    </div>

                    {item.allergenWarning && (
                      <div className="mt-3 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-medium flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span>{item.allergenWarning}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Classroom Allergies Watchlist */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Danh sách Cảnh báo Dị ứng Thực phẩm trong lớp</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">Nguyễn Minh Khôi (Bơ)</span>
                      <p className="text-[11px] text-rose-600 font-semibold mt-0.5">Dị ứng Tôm &amp; Hải sản có vỏ</p>
                    </div>
                    <span className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">Nghiêm ngặt</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">Lê Gia Huy (Sóc)</span>
                      <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Dị ứng Sữa bò tươi (Lactose)</p>
                    </div>
                    <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">Thay sữa hạt</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: BÀN GIAO ĐÓN TRẺ (PICKUP HANDOVER) ────────────────────── */}
        {activeTab === 'handover' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Cổng Bàn Giao &amp; Trả Trẻ Buổi Chiều (16:30 - 17:30)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Xác nhận danh tính người đón được ủy quyền của phụ huynh trước khi bàn giao trẻ ra về.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Đã bàn giao:{' '}
                    <strong className="text-emerald-700 font-black">
                      {headcountStats.handedOverCount} / {headcountStats.presentCount} bé
                    </strong>
                  </span>
                </div>
              </div>

              {/* Handover Student Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students
                  .filter((s) => s.attendance !== 'ABSENT')
                  .map((student) => (
                    <div
                      key={student.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        student.isHandedOver
                          ? 'bg-slate-50 border-slate-200 opacity-80'
                          : 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={student.avatarUrl}
                          alt={student.fullName}
                          className="w-12 h-12 rounded-2xl object-cover ring-1 ring-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 truncate">{student.fullName}</span>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {student.nickName}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1">
                            Người được ủy quyền đón:
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {student.guardians.map((g) => (
                                <span
                                  key={g.id}
                                  className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 font-medium"
                                >
                                  {g.relation}: {g.name} ({g.phone})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Handover Action or State */}
                      <div className="border-t border-slate-100 mt-3 pt-2.5 flex items-center justify-between">
                        {student.isHandedOver ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Đã đón lúc {student.handedOverAt} ({student.handedOverTo})</span>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-amber-600 font-medium">Đang ở lớp chờ đón</span>
                            <button
                              onClick={() => {
                                setConfirmHandoverStudent(student);
                                setSelectedGuardianToHandover(student.guardians[0]?.name || '');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#0c513f] hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Xác nhận Bàn giao</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 7: TRAO ĐỔI PHỤ HUYNH (DIRECT CHAT) ──────────────────────── */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-[560px]">
            {/* Left: Parent Contacts List */}
            <div className="border-r border-slate-200 p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-slate-900">Hộp thư Phụ huynh</h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {students.length} học sinh
                </span>
              </div>

              <div className="space-y-1.5 overflow-y-auto max-h-[460px]">
                {students.map((student) => {
                  const isSelected = student.id === activeChatStudentId;
                  const primaryGuardian = student.guardians[0];
                  return (
                    <button
                      key={student.id}
                      onClick={() => setActiveChatStudentId(student.id)}
                      className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-[#0c513f] text-white shadow-sm'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <img
                        src={student.avatarUrl}
                        alt={student.fullName}
                        className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-slate-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {student.fullName}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 rounded ${
                              isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {student.nickName}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? 'text-emerald-100/80' : 'text-slate-400'
                          }`}
                        >
                          PH: {primaryGuardian?.name} ({primaryGuardian?.relation})
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Two-Way Direct Conversation Box */}
            <div className="md:col-span-2 flex flex-col justify-between p-4 sm:p-6 bg-white">
              {/* Chat Header */}
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={activeChatStudent.avatarUrl}
                    alt={activeChatStudent.fullName}
                    className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <span>Phụ huynh bé {activeChatStudent.fullName} ({activeChatStudent.nickName})</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Người giám hộ: {activeChatStudent.guardians[0]?.name} • SĐT: {activeChatStudent.guardians[0]?.phone}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudentFor360(activeChatStudent)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Xem Hồ sơ 360</span>
                </button>
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[300px]">
                {activeChatList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                    <MessageSquare className="w-8 h-8 text-slate-300 mb-1" />
                    <span>Chưa có tin nhắn nào hôm nay</span>
                  </div>
                ) : (
                  activeChatList.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === 'TEACHER' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === 'TEACHER'
                            ? 'bg-[#0c513f] text-white rounded-tr-none'
                            : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Template Replies */}
              <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-slate-100 text-[11px]">
                <span className="text-slate-400 shrink-0 font-medium">Mẫu nhanh:</span>
                <button
                  onClick={() => handleSendChatMessage('Dạ hôm nay con ăn hết phần cơm và ngủ trưa rất ngoan ba mẹ nhé!')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 shrink-0 transition-colors"
                >
                  Bé ăn ngoan &amp; ngủ tốt
                </button>
                <button
                  onClick={() => handleSendChatMessage('Dạ cô đã cho bé uống thuốc đúng giờ và đo lại thân nhiệt cho con rồi ạ.')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 transition-colors"
                >
                  Đã uống thuốc đúng giờ
                </button>
                <button
                  onClick={() => handleSendChatMessage('Chiều nay ba mẹ đón bé nhớ mang thêm áo ấm dự phòng cho con nha.')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 transition-colors"
                >
                  Dặn mang áo ấm
                </button>
              </div>

              {/* Chat Input Bar */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Nhắn tin cho phụ huynh bé ${activeChatStudent.nickName}...`}
                  value={inputChatText}
                  onChange={(e) => setInputChatText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChatMessage();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={() => handleSendChatMessage()}
                  className="p-2.5 rounded-2xl bg-[#0c513f] hover:bg-emerald-700 text-white transition-colors flex items-center justify-center shrink-0 shadow-sm"
                  title="Gửi tin nhắn"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 8: TRỢ LÝ AI COPILOT (HOMEROOM AI COPILOT) ────────────────── */}
        {activeTab === 'copilot' && (
          <div className="space-y-6 animate-fade-in">
            {/* Copilot Header Banner */}
            <div className="rounded-3xl bg-gradient-to-r from-[#0c513f] via-emerald-800 to-teal-900 text-white p-6 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-semibold backdrop-blur-sm border border-emerald-400/30">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>Bella Preschool AI Copilot • Multimodal Assistant</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight">
                    Trợ lý Giáo viên Mầm non Thông minh
                  </h2>
                  <p className="text-xs text-emerald-100/90 max-w-2xl">
                    Tự động hóa tóm tắt ngày học, phát hiện xung đột dị ứng thực đơn theo thời gian thực và hỗ trợ cô giáo phản hồi phụ huynh chuẩn mực sư phạm.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-full bg-white/10 text-[11px] font-medium border border-white/20 backdrop-blur-md">
                    🔒 PII Masking Protected
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-[11px] font-semibold border border-amber-300/30">
                    ⚡ Gemini Flash Active
                  </span>
                </div>
              </div>
            </div>

            {/* 3 Core Copilot Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Action 1: Class Daily Briefing */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Báo cáo Nhanh Lớp học</h3>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Tự động
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Tổng hợp sĩ số ({headcountStats.presentCount}/{headcountStats.totalEnrolled}), thân nhiệt, tình trạng ăn ngủ trong ngày để chuẩn bị giao ca chiều.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleGenerateClassBriefing}
                    disabled={isGeneratingClassBriefing}
                    className="w-full py-2.5 px-4 rounded-2xl bg-[#0c513f] hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingClassBriefing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    )}
                    <span>{isGeneratingClassBriefing ? 'AI Đang tổng hợp...' : 'Tạo Báo cáo Nhanh'}</span>
                  </button>

                  {classBriefingText && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 border-b border-slate-200/60 pb-1.5">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Bản tóm tắt ngày {new Date().toLocaleDateString('vi-VN')}
                        </span>
                        <button
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText(classBriefingText);
                            }
                            setCopyFeedbackText('Đã sao chép báo cáo lớp!');
                            setTimeout(() => setCopyFeedbackText(null), 2500);
                          }}
                          className="text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                          title="Sao chép"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </button>
                      </div>
                      <p className="leading-relaxed whitespace-pre-line text-slate-800 font-normal">
                        {classBriefingText}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action 2: Allergy Safety Scanner */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Quét An Toàn Dị Ứng</h3>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Bảo vệ Trẻ
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Đối chiếu thực đơn 3 bữa hôm nay với danh sách dị ứng của {students.length} bé trong lớp để ngăn ngừa sốc phản vệ.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleScanAllergies}
                    disabled={isScanningAllergies}
                    className="w-full py-2.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isScanningAllergies ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>{isScanningAllergies ? 'Đang kiểm tra an toàn...' : 'Quét Thực Đơn Hôm Nay'}</span>
                  </button>

                  {allergyScanResults && (
                    <div
                      className={`p-3.5 rounded-2xl border text-xs space-y-2 animate-fade-in ${
                        allergyScanResults.safe
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50/70 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {allergyScanResults.safe ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>100% Thực đơn an toàn cho toàn bộ trẻ!</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Phát hiện {allergyScanResults.conflictingCount} nguy cơ dị ứng cần lưu ý:</span>
                          </>
                        )}
                      </div>
                      {allergyScanResults.details.map((detail, idx) => (
                        <div key={idx} className="p-2 rounded-xl bg-white/80 border border-rose-200/80 text-[11px] space-y-0.5">
                          <p className="font-semibold text-rose-800">{detail.studentName}</p>
                          <p className="text-slate-600">
                            Món: <span className="font-medium text-slate-900">{detail.dish}</span> • Dị ứng: <span className="text-rose-600 font-semibold">{detail.allergen}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action 3: Student Daily Digest */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                        <Heart className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Soạn Nhật Ký Bé Gửi Bố Mẹ</h3>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                      Gắn kết
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Tạo thông điệp ân cần, cá nhân hóa tổng kết ngày học (ăn, ngủ, vui chơi) để gửi phụ huynh qua Zalo / Chat.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <PreschoolSelect
                      aria-label="Chọn bé tóm tắt"
                      value={selectedStudentForDigest}
                      onChange={(e) => setSelectedStudentForDigest(e.target.value)}
                      wrapperClassName="w-full flex-1"
                      className="py-2 text-xs font-semibold"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} ({s.nickName})
                        </option>
                      ))}
                    </PreschoolSelect>
                  </div>

                  <button
                    onClick={() => handleGenerateStudentDigest(selectedStudentForDigest)}
                    disabled={isGeneratingDigest}
                    className="w-full py-2.5 px-4 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingDigest ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    )}
                    <span>{isGeneratingDigest ? 'Đang tạo nhật ký...' : 'Soạn Nhật Ký Cho Bé'}</span>
                  </button>

                  {generatedDigestText && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-teal-800 border-b border-slate-200/60 pb-1">
                        <span>Nội dung gửi phụ huynh:</span>
                        <button
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText(generatedDigestText);
                            }
                            setCopyFeedbackText('Đã sao chép nhật ký gửi phụ huynh!');
                            setTimeout(() => setCopyFeedbackText(null), 2500);
                          }}
                          className="text-slate-500 hover:text-teal-700 flex items-center gap-1 transition-colors"
                          title="Sao chép"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </button>
                      </div>
                      <p className="leading-relaxed text-slate-800 italic">
                        &quot;{generatedDigestText}&quot;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Copy Feedback Toast */}
            {copyFeedbackText && (
              <div className="fixed bottom-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{copyFeedbackText}</span>
              </div>
            )}

            {/* Pedagogical Q&A Chat Section */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Bot className="w-5 h-5 text-[#0c513f]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>Tư vấn Sư phạm &amp; Tình huống Trẻ Mầm non</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Copilot Live
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Hỏi nhanh cách xử lý khi trẻ biếng ăn, khóc quấy, xung đột đồ chơi hoặc giải tỏa căng thẳng cho cô giáo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Stream */}
              <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto bg-slate-50/30">
                {copilotQnAMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-end gap-2 max-w-[85%]">
                      {msg.sender === 'copilot' && (
                        <div className="w-7 h-7 rounded-xl bg-[#0c513f] text-white flex items-center justify-center shrink-0 mb-1">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-[#0c513f] text-white rounded-tr-none shadow-sm'
                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/80 shadow-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                  </div>
                ))}

                {isCopilotAsking && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
                    <Bot className="w-4 h-4 text-emerald-600" />
                    <span>Copilot đang suy nghĩ câu trả lời sư phạm chuẩn mực...</span>
                  </div>
                )}
              </div>

              {/* Prompt Suggestions */}
              <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Gợi ý hỏi:
                </span>
                <button
                  onClick={() => handleSendCopilotQuestion('Bé 3 tuổi khóc đòi mẹ lúc ngủ trưa thì cô nên dỗ thế nào?')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs shrink-0 transition-colors"
                >
                  Bé khóc đòi mẹ lúc ngủ trưa
                </button>
                <button
                  onClick={() => handleSendCopilotQuestion('Hướng dẫn cô xử lý sư phạm khi 2 bé giành đồ chơi và cắn bạn')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs shrink-0 transition-colors"
                >
                  Xử lý khi trẻ cắn bạn
                </button>
                <button
                  onClick={() => handleSendCopilotQuestion('Cách cô nhắn tin nhắc khéo phụ huynh hay đón con muộn sau 17h30')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs shrink-0 transition-colors"
                >
                  Nhắc phụ huynh đón con muộn
                </button>
              </div>

              {/* Input Bar */}
              <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Đặt câu hỏi sư phạm cho AI Copilot (VD: bài tập vận động nhẹ trước giờ ăn cho trẻ 4 tuổi)..."
                  value={copilotQuestionInput}
                  onChange={(e) => setCopilotQuestionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendCopilotQuestion();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={() => handleSendCopilotQuestion()}
                  disabled={isCopilotAsking || !copilotQuestionInput.trim()}
                  className="p-2.5 rounded-2xl bg-[#0c513f] hover:bg-emerald-700 text-white transition-colors flex items-center justify-center shrink-0 shadow-sm disabled:opacity-50"
                  title="Gửi câu hỏi"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL: HỒ SƠ HỌC SINH 360 (CHILD 360 DOSSIER) ────────────────── */}
      {selectedStudentFor360 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6">
            {/* Dossier Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedStudentFor360.avatarUrl}
                  alt={selectedStudentFor360.fullName}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-300/60"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{selectedStudentFor360.fullName}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      Tên ở nhà: {selectedStudentFor360.nickName}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>Mã học sinh: {selectedStudentFor360.code}</span>
                    <span>•</span>
                    <span>Sinh ngày: {selectedStudentFor360.dob} ({selectedStudentFor360.ageMonths} tháng tuổi)</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentFor360(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Body: 3 Pillars */}
            <div className="space-y-4 text-xs">
              {/* Pillar 1: Health & Physical Development */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-3">
                <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-700" />
                  <span>Thể trạng &amp; Chỉ số Tăng trưởng Chuẩn WHO</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Chiều cao</span>
                    <span className="text-base font-extrabold text-slate-800">{selectedStudentFor360.physical.heightCm} cm</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Cân nặng</span>
                    <span className="text-base font-extrabold text-slate-800">{selectedStudentFor360.physical.weightKg} kg</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Chỉ số BMI</span>
                    <span className="text-base font-extrabold text-slate-800">{selectedStudentFor360.physical.bmi}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-100/60 border border-emerald-200">
                    <span className="text-emerald-700 text-[10px] block">Đánh giá</span>
                    <span className="text-xs font-bold text-emerald-900">{selectedStudentFor360.physical.whoStatus}</span>
                  </div>
                </div>

                {/* Allergies Notice */}
                {selectedStudentFor360.allergies.length > 0 ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Tiền sử dị ứng:</strong> {selectedStudentFor360.allergies.join(', ')}
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Bé không có tiền sử dị ứng thực phẩm hoặc thuốc.</span>
                  </div>
                )}
              </div>

              {/* Pillar 2: Authorized Guardians List */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Danh sách Người Giám Hộ &amp; Đón Trẻ Hợp Pháp</span>
                </h4>
                <div className="space-y-2">
                  {selectedStudentFor360.guardians.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{g.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {g.relation}
                          </span>
                          {g.isPrimary && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Liên hệ chính
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Số điện thoại: {g.phone}</div>
                      </div>
                      <a
                        href={`tel:${g.phone.replace(/\s+/g, '')}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Gọi điện</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pillar 3: Educational Development Evaluation */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Đánh giá 5 Lĩnh vực Phát triển Mầm non</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="font-bold text-slate-800">1. Phát triển Thể chất:</span>
                    <p className="text-slate-500 mt-0.5">Vận động thô tốt, chạy nhảy hoạt bát, tự xúc ăn sạch sẽ.</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="font-bold text-slate-800">2. Phát triển Nhận thức:</span>
                    <p className="text-slate-500 mt-0.5">Phân biệt được 5 màu sắc cơ bản và xếp các khối gỗ chuẩn.</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="font-bold text-slate-800">3. Phát triển Ngôn ngữ:</span>
                    <p className="text-slate-500 mt-0.5">Nói câu trọn vẹn, diễn đạt rõ ràng nhu cầu của mình.</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="font-bold text-slate-800">4. Tình cảm &amp; Kỹ năng xã hội:</span>
                    <p className="text-slate-500 mt-0.5">Biết chia sẻ đồ chơi cùng bạn, chào hỏi lễ phép.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dossier Footer */}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedStudentFor360(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Đóng hồ sơ
              </button>
              <button
                onClick={() => {
                  setActiveChatStudentId(selectedStudentFor360.id);
                  setActiveTab('chat');
                  setSelectedStudentFor360(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#0c513f] hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Nhắn tin với Phụ huynh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: XÁC NHẬN BÀN GIAO ĐÓN TRẺ ──────────────────────────────── */}
      {confirmHandoverStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-base text-slate-900">Xác nhận Bàn Giao Trả Trẻ</h3>
              </div>
              <button
                onClick={() => setConfirmHandoverStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center gap-3">
                <img
                  src={confirmHandoverStudent.avatarUrl}
                  alt={confirmHandoverStudent.fullName}
                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200"
                />
                <div>
                  <div className="font-bold text-sm text-slate-900">{confirmHandoverStudent.fullName}</div>
                  <div className="text-slate-500">
                    Biệt danh: <strong>{confirmHandoverStudent.nickName}</strong> • Lớp:{' '}
                    {currentTeacher.className}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Chọn Người đón trẻ:</label>
                <PreschoolSelect
                  aria-label="Chọn Người đón trẻ"
                  value={selectedGuardianToHandover}
                  onChange={(e) => setSelectedGuardianToHandover(e.target.value)}
                  className="py-2 text-xs font-semibold"
                >
                  {confirmHandoverStudent.guardians.map((g) => (
                    <option key={g.id} value={`${g.relation}: ${g.name}`}>
                      {g.relation}: {g.name} ({g.phone})
                    </option>
                  ))}
                </PreschoolSelect>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Ghi chú dặn dò phụ huynh (nếu có):</label>
                <input
                  type="text"
                  placeholder="Vd: Bé ăn hết cơm, dặn mẹ cho uống nước ấm..."
                  value={handoverNote}
                  onChange={(e) => setHandoverNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Giáo viên kiểm tra nhận diện khuôn mặt và xác thực với phụ huynh trước khi cho bé về.</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmHandoverStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteHandover}
                className="px-4 py-2 rounded-xl bg-[#0c513f] hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Hoàn tất Bàn giao</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING AI COPILOT QUICK LAUNCH BUTTON ─────────────────────── */}
      <button
        onClick={() => {
          setActiveTab('copilot');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        className={`fixed bottom-6 right-6 z-40 p-3.5 rounded-full shadow-2xl transition-all duration-300 flex items-center gap-2.5 ${
          activeTab === 'copilot'
            ? 'bg-amber-500 hover:bg-amber-600 text-white ring-4 ring-amber-300/40'
            : 'bg-gradient-to-r from-[#0c513f] to-emerald-700 hover:from-emerald-800 hover:to-teal-800 text-white ring-4 ring-emerald-300/30 hover:scale-105'
        }`}
        title="Mở Trợ lý AI Copilot"
      >
        <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
        <span className="text-xs font-bold tracking-wide pr-1">AI Copilot</span>
      </button>
    </div>
  );
}

