'use client';

/**
 * Bella Education — Teacher 360° Workspace & Workforce Governance Detail Page
 * 
 * Deep Domain Features:
 * - Teacher 360° Profile Header (Identity, Tenure, Current Assignment, Workload Status)
 * - Tabbed Operational Workspace:
 *   1. Tổng Quan & Hồ Sơ (Overview & Contact)
 *   2. Bằng Cấp & Chứng Chỉ Lifecycle (Certifications, Expiry Warnings & Issuers)
 *   3. Lịch Sử Phân Công (Class Assignment Lifecycle History with Effective Dates)
 *   4. Lịch Giảng Dạy & Tải Công Việc (Weekly Schedule & 32/40h Workload Analysis)
 *   5. Đánh Giá & Năng Lực Sư Phạm (Evaluations, Reviews & Governance Metrics)
 */

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Award,
  BookOpen,
  Calendar,
  Clock,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit,
  Download,
  UserCheck,
  GraduationCap,
  Sparkles,
  ChevronRight,
  History,
  Star,
  Check,
  X,
} from 'lucide-react';

interface CertificationItem {
  readonly id: string;
  readonly title: string;
  readonly issuer: string;
  readonly issuedDate: string;
  readonly expiryDate: string;
  readonly status: string;
  readonly isExpiringSoon: boolean;
}

interface AssignmentItem {
  readonly academicYear: string;
  readonly classroom: string;
  readonly role: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly workload: string;
  readonly status: string;
}

interface ScheduleItem {
  readonly day: string;
  readonly shift: string;
  readonly activity: string;
}

interface EvaluationItem {
  readonly period: string;
  readonly rating: string;
  readonly evaluator: string;
  readonly feedback: string;
  readonly score: number;
}

interface ComplianceItem {
  readonly officialRecords: boolean;
  readonly healthCheck: boolean;
  readonly firstAidWarning: boolean;
}

interface TeacherDetail {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly status: string;
  readonly avatarBg: string;
  readonly joinedDate: string;
  readonly totalExperience: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly currentClass: string;
  readonly workloadHours: number;
  readonly maxWorkloadHours: number;
  readonly degree: string;
  readonly compliance: ComplianceItem;
  readonly certifications: readonly CertificationItem[];
  readonly assignmentHistory: readonly AssignmentItem[];
  readonly schedule: readonly ScheduleItem[];
  readonly evaluations: readonly EvaluationItem[];
}

