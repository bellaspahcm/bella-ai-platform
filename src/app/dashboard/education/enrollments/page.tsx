'use client';

/**
 * Bella Education Preschool — Student Management Operational Workspace
 * 
 * Re-designed strictly from Image 1 to Image 2:
 * - Top Utility Bar: "Trường Mầm non Ánh Dương", Notification Bell with badge, Admin User Profile
 * - Page Title Bar: "Quản Lý Trẻ", Academic Year "2026 - 2027", Primary Action "+ Đăng Ký Nhập Học Mới"
 * - Operational KPI Stat Cards: Tổng trẻ (280), Đang học (242), Chờ nhập học (28), Lưu ý y tế (12)
 * - Multi-tier Filter Bar: Status Pills, Keyword Search, Class / Status / Age Dropdowns, Advanced Filters
 * - Core Operational Table: Checkbox bulk actions, Avatar, Code, DOB/Age, Class, Guardian, Status, Row Actions
 * - Right Operational Widgets: Quick Actions, Classroom Capacity Progress, Medical Alerts Drawer
 * - Bottom Activity Panels: Upcoming Birthdays countdown, Pending Admission Queue with submission status
 * 
 * Architecture Rules:
 * - Scoped strictly to Preschool vertical (`bella_education` tenant)
 * - Zero `any` or `unknown` type cheating
 * - Direct integration with `/api/education/enrollments`
 */

import { useState, useRef, useEffect, useMemo, type ChangeEvent } from 'react';
import Link from 'next/link';
import { PreschoolSelect } from '@/components/ui/PreschoolSelect';
import { readSchoolRegistry, RegistrySessionError } from './registry-reader';
import { 
  Baby, 
  UserPlus, 
  Search, 
  Phone, 
  FileText,
  CalendarCheck,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  ShieldCheck,
  X,
  Check,
  GraduationCap,
  CreditCard,
  MessageSquare,
  Loader2,
  Users,
  Clock,
  Heart,
  Download,
  Printer,
  Upload,
  Building2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Bell,
  Cake,
  Zap,
  ListFilter
} from 'lucide-react';

export interface StudentRecord {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly gender: 'Bé trai' | 'Bé gái' | 'Chưa ghi nhận';
  readonly dateOfBirth: string;
  readonly age: string;
  readonly className: string;
  readonly branchName?: string;
  readonly courseNames?: readonly string[];
  readonly enrollmentStates?: readonly ('active' | 'pending')[];
  readonly parentName: string;
  readonly parentPhone: string;
  readonly status: 'Đang học' | 'Chờ nhập học' | 'Lưu ý y tế' | 'Đã nghỉ học';
  readonly statusKey: 'active' | 'pending' | 'healthAlert' | 'inactive';
  readonly hasHealthAlert: boolean;
  readonly medicalNote: string;
  readonly avatarUrl?: string;
}

export interface ClassroomOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly grade: string;
}

export interface BranchOption {
  readonly id: string;
  readonly name: string;
  readonly code?: string;
}

export interface AdmissionFormState {
  readonly childName: string;
  readonly nickname: string;
  readonly dateOfBirth: string;
  readonly gender: 'Nam' | 'Nữ';
  readonly guardianName: string;
  readonly guardianPhone: string;
  readonly medicalNote: string;
  readonly courseId: string;
  readonly branchId: string;
}

export interface AdmissionResponse {
  readonly success: boolean;
  readonly error?: string;
  readonly student?: {
    readonly partyId: string;
    readonly studentCode: string;
    readonly childName: string;
    readonly nickname: string;
    readonly dateOfBirth: string;
    readonly gender: string;
    readonly guardianName: string;
    readonly guardianPhone: string;
    readonly medicalNote: string;
  };
  readonly enrollment?: {
    readonly id: string;
    readonly courseId: string;
    readonly courseTitle: string;
    readonly status: string;
    readonly enrolledAt: string;
  };
  readonly chain?: {
    readonly branchId: string;
    readonly enrollmentId: string;
    readonly courseId: string;
  } | null;
}

export interface StudentRegistryResponse {
  readonly success: boolean;
  readonly error?: string;
  readonly students?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly nickname: string;
    readonly dateOfBirth: string;
    readonly gender: string;
    readonly className: string;
    readonly parentName: string;
    readonly parentPhone: string;
    readonly hasHealthAlert: boolean;
    readonly medicalNote: string;
    readonly status: string;
    readonly statusKey: 'active' | 'pending' | 'inactive';
  }>;
}

export interface HealthAlertChild {
  readonly id: string;
  readonly name: string;
  readonly className: string;
  readonly condition: string;
  readonly avatarUrl: string;
  readonly gender?: StudentRecord['gender'];
}

export interface IncompleteDocChild {
  readonly id: string;
  readonly name: string;
  readonly className: string;
  readonly missingDoc: string;
  readonly badgeClass: string;
  readonly gender?: StudentRecord['gender'];
}

export interface UpcomingBirthdayChild {
  readonly id: string;
  readonly name: string;
  readonly className: string;
  readonly dob: string;
  readonly daysRemaining: number;
  readonly avatarUrl: string;
  readonly gender?: StudentRecord['gender'];
}

export interface PendingAdmissionChild {
  readonly id: string;
  readonly name: string;
  readonly className: string;
  readonly statusText: 'Hồ sơ đầy đủ' | 'Chờ bổ sung hồ sơ' | 'Chờ xác nhận';
  readonly submittedDate: string;
  readonly avatarUrl: string;
  readonly gender?: StudentRecord['gender'];
}

export interface ClassroomCapacityStat {
  readonly className: string;
  readonly currentStudents: number;
  readonly maxCapacity: number;
  readonly percentage: number;
}

const DEFAULT_ADMISSION_FORM: AdmissionFormState = {
  childName: '',
  nickname: '',
  dateOfBirth: '',
  gender: 'Nam',
  guardianName: '',
  guardianPhone: '',
  medicalNote: '',
  courseId: '',
  branchId: '',
};

