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
  Megaphone,
  Headphones,
  Bell,
  GraduationCap,
  Award,
  Smile,
  FileText,
} from 'lucide-react';
import type {
  ParentPortalPayload,
  ParentPortalAnnouncement,
  ParentPortalChatMessage,
  ParentPortalWeeklyMenuDay,
} from '@/products/bella-education/parent-portal/domain/parent-portal.types';

type PortalLegacyPayload = ParentPortalPayload & { readonly announcements: readonly ParentPortalAnnouncement[] };
type PortalTab = 'daily' | 'menu' | 'timetable' | 'tuition' | 'chat';
type DailyTab = 'overview' | 'teachers' | 'attendance' | 'care' | 'menu' | 'tuition' | 'chat';

const QUICK_MESSAGES = [
  'Hôm nay bé hơi ho, nhờ cô cho bé uống nước ấm nhiều nhé.',
  'Chiều nay 16:30 bà ngoại sẽ đến đón bé, nhờ cô hỗ trợ.',
  'Bé vừa khỏi ốm, nhờ cô chú ý giúp mẹ nếu bé mệt ạ.',
  'Mẹ có để thêm 1 bộ quần áo dự phòng trong balo của bé.',
];


// --- Preschoool Parent Portal Helpers & Illustrations (Matching Demo UI) ---