const TEACHER_DETAILS_MAP: Record<string, TeacherDetail> = {
  'TEA-001': {
    id: 'TEA-001',
    name: 'Cô Nguyễn Thị Mai',
    role: 'Giáo viên Chủ nhiệm Lớp Mầm A1',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
    joinedDate: '01/08/2022 (4 năm làm việc tại Bella)',
    totalExperience: '8 năm kinh nghiệm chuyên môn',
    phone: '0982 111 222',
    email: 'mai.nguyen@bellapreschool.edu.vn',
    address: 'Q. Cầu Giấy, Thành phố Hà Nội',
    currentClass: 'Lớp Mầm A1 — Họa Mi',
    workloadHours: 32,
    maxWorkloadHours: 40,
    degree: 'Cử nhân Sư phạm Mầm non - Đại học Quốc Gia Hà Nội (Tốt nghiệp loại Ưu)',
    compliance: { officialRecords: true, healthCheck: true, firstAidWarning: true },
    certifications: [
      {
        id: 'CERT-01',
        title: 'Chứng chỉ Phương pháp Giáo dục Montessori International',
        issuer: 'Association Montessori Internationale (AMI)',
        issuedDate: '15/12/2021',
        expiryDate: '15/12/2028',
        status: 'Valid',
        isExpiringSoon: false,
      },
      {
        id: 'CERT-02',
        title: 'Chứng chỉ Sơ cứu & Y tế Cấp cứu Trẻ em Mầm non',
        issuer: 'Hội Chữ Thập Đỏ Việt Nam',
        issuedDate: '10/10/2024',
        expiryDate: '10/10/2026',
        status: 'Expiring Soon',
        isExpiringSoon: true,
      },
      {
        id: 'CERT-03',
        title: 'Chứng chỉ Tiền Tiểu học & Phát triển Ngôn ngữ Trẻ mầm non',
        issuer: 'Viện Khoa học Giáo dục Việt Nam',
        issuedDate: '20/05/2023',
        expiryDate: 'Vĩnh viễn',
        status: 'Valid',
        isExpiringSoon: false,
      },
    ],
    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Lớp Mầm A1 — Họa Mi',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '32h/tuần',
        status: 'Đang Phụ Trách',
      },
      {
        academicYear: '2025 - 2026',
        classroom: 'Lớp Mầm A2 — Sơn Ca',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2025',
        endDate: '31/05/2026',
        workload: '34h/tuần',
        status: 'Hoàn Thành',
      },
    ],
    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Đón trẻ, Thể dục sáng & Hoạt động Montessori Lớp Mầm A1' },
      { day: 'Thứ Hai', shift: 'Chiều (14:00 - 17:00)', activity: 'Hoạt động Nhóm, Trả trẻ & Trao đổi Phụ huynh' },
      { day: 'Thứ Ba', shift: 'Sáng (07:30 - 11:30)', activity: 'Lớp Sáng tạo Nghệ thuật & Kể chuyện theo chủ đề' },
      { day: 'Thứ Ba', shift: 'Chiều (14:00 - 17:00)', activity: 'Sinh hoạt chuyên môn Khối Mầm' },
      { day: 'Thứ Tư', shift: 'Sáng (07:30 - 11:30)', activity: 'Hoạt động Ngoài trời & Trải nghiệm Giác quan' },
      { day: 'Thứ Năm', shift: 'Sáng (07:30 - 11:30)', activity: 'Khám phá Khoa học Mầm non & Montessori' },
      { day: 'Thứ Sáu', shift: 'Sáng (07:30 - 11:30)', activity: 'Tổng kết tuần, Nêu gương bé ngoan & Trả trẻ' },
    ],
    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Xuất sắc (A+)',
        evaluator: 'Ban Giám Hiệu - Cô Hiệu Trưởng Trịnh Thu Hà',
        feedback: 'Cô Mai có năng lực chuyên môn vững vàng, luôn tận tụy với trẻ. Phương pháp Montessori được áp dụng sinh động, phụ huynh đánh giá rất cao.',
        score: 96,
      },
    ],
  },
  'TEA-002': {
    id: 'TEA-002',
    name: 'Cô Trần Ngọc Anh',
    role: 'Giáo viên Chủ nhiệm Lớp Chồi B1',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
    joinedDate: '01/08/2020 (6 năm làm việc tại Bella)',
    totalExperience: '10 năm kinh nghiệm chuyên môn',
    phone: '0915 222 333',
    email: 'ngocanh.tran@bellapreschool.edu.vn',
    address: 'Q. Ba Đình, Thành phố Hà Nội',
    currentClass: 'Lớp Chồi B1 — Thỏ Ngọc',
    workloadHours: 36,
    maxWorkloadHours: 40,
    degree: 'Thạc sĩ Tâm lý Học Mầm non - Đại học Sư Phạm Hà Nội',
    compliance: { officialRecords: true, healthCheck: true, firstAidWarning: false },
    certifications: [
      {
        id: 'CERT-04',
        title: 'Chứng chỉ Chuyên gia Reggio Emilia Approach',
        issuer: 'Reggio Children Foundation',
        issuedDate: '10/06/2022',
        expiryDate: '10/06/2029',
        status: 'Valid',
        isExpiringSoon: false,
      },
      {
        id: 'CERT-05',
        title: 'Chứng chỉ Năng lực Tiếng Anh C1 Quốc tế',
        issuer: 'Cambridge Assessment English',
        issuedDate: '18/03/2023',
        expiryDate: 'Vĩnh viễn',
        status: 'Valid',
        isExpiringSoon: false,
      },
    ],
    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Lớp Chồi B1 — Thỏ Ngọc',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '36h/tuần',
        status: 'Đang Phụ Trách',
      },
    ],
    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Đón trẻ, Thể dục sáng & Hoạt động Reggio Emilia' },
      { day: 'Thứ Hai', shift: 'Chiều (14:00 - 17:00)', activity: 'Dự án sáng tạo & Trả trẻ' },
      { day: 'Thứ Ba', shift: 'Sáng (07:30 - 11:30)', activity: 'Tiếng Anh giao tiếp mầm non & Kể chuyện' },
    ],
    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Xuất sắc (A+)',
        evaluator: 'Ban Giám Hiệu',
        feedback: 'Cô Ngọc Anh có năng lực quản lý lớp xuất sắc, sáng tạo trong việc tổ chức các góc hoạt động Reggio Emilia.',
        score: 97,
      },
    ],
  },
  'TEA-003': {
    id: 'TEA-003',
    name: 'Cô Đặng Thùy Linh',
    role: 'Giáo viên Chủ nhiệm Lớp Lá C1',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    joinedDate: '01/09/2023 (3 năm làm việc tại Bella)',
    totalExperience: '6 năm kinh nghiệm chuyên môn',
    phone: '0973 444 555',
    email: 'thuylinh.dang@bellapreschool.edu.vn',
    address: 'Q. Đống Đa, Thành phố Hà Nội',
    currentClass: 'Lớp Lá C1 — Vàng Anh',
    workloadHours: 28,
    maxWorkloadHours: 40,
    degree: 'Cử nhân Ngôn ngữ Anh & GD Mầm non - Đại học Ngoại Ngữ',
    compliance: { officialRecords: true, healthCheck: true, firstAidWarning: false },
    certifications: [
      {
        id: 'CERT-06',
        title: 'Chứng chỉ Chuẩn Bị Tiền Tiểu Học Chuẩn Quốc Gia',
        issuer: 'Viện Khoa học Giáo dục Việt Nam',
        issuedDate: '12/04/2024',
        expiryDate: '12/04/2030',
        status: 'Valid',
        isExpiringSoon: false,
      },
    ],
    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Lớp Lá C1 — Vàng Anh',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '28h/tuần',
        status: 'Đang Phụ Trách',
      },
    ],
    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Làm quen chữ cái, toán tư duy & Tiền tiểu học' },
    ],
    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Tốt (A)',
        evaluator: 'Tổ trưởng Khối Lá',
        feedback: 'Cô Linh hướng dẫn các bé chuẩn bị tâm lý và kỹ năng vào lớp 1 rất chu đáo.',
        score: 93,
      },
    ],
  },
  'TEA-004': {
    id: 'TEA-004',
    name: 'Cô Hoàng Bích Ngọc',
    role: 'Giáo viên Chủ nhiệm Lớp Nhà Trẻ N1',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
    joinedDate: '15/01/2024 (2 năm làm việc tại Bella)',
    totalExperience: '5 năm kinh nghiệm chuyên môn',
    phone: '0904 666 777',
    email: 'bichngoc.hoang@bellapreschool.edu.vn',
    address: 'Q. Thanh Xuân, Thành phố Hà Nội',
    currentClass: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    workloadHours: 30,
    maxWorkloadHours: 40,
    degree: 'Cử nhân Giáo dục Đặc biệt - ĐH Sư Phạm TP.HCM',
    compliance: { officialRecords: true, healthCheck: true, firstAidWarning: true },
    certifications: [
      {
        id: 'CERT-07',
        title: 'Chăm sóc Trẻ sơ sinh & Nhà trẻ Chuyên sâu',
        issuer: 'Bệnh viện Nhi Trung Ương',
        issuedDate: '15/03/2023',
        expiryDate: '15/03/2027',
        status: 'Valid',
        isExpiringSoon: false,
      },
      {
        id: 'CERT-08',
        title: 'Dinh dưỡng Nhi khoa & Vệ sinh An toàn',
        issuer: 'Viện Dinh Dưỡng Quốc Gia',
        issuedDate: '10/09/2024',
        expiryDate: '10/09/2026',
        status: 'Expiring Soon',
        isExpiringSoon: true,
      },
    ],
    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Lớp Nhà Trẻ N1 — Gấu Misa',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '30h/tuần',
        status: 'Đang Phụ Trách',
      },
    ],
    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Đón trẻ, rèn luyện kỹ năng tự lập, bữa ăn dinh dưỡng' },
    ],
    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Xuất sắc (A+)',
        evaluator: 'Ban Giám Hiệu',
        feedback: 'Cô Ngọc rất kiên nhẫn, chăm sóc các bé nhỏ chu đáo như người mẹ thứ hai.',
        score: 95,
      },
    ],
  },
  'TEA-005': {
    id: 'TEA-005',
    name: 'Cô Lê Minh Tâm',
    role: 'Giáo viên Trợ giảng Lớp Mầm A2',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
    joinedDate: '01/03/2023 (3 năm làm việc tại Bella)',
    totalExperience: '4 năm kinh nghiệm chuyên môn',
    phone: '0938 888 999',
    email: 'minhtam.le@bellapreschool.edu.vn',
    address: 'Q. Tây Hồ, Thành phố Hà Nội',
    currentClass: 'Lớp Mầm A2 — Sơn Ca',
    workloadHours: 20,
    maxWorkloadHours: 40,
    degree: 'Cao đẳng Sư phạm Mầm non - CĐ Sư Phạm T.Ư',
    compliance: { officialRecords: true, healthCheck: true, firstAidWarning: false },
    certifications: [
      {
        id: 'CERT-09',
        title: 'Kỹ năng Giáo dục sớm Mầm non',
        issuer: 'Học viện Giáo dục Sớm',
        issuedDate: '15/08/2023',
        expiryDate: '15/08/2028',
        status: 'Valid',
        isExpiringSoon: false,
      },
    ],
    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Lớp Mầm A2 — Sơn Ca',
        role: 'Giáo viên Trợ giảng',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '20h/tuần',
        status: 'Đang Phụ Trách',
      },
    ],
    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Hỗ trợ giáo viên chính đón trẻ, phát triển kỹ năng vận động' },
    ],
    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Tốt (A)',
        evaluator: 'Tổ Chuyên Môn',
        feedback: 'Nhiệt tình, phối hợp ăn ý với giáo viên chủ nhiệm trong mọi hoạt động.',
        score: 91,
      },
    ],
  },
  'TEA-006': {
    id: 'TEA-006',
    name: 'Cô Phạm Thị Trang',
    role: 'Giáo viên Năng khiếu Âm nhạc & Nghệ thuật',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
    joinedDate: '10/08/2021 (5 năm làm việc tại Bella)',
    totalExperience: '7 năm kinh nghiệm chuyên môn',
    phone: '0945 777 888',
    email: 'trang.pham@bellapreschool.edu.vn',
    address: 'Q. Hai Bà Trưng, Thành phố Hà Nội',
    currentClass: 'Âm nhạc — Nghệ thuật',
    workloadHours: 24,
    maxWorkloadHours: 40,
    degree: 'Cử nhân Âm nhạc - Giáo dục Nghệ thuật Mầm non',
    compliance: { officialRecords: true, healthCheck: true, firstAidWarning: false },
    certifications: [
      {
        id: 'CERT-10',
        title: 'Phương pháp Cảm thụ Âm nhạc Orff-Schulwerk',
        issuer: 'Hiệp hội Orff Quốc tế',
        issuedDate: '12/11/2022',
        expiryDate: '12/11/2029',
        status: 'Valid',
        isExpiringSoon: false,
      },
    ],
    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Âm nhạc — Nghệ thuật',
        role: 'Giáo viên Năng khiếu',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '24h/tuần',
        status: 'Đang Phụ Trách',
      },
    ],
    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Giờ cảm thụ âm nhạc Khối Mầm và Khối Chồi' },
    ],
    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Xuất sắc (A+)',
        evaluator: 'Ban Giám Hiệu',
        feedback: 'Các tiết học âm nhạc của cô Trang luôn tràn đầy tiếng cười và kích thích trí sáng tạo của trẻ.',
        score: 96,
      },
    ],
  },
};