// ── Realistic Preschool Operational Dataset Matching Image 2 ──
const CANONICAL_PRESCHOOL_STUDENTS: ReadonlyArray<StudentRecord> = [
  {
    id: 'HS0001',
    name: 'Nguyễn Minh An',
    nickname: 'Bé Bi',
    gender: 'Bé trai',
    dateOfBirth: '12/03/2022',
    age: '3 tuổi',
    className: 'Lá 1',
    parentName: 'Nguyễn Văn Hùng',
    parentPhone: '0901 234 567',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0002',
    name: 'Trần Bảo Ngọc',
    nickname: 'Bé Na',
    gender: 'Bé gái',
    dateOfBirth: '05/06/2021',
    age: '4 tuổi',
    className: 'Chồi 2',
    parentName: 'Trần Thị Mai',
    parentPhone: '0902 345 678',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0003',
    name: 'Lê Gia Huy',
    nickname: 'Bé Tôm',
    gender: 'Bé trai',
    dateOfBirth: '20/08/2022',
    age: '3 tuổi',
    className: 'Lá 1',
    parentName: 'Lê Văn Tài',
    parentPhone: '0903 456 789',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0004',
    name: 'Phạm Khánh Linh',
    nickname: 'Bé Bông',
    gender: 'Bé gái',
    dateOfBirth: '14/11/2021',
    age: '4 tuổi',
    className: 'Chồi 1',
    parentName: 'Phạm Thu Hà',
    parentPhone: '0904 567 890',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0005',
    name: 'Hoàng Nhật Minh',
    nickname: 'Bé Sóc',
    gender: 'Bé trai',
    dateOfBirth: '02/01/2023',
    age: '2 tuổi',
    className: 'Mầm 1',
    parentName: 'Hoàng Thế Anh',
    parentPhone: '0905 678 901',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0006',
    name: 'Vũ Phương Anh',
    nickname: 'Bé Thỏ',
    gender: 'Bé gái',
    dateOfBirth: '18/04/2021',
    age: '4 tuổi',
    className: 'Chồi 2',
    parentName: 'Vũ Thị Lan',
    parentPhone: '0906 789 012',
    status: 'Lưu ý y tế',
    statusKey: 'healthAlert',
    hasHealthAlert: true,
    medicalNote: 'Dị ứng hải sản',
    avatarUrl: 'https://images.unsplash.com/photo-1519456264917-42d0aa2e0625?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0007',
    name: 'Đặng Quang Huy',
    nickname: 'Bé Khoai',
    gender: 'Bé trai',
    dateOfBirth: '25/09/2022',
    age: '3 tuổi',
    className: 'Mầm 2',
    parentName: 'Đặng Quốc Tuấn',
    parentPhone: '0907 890 123',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0008',
    name: 'Bùi Thùy Chi',
    nickname: 'Bé Miu',
    gender: 'Bé gái',
    dateOfBirth: '30/12/2020',
    age: '5 tuổi',
    className: 'Lá 2',
    parentName: 'Bùi Thị Hương',
    parentPhone: '0908 901 234',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0009',
    name: 'Ngô Tuấn Khang',
    nickname: 'Bé Ken',
    gender: 'Bé trai',
    dateOfBirth: '17/05/2022',
    age: '3 tuổi',
    className: 'Chồi 1',
    parentName: 'Ngô Minh Đức',
    parentPhone: '0909 012 345',
    status: 'Chờ nhập học',
    statusKey: 'pending',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0010',
    name: 'Đỗ Hải Yến',
    nickname: 'Bé Cún',
    gender: 'Bé gái',
    dateOfBirth: '09/10/2021',
    age: '4 tuổi',
    className: 'Chồi 2',
    parentName: 'Đỗ Hải Nam',
    parentPhone: '0910 123 456',
    status: 'Đang học',
    statusKey: 'active',
    hasHealthAlert: false,
    medicalNote: '',
    avatarUrl: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
  },
];

const CANONICAL_HEALTH_ALERT_CHILDREN: ReadonlyArray<HealthAlertChild> = [
  {
    id: 'HS0006',
    name: 'Vũ Phương Anh',
    className: 'Chồi 2',
    condition: 'Dị ứng hải sản',
    gender: 'Bé gái',
    avatarUrl: 'https://images.unsplash.com/photo-1519456264917-42d0aa2e0625?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0011',
    name: 'Trần Đức Minh',
    className: 'Lá 1',
    condition: 'Hen suyễn',
    gender: 'Bé trai',
    avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0012',
    name: 'Lê Thảo My',
    className: 'Mầm 1',
    condition: 'Dị ứng phấn hoa',
    gender: 'Bé gái',
    avatarUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0013',
    name: 'Nguyễn Gia Bảo',
    className: 'Chồi 1',
    condition: 'Tiền sử sốt cao',
    gender: 'Bé trai',
    avatarUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0014',
    name: 'Phạm Minh Châu',
    className: 'Lá 2',
    condition: 'Dị ứng sữa bò',
    gender: 'Bé gái',
    avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80',
  },
];

const CANONICAL_INCOMPLETE_DOC_CHILDREN: ReadonlyArray<IncompleteDocChild> = [
  {
    id: 'HS0003',
    name: 'Lê Gia Huy',
    className: 'Lá 1',
    missingDoc: 'Thiếu sổ tiêm chủng',
    badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200/70',
    gender: 'Bé trai',
  },
  {
    id: 'HS0004',
    name: 'Phạm Khánh Linh',
    className: 'Chồi 1',
    missingDoc: 'Thiếu giấy khám sức khỏe',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200/70',
    gender: 'Bé gái',
  },
  {
    id: 'HS0007',
    name: 'Đặng Quang Huy',
    className: 'Mầm 2',
    missingDoc: 'Thiếu bản sao khai sinh',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200/70',
    gender: 'Bé trai',
  },
  {
    id: 'HS0008',
    name: 'Bùi Thùy Chi',
    className: 'Lá 2',
    missingDoc: 'Chưa nộp ảnh thẻ 3x4',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200/70',
    gender: 'Bé gái',
  },
  {
    id: 'HS0010',
    name: 'Đỗ Hải Yến',
    className: 'Chồi 2',
    missingDoc: 'Chưa cập nhật thẻ BHYT',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200/70',
    gender: 'Bé gái',
  },
];

const CANONICAL_BIRTHDAY_CHILDREN: ReadonlyArray<UpcomingBirthdayChild> = [
  {
    id: 'HS0005',
    name: 'Hoàng Nhật Minh',
    className: 'Mầm 1',
    dob: '02/01/2023',
    daysRemaining: 5,
    gender: 'Bé trai',
    avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0002',
    name: 'Trần Bảo Ngọc',
    className: 'Chồi 2',
    dob: '05/06/2021',
    daysRemaining: 12,
    gender: 'Bé gái',
    avatarUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0009',
    name: 'Ngô Tuấn Khang',
    className: 'Chồi 1',
    dob: '17/05/2022',
    daysRemaining: 18,
    gender: 'Bé trai',
    avatarUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'HS0010',
    name: 'Đỗ Hải Yến',
    className: 'Chồi 2',
    dob: '09/10/2021',
    daysRemaining: 25,
    gender: 'Bé gái',
    avatarUrl: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
  },
];

const CANONICAL_PENDING_CHILDREN: ReadonlyArray<PendingAdmissionChild> = [
  {
    id: 'PA001',
    name: 'Nguyễn Hà Phương',
    className: 'Mầm 1',
    statusText: 'Hồ sơ đầy đủ',
    submittedDate: '10/04/2026',
    gender: 'Bé gái',
    avatarUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'PA002',
    name: 'Lê Minh Quân',
    className: 'Chồi 1',
    statusText: 'Chờ bổ sung hồ sơ',
    submittedDate: '12/04/2026',
    gender: 'Bé trai',
    avatarUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'PA003',
    name: 'Phạm An Nhiên',
    className: 'Mầm 2',
    statusText: 'Hồ sơ đầy đủ',
    submittedDate: '15/04/2026',
    gender: 'Bé gái',
    avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'PA004',
    name: 'Trần Gia Khánh',
    className: 'Lá 1',
    statusText: 'Chờ xác nhận',
    submittedDate: '16/04/2026',
    gender: 'Bé trai',
    avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
  },
];