function PreschoolLogoIcon() {
  return (
    <svg viewBox="0 0 44 44" className="w-10 h-10 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="17" r="7.5" fill="#F59E0B" />
      <path d="M22 4V7" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M31.2 7.8L29.1 9.9" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M35 17H32" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12.8 7.8L14.9 9.9" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 17H12" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 28V19" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="16" r="2" fill="white" />
      <path d="M22 36C22 29 11 25 11 25C11 25 11 34 22 36Z" fill="#10B981" />
      <path d="M22 36C22 29 33 25 33 25C33 25 33 34 22 36Z" fill="#059669" />
      <path d="M22 36V26" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PreschoolHeroIllustration() {
  return (
    <svg viewBox="0 0 160 110" className="w-36 h-28 shrink-0 overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rolling green hills background */}
      <path d="M-10 105 C30 85, 120 85, 170 105 L170 110 L-10 110 Z" fill="#86EFAC" fillOpacity="0.35" />
      <path d="M5 106 C50 92, 110 92, 155 106 L155 110 L5 110 Z" fill="#4ADE80" fillOpacity="0.4" />

      {/* Sun with smiling face */}
      <g transform="translate(15, 12)">
        <circle cx="20" cy="20" r="13" fill="#FEF08A" />
        <circle cx="20" cy="20" r="10" fill="#FDE047" />
        <path d="M20 3V6M20 34V37M3 20H6M34 20H37M8 8L10 10M30 30L32 32M8 32L10 30M30 8L32 10" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="18" r="1.3" fill="#92400E" />
        <circle cx="24" cy="18" r="1.3" fill="#92400E" />
        <path d="M17 22C18.5 24 21.5 24 23 22" stroke="#92400E" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="14" cy="20" r="1.5" fill="#F87171" fillOpacity="0.5" />
        <circle cx="26" cy="20" r="1.5" fill="#F87171" fillOpacity="0.5" />
      </g>

      {/* Soft puffy clouds */}
      <g opacity="0.85">
        <path d="M6 38 C6 34, 11 31, 15 33 C18 29, 26 29, 29 33 C33 31, 38 35, 36 39 C38 43, 33 46, 29 45 C26 48, 17 48, 14 45 C10 46, 6 42, 6 38 Z" fill="white" />
        <path d="M125 18 C125 15, 129 13, 132 14 C134 11, 140 11, 143 14 C146 12, 150 15, 148 18 C150 21, 146 23, 143 22 C140 25, 133 25, 131 22 C127 23, 125 20, 125 18 Z" fill="white" fillOpacity="0.9" />
      </g>

      {/* Flanking Trees & Bushes */}
      <ellipse cx="60" cy="85" rx="12" ry="14" fill="#86EFAC" />
      <ellipse cx="58" cy="83" rx="9" ry="11" fill="#4ADE80" />
      <rect x="58" y="94" width="4" height="12" rx="1" fill="#B45309" />

      <ellipse cx="142" cy="80" rx="14" ry="16" fill="#86EFAC" />
      <ellipse cx="144" cy="78" rx="11" ry="13" fill="#4ADE80" />
      <rect x="141" y="92" width="4" height="14" rx="1" fill="#B45309" />

      <circle cx="68" cy="98" r="8" fill="#34D399" />
      <circle cx="73" cy="99" r="6" fill="#10B981" />
      <circle cx="132" cy="98" r="8" fill="#34D399" />
      <circle cx="127" cy="99" r="6" fill="#10B981" />

      {/* Schoolhouse Building */}
      <rect x="72" y="60" width="56" height="42" rx="3" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1" />
      <path d="M68 62 L100 38 L132 62 Z" fill="#FB923C" />
      <path d="M72 61 L100 40 L128 61 Z" fill="#F97316" fillOpacity="0.4" />

      {/* Cupola / Clock Tower */}
      <rect x="94" y="24" width="12" height="15" rx="1.5" fill="#FEF3C7" />
      <path d="M92 24 L100 16 L108 24 Z" fill="#EA580C" />
      <line x1="100" y1="16" x2="100" y2="7" stroke="#94A3B8" strokeWidth="1.5" />
      <path d="M100 8 C104 7, 107 10, 112 8 L112 14 C107 16, 104 13, 100 14 Z" fill="#EF4444" />
      <circle cx="100" cy="31" r="3" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="0.8" />

      {/* Upper Windows */}
      <g fill="#BAE6FD" stroke="#38BDF8" strokeWidth="0.8">
        <rect x="78" y="66" width="7" height="10" rx="3" />
        <rect x="96.5" y="66" width="7" height="10" rx="3" />
        <rect x="115" y="66" width="7" height="10" rx="3" />
      </g>

      {/* Lower Arched Door */}
      <path d="M95 102 V88 C95 85 105 85 105 88 V102 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1" />
      <circle cx="103" cy="95" r="0.8" fill="white" />

      {/* Lower Left & Right Windows */}
      <rect x="78" y="84" width="8" height="9" rx="1.5" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="0.8" />
      <rect x="114" y="84" width="8" height="9" rx="1.5" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="0.8" />

      {/* Ground line */}
      <rect x="64" y="102" width="72" height="2" rx="1" fill="#FBBF24" fillOpacity="0.5" />
    </svg>
  );
}

function EmptyAnnouncementsGraphic() {
  return (
    <div className="flex flex-col items-center justify-center py-2">
      <svg viewBox="0 0 90 80" className="w-20 h-18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="18" y="12" width="46" height="58" rx="8" fill="#F0F9FF" />
        <rect x="22" y="10" width="42" height="56" rx="6" fill="#E0F2FE" stroke="#BAE6FD" strokeWidth="1.5" />
        <path d="M52 10 L64 22 H54 C53 22 52 21 52 20 V10 Z" fill="#BAE6FD" stroke="#93C5FD" strokeWidth="1" />
        <rect x="29" y="24" width="20" height="2.5" rx="1.25" fill="#93C5FD" />
        <rect x="29" y="32" width="28" height="2.5" rx="1.25" fill="#93C5FD" />
        <rect x="29" y="40" width="24" height="2.5" rx="1.25" fill="#93C5FD" />
        <rect x="29" y="48" width="16" height="2.5" rx="1.25" fill="#93C5FD" />

        <g transform="translate(46, 38)">
          <circle cx="16" cy="16" r="16" fill="#FEF3C7" fillOpacity="0.7" />
          <path d="M16 6 C13 6 10 9 10 15 C10 18 8 20 7 21 C6 22 7 23 8 23 H24 C25 23 26 22 25 21 C24 20 22 18 22 15 C22 9 19 6 16 6 Z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.2" />
          <ellipse cx="16" cy="23" rx="8" ry="1.5" fill="#D97706" />
          <circle cx="16" cy="24.5" r="2" fill="#B45309" />
          <circle cx="16" cy="5" r="1.5" fill="#F59E0B" />
          <path d="M4 14 C3 16 3 19 4 21" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M28 14 C29 16 29 19 28 21" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

function FaintSchoolIcon() {
  return (
    <svg viewBox="0 0 60 50" className="w-14 h-12 shrink-0 opacity-45" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="40" height="28" rx="2" fill="#93C5FD" />
      <path d="M6 21 L30 6 L54 21 Z" fill="#60A5FA" />
      <rect x="26" y="2" width="8" height="8" rx="1" fill="#93C5FD" />
      <path d="M30 2 V-2" stroke="#60A5FA" strokeWidth="1.5" />
      <path d="M30 -2 L36 0 L30 2 Z" fill="#F87171" />
      <rect x="16" y="25" width="6" height="8" rx="1" fill="white" />
      <rect x="38" y="25" width="6" height="8" rx="1" fill="white" />
      <path d="M26 48 V36 C26 34 34 34 34 36 V48 Z" fill="white" />
    </svg>
  );
}

function formatSchoolDay(dayStr: string): string {
  if (!dayStr) return '';
  const parts = dayStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dayStr;
}

// --- Male / Female detection for guardian role ---------------------------------
const MALE_LAST_NAMES_VI = new Set([
  'quang', 'tuấn', 'tuan', 'hùng', 'hung', 'dũng', 'dung', 'huy', 'nam', 'long',
  'phong', 'khoa', 'khánh', 'khanh', 'thịnh', 'thinh', 'minh', 'thành', 'thanh',
  'hải', 'hai', 'bình', 'binh', 'mạnh', 'manh', 'cường', 'cuong', 'khôi', 'khoi',
  'đức', 'duc', 'trung', 'kiên', 'kien', 'toàn', 'toan', 'vinh', 'vĩnh',
  'hoàng', 'hoang', 'phúc', 'phuc', 'sơn', 'son', 'tân', 'tan', 'nhân', 'nhan',
]);

function getGuardianRole(guardianName: string): { role: string; vocative: string } {
  if (!guardianName) return { role: 'Phụ huynh', vocative: 'phụ huynh' };
  const lower = guardianName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const words = lower.trim().split(/\s+/);
  const lastName = words[words.length - 1];
  if (MALE_LAST_NAMES_VI.has(lastName)) return { role: 'Ba', vocative: 'ba' };
  return { role: 'Mẹ', vocative: 'mẹ' };
}

function toNonAccentUpper(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toUpperCase();
}

function getChildShortName(fullName: string): string {
  if (!fullName) return 'bé';
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] || fullName;
}

// --- Class–teacher lookup map (seeded from teacher_assignments DB) -------------
interface ClassTeacherProfile {
  readonly name: string;
  readonly shortName: string;
  readonly initial: string;
  readonly phone?: string;
  readonly exp: string;
  readonly note: string;
  readonly roleTitle?: string;
}
interface ClassTeacherInfo {
  readonly room: string;
  readonly leadTeacher: ClassTeacherProfile;
  readonly nannyTeacher: ClassTeacherProfile;
  readonly assistantTeacher: ClassTeacherProfile;
}

function _normalizeClassCode(s: string): string {
  return (s || '').toLowerCase().replace(/[-_\s]/g, '');
}

function getClassTeacherInfo(courseCode: string, courseTitle: string): ClassTeacherInfo {
  const code = _normalizeClassCode(courseCode);
  const title = (courseTitle || '').toLowerCase();

  if (code === 'choi2' || title.includes('chồi 2') || title.includes('thỏ ngọc')) {
    return {
      room: 'Phòng 104 — Tầng 1',
      leadTeacher: { name: 'Cô Trần Ngọc Anh', shortName: 'Cô Ngọc Anh', initial: 'A', phone: '0912 345 678', exp: '8 năm kinh nghiệm giáo dục mầm non', note: 'Phụ trách quản lý học tập, rèn luyện nề nếp sinh hoạt và là cầu nối chính trao đổi hàng ngày cùng phụ huynh bé.' },
      nannyTeacher: { name: 'Cô Dương Diễm My', shortName: 'Cô Diễm My', initial: 'M', phone: '0934 567 890', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chuyên viên Chăm sóc & Dinh dưỡng', note: 'Chăm sóc từng cữ ăn, giấc ngủ, vệ sinh cá nhân và đồng hành theo dõi sự an toàn của trẻ trong suốt ngày học.' },
      assistantTeacher: { name: 'Cô Vũ Thị Thảo', shortName: 'Cô Thảo', initial: 'T', roleTitle: 'GV Phụ tá', exp: 'Giáo viên Âm nhạc & Vận động', note: 'Hỗ trợ tổ chức hoạt động ngoài trời, rèn luyện kỹ năng vận động và các tiết học năng khiếu sáng tạo.' },
    };
  }
  if (code === 'choi1' || title.includes('chồi 1') || title.includes('sóc nhí')) {
    return {
      room: 'Phòng 103 — Tầng 1',
      leadTeacher: { name: 'Cô Phạm Thu Hương', shortName: 'Cô Hương', initial: 'H', phone: '0910 789 012', exp: '7 năm kinh nghiệm giảng dạy lứa tuổi 4-5 tuổi', note: 'Tập trung phát triển ngôn ngữ biểu đạt, khả năng tương tác xã hội và sáng tạo nghệ thuật.' },
      nannyTeacher: { name: 'Cô Đoàn Ngọc Trâm', shortName: 'Cô Trâm', initial: 'T', phone: '0914 556 677', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chuyên viên Dinh dưỡng học đường', note: 'Theo dõi chặt chẽ khẩu phần ăn, rèn luyện bé thói quen tự xúc ăn và uống đủ nước.' },
      assistantTeacher: { name: 'Cô Dương Diễm My', shortName: 'Cô My', initial: 'M', roleTitle: 'GV Phụ tá', exp: 'Giáo viên Âm nhạc & Múa', note: 'Dẫn dắt các bài thể dục nhịp điệu buổi sáng và tiết biểu diễn văn nghệ.' },
    };
  }
  if (code === 'mamnon2' || code === 'mam2' || title.includes('mầm non 2') || title.includes('sơn ca')) {
    return {
      room: 'Phòng 102 — Tầng 1',
      leadTeacher: { name: 'Cô Lê Minh Tâm', shortName: 'Cô Tâm', initial: 'T', phone: '0905 234 567', exp: '7 năm kinh nghiệm giáo dục mầm non', note: 'Phụ trách quản lý học tập, phát triển kỹ năng ngôn ngữ và tương tác hàng ngày cùng phụ huynh.' },
      nannyTeacher: { name: 'Cô Phan Thị Tuyết', shortName: 'Cô Tuyết', initial: 'T', phone: '0908 765 432', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chuyên viên Dinh dưỡng & Vệ sinh mầm non', note: 'Chăm sóc từng bữa ăn, theo dõi giấc ngủ và đảm bảo an toàn tuyệt đối cho trẻ trong lớp.' },
      assistantTeacher: { name: 'Cô Hoàng Bích Ngọc', shortName: 'Cô Ngọc', initial: 'N', roleTitle: 'GV Phụ tá', exp: 'Giáo viên Mỹ thuật mầm non', note: 'Hướng dẫn tạo hình, vẽ tranh và các trò chơi vận động phối hợp.' },
    };
  }
  if (code === 'nhatre1' || code === 'nt1' || title.includes('nhà trẻ 1') || title.includes('gấu misa')) {
    return {
      room: 'Phòng 001 — Tầng Trệt',
      leadTeacher: { name: 'Cô Hoàng Bích Ngọc', shortName: 'Cô Ngọc', initial: 'N', phone: '0906 345 678', exp: '6 năm kinh nghiệm chăm sóc lứa tuổi nhà trẻ', note: 'Đặc biệt quan tâm chăm sóc tâm lý tiếp xúc ban đầu, rèn luyện kỹ năng vận động sớm cho bé.' },
      nannyTeacher: { name: 'Cô Đỗ Kim Yến', shortName: 'Cô Yến', initial: 'Y', phone: '0909 876 543', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chuyên viên Dinh dưỡng & Chăm sóc sơ sinh/nhà trẻ', note: 'Chăm lo dinh dưỡng các cữ cháo/sữa và giấc ngủ trưa chu đáo cho bé.' },
      assistantTeacher: { name: 'Cô Vũ Phương Thảo', shortName: 'Cô Thảo', initial: 'T', roleTitle: 'GV Phụ tá', exp: 'Cử nhân Giáo dục mầm non', note: 'Tổ chức trò chơi phát triển giác quan và âm nhạc kích thích trí não.' },
    };
  }
  if (code === 'nhatre2' || code === 'nt2' || title.includes('nhà trẻ 2') || title.includes('thỏ trắng')) {
    return {
      room: 'Phòng 002 — Tầng Trệt',
      leadTeacher: { name: 'Cô Vũ Phương Thảo', shortName: 'Cô Thảo', initial: 'T', phone: '0907 456 789', exp: '5 năm kinh nghiệm mầm non', note: 'Theo dõi sát sao từng bước phát triển đầu đời của trẻ, hướng dẫn trẻ tự lập cơ bản.' },
      nannyTeacher: { name: 'Cô Trịnh Quỳnh Nga', shortName: 'Cô Nga', initial: 'N', phone: '0911 223 344', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chăm sóc dinh dưỡng và vệ sinh chuẩn quốc gia', note: 'Tận tâm chăm chút từng bữa ăn, vệ sinh thân thể sạch sẽ và giấc ngủ êm dịu.' },
      assistantTeacher: { name: 'Cô Lâm Mỹ Duyên', shortName: 'Cô Duyên', initial: 'D', roleTitle: 'GV Phụ tá', exp: 'Giáo viên Thể chất mầm non', note: 'Đồng hành rèn luyện thể chất dẻo dai và phản xạ nhanh nhạy cho bé.' },
    };
  }
  if (code === 'la1' || title.includes('lớp lá 1') || title.includes('vàng anh')) {
    return {
      room: 'Phòng 201 — Tầng 2',
      leadTeacher: { name: 'Cô Đặng Thùy Linh', shortName: 'Cô Linh', initial: 'L', phone: '0908 567 890', exp: '9 năm kinh nghiệm chuẩn bị hành trang vào Lớp 1', note: 'Chủ nhiệm rèn luyện tư duy logic, làm quen chữ cái và số học tiền tiểu học.' },
      nannyTeacher: { name: 'Cô Lâm Mỹ Duyên', shortName: 'Cô Duyên', initial: 'D', phone: '0912 334 455', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chuyên gia Y tế & Dinh dưỡng học đường', note: 'Quản lý chế độ ăn uống khoa học và nề nếp sinh hoạt tự giác của trẻ.' },
      assistantTeacher: { name: 'Cô Võ Thanh Trúc', shortName: 'Cô Trúc', initial: 'T', roleTitle: 'GV Phụ tá', exp: 'Giáo viên Tiếng Anh mầm non', note: 'Hỗ trợ học tiếng Anh giao tiếp và các tiết học khoa học STEM nhí.' },
    };
  }
  if (code === 'la2' || title.includes('lớp lá 2') || title.includes('bồ câu')) {
    return {
      room: 'Phòng 202 — Tầng 2',
      leadTeacher: { name: 'Cô Nguyễn Bích Hạnh', shortName: 'Cô Hạnh', initial: 'H', phone: '0909 678 901', exp: '10 năm kinh nghiệm giáo dục mầm non chuẩn quốc gia', note: 'Dạy bé kỹ năng sống, chuẩn bị tâm lý tự tin và nền tảng kiến thức vững chắc vào lớp 1.' },
      nannyTeacher: { name: 'Cô Võ Thanh Trúc', shortName: 'Cô Trúc', initial: 'T', phone: '0913 445 566', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chuyên viên Chăm sóc thể chất mầm non', note: 'Đảm bảo chế độ ăn uống đủ vi chất, theo dõi chỉ số chiều cao cân nặng định kỳ.' },
      assistantTeacher: { name: 'Cô Đoàn Ngọc Trâm', shortName: 'Cô Trâm', initial: 'T', roleTitle: 'GV Phụ tá', exp: 'Giáo viên Kỹ năng mềm', note: 'Rèn luyện sự tập trung, kỹ năng lắng nghe và làm việc nhóm.' },
    };
  }
  // Default → Lớp Mầm non 1 — Họa Mi (MAM-NON-1)
  return {
    room: 'Phòng 101 — Tầng 1',
    leadTeacher: { name: 'Cô Nguyễn Thị Mai', shortName: 'Cô Mai', initial: 'M', phone: '0903 123 456', exp: '8 năm kinh nghiệm giáo dục mầm non', note: 'Phụ trách quản lý học tập, rèn luyện nề nếp sinh hoạt và là cầu nối chính trao đổi hàng ngày cùng phụ huynh bé.' },
    nannyTeacher: { name: 'Cô Bùi Thị Hồng', shortName: 'Cô Hồng', initial: 'H', phone: '0908 654 321', roleTitle: 'Cô Bảo mẫu & Chăm sóc', exp: 'Chuyên viên Chăm sóc & Dinh dưỡng', note: 'Chăm sóc từng cữ ăn, giấc ngủ, vệ sinh cá nhân và đồng hành theo dõi sự an toàn của trẻ trong suốt ngày học.' },
    assistantTeacher: { name: 'Cô Phan Thị Tuyết', shortName: 'Cô Tuyết', initial: 'T', roleTitle: 'GV Phụ tá', exp: 'Giáo viên Âm nhạc & Vận động', note: 'Hỗ trợ tổ chức hoạt động ngoài trời, rèn luyện kỹ năng vận động và các tiết học năng khiếu sáng tạo.' },
  };
}

function getGuardianGreeting(guardianName: string): string {
  if (!guardianName) return 'Xin chào phụ huynh!';
  const role = getGuardianRole(guardianName);
  const words = guardianName.trim().split(/\s+/);
  const lastName = words[words.length - 1];
  const salutation = role.role === 'Ba' ? 'anh' : role.role === 'Mẹ' ? 'chị' : 'phụ huynh';
  return `Xin chào ${salutation} ${lastName}!`;
}

function getGuardianInitials(guardianName: string): string {
  if (!guardianName) return 'PH';
  const words = guardianName.trim().split(/\s+/);
  if (words.length >= 2) {
    const first = words[0][0]?.toUpperCase() || '';
    const last = words[words.length - 1][0]?.toUpperCase() || '';
    return `${first}${last}`;
  }
  return words[0]?.slice(0, 2).toUpperCase() || 'PH';
}

function formatLastUpdated(serverTime: string): string {
  try {
    const date = new Date(serverTime);
    if (!Number.isFinite(date.getTime())) return '30/10/2026 09:41';
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date).replace(',', '');
  } catch {
    return '30/10/2026 09:41';
  }
}

const ATTENDANCE_MAP: Record<ParentPortalDailyRead['attendanceStatus'], {
  label: string;
  colorClass: string;
  description: string;
}> = {
  unmarked: {
    label: 'Chưa điểm danh',
    colorClass: 'text-amber-500',
    description: 'Nhà trường chưa ghi nhận dữ liệu điểm danh của bé trong ngày hôm nay. Thông tin sẽ được cập nhật khi có dữ liệu mới.',
  },
  present: {
    label: 'Có mặt',
    colorClass: 'text-emerald-600',
    description: 'Bé đã có mặt tại lớp an toàn hôm nay.',
  },
  absent: {
    label: 'Vắng',
    colorClass: 'text-rose-500',
    description: 'Nhà trường ghi nhận bé vắng mặt hôm nay. Phụ huynh vui lòng gửi thông báo nếu cần hỗ trợ.',
  },
  excused: {
    label: 'Có phép',
    colorClass: 'text-indigo-600',
    description: 'Bé được nhà trường xác nhận nghỉ học có phép.',
  },
};

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
  const [dailyTab, setDailyTab] = useState<DailyTab>('overview');
  const [dailyMenuDay, setDailyMenuDay] = useState<'T2' | 'T3' | 'T4' | 'T5' | 'T6'>('T6');
  const [copiedDailyField, setCopiedDailyField] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string>('T2');
  const [childImgFailed, setChildImgFailed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isNoticeHighlight, setIsNoticeHighlight] = useState(false);

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

  function handleBellClick() {
    const el = document.getElementById('school-announcements-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setIsNoticeHighlight(true);
      setTimeout(() => setIsNoticeHighlight(false), 2500);
    }
  }

  function copyDailyField(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedDailyField(label);
    setTimeout(() => setCopiedDailyField(null), 2000);
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
    const attendanceInfo = ATTENDANCE_MAP[dailyRead.attendanceStatus] || ATTENDANCE_MAP.unmarked;
    const currentTeacher = getClassTeacherInfo(dailyRead.courseCode, dailyRead.courseTitle);
    const guardianRole = getGuardianRole(dailyRead.guardianName);
    const childShortName = getChildShortName(dailyRead.childName);
    const childUpper = toNonAccentUpper(dailyRead.childName);
    const tuitionMemo = `HOCPHI ${childUpper}`;

    return (
      <div className="min-h-screen bg-[#f1f5f9] flex justify-center py-0 sm:py-6 text-slate-800 font-sans selection:bg-amber-100 selection:text-amber-900">
        <main className="w-full max-w-md bg-[#f8fafc] min-h-screen sm:min-h-0 sm:rounded-[36px] shadow-2xl sm:border border-slate-200/80 overflow-hidden flex flex-col relative pb-8">

          {/* ── SCHOOL BRAND HEADER ── */}
          <header className="px-5 pt-4 pb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PreschoolLogoIcon />
              <div>
                <p className="text-sm font-extrabold text-slate-900 leading-tight tracking-tight">
                  {dailyRead.schoolName || 'Trường Mầm non Ánh Dương'}
                </p>
                <p className="text-[11px] text-slate-400 font-normal leading-tight mt-0.5">
                  Nuôi dưỡng những ước mơ đầu tiên
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                onClick={handleBellClick}
                title="Xem thông báo nhà trường"
                className="relative p-1.5 text-slate-700 hover:text-slate-900 active:scale-95 transition-all cursor-pointer rounded-full hover:bg-slate-100"
                aria-label="Xem thông báo nhà trường"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </div>
              <div
                onClick={() => setIsUserMenuOpen(true)}
                title="Thông tin phụ huynh và học sinh"
                className="w-8 h-8 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-600 font-bold text-xs flex items-center justify-center border border-sky-200/60 shadow-2xs cursor-pointer active:scale-95 transition-all"
                aria-label="Thông tin tài khoản phụ huynh"
              >
                {getGuardianInitials(dailyRead.guardianName)}
              </div>
            </div>
          </header>

          {/* ── HERO BANNER: GREETING & CAMPUS ILLUSTRATION ── */}
          <section className="px-5 pt-3 pb-1 flex items-center justify-between gap-2 overflow-visible" aria-label="Chào đón phụ huynh">
            <div className="max-w-[58%]">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>👋</span>
                <span>{getGuardianGreeting(dailyRead.guardianName)}</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1 leading-snug">
                Đây là sổ liên lạc phụ huynh của bé tại trường.
              </p>
            </div>
            <div className="shrink-0 -mr-1">
              <PreschoolHeroIllustration />
            </div>
          </section>

          {/* ── CARD 1: CHILD PROFILE ── */}
          <section className="mx-4 mt-2 bg-white rounded-3xl p-4 shadow-xs border border-slate-100/90 flex items-center gap-3.5" aria-label="Thông tin học sinh">
            <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 ring-4 ring-slate-50 shadow-xs bg-amber-50">
              {!childImgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/images/preschool_banner_kid.png"
                  alt={dailyRead.childName}
                  onError={() => setChildImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-sky-100 text-sky-700 font-black text-xl">
                  {dailyRead.childName.charAt(0) || 'B'}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                  {dailyRead.childName}
                </h2>
                <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-600 border border-sky-100">
                  Đang học
                </span>
              </div>

              <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                {dailyRead.courseTitle}
              </p>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5 font-normal">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Ngày {formatSchoolDay(dailyRead.schoolDay)} (giờ Việt Nam)</span>
              </div>
            </div>
          </section>

{/* ── MOBILE TAB NAVIGATION FOR GUARDIAN ── */}
          <nav className="mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1" aria-label="Điều hướng sổ liên lạc">
            {[
              { id: 'overview', label: 'Hôm nay', icon: Sparkles },
              { id: 'teachers', label: 'Lớp & Cô', icon: Users },
              { id: 'attendance', label: 'Điểm danh', icon: CalendarDays },
              { id: 'care', label: 'Chăm sóc', icon: Heart },
              { id: 'menu', label: 'Thực đơn', icon: Utensils },
              { id: 'tuition', label: 'Học phí & QR', icon: CreditCard },
              { id: 'chat', label: 'Dặn cô', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = dailyTab === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setDailyTab(tab.id as DailyTab)}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs ${
                    isActive
                      ? 'bg-[#0c513f] text-white shadow-sm ring-2 ring-emerald-600/30 font-extrabold'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </div>
              );
            })}
          </nav>

          {/* ── TAB 1: OVERVIEW (HÔM NAY) ── */}
          {dailyTab === 'overview' && (
            <div className="space-y-3">
              {/* Card Điểm danh hôm nay */}
              <section className="mx-4 mt-1 bg-[#fffdf5] border border-[#fef3c7] rounded-3xl p-4 sm:p-5 shadow-2xs" aria-label="Thông tin điểm danh">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">Điểm danh hôm nay</span>
                  </div>
                  <div
                    onClick={() => setDailyTab('attendance')}
                    className="text-[11px] font-bold text-amber-700 flex items-center gap-0.5 cursor-pointer hover:underline"
                  >
                    <span>Lịch sử tuần</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="mt-3">
                  <p className={`text-xl font-black ${attendanceInfo.colorClass}`}>
                    {attendanceInfo.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {attendanceInfo.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/95 backdrop-blur-xs rounded-2xl p-3 border border-amber-100/60 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium truncate">
                        Sĩ số đang ghi danh
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1.5 pl-0.5">
                      {dailyRead.totalClassSize}
                    </p>
                  </div>

                  <div className="bg-white/95 backdrop-blur-xs rounded-2xl p-3 border border-amber-100/60 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium truncate">
                        Có mặt hôm nay
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1.5 pl-0.5">
                      {dailyRead.presentTodayCount}
                    </p>
                  </div>
                </div>
              </section>

              {/* Tóm tắt Giáo viên lớp */}
              <section className="mx-4 bg-white rounded-3xl p-4 shadow-xs border border-slate-100" aria-label="Giáo viên phụ trách">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">Giáo viên phụ trách lớp</h3>
                  </div>
                  <div
                    onClick={() => setDailyTab('teachers')}
                    className="text-[11px] font-bold text-sky-600 flex items-center gap-0.5 cursor-pointer hover:underline"
                  >
                    <span>Xem chi tiết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                        {currentTeacher.leadTeacher.initial}
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900">{currentTeacher.leadTeacher.name}</p>
                        <p className="text-[11px] text-slate-500">Giáo viên Chủ nhiệm</p>
                      </div>
                    </div>
                    {currentTeacher.leadTeacher.phone && (
                      <a
                        href={`tel:${currentTeacher.leadTeacher.phone.replace(/\s/g, '')}`}
                        className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-[11px] flex items-center gap-1 border border-emerald-200 hover:bg-emerald-100"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Gọi cô</span>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">
                        {currentTeacher.nannyTeacher.initial}
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900">{currentTeacher.nannyTeacher.name}</p>
                        <p className="text-[11px] text-slate-500">Cô Bảo mẫu &amp; Chăm sóc</p>
                      </div>
                    </div>
                    {currentTeacher.nannyTeacher.phone && (
                      <a
                        href={`tel:${currentTeacher.nannyTeacher.phone.replace(/\s/g, '')}`}
                        className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-bold text-[11px] flex items-center gap-1 border border-amber-200 hover:bg-amber-100"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Gọi cô</span>
                      </a>
                    )}
                  </div>
                </div>
              </section>

              {/* Tóm tắt Nhật ký Chăm sóc & Dinh dưỡng */}
              <section className="mx-4 bg-white rounded-3xl p-4 shadow-xs border border-slate-100" aria-label="Chăm sóc hôm nay">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Heart className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">Chăm sóc &amp; Dinh dưỡng hôm nay</h3>
                  </div>
                  <div
                    onClick={() => setDailyTab('care')}
                    className="text-[11px] font-bold text-sky-600 flex items-center gap-0.5 cursor-pointer hover:underline"
                  >
                    <span>Xem nhật ký</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-2.5">
                    <Utensils className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500">Bữa ăn</p>
                    <p className="font-extrabold text-slate-800 text-[11px] mt-0.5">Ăn hết suất</p>
                  </div>
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-2.5">
                    <Sun className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500">Ngủ trưa</p>
                    <p className="font-extrabold text-slate-800 text-[11px] mt-0.5">2h30 (Sâu giấc)</p>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500">Thân nhiệt</p>
                    <p className="font-extrabold text-slate-800 text-[11px] mt-0.5">36.6°C (Khỏe)</p>
                  </div>
                </div>
              </section>

              {/* Tóm tắt Học phí & VietQR */}
              <section className="mx-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 rounded-3xl p-4 shadow-xs border border-emerald-100/80" aria-label="Học phí">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Học phí Tháng 10/2026</h3>
                      <p className="text-[11px] text-amber-700 font-semibold">Chờ thanh toán · Hạn nộp 05/11</p>
                    </div>
                  </div>
                  <div
                    onClick={() => setDailyTab('tuition')}
                    className="px-3 py-1.5 rounded-xl bg-[#0c513f] text-white font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Mã VietQR</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-emerald-200/50">
                  <span className="text-slate-600">Số tiền cần thanh toán:</span>
                  <span className="text-sm font-black text-[#0c513f]">6.620.000 đ</span>
                </div>
              </section>
            </div>
          )}

          {/* ── TAB 2: TEACHERS (LỚP & GIÁO VIÊN PHỤ TRÁCH) ── */}
          {dailyTab === 'teachers' && (
            <div className="mx-4 mt-1 space-y-3">
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Đội ngũ sư phạm lớp
                    </span>
                    <span className="text-[11px] text-slate-400">Niên khóa 2026 - 2027</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-2">
                    {dailyRead.courseTitle} ({dailyRead.courseCode})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phòng học: {currentTeacher.room} (Khu Mầm non Ánh Dương)
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Cô chủ nhiệm */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                          {currentTeacher.leadTeacher.initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-slate-900 text-sm">{currentTeacher.leadTeacher.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              Chủ nhiệm
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{currentTeacher.leadTeacher.exp}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-indigo-50">
                      {currentTeacher.leadTeacher.note}
                    </p>
                    {currentTeacher.leadTeacher.phone && (
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-slate-500">SĐT / Zalo: {currentTeacher.leadTeacher.phone}</span>
                        <a href={`tel:${currentTeacher.leadTeacher.phone.replace(/\s/g, '')}`} className="text-indigo-700 font-bold flex items-center gap-1 hover:underline">
                          <Phone className="w-3.5 h-3.5" />
                          <span>Gọi trực tiếp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Cô bảo mẫu */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-black text-lg flex items-center justify-center shadow-xs">
                          {currentTeacher.nannyTeacher.initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-slate-900 text-sm">{currentTeacher.nannyTeacher.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Bảo mẫu
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{currentTeacher.nannyTeacher.exp}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-50">
                      {currentTeacher.nannyTeacher.note}
                    </p>
                    {currentTeacher.nannyTeacher.phone && (
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-slate-500">SĐT: {currentTeacher.nannyTeacher.phone}</span>
                        <a href={`tel:${currentTeacher.nannyTeacher.phone.replace(/\s/g, '')}`} className="text-amber-700 font-bold flex items-center gap-1 hover:underline">
                          <Phone className="w-3.5 h-3.5" />
                          <span>Gọi trực tiếp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Giáo viên phụ */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                        {currentTeacher.assistantTeacher.initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-slate-900 text-sm">{currentTeacher.assistantTeacher.name}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {currentTeacher.assistantTeacher.roleTitle ?? 'GV Phụ tá'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{currentTeacher.assistantTeacher.exp}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-emerald-50">
                      {currentTeacher.assistantTeacher.note}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: ATTENDANCE (LỊCH SỬ ĐIỂM DANH) ── */}
          {dailyTab === 'attendance' && (
            <div className="mx-4 mt-1 space-y-3">
              {/* Thẻ hôm nay */}
              <div className="bg-[#fffdf5] border border-[#fef3c7] rounded-3xl p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Hôm nay
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1.5">
                      Điểm danh: {attendanceInfo.label}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Bé đã có mặt tại lớp lúc 07:40 sáng. Tình trạng sức khỏe đầu giờ tốt, thân nhiệt 36.6°C.
                </p>
              </div>

              {/* Lịch sử tuần */}
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-emerald-600" />
                    <span>Lịch sử điểm danh tuần này</span>
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    Chuyên cần 100%
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    { day: 'Thứ 2 (26/10)', checkin: '07:45', checkout: '17:15', status: 'Có mặt', receiver: 'Mẹ đón', color: 'emerald' },
                    { day: 'Thứ 3 (27/10)', checkin: '07:48', checkout: '17:10', status: 'Có mặt', receiver: 'Ba đón', color: 'emerald' },
                    { day: 'Thứ 4 (28/10)', checkin: '07:42', checkout: '17:20', status: 'Có mặt', receiver: 'Mẹ đón', color: 'emerald' },
                    { day: 'Thứ 5 (29/10)', checkin: '07:50', checkout: '17:05', status: 'Có mặt', receiver: 'Mẹ đón', color: 'emerald' },
                    { day: 'Thứ 6 (30/10)', checkin: '07:40', checkout: 'Đang học', status: 'Có mặt', receiver: 'Tại lớp', color: 'amber' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="font-bold text-slate-800">{row.day}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Đến lớp: {row.checkin} · {row.checkout} ({row.receiver})
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                        row.color === 'emerald' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>Tổng số ngày đi học trong tháng:</span>
                  <span className="font-black text-slate-900">25 / 26 buổi (96.2%)</span>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: CARE (LỊCH SỬ CHĂM SÓC & NUÔI DƯỠNG) ── */}
          {dailyTab === 'care' && (
            <div className="mx-4 mt-1 space-y-3">
              {/* Bữa ăn 3 cữ */}
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Utensils className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">Nhật ký 3 cữ ăn trong ngày</h4>
                      <p className="text-[10px] text-slate-400">Được cập nhật sau mỗi cữ ăn của trẻ</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Ăn giỏi
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900">Bữa sáng (08:00)</span>
                        <span className="text-[10px] text-slate-500">· Phở bò Hà Nội, sữa chua Probi</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">Bé tự xúc ăn rất nhanh và ngoan, không làm rơi vãi.</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] shrink-0">
                      Hết 100%
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900">Bữa trưa (11:15)</span>
                        <span className="text-[10px] text-slate-500">· Cơm tấm sườn ram, canh cua rau đay</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">Ăn hết cơm và thịt, uống hết 1 bát canh rau mồng tơi.</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] shrink-0">
                      Hết 100%
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-sky-50/50 border border-sky-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900">Bữa xế (14:30)</span>
                        <span className="text-[10px] text-slate-500">· Chè sen long nhãn, sữa hạt óc chó</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">Uống hết hộp sữa 180ml, ăn hết phần chè sen thanh mát.</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] shrink-0">
                      Hết 100%
                    </span>
                  </div>
                </div>
              </div>

              {/* Giấc ngủ & Sức khỏe */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Sun className="w-4 h-4" />
                    <span>Giấc ngủ trưa</span>
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">11:45 - 14:15</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Thời lượng: 2 tiếng 30 phút</p>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1">Ngủ ngon, tròn giấc</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 text-rose-600 font-bold">
                    <Heart className="w-4 h-4" />
                    <span>Thân nhiệt &amp; Sức khỏe</span>
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">36.6°C (Bình thường)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Kiểm tra lúc: 07:45 sáng</p>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1">Hoạt bát, vui vẻ</p>
                  </div>
                </div>
              </div>

              {/* Vệ sinh & Bàn giao đón trẻ */}
              <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-extrabold text-slate-900">Vệ sinh &amp; An toàn đón trẻ</span>
                  <span className="text-[11px] text-slate-400">Quy trình chuẩn</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vệ sinh cá nhân:</span>
                    <span className="font-semibold text-slate-800">Rửa tay sát khuẩn 4 lần, vệ sinh 3 lần bình thường</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Khung giờ trả trẻ:</span>
                    <span className="font-semibold text-slate-800">16:30 - 17:30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Người đón đăng ký:</span>
                    <span className="font-semibold text-emerald-700">{guardianRole.role} ({dailyRead.guardianName})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trạng thái hiện tại:</span>
                    <span className="font-black text-amber-600">Đang sinh hoạt tại trường</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 5: MENU (THỰC ĐƠN TUẦN DINH DƯỠNG) ── */}
          {dailyTab === 'menu' && (
            <div className="mx-4 mt-1 space-y-3">
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Đã kiểm định dinh dưỡng
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">~1.280 Kcal/ngày</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-2">
                    Thực đơn Dinh dưỡng Tuần 43
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thực phẩm đạt chuẩn an toàn VietGAP, cân đối 4 nhóm dưỡng chất
                  </p>
                </div>

                {/* Day selector pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {[
                    { key: 'T2', label: 'T2', date: '26/10' },
                    { key: 'T3', label: 'T3', date: '27/10' },
                    { key: 'T4', label: 'T4', date: '28/10' },
                    { key: 'T5', label: 'T5', date: '29/10' },
                    { key: 'T6', label: 'T6', date: '30/10' },
                  ].map((d) => (
                    <div
                      key={d.key}
                      onClick={() => setDailyMenuDay(d.key as 'T2' | 'T3' | 'T4' | 'T5' | 'T6')}
                      role="tab"
                      tabIndex={0}
                      className={`px-3 py-2 rounded-2xl text-xs font-black shrink-0 flex flex-col items-center min-w-[58px] cursor-pointer transition ${
                        dailyMenuDay === d.key
                          ? 'bg-[#0c513f] text-white shadow-sm scale-102'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{d.label}</span>
                      <span className="text-[10px] font-medium opacity-80">{d.date}</span>
                    </div>
                  ))}
                </div>

                {/* Day meals details */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-200/50 pb-2">
                    <span className="font-extrabold text-emerald-950">
                      {dailyMenuDay === 'T2' && 'Thứ Hai (26/10)'}
                      {dailyMenuDay === 'T3' && 'Thứ Ba (27/10)'}
                      {dailyMenuDay === 'T4' && 'Thứ Tư (28/10)'}
                      {dailyMenuDay === 'T5' && 'Thứ Năm (29/10)'}
                      {dailyMenuDay === 'T6' && 'Thứ Sáu (30/10) — Hôm nay'}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-800">Năng lượng chuẩn</span>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100/70">
                      <span className="font-bold text-amber-700">🥣 Bữa sáng:</span>
                      <p className="mt-0.5 text-slate-700">
                        {dailyMenuDay === 'T2' && 'Cháo thịt nạc bằm cà rốt, sữa đậu nành Fami'}
                        {dailyMenuDay === 'T3' && 'Búp bê nui nấu tôm tươi thịt bằm, sữa hạt hạnh nhân'}
                        {dailyMenuDay === 'T4' && 'Bánh cuốn chả lụa thịt bằm mộc nhĩ, sữa bắp ngọt'}
                        {dailyMenuDay === 'T5' && 'Cháo lươn đồng nấu đậu xanh thơm bùi, yakult'}
                        {dailyMenuDay === 'T6' && 'Phở bò Hà Nội thanh ngọt, sữa chua men sống Probi'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100/70">
                      <span className="font-bold text-emerald-700">🍲 Bữa trưa:</span>
                      <p className="mt-0.5 text-slate-700">
                        {dailyMenuDay === 'T2' && 'Cơm gạo dẻo, gà rim mè mật ong, canh bí đỏ sườn non, dưa hấu'}
                        {dailyMenuDay === 'T3' && 'Cơm tấm thịt kho trứng cút, canh mướp mồng tơi tôm đất, quýt ngọt'}
                        {dailyMenuDay === 'T4' && 'Cơm trắng, cá hồi Nauy áp chảo sốt cam, canh cải bó xôi, thanh long'}
                        {dailyMenuDay === 'T5' && 'Cơm dẻo, bò xào củ quả đa sắc, canh rong biển đậu hũ non, táo tây'}
                        {dailyMenuDay === 'T6' && 'Cơm tấm sườn non ram mật ong, canh cua đồng rau đay, chuối cau tráng miệng'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100/70">
                      <span className="font-bold text-sky-700">🥛 Bữa xế:</span>
                      <p className="mt-0.5 text-slate-700">
                        {dailyMenuDay === 'T2' && 'Bánh flan caramel mềm mịn, sữa tươi tiệt trùng Vinamilk'}
                        {dailyMenuDay === 'T3' && 'Cháo yến mạch chuối tiêu, sữa tươi tiệt trùng'}
                        {dailyMenuDay === 'T4' && 'Súp bắp non gà xé nấm hương, sữa tươi hạt sen'}
                        {dailyMenuDay === 'T5' && 'Chè đậu xanh nha đam đường phèn thanh mát, sữa hạt điều'}
                        {dailyMenuDay === 'T6' && 'Chè sen long nhãn hạt chia, sữa tươi hạt óc chó 180ml'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 6: TUITION & VIETQR (HỌC PHÍ & MÃ VIETQR) ── */}
          {dailyTab === 'tuition' && (
            <div className="mx-4 mt-1 space-y-3">
              {/* Thẻ hóa đơn */}
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Học phí Tháng 10/2026
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Mã HĐ: #HP-202610-089 · Hạn nộp: 05/11/2026
                    </p>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                    Chờ thanh toán
                  </span>
                </div>

                {/* Bảng chi tiết khoản thu */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                    <span>1. Học phí chương trình Mầm non chuẩn Quốc tế</span>
                    <span className="font-bold text-slate-900">4.500.000 đ</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                    <span>2. Tiền ăn bán trú (3 bữa dinh dưỡng/ngày x 22 ngày)</span>
                    <span className="font-bold text-slate-900">1.320.000 đ</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                    <span>3. Phí cơ sở vật chất, điều hòa &amp; học cụ</span>
                    <span className="font-bold text-slate-900">350.000 đ</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                    <span>4. Lớp năng khiếu Aerobic &amp; Mỹ thuật sáng tạo</span>
                    <span className="font-bold text-slate-900">450.000 đ</span>
                  </div>

                  <div className="border-t-2 border-slate-100 pt-3 flex justify-between items-center text-sm font-black text-slate-900">
                    <span>Tổng số tiền cần thanh toán</span>
                    <span className="text-lg text-[#0c513f]">6.620.000 đ</span>
                  </div>
                </div>
              </div>

              {/* Thẻ mã VietQR động */}
              <div className="bg-gradient-to-b from-[#f0fdf4] to-white rounded-3xl p-5 shadow-xs border border-emerald-200/80 space-y-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-[#0c513f]" />
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Quét mã VietQR chuyển khoản nhanh
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Mở ứng dụng ngân hàng bất kỳ để quét mã QR. Hệ thống tự động gạch nợ sau 3-5 phút.
                </p>

                {/* QR Code Graphic Image */}
                <div className="flex justify-center py-1">
                  <div className="p-3 bg-white rounded-3xl shadow-md border-2 border-emerald-100 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://img.vietqr.io/image/MB-190365701493-compact.png?amount=6620000&addInfo=${encodeURIComponent(tuitionMemo)}&accountName=TRUONG%20MAM%20NON%20ANH%20DUONG`}
                      alt="VietQR Học phí"
                      className="w-48 h-48 object-contain mx-auto"
                    />
                  </div>
                </div>

                {/* Thông tin tài khoản chuyển khoản */}
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-slate-400">Ngân hàng:</p>
                      <p className="font-bold text-slate-800">MB Bank (Ngân hàng TMCP Quân Đội)</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400">Số tài khoản:</p>
                      <p className="font-black text-slate-900 text-sm font-mono tracking-wider">190365701493</p>
                    </div>
                    <div
                      onClick={() => copyDailyField('190365701493', 'stk')}
                      className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-slate-50 active:scale-95"
                    >
                      {copiedDailyField === 'stk' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      <span>{copiedDailyField === 'stk' ? 'Đã sao chép' : 'Sao chép'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400">Chủ tài khoản:</p>
                      <p className="font-bold text-slate-800 uppercase">TRUONG MAM NON ANH DUONG</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400">Nội dung chuyển khoản:</p>
                      <p className="font-black text-[#0c513f] font-mono">{tuitionMemo}</p>
                    </div>
                    <div
                      onClick={() => copyDailyField(tuitionMemo, 'noidung')}
                      className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-slate-50 active:scale-95"
                    >
                      {copiedDailyField === 'noidung' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      <span>{copiedDailyField === 'noidung' ? 'Đã sao chép' : 'Sao chép'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 7: CHAT & CONTACT (DẶN CÔ & LIÊN HỆ) ── */}
          {dailyTab === 'chat' && (
            <div className="mx-4 mt-1 space-y-3">
              {/* Thẻ kênh liên hệ */}
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Kết nối &amp; Dặn dò với Nhà trường
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kênh liên lạc 2 chiều giữa phụ huynh và giáo viên chủ nhiệm
                    </p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Trực tuyến" />
                </div>

                <div className="space-y-2">
                  <a
                    href={currentTeacher.leadTeacher.phone ? `tel:${currentTeacher.leadTeacher.phone.replace(/\s/g, '')}` : '#'}
                    className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-slate-800 hover:bg-indigo-100/60 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-indigo-600" />
                      <div>
                        <p className="font-bold text-slate-900 text-xs">Cô Chủ nhiệm: {currentTeacher.leadTeacher.name}</p>
                        <p className="text-[11px] text-slate-500">{currentTeacher.leadTeacher.phone ?? ''} (Zalo / Gọi điện)</p>
                      </div>
                    </div>
                    <span className="text-indigo-700 font-bold text-xs">Gọi ngay</span>
                  </a>

                  <a
                    href="tel:02873006868"
                    className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-slate-800 hover:bg-emerald-100/60 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Headphones className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="font-bold text-slate-900 text-xs">Hotline văn phòng Trường Mầm non</p>
                        <p className="text-[11px] text-slate-500">028 7300 6868 (Giờ hành chính)</p>
                      </div>
                    </div>
                    <span className="text-emerald-700 font-bold text-xs">Hỗ trợ</span>
                  </a>
                </div>

                {/* Lời dặn nhanh */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Lời dặn mẫu gửi giáo viên
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {QUICK_MESSAGES.map((msg, i) => (
                      <div
                        key={i}
                        onClick={() => copyDailyField(msg, `msg-${i}`)}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 transition cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span className="text-[11px] leading-relaxed">{msg}</span>
                        <span className="text-[10px] text-emerald-600 font-bold shrink-0">
                          {copiedDailyField === `msg-${i}` ? 'Đã sao chép' : 'Sao chép'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lịch sử tin nhắn trao đổi */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Lịch sử trao đổi hôm nay
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-2xl bg-sky-50 text-sky-950 border border-sky-100 ml-6">
                      <p className="text-[10px] font-bold text-sky-700">{guardianRole.role} ({dailyRead.guardianName}) · 07:45</p>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        Chào {currentTeacher.leadTeacher.shortName}, hôm nay {guardianRole.vocative} gửi bé hơi sớm một chút, nhờ cô cho bé ăn sáng giúp {guardianRole.vocative} nhé.
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 text-slate-800 border border-slate-100 mr-6">
                      <p className="text-[10px] font-bold text-indigo-700">{currentTeacher.leadTeacher.shortName} (Chủ nhiệm) · 07:50</p>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        Dạ vâng {guardianRole.vocative}, bé {childShortName} đã vào lớp an toàn và ăn sáng rất ngon miệng ạ! {guardianRole.role} yên tâm công tác nhé.
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 text-slate-800 border border-slate-100 mr-6">
                      <p className="text-[10px] font-bold text-indigo-700">{currentTeacher.leadTeacher.shortName} (Chủ nhiệm) · 12:00</p>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        Bé {childShortName} hôm nay ăn hết suất trưa và đã đi ngủ rất ngoan rồi {guardianRole.vocative} nhé.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CARD: SCHOOL ANNOUNCEMENTS (BẢNG TIN CHUNG) ── */}
          <section id="school-announcements-section" className={`mx-4 mt-3 bg-white rounded-3xl p-5 shadow-xs border transition-all duration-500 ${isNoticeHighlight ? 'ring-2 ring-amber-400 border-amber-300 bg-amber-50/20' : 'border-slate-100'}`} aria-label="Thông báo chung của nhà trường">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4 text-rose-500" />
                </div>
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  Thông báo chung của nhà trường
                </h2>
              </div>
              <span className="text-xs text-sky-600 font-semibold flex items-center gap-0.5 hover:underline cursor-pointer">
                Xem tất cả &gt;
              </span>
            </div>

            {dailyRead.announcements.length === 0 ? (
              <div className="mt-2 flex flex-col items-center justify-center py-2">
                <EmptyAnnouncementsGraphic />
                <p className="text-xs text-slate-400 text-center mt-1">
                  Hiện chưa có thông báo mới từ nhà trường.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {dailyRead.announcements.map((announcement) => (
                  <li key={announcement.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                      {announcement.title}
                    </h3>
                    <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600 leading-relaxed">
                      {announcement.bodyText}
                    </p>
                    <time className="mt-2.5 block text-[10px] text-slate-400 font-medium" dateTime={announcement.publishedAt}>
                      {new Date(announcement.publishedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── CARD 4: NOTICE DISCLAIMER CARD ── */}
          <div
            role="note"
            className="mx-4 mt-3 bg-[#eff6ff] border border-blue-100/80 rounded-2xl p-4 flex items-center justify-between gap-3 relative overflow-hidden"
          >
            <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs">
              <Info className="w-3.5 h-3.5" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-xs">
                Bạn đang xem sổ liên lạc trực tuyến
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Với thông tin lớp, điểm danh hôm nay và thông báo chung của nhà trường. Nhắn tin riêng, email, thông báo đẩy, nhật ký chăm sóc, bàn giao, học phí, thực đơn, thời khóa biểu và AI chưa khả dụng trong phạm vi này.
              </p>
            </div>

            <FaintSchoolIcon />
          </div>

          {/* ── CARD 5: ACTION ROW ── */}
          <div className="mx-4 mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white px-5 py-2.5 font-semibold text-xs flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tải lại thông tin</span>
            </button>

            <div className="flex items-center gap-2 text-right">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <div className="text-right leading-tight">
                <p className="text-[10px] text-slate-400">Cập nhật lần cuối:</p>
                <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  {formatLastUpdated(dailyRead.serverTime)}
                </p>
              </div>
            </div>
          </div>

          {/* ── BOTTOM HELP LINK ── */}
          <div
            onClick={() => setIsHelpModalOpen(true)}
            className="mx-4 mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 cursor-pointer hover:text-slate-800 active:scale-98 transition-all"
          >
            <Headphones className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Nếu cần hỗ trợ, vui lòng liên hệ nhà trường qua số điện thoại hoặc Zalo. &gt;</span>
          </div>

          {/* ── USER MENU MODAL (Guardian & Child Info) ── */}
          {isUserMenuOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
              onClick={() => setIsUserMenuOpen(false)}
            >
              <div
                className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 font-extrabold text-sm flex items-center justify-center border border-sky-200">
                      {getGuardianInitials(dailyRead.guardianName)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{dailyRead.guardianName}</p>
                      <p className="text-[11px] text-emerald-600 font-medium">Người giám hộ hợp pháp</p>
                    </div>
                  </div>
                  <div
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-400">Học sinh:</span><span className="font-bold text-slate-800">{dailyRead.childName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Lớp:</span><span className="font-semibold text-slate-700">{dailyRead.courseTitle} ({dailyRead.courseCode})</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Trường:</span><span className="font-semibold text-slate-700">{dailyRead.schoolName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Trạng thái:</span><span className="text-sky-600 font-bold">Đang học</span></div>
                  </div>

                  <div className="bg-sky-50/60 rounded-2xl p-3 border border-sky-100 text-[11px] text-sky-800">
                    <p className="font-semibold">Bảo mật liên kết:</p>
                    <p className="mt-0.5 text-slate-500 leading-relaxed">
                      Sổ liên lạc hoạt động theo cơ chế xác thực Magic Link an toàn dành riêng cho phụ huynh.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs cursor-pointer hover:bg-slate-800 transition"
                >
                  Đóng
                </div>
              </div>
            </div>
          )}

          {/* ── HELP & SUPPORT MODAL ── */}
          {isHelpModalOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
              onClick={() => setIsHelpModalOpen(false)}
            >
              <div
                className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Headphones className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-900">Liên hệ Nhà trường</p>
                  </div>
                  <div
                    onClick={() => setIsHelpModalOpen(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <a
                    href="tel:02873006868"
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition text-slate-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="font-bold text-slate-900">Hotline Tuyển sinh &amp; Hỗ trợ</p>
                        <p className="text-[11px] text-slate-500">028 7300 6868 (Giờ hành chính)</p>
                      </div>
                    </div>
                    <span className="text-emerald-600 font-bold text-xs">Gọi ngay</span>
                  </a>

                  <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-100 flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-sky-600" />
                      <div>
                        <p className="font-bold text-slate-900">Kênh Zalo Official</p>
                        <p className="text-[11px] text-slate-500">Mầm non Ánh Dương Care</p>
                      </div>
                    </div>
                    <span className="text-sky-600 font-bold text-xs">Kết nối</span>
                  </div>
                </div>

                <div
                  onClick={() => setIsHelpModalOpen(false)}
                  className="w-full text-center py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs cursor-pointer hover:bg-slate-800 transition"
                >
                  Đóng
                </div>
              </div>
            </div>
          )}
        </main>
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
                Khung thời gian sinh hoạt &amp; học tập
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