function getTeacherData(id: string): TeacherDetail {
  if (TEACHER_DETAILS_MAP[id]) {
    return TEACHER_DETAILS_MAP[id];
  }
  return {
    id,
    name: 'Cô Giáo Viên Mầm Non',
    role: 'Giáo viên Chủ nhiệm',
    status: 'Đang Giảng Dạy',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    joinedDate: '01/08/2024',
    totalExperience: '3 năm kinh nghiệm chuyên môn',
    phone: '0988 888 999',
    email: 'giaovien@bellapreschool.edu.vn',
    address: 'Thành phố Hà Nội',
    currentClass: 'Lớp Mầm A1 — Họa Mi',
    workloadHours: 30,
    maxWorkloadHours: 40,
    degree: 'Cử nhân Sư phạm Mầm non',
    compliance: { officialRecords: true, healthCheck: true, firstAidWarning: false },
    certifications: [
      {
        id: 'CERT-01',
        title: 'Chứng chỉ Phương pháp Giáo dục Mầm non',
        issuer: 'ĐH Sư Phạm',
        issuedDate: '15/05/2024',
        expiryDate: '15/05/2029',
        status: 'Valid',
        isExpiringSoon: false,
      },
    ],
    assignmentHistory: [
      {
        academicYear: '2026 - 2027',
        classroom: 'Lớp Mầm A1 — Họa Mi',
        role: 'Giáo viên Chủ nhiệm',
        startDate: '01/08/2026',
        endDate: '31/05/2027',
        workload: '30h/tuần',
        status: 'Đang Phụ Trách',
      },
    ],
    schedule: [
      { day: 'Thứ Hai', shift: 'Sáng (07:30 - 11:30)', activity: 'Đón trẻ và sinh hoạt nề nếp' },
    ],
    evaluations: [
      {
        period: 'Học kỳ I (2025-2026)',
        rating: 'Tốt (A)',
        evaluator: 'Ban Giám Hiệu',
        feedback: 'Hoàn thành tốt nhiệm vụ giảng dạy và chăm sóc học sinh.',
        score: 90,
      },
    ],
  };
}