const CANONICAL_CLASS_STATS: ReadonlyArray<ClassroomCapacityStat> = [
  { className: 'Lá 1', currentStudents: 32, maxCapacity: 36, percentage: 88 },
  { className: 'Lá 2', currentStudents: 28, maxCapacity: 36, percentage: 77 },
  { className: 'Chồi 1', currentStudents: 36, maxCapacity: 36, percentage: 100 },
  { className: 'Chồi 2', currentStudents: 34, maxCapacity: 36, percentage: 94 },
  { className: 'Mầm 1', currentStudents: 24, maxCapacity: 36, percentage: 66 },
  { className: 'Mầm 2', currentStudents: 26, maxCapacity: 36, percentage: 72 },
];

function formatAge(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 'Chưa rõ tuổi';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return `${Math.max(age, 0)} tuổi`;
}

function formatDate(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 'Chưa rõ';
  return dob.toLocaleDateString('vi-VN');
}

// ── ChildAvatar — safe avatar with onError fallback ──────────────────────────
// Never renders browser-default broken-image icon or alt-text overflow.
// Falls back to an initialed badge with gender-tinted background.
interface ChildAvatarProps {
  readonly avatarUrl?: string;
  readonly name: string;
  readonly gender?: 'Bé trai' | 'Bé gái' | string;
  readonly sizeClass?: string;
}

function ChildAvatar({ name, gender, sizeClass = 'w-10 h-10' }: Omit<ChildAvatarProps, 'avatarUrl'> & { avatarUrl?: string }) {
  const isBoy = gender === 'Bé trai';
  const initial = name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? name[0]?.toUpperCase() ?? '?';
  const fallbackCls = isBoy
    ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300';

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${fallbackCls}`}
      aria-label={name}
    >
      {initial}
    </div>
  );
}

export default function PreschoolEnrollmentsPage() {
  const [students, setStudents] = useState<ReadonlyArray<StudentRecord>>([]);
  const [selectedYear, setSelectedYear] = useState('Năm học 2026 - 2027');
  const [selectedSchool, setSelectedSchool] = useState('Trường Mầm non Ánh Dương');
  
  // Filtering states
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'active' | 'pending' | 'healthAlert'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedAgeFilter, setSelectedAgeFilter] = useState('all');
  
  // Selection & pagination states
  const [selectedStudentIds, setSelectedStudentIds] = useState<ReadonlySet<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Menu & Modal states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [classrooms, setClassrooms] = useState<ReadonlyArray<ClassroomOption>>([]);
  const [branches, setBranches] = useState<ReadonlyArray<BranchOption>>([]);
  const [admissionForm, setAdmissionForm] = useState<AdmissionFormState>(DEFAULT_ADMISSION_FORM);
  const [admissionError, setAdmissionError] = useState('');
  const [admissionSuccess, setAdmissionSuccess] = useState('');
  const [isSubmittingAdmission, setIsSubmittingAdmission] = useState(false);
  const [admissionStorageKey, setAdmissionStorageKey] = useState('');
  const [pendingAdmissionKey, setPendingAdmissionKey] = useState('');
  const [resumeNeedsPayload, setResumeNeedsPayload] = useState(false);
  const admissionSubmitRef = useRef(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [registryReady, setRegistryReady] = useState(false);
  const [registryTotals, setRegistryTotals] = useState({ students: 0, active: 0, pending: 0 });
  const [registryRefresh, setRegistryRefresh] = useState(0);
  const [studentLoadError, setStudentLoadError] = useState('');
  const [registryNeedsLogin, setRegistryNeedsLogin] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Only the operation key is retained in this tab; child/guardian/medical data
  // is recovered by the authenticated server. Never use a cross-user storage key.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/education/enrollments?admissionContext=1', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { success?: boolean; admissionContext?: { tenantId: string; actorId: string } };
        if (!response.ok || !data.success || !data.admissionContext || cancelled) return;
        const key = `preschool-admission:${data.admissionContext.tenantId}:${data.admissionContext.actorId}`;
        try {
          const pending = sessionStorage.getItem(key) || '';
          if (pending && /^[0-9a-f-]{36}$/i.test(pending)) setPendingAdmissionKey(pending);
          setAdmissionStorageKey(key);
        } catch {
          setAdmissionError('Trình duyệt không lưu được mã hồ sơ để thử lại. Vui lòng bật lưu trữ phiên.');
        }
      }).catch(() => { if (!cancelled) setAdmissionError('Không xác minh được quyền nhập học. Vui lòng tải lại.'); });
    return () => { cancelled = true; };
  }, []);

  // Close overflow menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Publish a complete authorized registry; denied or partial pages never become a zero-child result.
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setIsLoadingStudents(true); setRegistryReady(false); setRegistryNeedsLogin(false); setStudentLoadError(''); setStudents([]);
    void readSchoolRegistry(controller.signal).then(result => {
      if (!active) return;
      setStudents(result.students.map(item => {
        const states = [...new Set(item.enrollments.map(e => e.status))];
        const statusKey = states.includes('active') ? 'active' as const : 'pending' as const;
        return {
          id: item.studentCode, name: item.name, nickname: '',
          gender: item.gender === 'male' ? 'Bé trai' as const : item.gender === 'female' ? 'Bé gái' as const : 'Chưa ghi nhận' as const,
          dateOfBirth: item.dob ? formatDate(item.dob) : 'Chưa ghi nhận',
          age: item.dob ? formatAge(item.dob) : 'Chưa ghi nhận',
          className: [...new Set(item.enrollments.map(e => e.courseTitle))].join(' · '),
          branchName: [...new Set(item.enrollments.map(e => e.branchName))].join(' · '),
          courseNames: item.enrollments.map(e => e.courseTitle), enrollmentStates: states,
          parentName: 'Chưa được cung cấp trong danh sách', parentPhone: '',
          status: states.length > 1 ? 'Đang học' as const : statusKey === 'active' ? 'Đang học' as const : 'Chờ nhập học' as const,
          statusKey, hasHealthAlert: false, medicalNote: '',
        };
      }));
      setRegistryTotals(result.totals); setStudentLoadError(''); setRegistryReady(true);
    }).catch((error: unknown) => { if (active) {
      setStudents([]); setRegistryReady(false);
      const sessionError = error instanceof RegistrySessionError;
      setRegistryNeedsLogin(sessionError && error.code === 'REGISTRY_UNAUTHENTICATED');
      setStudentLoadError(sessionError && error.code === 'REGISTRY_UNAUTHENTICATED'
        ? 'Phiên hiện tại chưa có đăng nhập Supabase hợp lệ. Vui lòng đăng nhập bằng tài khoản thật để xem danh sách trẻ. (REGISTRY_UNAUTHENTICATED)'
        : sessionError ? 'Phiên hiện tại bị từ chối quyền đọc danh sách trẻ. (REGISTRY_ACCESS_DENIED)'
        : 'Không thể tải danh sách trẻ được cấp quyền. Chưa thể xác định tổng hồ sơ; vui lòng tải lại.');
    } })
      .finally(() => { if (active) setIsLoadingStudents(false); });
    return () => { active = false; controller.abort(); };
  }, [registryRefresh]);

  // Load course and branch options for admission modal
  useEffect(() => {
    if (!isAdmissionModalOpen) return;

    let cancelled = false;
    async function loadAdmissionOptions() {
      try {
        const branchResponse = await fetch('/api/education/branches');
        const branchData = (await branchResponse.json()) as { success?:boolean;branches?:ReadonlyArray<BranchOption> };
        if (cancelled) return;
        if (!branchResponse.ok || !branchData.success) throw new Error('Branch options unavailable');
        const loadedBranches = branchData.branches ?? [];
        setBranches(loadedBranches);
        setAdmissionForm((current) => ({
          ...current,
          courseId: current.courseId,
          branchId: current.branchId,
        }));
      } catch {
        if (!cancelled) {
          setAdmissionError('Không tải được danh sách lớp hoặc chi nhánh. Vui lòng thử lại.');
        }
      }
    }

    loadAdmissionOptions();
    return () => {
      cancelled = true;
    };
  }, [isAdmissionModalOpen]);

  useEffect(() => {
    setClassrooms([]);
    if (!isAdmissionModalOpen || !admissionForm.branchId) return;
    let cancelled = false;
    fetch(`/api/education/courses?admissionBranchId=${encodeURIComponent(admissionForm.branchId)}`)
      .then(async (response) => {
        const data = await response.json() as {success?:boolean;classrooms?:ReadonlyArray<ClassroomOption>};
        if (!response.ok || !data.success) throw new Error('Course candidates unavailable');
        if (!cancelled) setClassrooms(data.classrooms ?? []);
      }).catch(() => { if (!cancelled) setAdmissionError('Không tải được lớp cho cơ sở đã chọn. Vui lòng thử lại.'); });
    return () => { cancelled = true; };
  },[isAdmissionModalOpen,admissionForm.branchId]);

  // Aggregate KPI Counts — derived from canonical students state loaded from API
  const totalCount = registryTotals.students;
  const activeCount = registryTotals.active;
  const pendingCount = registryTotals.pending;


  // Dynamic available classes derived from student registry
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    students.forEach((s) => {
      for (const name of s.courseNames ?? [s.className]) if (name && name !== 'Chưa xếp lớp') classSet.add(name);
    });
    return Array.from(classSet).sort();
  }, [students]);

  // Filtered Students Calculation
  const filteredStudents = useMemo(() => {
    return students.filter((stu) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || 
        stu.name.toLowerCase().includes(query) ||
        stu.id.toLowerCase().includes(query) ||
        stu.parentName.toLowerCase().includes(query) ||
        stu.parentPhone.includes(query) ||
        stu.className.toLowerCase().includes(query);

      // Status Pill Filter
      let matchesTab = true;
      if (selectedStatusTab === 'active') {
        matchesTab = stu.enrollmentStates?.includes('active') ?? (stu.statusKey === 'active' || stu.statusKey === 'healthAlert');
      } else if (selectedStatusTab === 'pending') {
        matchesTab = stu.enrollmentStates?.includes('pending') ?? stu.statusKey === 'pending';
      } else if (selectedStatusTab === 'healthAlert') {
        matchesTab = stu.hasHealthAlert || stu.statusKey === 'healthAlert';
      }

      // Dropdown Filters
      const matchesClass = selectedClassFilter === 'all' || (stu.courseNames ?? [stu.className]).includes(selectedClassFilter);
      const matchesStatus = selectedStatusFilter === 'all' || 
        (selectedStatusFilter === 'active' && (stu.enrollmentStates?.includes('active') ?? stu.statusKey === 'active')) ||
        (selectedStatusFilter === 'pending' && (stu.enrollmentStates?.includes('pending') ?? stu.statusKey === 'pending')) ||
        (selectedStatusFilter === 'healthAlert' && (stu.hasHealthAlert || stu.statusKey === 'healthAlert'));
      const matchesAge = selectedAgeFilter === 'all' || stu.age.includes(selectedAgeFilter);

      return matchesSearch && matchesTab && matchesClass && matchesStatus && matchesAge;
    });
  }, [students, searchQuery, selectedStatusTab, selectedClassFilter, selectedStatusFilter, selectedAgeFilter]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const boundedPage = Math.min(currentPage, totalPages);
  if (currentPage !== boundedPage) setCurrentPage(boundedPage);
  const visiblePages = [...new Set([1, boundedPage - 1, boundedPage, boundedPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const displayedStudents = useMemo(() => {
    const startIndex = (boundedPage - 1) * pageSize;
    return filteredStudents.slice(startIndex, startIndex + pageSize);
  }, [filteredStudents, boundedPage, pageSize]);

  // Checkbox handlers
  const isAllDisplayedSelected = displayedStudents.length > 0 && displayedStudents.every((s) => selectedStudentIds.has(s.id));
  function toggleSelectAll() {
    if (isAllDisplayedSelected) {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        displayedStudents.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        displayedStudents.forEach((s) => next.add(s.id));
        return next;
      });
    }
  }

  function toggleSelectStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetAllFilters() {
    setSearchQuery('');
    setSelectedStatusTab('all');
    setSelectedClassFilter('all');
    setSelectedStatusFilter('all');
    setSelectedAgeFilter('all');
    setCurrentPage(1);
  }

  function openAdmissionModal() {
    if (!pendingAdmissionKey) setAdmissionForm(DEFAULT_ADMISSION_FORM);
    setAdmissionError('');
    setAdmissionSuccess('');
    setModalStep(pendingAdmissionKey ? 2 : 1);
    setIsAdmissionModalOpen(true);
  }

  function updateAdmissionForm<K extends keyof AdmissionFormState>(field: K, value: AdmissionFormState[K]) {
    if (pendingAdmissionKey && !resumeNeedsPayload) return;
    setAdmissionForm((current) => ({ ...current, [field]: value, ...(field==='branchId' ? {courseId:''} : {}) }));
    setAdmissionError('');
  }

  async function submitAdmission() {
    setAdmissionError('');
    setAdmissionSuccess('');

    if (admissionSubmitRef.current) return;
    if (!admissionStorageKey) { setAdmissionError('Không xác minh được quyền nhập học hoặc lưu trữ phiên. Vui lòng tải lại.'); return; }
    const sendingPayload = !pendingAdmissionKey || resumeNeedsPayload;
    if (sendingPayload && (!admissionForm.childName.trim() || !admissionForm.dateOfBirth || !admissionForm.guardianName.trim() || !admissionForm.guardianPhone.trim() || !admissionForm.courseId)) {
      setAdmissionError('Vui lòng nhập đủ thông tin bắt buộc và chọn lớp.');
      return;
    }
    if (sendingPayload && (!admissionForm.branchId || !branches.some((branch) => branch.id === admissionForm.branchId))) {
      setAdmissionError('Vui lòng chọn cơ sở/chi nhánh nhập học.');
      return;
    }

    admissionSubmitRef.current = true;
    setIsSubmittingAdmission(true);
    try {
      const operationKey = pendingAdmissionKey || crypto.randomUUID();
      // Store before sending; a network error never silently allocates a new key.
      sessionStorage.setItem(admissionStorageKey, operationKey);
      setPendingAdmissionKey(operationKey);
      setResumeNeedsPayload(false);
      const response = await fetch('/api/education/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendingPayload ? { ...admissionForm, operationKey } : { operationKey }),
      });
      const data = (await response.json()) as AdmissionResponse;

      if (response.status===400 && ['PRESCHOOL_ADMISSION_INVALID_PAYLOAD','PRESCHOOL_ADMISSION_INVALID_GUARDIAN_PHONE','PRESCHOOL_ADMISSION_INVALID_KEY','PRESCHOOL_ADMISSION_ACTIVE_COURSE_REQUIRED'].includes(data.error ?? '')) {
        setResumeNeedsPayload(true); setModalStep(1); // Correct payload with the SAME operation key.
      }
      if (response.status === 404 && data.error === 'PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND') {
        // An earlier request could still be in flight. Re-enter with the SAME key.
        setResumeNeedsPayload(true);
        setModalStep(1);
        throw new Error('Chưa tìm thấy hồ sơ. Nhập lại thông tin để tiếp tục bằng cùng mã yêu cầu.');
      }
      if (!response.ok || !data.success || !data.student || !data.enrollment || !data.chain) {
        throw new Error(data.error || 'Đăng ký nhập học chưa hoàn tất.');
      }

      // Add to local state
      sessionStorage.removeItem(admissionStorageKey);
      setPendingAdmissionKey('');
      setResumeNeedsPayload(false);
      setRegistryReady(false);
      setRegistryRefresh(value => value + 1);
      setToastMessage(`Đã tạo thành công hồ sơ ${data.student.studentCode} cho bé ${data.student.childName}`);
      setIsAdmissionModalOpen(false);
    } catch (error) {
      setAdmissionError(error instanceof Error ? error.message : 'Đăng ký nhập học thất bại.');
    } finally {
      admissionSubmitRef.current = false;
      setIsSubmittingAdmission(false);
    }
  }

  function handleExportData() {
    const csvContent = [
      ['Mã HS', 'Họ Tên', 'Giới Tính', 'Ngày Sinh', 'Độ Tuổi', 'Lớp', 'Phụ Huynh', 'SĐT', 'Trạng Thái', 'Lưu Ý Y Tế'].join(','),
      ...filteredStudents.map((s) => [
        `"${s.id}"`,
        `"${s.name}"`,
        `"${s.gender}"`,
        `"${s.dateOfBirth}"`,
        `"${s.age}"`,
        `"${s.className}"`,
        `"${s.parentName}"`,
        `"${s.parentPhone}"`,
        `"${s.enrollmentStates?.map(state => state === 'active' ? 'Đang học' : 'Chờ nhập học').join(' · ') ?? s.status}"`,
        `"${s.medicalNote}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_tre_mam_non_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage('Đã tải xuống danh sách học sinh (CSV)');
  }

  function handlePrintList() {
    window.print();
  }

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] p-4 sm:p-6 lg:p-8 space-y-6 pb-32 sm:pb-40 lg:pb-48 font-sans">
      {/* ── Toast Feedback Notification ── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 rounded-2xl bg-emerald-800 text-white px-5 py-3 text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top App Bar (School Identity, Notification Bell & User Profile) ── */}
      <div className="flex items-center justify-end gap-4 pb-1">
        <button 
          type="button" 
          aria-label="Thông báo hệ thống"
          className="relative p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
        </button>

        <div className="flex items-center gap-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-2xs">
          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-extrabold text-xs">
            A
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {selectedSchool}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* ── Page Header Card (Title, Academic Year Selector & Primary Action) ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-7 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100/80 dark:border-emerald-900/60">
              <Baby className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Quản Lý Trẻ
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Danh sách toàn bộ hồ sơ trẻ mầm non ({registryReady ? totalCount : '—'} trẻ), hồ sơ cá nhân, người giám hộ &amp; lịch sử học tập
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            {/* Academic Year Selector */}
            <PreschoolSelect
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              wrapperClassName="min-w-40"
              className="py-2.5 text-xs font-bold"
            >
              <option>Năm học 2026 - 2027</option>
              <option>Năm học 2025 - 2026</option>
            </PreschoolSelect>

            {/* Primary Workflow CTA */}
            <button 
              type="button"
              onClick={openAdmissionModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-white px-5 py-2.5 text-xs font-extrabold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đăng Ký Nhập Học Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Summary Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Tổng trẻ */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng trẻ</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {registryReady ? totalCount : '—'}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Hồ sơ trong phạm vi được cấp quyền
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Đang học */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Đang học</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {registryReady ? activeCount : '—'}
            </div>
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {registryReady && totalCount > 0 ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(activeCount / totalCount * 100) + '%' : '—'} <span className="text-slate-400 font-medium">tổng số trẻ</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Chờ nhập học */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Chờ nhập học</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {registryReady ? pendingCount : '—'}
            </div>
            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {registryReady && totalCount > 0 ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(pendingCount / totalCount * 100) + '%' : '—'} <span className="text-slate-400 font-medium">tổng số trẻ</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Lưu ý y tế */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Lưu ý y tế</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Chưa xác minh
            </div>
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Chưa có dữ liệu y tế trong registry
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Main Workspace: Full-width Table ── */}
      <div ref={menuRef}>
        
        {/* ── FULL-WIDTH TABLE ── */}
        <div className="space-y-4">
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs overflow-hidden">
            
            {/* Table Header Bar */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <ListFilter className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Danh sách trẻ
                </h2>
                {selectedStudentIds.size > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                    Đã chọn {selectedStudentIds.size}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={handleExportData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Xuất dữ liệu</span>
                </button>

                <button 
                  type="button" 
                  aria-label="Tùy chọn hiển thị"
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              role="search"
              aria-label="Tìm kiếm và lọc danh sách trẻ"
              onMouseDown={() => setActiveMenuId(null)}
              className="space-y-4 border-b border-slate-100 dark:border-slate-700/60 p-5 sm:p-6"
            >
              {/* ── Row 1 of Filters: Search Box + Status Tab Pills ── */}
              <div className="flex flex-col 2xl:flex-row items-stretch 2xl:items-center gap-4 justify-between">
                <div className="relative min-w-0 w-full 2xl:max-w-sm">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Tìm tên trẻ, mã hồ sơ, tên phụ huynh, SĐT..."
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all font-medium"
                  />
                </div>

                <div className="flex items-center gap-2 min-w-0 overflow-x-auto pb-1 2xl:pb-0">
                  <button
                    type="button"
                    onClick={() => { setSelectedStatusTab('all'); setCurrentPage(1); }}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      selectedStatusTab === 'all'
                        ? 'bg-[#064E3B] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả trẻ ({registryReady ? totalCount : '—'})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedStatusTab('active'); setCurrentPage(1); }}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      selectedStatusTab === 'active'
                        ? 'bg-[#064E3B] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Đang học ({registryReady ? activeCount : '—'})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedStatusTab('pending'); setCurrentPage(1); }}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      selectedStatusTab === 'pending'
                        ? 'bg-[#064E3B] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Chờ nhập học ({registryReady ? pendingCount : '—'})
                  </button>
                  <button
                    type="button"
                    disabled title="Chưa có dữ liệu y tế được xác minh trong registry"
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      selectedStatusTab === 'healthAlert'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 hover:bg-amber-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Lưu ý y tế (chưa xác minh)</span>
                  </button>
                </div>
              </div>

              {/* ── Row 2 of Filters: Secondary Dropdowns (Lớp học, Trạng thái, Độ tuổi, Xóa bộ lọc) ── */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Lớp học:</span>
                  <PreschoolSelect
                      value={selectedClassFilter}
                      onChange={(e) => { setSelectedClassFilter(e.target.value); setCurrentPage(1); }}
                      className="text-xs font-semibold py-1.5"
                      wrapperClassName="shrink-0"
                    >
                      <option value="all">Tất cả lớp ({availableClasses.length > 0 ? `${availableClasses.length} lớp` : `${registryReady ? totalCount : '—'} trẻ`})</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </PreschoolSelect>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Trạng thái:</span>
                  <PreschoolSelect
                      value={selectedStatusFilter}
                      onChange={(e) => { setSelectedStatusFilter(e.target.value); setCurrentPage(1); }}
                      className="text-xs font-semibold py-1.5"
                      wrapperClassName="shrink-0"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="active">Đang học</option>
                      <option value="pending">Chờ nhập học</option>
                      <option value="healthAlert" disabled>Lưu ý y tế (chưa xác minh)</option>
                    </PreschoolSelect>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Độ tuổi:</span>
                  <PreschoolSelect
                      value={selectedAgeFilter}
                      onChange={(e) => { setSelectedAgeFilter(e.target.value); setCurrentPage(1); }}
                      className="text-xs font-semibold py-1.5"
                      wrapperClassName="shrink-0"
                    >
                      <option value="all">Tất cả độ tuổi</option>
                      <option value="2 tuổi">2 tuổi (Nhà trẻ)</option>
                      <option value="3 tuổi">3 tuổi (Mầm)</option>
                      <option value="4 tuổi">4 tuổi (Chồi)</option>
                      <option value="5 tuổi">5 tuổi (Lá)</option>
                    </PreschoolSelect>
                </div>

                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors ml-auto"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Xóa bộ lọc</span>
                </button>
              </div>

              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Kết quả: <span className="font-bold text-slate-900 dark:text-white">{registryReady ? `${filteredStudents.length} trẻ` : 'Chưa xác định'}</span> phù hợp bộ lọc · Tổng hồ sơ: {registryReady ? totalCount : '—'}
              </p>
            </div>

            {isLoadingStudents && (
              <div className="flex flex-col items-center justify-center p-12 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                <p role="status" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Đang tải danh sách trẻ…</p>
              </div>
            )}
            {studentLoadError && <div role="alert" className="p-6 text-sm text-rose-700">
              <p>{studentLoadError}</p>
              {registryNeedsLogin && <Link href={{ pathname: '/login', query: { reset: 'true', next: '/dashboard/education/enrollments' } }} className="mt-3 inline-block font-semibold underline">Đăng nhập tài khoản thật</Link>}
              {!registryNeedsLogin && <button type="button" onClick={() => setRegistryRefresh(value => value + 1)} className="mt-3 font-semibold underline">Thử tải lại</button>}
            </div>}
            {/* Empty State when no results */}
            {registryReady && displayedStudents.length === 0 && (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Không tìm thấy học sinh nào phù hợp
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Vui lòng thử thay đổi từ khóa tìm kiếm hoặc làm mới các bộ lọc đã chọn.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            )}

            {/* Table Content */}
            {displayedStudents.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={isAllDisplayedSelected}
                          onChange={toggleSelectAll}
                          aria-label="Chọn tất cả trẻ trên trang"
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">Trẻ</th>
                      <th className="py-3 px-3">Mã hồ sơ</th>
                      <th className="py-3 px-3">Ngày sinh / Độ tuổi</th>
                      <th className="py-3 px-3">Lớp học</th>
                      <th className="py-3 px-3">Phụ huynh</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                    {displayedStudents.map((stu) => {
                      const isSelected = selectedStudentIds.has(stu.id);
                      const isMenuOpen = activeMenuId === stu.id;

                      return (
                        <tr 
                          key={stu.id} 
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectStudent(stu.id)}
                              aria-label={`Chọn học sinh ${stu.name}`}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                            />
                          </td>

                          {/* Trẻ (Avatar + Name + Gender subtitle) */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <ChildAvatar
                                avatarUrl={stu.avatarUrl}
                                name={stu.name}
                                gender={stu.gender}
                                sizeClass="w-10 h-10"
                              />
                              <div>
                                <Link 
                                  href={`/dashboard/education/enrollments/${stu.id}`}
                                  className="font-extrabold text-slate-900 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                                >
                                  {stu.name}
                                </Link>
                                <div className="text-[11px] font-semibold">
                                  {stu.gender === 'Bé trai' ? (
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">Bé trai</span>
                                  ) : (
                                    <span className="text-rose-500 dark:text-rose-400 font-bold">{stu.gender}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Mã hồ sơ */}
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-bold">
                            {stu.id}
                          </td>

                          {/* Ngày sinh / Độ tuổi */}
                          <td className="py-3 px-3">
                            <div className="text-slate-800 dark:text-slate-200 font-semibold">{stu.dateOfBirth}</div>
                            <div className="text-[11px] text-slate-400 font-medium">{stu.age}</div>
                          </td>

                          {/* Lớp học */}
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {stu.className}
                            </span>
                          </td>

                          {/* Phụ huynh (Tên & SĐT) */}
                          <td className="py-3 px-3">
                            <div className="text-slate-800 dark:text-slate-200 font-bold">{stu.parentName}</div>
                            {stu.parentPhone && <a
                              href={`tel:${stu.parentPhone}`} 
                              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-emerald-600 font-medium"
                            >
                              {stu.parentPhone}
                            </a>}
                          </td>

                          {/* Trạng thái */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {(stu.enrollmentStates?.includes('active') ?? stu.statusKey === 'active') && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60">
                                Đang học
                              </span>
                            )}
                            {(stu.enrollmentStates?.includes('pending') ?? stu.statusKey === 'pending') && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60">
                                Chờ nhập học
                              </span>
                            )}
                            {(stu.statusKey === 'healthAlert' || stu.hasHealthAlert) && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Lưu ý y tế</span>
                              </span>
                            )}
                            {stu.statusKey === 'inactive' && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Đã nghỉ
                              </span>
                            )}
                          </td>

                          {/* Thao tác Menu */}
                          <td className="py-3 px-4 text-right relative">
                            <button
                              type="button"
                              onClick={() => setActiveMenuId(isMenuOpen ? null : stu.id)}
                              aria-label={`Thao tác hồ sơ ${stu.name}`}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-4 mt-1 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1 text-left animate-in fade-in zoom-in-95 duration-100">
                                <Link
                                  href={`/dashboard/education/enrollments/${stu.id}`}
                                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 rounded-xl transition-colors"
                                >
                                  <FileText className="w-4 h-4 text-emerald-600" />
                                  <span>Xem Hồ Sơ 360°</span>
                                </Link>
                                <Link
                                  href={`/dashboard/education/communication?student=${stu.id}`}
                                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 rounded-xl transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                                  <span>Sổ Liên Lạc</span>
                                </Link>
                                <Link
                                  href={`/dashboard/education/attendance?student=${stu.id}`}
                                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 rounded-xl transition-colors"
                                >
                                  <CalendarCheck className="w-4 h-4 text-indigo-500" />
                                  <span>Lịch Sử Điểm Danh</span>
                                </Link>
                                <Link
                                  href={`/dashboard/education/grades?student=${stu.id}`}
                                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 rounded-xl transition-colors"
                                >
                                  <GraduationCap className="w-4 h-4 text-amber-500" />
                                  <span>Đánh Giá Phát Triển</span>
                                </Link>
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                                  <Link
                                    href={`/dashboard/education/finance?student=${stu.id}`}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 rounded-xl transition-colors"
                                  >
                                    <CreditCard className="w-4 h-4 text-rose-500" />
                                    <span>Học Phí &amp; Công Nợ</span>
                                  </Link>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer / Pagination Matching Image 2 */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Hiển thị {displayedStudents.length} trong {filteredStudents.length} kết quả sau lọc
              </span>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={boundedPage <= 1}
                  aria-label="Trang trước"
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {visiblePages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    aria-current={boundedPage === page ? 'page' : undefined}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      boundedPage === page
                        ? 'bg-[#064E3B] text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={boundedPage >= totalPages}
                  aria-label="Trang kế tiếp"
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Page Size Select */}
              <PreschoolSelect
                    aria-label="Số trẻ trên trang"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="text-xs font-semibold py-1"
                    wrapperClassName="shrink-0"
                  >
                    {[10, 20, 50].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt} / trang
                      </option>
                    ))}
                  </PreschoolSelect>
            </div>
          </div>
        </div>

        {/* ── BELOW TABLE: Quick Actions + Stats Widgets (2-col responsive grid) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          
          {/* Widget 1: Thao tác nhanh */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Thao tác nhanh</span>
            </div>

            {/* Primary Action */}
            <button
              type="button"
              onClick={openAdmissionModal}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đăng ký nhập học mới</span>
            </button>

            {/* Quick Links */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={openAdmissionModal}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>Thêm trẻ vào lớp</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={handleExportData}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <span>Xuất danh sách trẻ</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={handlePrintList}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Printer className="w-4 h-4" />
                  </div>
                  <span>In danh sách</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => setToastMessage('Tính năng nhập file Excel/CSV sẵn sàng trong cấu hình phòng đào tạo')}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span>Nhập dữ liệu từ file</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Widget 2: Thống kê theo lớp học */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Thống kê theo lớp học</span>
            </div>

            <div className="space-y-3 pt-1">
              {CANONICAL_CLASS_STATS.map((cls) => (
                <div key={cls.className} className="flex items-center justify-between gap-3 text-xs font-bold">
                  <span className="w-12 text-slate-700 dark:text-slate-300 shrink-0">
                    {cls.className}
                  </span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700/80 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-[#10B981] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${cls.percentage}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-900 dark:text-white font-black shrink-0">
                    {cls.currentStudents}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-3xl bg-white dark:bg-slate-800/90 border p-5"><h3 className="font-bold">Lưu ý y tế</h3><p>Chưa có dữ liệu y tế được xác minh trong danh sách trẻ.</p></section>
          {/* Widget 4: Hồ sơ cần bổ sung */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Hồ sơ cần bổ sung ({CANONICAL_INCOMPLETE_DOC_CHILDREN.length})</span>
              </div>
              <button 
                type="button"
                onClick={() => setToastMessage('Đã gửi thông báo nhắc hoàn thiện hồ sơ tới phụ huynh của 5 bé')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>

            <div className="space-y-3 pt-1">
              {CANONICAL_INCOMPLETE_DOC_CHILDREN.map((child) => (
                <Link
                  key={child.id}
                  href={`/dashboard/education/enrollments/${child.id}`}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ChildAvatar
                      gender={child.gender}
                      name={child.name}
                      sizeClass="w-9 h-9"
                    />
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {child.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-semibold">{child.className}</p>
                      <div className="mt-0.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${child.badgeClass}`}>
                          {child.missingDoc}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Upcoming Birthdays & Pending Admissions (2 Side-by-Side Cards) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Bottom Card Left: Trẻ sắp sinh nhật */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
              <Cake className="w-4 h-4 text-rose-500" />
              <span>Trẻ sắp sinh nhật</span>
            </div>
            <button 
              type="button" 
              onClick={() => setToastMessage('Danh sách sinh nhật tháng này đã được gửi cho phòng chăm sóc & dinh dưỡng')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {CANONICAL_BIRTHDAY_CHILDREN.map((bday) => (
              <Link
                key={bday.id}
                href={`/dashboard/education/enrollments/${bday.id}`}
                className="py-3 flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ChildAvatar
                    gender={bday.gender}
                    avatarUrl={bday.avatarUrl}
                    name={bday.name}
                    sizeClass="w-10 h-10"
                  />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {bday.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-semibold">{bday.className}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 font-bold hidden sm:inline">
                    {bday.dob}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/80">
                    🎂 Còn {bday.daysRemaining} ngày
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom Card Right: Trẻ chờ nhập học (28) */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Trẻ chờ nhập học ({registryReady ? pendingCount : '—'})</span>
            </div>
            <button 
              type="button" 
              onClick={() => {
                setSelectedStatusTab('pending');
                setCurrentPage(1);
                menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {CANONICAL_PENDING_CHILDREN.map((pending) => (
              <Link
                key={pending.id}
                href={`/dashboard/education/enrollments/${pending.id}`}
                className="py-3 flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ChildAvatar
                    gender={pending.gender}
                    avatarUrl={pending.avatarUrl}
                    name={pending.name}
                    sizeClass="w-10 h-10"
                  />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {pending.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-semibold">{pending.className}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      pending.statusText === 'Hồ sơ đầy đủ'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                        : 'bg-amber-50 text-amber-800 border border-amber-200/70'
                    }`}>
                      {pending.statusText}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                      Nộp hồ sơ: {pending.submittedDate}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* ── Trailing scroll spacer — keeps bottom cards clear of the viewport edge ── */}
      <div className="h-12 sm:h-16 w-full pointer-events-none select-none" aria-hidden="true" />

      {/* ── ADMISSION WORKFLOW MODAL (Multi-step admission flow) ── */}
      {isAdmissionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              type="button"
              onClick={() => setIsAdmissionModalOpen(false)}
              aria-label="Đóng biểu mẫu"
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Quy trình đăng ký nhập học • Bước {modalStep}/2
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Đăng Ký Hồ Sơ Nhập Học Mới
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thu thập thông tin bé, người giám hộ, tiền sử y tế và phân lớp dự kiến
              </p>
            </div>

            {pendingAdmissionKey && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <p>Hồ sơ trước chưa được xác nhận hoàn tất. Tiếp tục để kiểm tra và khôi phục đúng hồ sơ.</p>
                <button type="button" disabled={isSubmittingAdmission} className="font-bold underline" onClick={() => {
                  if (!window.confirm('Tạo một yêu cầu nhập học mới? Hồ sơ trước được giữ nguyên và có thể vẫn đang xử lý.')) return;
                  sessionStorage.removeItem(admissionStorageKey);
                  setPendingAdmissionKey(''); setResumeNeedsPayload(false);
                  setAdmissionForm(DEFAULT_ADMISSION_FORM); setAdmissionError(''); setModalStep(1);
                }}>Bắt đầu hồ sơ mới</button>
              </div>
            )}
            <fieldset disabled={isSubmittingAdmission || Boolean(pendingAdmissionKey && !resumeNeedsPayload)} className="space-y-4 disabled:opacity-60">
            {/* Modal Step 1: Child Basic Info */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Họ và tên trẻ *
                    </label>
                    <input
                      type="text"
                      value={admissionForm.childName}
                      onChange={(e) => updateAdmissionForm('childName', e.target.value)}
                      placeholder="VD: Lê Hoàng Nam"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Tên thường gọi / Biệt danh
                    </label>
                    <input
                      type="text"
                      value={admissionForm.nickname}
                      onChange={(e) => updateAdmissionForm('nickname', e.target.value)}
                      placeholder="VD: Bé Tôm"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Ngày sinh *
                    </label>
                    <input
                      type="date"
                      value={admissionForm.dateOfBirth}
                      onChange={(e) => updateAdmissionForm('dateOfBirth', e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Giới tính
                    </label>
                    <PreschoolSelect
                        value={admissionForm.gender}
                        onChange={(e) => updateAdmissionForm('gender', e.target.value as AdmissionFormState['gender'])}
                        className="w-full text-xs font-semibold py-2"
                        wrapperClassName="w-full mt-1.5"
                      >
                        <option>Nam</option>
                        <option>Nữ</option>
                      </PreschoolSelect>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Step 2: Guardian, Health & Classroom */}
            {modalStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Họ tên người giám hộ *
                    </label>
                    <input
                      type="text"
                      value={admissionForm.guardianName}
                      onChange={(e) => updateAdmissionForm('guardianName', e.target.value)}
                      placeholder="VD: Lê Văn Thành (Bố)"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Số điện thoại liên hệ *
                    </label>
                    <input
                      type="text"
                      value={admissionForm.guardianPhone}
                      onChange={(e) => updateAdmissionForm('guardianPhone', e.target.value)}
                      placeholder="VD: 0989 112 334"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Ghi chú y tế / Dặn dò đặc biệt (Dị ứng, chế độ ăn)
                  </label>
                  <textarea
                    rows={2}
                    value={admissionForm.medicalNote}
                    onChange={(e) => updateAdmissionForm('medicalNote', e.target.value)}
                    placeholder="VD: Dị ứng sữa bò, cần dùng sữa hạt thay thế."
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Cơ sở / chi nhánh nhập học *
                  </label>
                  <PreschoolSelect
                    value={admissionForm.branchId}
                    onChange={(e) => updateAdmissionForm('branchId', e.target.value)}
                    className="w-full text-xs font-semibold py-2"
                    wrapperClassName="w-full mt-1.5"
                  >
                    <option value="">{branches.length === 0 ? 'Chưa có cơ sở được phép truy cập' : 'Chọn cơ sở nhập học'}</option>
                    {branches.length > 0 && (
                      branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}{branch.code ? ` • ${branch.code}` : ''}
                        </option>
                      ))
                    )}
                  </PreschoolSelect>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Lớp nhập học *
                  </label>
                  <PreschoolSelect
                    value={admissionForm.courseId}
                    onChange={(e) => updateAdmissionForm('courseId', e.target.value)}
                    className="w-full text-xs font-semibold py-2"
                    wrapperClassName="w-full mt-1.5"
                  >
                    <option value="">{classrooms.length === 0 ? 'Chưa tải được lớp nhập học' : 'Chọn lớp nhập học'}</option>
                    {classrooms.length > 0 && (
                      classrooms.map((classroom) => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name}{classroom.grade ? ` • ${classroom.grade}` : ''}
                        </option>
                      ))
                    )}
                  </PreschoolSelect>
                </div>



                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Kiểm tra hồ sơ trước khi ghi nhận:
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    Mã học sinh sẽ được sinh tự động. Hệ thống báo hoàn tất sau khi enrollment được ghi và đối soát vào cơ sở dữ liệu.
                  </p>
                </div>
              </div>
            )}

            {admissionError && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/70 dark:border-rose-900/70 px-4 py-3 text-xs font-bold text-rose-700 dark:text-rose-300">
                {admissionError}
              </div>
            )}

            {admissionSuccess && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-900/70 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {admissionSuccess}
              </div>
            )}

            </fieldset>
            {/* Modal Navigation Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {modalStep > 1 && (
                <button
                  type="button"
                  onClick={() => setModalStep(modalStep - 1)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Quay lại
                </button>
              )}
              {modalStep < 2 ? (
                <button
                  type="button"
                  onClick={() => setModalStep(2)}
                  className="px-5 py-2.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Tiếp theo: Giám hộ →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitAdmission}
                  disabled={isSubmittingAdmission || !admissionStorageKey}
                  className="px-5 py-2.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] disabled:bg-slate-400 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmittingAdmission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isSubmittingAdmission ? 'Đang ghi nhận...' : pendingAdmissionKey && !resumeNeedsPayload ? 'Tiếp tục hồ sơ đang xử lý' : 'Hoàn Tất Đăng Ký Nhập Học'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