export default function TeacherDetailPage() {
  const params = useParams();
  const teacherId = (params?.id as string) || 'TEA-001';

  const [activeTab, setActiveTab] = useState<'overview' | 'certifications' | 'assignments' | 'schedule' | 'evaluations'>('overview');
  const [selectedYear, setSelectedYear] = useState('2026 - 2027');
  const [teacher, setTeacher] = useState<TeacherDetail>(() => getTeacherData(teacherId));
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync when teacherId changes
  useEffect(() => {
    setTeacher(getTeacherData(teacherId));
  }, [teacherId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/education/teachers"
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[var(--education-brand-ink)] uppercase tracking-wider">
                Hồ sơ giáo viên 360°
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-bold text-slate-500">{teacher.id}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {teacher.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Xuất Hồ Sơ PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#0e5c43] hover:bg-[#0a4633] text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Edit className="w-4 h-4" />
            <span>Cập Nhật Hồ Sơ</span>
          </button>
        </div>
      </div>

      {/* ── TEACHER 360 HERO SUMMARY CARD ── */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl ${teacher.avatarBg} flex items-center justify-center font-extrabold text-2xl sm:text-3xl shrink-0 shadow-md`}>
              {teacher.name.split(' ').pop()?.[0]}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {teacher.name}
                </h2>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#0e5c43]/10 text-[#0e5c43] dark:text-emerald-300 border border-[#0e5c43]/20">
                  {teacher.status}
                </span>
              </div>
              <p className="text-xs font-extrabold text-[#0e5c43] dark:text-emerald-400">
                {teacher.role}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${teacher.phone}`} className="hover:text-emerald-600 transition-colors">
                    {teacher.phone}
                  </a>
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`mailto:${teacher.email}`} className="hover:text-emerald-600 transition-colors">
                    {teacher.email}
                  </a>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {teacher.address}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Workload & Assignment Badge */}
          <div className="w-full lg:w-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#0e5c43] dark:text-emerald-400" />
                Định Mức Tải Công Việc:
              </span>
              {teacher.workloadHours >= 36 ? (
                <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200/60">
                  ● Đủ Tải
                </span>
              ) : (
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200/60">
                  ● Còn Lịch Trống
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>{teacher.workloadHours} / {teacher.maxWorkloadHours} giờ/tuần</span>
              <span>{Math.round((teacher.workloadHours / teacher.maxWorkloadHours) * 100)}% tải</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  teacher.workloadHours >= 36 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (teacher.workloadHours / teacher.maxWorkloadHours) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── 360 NAVIGATION TABS ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tổng Quan & Hồ Sơ
          </button>
          <button
            onClick={() => setActiveTab('certifications')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'certifications'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Bằng Cấp & Chứng Chỉ ({teacher.certifications.length})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'assignments'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch Sử Phân Công Lớp
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Thời Khóa Biểu Tuần
          </button>
          <button
            onClick={() => setActiveTab('evaluations')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evaluations'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Đánh Giá Sư Phạm
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT 1: OVERVIEW & PROFILE ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[var(--education-brand-ink)]" />
              Thông Tin Trình Độ & Kinh Nghiệm Sư Phạm
            </h3>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                <span className="text-slate-400 font-medium block">Bằng cấp đào tạo chính quy:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{teacher.degree}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-400 font-medium block">Thâm niên ngành:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{teacher.totalExperience}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <span className="text-slate-400 font-medium block">Thời gian gia nhập Bella:</span>
                  <span className="font-extrabold text-[var(--education-brand-ink)]">{teacher.joinedDate}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                <span className="text-slate-400 font-medium block">Lớp phụ trách hiện tại (Năm học 2026-2027):</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{teacher.currentClass}</span>
              </div>
            </div>
          </div>

          {/* Side Info Widget */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Tuân Thủ Hồ Sơ & Pháp Lý
            </h3>
            <div className="space-y-3 text-xs">
              <div className={`flex items-center justify-between p-3 rounded-2xl border font-bold ${
                teacher.compliance.officialRecords
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 text-amber-800 dark:text-amber-300'
              }`}>
                <span>Hồ sơ nhân sự chính thức</span>
                {teacher.compliance.officialRecords ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className={`flex items-center justify-between p-3 rounded-2xl border font-bold ${
                teacher.compliance.healthCheck
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 text-amber-800 dark:text-amber-300'
              }`}>
                <span>Khám sức khỏe định kỳ năm 2026</span>
                {teacher.compliance.healthCheck ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className={`flex items-center justify-between p-3 rounded-2xl border font-bold ${
                teacher.compliance.firstAidWarning
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 text-amber-800 dark:text-amber-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 text-emerald-800 dark:text-emerald-300'
              }`}>
                <span>{teacher.compliance.firstAidWarning ? 'Gia hạn chứng chỉ Sơ cứu y tế' : 'Chứng chỉ Sơ cứu y tế hợp lệ'}</span>
                {teacher.compliance.firstAidWarning ? (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: CERTIFICATIONS LIFECYCLE ── */}
      {activeTab === 'certifications' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--education-brand-ink)]" />
              Danh Sách Bằng Cấp & Chứng Chỉ Chuyên Môn
            </h3>
            <button className="px-4 py-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-all cursor-pointer">
              + Thêm Chứng Chỉ Mới
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teacher.certifications.map((c) => (
              <div
                key={c.id}
                className={`p-6 rounded-3xl border ${
                  c.isExpiringSoon
                    ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                    : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/60'
                } space-y-3 flex flex-col justify-between`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {c.id}
                    </span>
                    {c.isExpiringSoon ? (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                        ⚠️ Sắp hết hạn
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        ✓ Hợp lệ
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {c.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cơ quan cấp: <strong>{c.issuer}</strong>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs flex items-center justify-between text-slate-600 dark:text-slate-400 font-semibold">
                  <span>Ngày cấp: {c.issuedDate}</span>
                  <span>Hạn: <strong>{c.expiryDate}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 3: ASSIGNMENT HISTORY LIFECYCLE ── */}
      {activeTab === 'assignments' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--education-brand-ink)]" />
            Lịch Sử Quan Hệ Phân Công Giảng Dạy (Lifecycle History)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Năm Học</th>
                  <th className="p-3.5">Lớp Phụ Trách</th>
                  <th className="p-3.5">Vai Trò</th>
                  <th className="p-3.5">Thời Gian Áp Dụng</th>
                  <th className="p-3.5">Định Mức Tải</th>
                  <th className="p-3.5 rounded-r-2xl">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teacher.assignmentHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{item.academicYear}</td>
                    <td className="p-3.5 font-extrabold text-[var(--education-brand-ink)]">{item.classroom}</td>
                    <td className="p-3.5 font-semibold text-slate-700 dark:text-slate-300">{item.role}</td>
                    <td className="p-3.5 text-slate-500">{item.startDate} ➔ {item.endDate}</td>
                    <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">{item.workload}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                        item.status === 'Đang Phụ Trách' 
                          ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 4: SCHEDULE & WORKLOAD ── */}
      {activeTab === 'schedule' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--education-brand-ink)]" />
            Thời Khóa Biểu Giảng Dạy Tuần Này
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teacher.schedule.map((s, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[var(--education-brand-ink)]">{s.day}</span>
                  <span className="font-bold text-slate-500">{s.shift}</span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {s.activity}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 5: EVALUATIONS ── */}
      {activeTab === 'evaluations' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Đánh Giá Sư Phạm & Nhận Xét Từ Ban Giám Hiệu
          </h3>

          <div className="space-y-4">
            {teacher.evaluations.map((ev, idx) => (
              <div key={idx} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">{ev.period}</span>
                  <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold border border-amber-300">
                    Xếp loại: {ev.rating} ({ev.score}/100)
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 italic">
                  &quot;{ev.feedback}&quot;
                </p>
                <div className="text-slate-400 font-medium text-[11px] pt-1">
                  Người đánh giá: {ev.evaluator}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-xl text-xs font-bold animate-in slide-in-from-top-4 duration-300">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-emerald-700 transition-colors ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── EDIT TEACHER PROFILE MODAL ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400">
                Quản lý nhân sự sư phạm mầm non 360°
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Cập Nhật Hồ Sơ: {teacher.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chỉnh sửa thông tin nhân sự, học vị, định mức giờ dạy & hồ sơ tuân thủ pháp lý
              </p>
            </div>

            <form
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = (fd.get('name') as string)?.trim() || teacher.name;
                const role = (fd.get('role') as string)?.trim() || teacher.role;
                const status = (fd.get('status') as string)?.trim() || teacher.status;
                const phone = (fd.get('phone') as string)?.trim() || teacher.phone;
                const email = (fd.get('email') as string)?.trim() || teacher.email;
                const address = (fd.get('address') as string)?.trim() || teacher.address;
                const joinedDate = (fd.get('joinedDate') as string)?.trim() || teacher.joinedDate;
                const degree = (fd.get('degree') as string)?.trim() || teacher.degree;
                const totalExperience = (fd.get('totalExperience') as string)?.trim() || teacher.totalExperience;
                const currentClass = (fd.get('currentClass') as string)?.trim() || teacher.currentClass;
                const workloadHours = Math.min(45, Math.max(0, Number(fd.get('workloadHours')) || teacher.workloadHours));
                const officialRecords = fd.get('officialRecords') === 'on';
                const healthCheck = fd.get('healthCheck') === 'on';
                const firstAidWarning = fd.get('firstAidWarning') === 'warning';

                setTeacher((prev) => ({
                  ...prev,
                  name,
                  role,
                  status,
                  phone,
                  email,
                  address,
                  joinedDate,
                  degree,
                  totalExperience,
                  currentClass,
                  workloadHours,
                  compliance: {
                    officialRecords,
                    healthCheck,
                    firstAidWarning,
                  },
                }));

                setIsEditModalOpen(false);
                setToastMessage(`Đã cập nhật thành công hồ sơ của ${name}!`);
              }}
              className="space-y-5"
            >
              {/* Nhóm 1: Thông tin nhân sự & Liên hệ */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  1. Thông tin cá nhân & Liên hệ
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Họ và tên cô giáo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      defaultValue={teacher.name}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Chức danh / Vai trò
                    </label>
                    <input
                      type="text"
                      name="role"
                      defaultValue={teacher.role}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Trạng thái hoạt động
                    </label>
                    <select
                      name="status"
                      defaultValue={teacher.status}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    >
                      <option value="Đang Giảng Dạy">Đang Giảng Dạy</option>
                      <option value="Tạm Nghỉ">Tạm Nghỉ</option>
                      <option value="Chờ Phân Công">Chờ Phân Công</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      name="phone"
                      defaultValue={teacher.phone}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Email công vụ
                    </label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={teacher.email}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Địa chỉ cư trú
                    </label>
                    <input
                      type="text"
                      name="address"
                      defaultValue={teacher.address}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Thời gian gia nhập trường
                    </label>
                    <input
                      type="text"
                      name="joinedDate"
                      defaultValue={teacher.joinedDate}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Trình độ chuyên môn & Học vị */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  2. Trình độ học vấn & Kinh nghiệm
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bằng cấp đào tạo chính quy
                    </label>
                    <input
                      type="text"
                      name="degree"
                      defaultValue={teacher.degree}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Thâm niên chuyên môn
                    </label>
                    <input
                      type="text"
                      name="totalExperience"
                      defaultValue={teacher.totalExperience}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 3: Phân công giảng dạy & Định mức tải */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  3. Phân công lớp & Định mức giờ dạy
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Lớp phụ trách hiện tại
                    </label>
                    <select
                      name="currentClass"
                      defaultValue={teacher.currentClass}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    >
                      <option>Lớp Mầm A1 — Họa Mi</option>
                      <option>Lớp Chồi B1 — Thỏ Ngọc</option>
                      <option>Lớp Lá C1 — Vàng Anh</option>
                      <option>Lớp Nhà Trẻ N1 — Gấu Misa</option>
                      <option>Lớp Mầm A2 — Sơn Ca</option>
                      <option>Âm nhạc — Nghệ thuật</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Định mức giờ giảng dạy/tuần (Max 40h)
                    </label>
                    <input
                      type="number"
                      name="workloadHours"
                      min={10}
                      max={40}
                      defaultValue={teacher.workloadHours}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 4: Tuân thủ pháp lý & Chứng chỉ hành nghề */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  4. Tuân thủ hồ sơ & Pháp lý
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                    <input
                      type="checkbox"
                      name="officialRecords"
                      defaultChecked={teacher.compliance.officialRecords}
                      className="w-4 h-4 rounded text-[#0e5c43] focus:ring-[#0e5c43]"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Hồ sơ nhân sự chính thức
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                    <input
                      type="checkbox"
                      name="healthCheck"
                      defaultChecked={teacher.compliance.healthCheck}
                      className="w-4 h-4 rounded text-[#0e5c43] focus:ring-[#0e5c43]"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Khám sức khỏe 2026
                    </span>
                  </label>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      Chứng chỉ Sơ cứu y tế
                    </label>
                    <select
                      name="firstAidWarning"
                      defaultValue={teacher.compliance.firstAidWarning ? 'warning' : 'valid'}
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                    >
                      <option value="valid">Đã gia hạn (Hợp lệ)</option>
                      <option value="warning">Cần gia hạn (Cảnh báo)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu Thay Đổi & Cập Nhật Hồ Sơ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
