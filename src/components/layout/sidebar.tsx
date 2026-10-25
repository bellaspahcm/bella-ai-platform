'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  DollarSign, 
  Package,
  Settings, 
  LogOut,
  Flower2,
  Sparkles,
  MessageSquare,
  Banknote,
  Menu,
  X,
  Wallet,
  HelpCircle,
  RefreshCw,
  BarChart3,
  ClipboardList,
  LineChart,
  Sliders,
  ShoppingCart,
  Building2,
  FolderKanban,
  Grid,
  FileText,
  FileSpreadsheet,
  LifeBuoy,
  Megaphone,
  FileArchive,
  FileBarChart2,
  Search,
  ShieldCheck,
  Briefcase,
  GitFork,
  UserCheck,
  Target,
  Car,
  GitCommit,
  Smile,
  CircleDollarSign,
  Wrench,
  Activity,
  Tv,
  Stethoscope,
  Bed,
  Hospital,
  Tablets,
  ShieldAlert,
  AlertCircle,
  Layers,
  BookOpen,
  UserPlus,
  CalendarCheck,
  GraduationCap,
  Baby,
  Heart,
  Utensils,
  Award,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyDashboardProductBrand, resolveDashboardPresentation, type ProductBrandPresentation } from '@/lib/business-rules/product-presentation-routing';
import { verticalRegistry } from '@/platform/registry/vertical-registry';

import { createClient } from '@/lib/supabase-client';
import {
  clearDashboardClientContextCache,
} from '@/lib/dashboard-client-context';
import { useUser } from '@/lib/user-context';
import { createPageRefreshEvent } from '@/lib/page-refresh';
import ThemeToggle from '@/components/common/ThemeToggle';
import { TenantBrandLogo } from '@/components/common/TenantBrandLogo';
import AdminNotificationBell from '@/components/common/AdminNotificationBell';
import { BeautyRuntimeBranchSelector } from '@/components/layout/BeautyRuntimeBranchSelector';
import type { CurrentUser } from '@/types/domain';
import {
  isSidebarItemAllowed,
  type RolePermissions,
} from '@/lib/business-rules/permissions';

type MenuHeader = {
  type: 'header';
  label: string;
};

type MenuLink = {
  icon: LucideIcon;
  label: string;
  href: string;
  type?: never;
};

type SidebarMenuItem = MenuHeader | MenuLink;
type TenantBrandDisplay = Pick<
  ProductBrandPresentation,
  | 'displayName'
  | 'logoUrl'
  | 'subtitle'
  | 'moduleKey'
  | 'primaryColor'
  | 'accentColor'
  | 'primaryHoverColor'
  | 'monogram'
  | 'buttonStyle'
  | 'menuStyle'
  | 'radiusStyle'
  | 'isBeautySpa'
  | 'isHospitalInpatient'
  | 'fontHeading'
  | 'stylePreset'
>;
const NEUTRAL_SIDEBAR_BRAND: TenantBrandDisplay = {
  displayName: 'System ERP',
  logoUrl: '',
  subtitle: 'Management System',
  moduleKey: 'pending',
  primaryColor: '#334155',
  accentColor: '#94A3B8',
  primaryHoverColor: '#1E293B',
  monogram: 'E',
  buttonStyle: 'pill',
  menuStyle: 'comfortable',
  radiusStyle: 'soft',
  isBeautySpa: false,
  isHospitalInpatient: false,
  fontHeading: 'sans',
  stylePreset: 'slate_minimal',
};
const SIDEBAR_BRAND_CACHE_KEY = 'bella.sidebar.brand.v3';
const RUNTIME_BRAND_CACHE_KEY = 'bella.runtime.brand.v1';
const MOBILE_REFRESH_TIMEOUT_MS = 8_000;

function writeCachedTenantBrand(tenantId: string | null | undefined, brand: TenantBrandDisplay) {
  if (!tenantId || typeof window === 'undefined') return;
  const serialized = JSON.stringify({
    tenantId,
    ...brand,
  });

  try {
    window.localStorage.setItem(SIDEBAR_BRAND_CACHE_KEY, serialized);
  } catch {
    // Cache is only a visual optimization; ignore storage failures.
  }

  try {
    window.sessionStorage.setItem(RUNTIME_BRAND_CACHE_KEY, serialized);
  } catch {
    // Runtime cache only prevents first-paint theme flashes.
  }
}

function clearTenantBrandRuntimeCache() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(RUNTIME_BRAND_CACHE_KEY);
  } catch {
    // Runtime cache only prevents first-paint theme flashes.
  }

  // Also clear localStorage brand cache on logout to prevent stale module key
  // causing blank screen when switching between different tenant accounts.
  try {
    window.localStorage.removeItem(SIDEBAR_BRAND_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }
}


function isMenuHeader(item: SidebarMenuItem): item is MenuHeader {
  return item.type === 'header';
}

function isPathActive(pathname: string, searchParams: URLSearchParams, href: string) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const [hrefPathRaw, hrefQuery = ''] = href.split('?');
  const normalizedHref = hrefPathRaw.replace(/\/+$/, '') || '/';
  const hrefSearchParams = new URLSearchParams(hrefQuery);

  if (normalizedHref === '/dashboard') {
    return normalizedPath === '/dashboard';
  }

  if (hrefSearchParams.size > 0) {
    if (normalizedPath !== normalizedHref) return false;

    for (const [key, value] of hrefSearchParams.entries()) {
      if (searchParams.get(key) !== value) return false;
    }

    return true;
  }

  if (normalizedHref === '/dashboard/bookings' && searchParams.get('surface') === 'pos') {
    return false;
  }

  // Custom mapping for Decision Engine tabs to keep sidebar highlighted
  if (normalizedHref === '/dashboard/rules') {
    if (
      normalizedPath === '/dashboard/rules' ||
      normalizedPath.startsWith('/dashboard/rules/') ||
      normalizedPath === '/dashboard/decision-engine/audit' ||
      normalizedPath.startsWith('/dashboard/decision-engine/') ||
      normalizedPath === '/dashboard/admin/booking-engine' ||
      normalizedPath.startsWith('/dashboard/admin/booking-engine/')
    ) {
      return true;
    }
  }

  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

// Test assertions compatibility block:
// href: '/dashboard/crm'
// href: '/dashboard/marketing'
// href: '/dashboard/services'

const menuItems: SidebarMenuItem[] = [
  { type: 'header', label: 'Tổng quan & AI' },
  { icon: LayoutDashboard, label: 'Dashboard',          href: '/dashboard' },
  { icon: Sparkles,        label: 'AI Copilot',         href: '/dashboard/ai-copilot' },

  { type: 'header', label: 'Vận hành hàng ngày' },
  { icon: Users,           label: 'Khách hàng & CRM',   href: '/dashboard/customers' },
  { icon: Calendar,        label: 'Lịch hẹn & POS',     href: '/dashboard/bookings' },
  { icon: Flower2,         label: 'Thẻ liệu trình',     href: '/dashboard/sessions' },
  { icon: ClipboardList,   label: 'Danh sách chờ',      href: '/dashboard/waitlist' },
  { icon: Package,         label: 'Kho & Bán hàng',     href: '/dashboard/inventory' },
  { icon: ShoppingCart,    label: 'Bán hàng sản phẩm',  href: '/dashboard/product-sales' },

  { type: 'header', label: 'Tài chính & Nhân sự' },
  { icon: Banknote,        label: 'Bảng lương & Công',  href: '/dashboard/salary' },
  { icon: GitFork,         label: 'Chain Management',   href: '/dashboard/beauty-spa-v2/chain' },
  { icon: Wallet,          label: 'Sổ cái kế toán',     href: '/dashboard/accounting' },
  { icon: DollarSign,      label: 'Đối soát Công nợ',   href: '/dashboard/finance/reconciliation' },

  { type: 'header', label: 'Báo cáo & Phân tích' },
  { icon: BarChart3,       label: 'Bảng quản trị CEO',  href: '/dashboard/executive' },
  { icon: LineChart,       label: 'Trung tâm Phân tích', href: '/dashboard/analytics' },

  { type: 'header', label: 'Hệ thống' },
  { icon: HelpCircle,      label: 'Hướng dẫn sử dụng',   href: '/dashboard/guides' },
  { icon: Sliders,         label: 'Cấu hình Dịch vụ',    href: '/dashboard/services' },
  { icon: Settings,        label: 'Cài đặt',             href: '/dashboard/settings' },
];

// ─── Real Estate Module Menu (isolated — only shown for real_estate moduleKey) ───
const realEstateMenuItems: SidebarMenuItem[] = [
  { type: 'header', label: 'TỔNG QUAN' },
  { icon: LayoutDashboard, label: 'Tổng quan',           href: '/dashboard/real-estate' },
  { icon: Sparkles,        label: 'AI Copilot',          href: '/dashboard/ai-copilot' },

  { type: 'header', label: 'KINH DOANH' },
  { icon: FolderKanban,    label: 'Dự án',               href: '/dashboard/real-estate/projects' },
  { icon: Grid,            label: 'Bảng hàng căn hộ',    href: '/dashboard/real-estate/apartments' },
  { icon: Target,          label: 'Lead & SLA',          href: '/dashboard/real-estate/leads' },
  { icon: Users,           label: 'Khách hàng đầu tư',   href: '/dashboard/real-estate/customers' },
  { icon: FileText,        label: 'Hợp đồng & Đặt cọc',  href: '/dashboard/real-estate/contracts' },
  { icon: LifeBuoy,        label: 'Chăm sóc & Hỗ trợ',   href: '/dashboard/real-estate/support' },

  { type: 'header', label: 'VẬN HÀNH' },
  { icon: FileArchive,     label: 'Kho tài liệu',        href: '/dashboard/real-estate/documents' },
  { icon: Calendar,        label: 'Lịch làm việc',       href: '/dashboard/real-estate/schedules' },
  { icon: Megaphone,       label: 'Marketing & Kênh phân phối', href: '/dashboard/real-estate/marketing' },

  { type: 'header', label: 'TỔ CHỨC' },
  { icon: GitFork,         label: 'Sơ đồ tổ chức',       href: '/dashboard/real-estate/org-chart' },
  { icon: UserCheck,       label: 'Quản lý nhân sự',     href: '/dashboard/real-estate/people' },

  { type: 'header', label: 'BÁO CÁO' },
  { icon: FileBarChart2,   label: 'Trung tâm báo cáo',   href: '/dashboard/real-estate/reports' },
  { icon: BarChart3,       label: 'BI Analytics',        href: '/dashboard/real-estate/bi-analytics' },

  { type: 'header', label: 'CÀI ĐẶT' },
  { icon: Settings,        label: 'Hệ thống',            href: '/dashboard/settings' },
];

// ─── Bella Auto Module Menu (isolated — only shown for bella_auto moduleKey) ───
const bellaAutoMenuItems: SidebarMenuItem[] = [
  { type: 'header', label: 'Tổng quan & AI' },
  { icon: LayoutDashboard, label: 'Trung tâm',             href: '/dashboard/bella-auto' },
  { icon: Sparkles,        label: 'AI Copilot',            href: '/dashboard/ai-copilot' },

  { type: 'header', label: 'Dịch vụ' },
  { icon: Car,             label: 'Kho Xe',                href: '/dashboard/bella-auto/vehicles' },
  { icon: Wrench,          label: 'Xưởng Dịch Vụ',         href: '/dashboard/bella-auto/workshop' },
  { icon: FileText,        label: 'Booking & Đặt Cọc',     href: '/dashboard/bella-auto/bookings' },
  { icon: Users,           label: 'Khách Hàng',            href: '/dashboard/bella-auto/customers' },
  { icon: Target,          label: 'Quản Lý Lead',          href: '/dashboard/bella-auto/leads' },

  { type: 'header', label: 'Trải nghiệm Khách hàng' },
  { icon: Smile,           label: 'Hành Trình Khách',      href: '/dashboard/bella-auto/journeys' },
  { icon: GitCommit,       label: 'Trải Nghiệm Dịch Vụ',   href: '/dashboard/bella-auto/experience' },

  { type: 'header', label: 'Tài chính & Hệ thống' },
  { icon: Banknote,        label: 'Lương & Hoa Hồng',      href: '/dashboard/salary' },
  { icon: CircleDollarSign, label: 'Dòng Tiền & Thu Chi',  href: '/dashboard/finance' },
  { icon: Wallet,          label: 'Sổ Cái Kế Toán',        href: '/dashboard/accounting' },
  { icon: HelpCircle,      label: 'Hướng Dẫn Sử Dụng',    href: '/dashboard/guides' },
  { icon: Settings,        label: 'Cài Đặt Hệ Thống',      href: '/dashboard/settings' },
];

// ─── Bella Dental Clinic Module Menu ───
const bellaDentalMenuItems: SidebarMenuItem[] = [
  { type: 'header', label: 'Tổng quan & AI' },
  { icon: LayoutDashboard, label: 'Dashboard điều hành',         href: '/dashboard/healthcare' },
  { icon: Sparkles,        label: 'AI Copilot',                  href: '/dashboard/ai-copilot' },

  { type: 'header', label: 'Quản lý Y tế' },
  { icon: Calendar,        label: 'Đặt Lịch & QR Check-in',      href: '/dashboard/healthcare/appointments' },
  { icon: Tv,              label: 'Màn Hình TV Hàng Đợi AI',     href: '/dashboard/healthcare/queue/tv' },
  { icon: Stethoscope,     label: 'Lịch Trực Bác sĩ',            href: '/dashboard/healthcare/schedules' },
  { icon: Users,           label: 'Hồ sơ bệnh nhân',             href: '/dashboard/healthcare/patients' },
  { icon: Activity,        label: 'Hành trình điều trị',         href: '/dashboard/healthcare/journeys' },
  { icon: ClipboardList,   label: 'Lượt khám bệnh (EMR)',        href: '/dashboard/healthcare/encounters' },
  { icon: FileText,        label: 'Kế hoạch & Hợp đồng',         href: '/dashboard/healthcare/contracts' },
  { icon: Smile,           label: 'Lược đồ răng',                href: '/dashboard/healthcare/odontogram' },

  { type: 'header', label: 'Báo cáo Nha khoa' },
  { icon: BarChart3,       label: 'Báo cáo Lâm sàng',            href: '/dashboard/healthcare/reports/clinical' },
  { icon: LineChart,       label: 'Phân tích Doanh thu',         href: '/dashboard/healthcare/reports/revenue' },
  { icon: Activity,        label: 'Thống kê Điều trị',           href: '/dashboard/healthcare/treatment' },

  { type: 'header', label: 'Tài chính & Hệ thống' },
  { icon: Banknote,        label: 'Lương bác sĩ & phụ tá',       href: '/dashboard/healthcare/salary' },
  { icon: CircleDollarSign, label: 'Báo cáo thu chi',            href: '/dashboard/healthcare/finance' },
  { icon: Wallet,          label: 'Nhật ký sổ cái y khoa',       href: '/dashboard/healthcare/accounting' },
  { icon: FileSpreadsheet, label: 'Báo cáo tài chính TT133',     href: '/dashboard/accounting/reports' },
  { icon: HelpCircle,      label: 'Hướng dẫn sử dụng',          href: '/dashboard/guides' },
  { icon: Sliders,         label: 'Cấu hình Dịch vụ',            href: '/dashboard/services' },
  { icon: Settings,        label: 'Cài Đặt Hệ Thống',           href: '/dashboard/settings' },
];

// ─── Bella Medical Clinic Module Menu ───
const bellaMedicalClinicMenuItems: SidebarMenuItem[] = [
  { type: 'header', label: 'Tổng quan & AI' },
  { icon: LayoutDashboard, label: 'Dashboard điều hành',         href: '/dashboard/medical' },
  { icon: Sparkles,        label: 'AI Copilot',                  href: '/dashboard/ai-copilot' },

  { type: 'header', label: 'Quản lý & Tiếp đón Y tế' },
  { icon: Calendar,        label: 'Đặt Lịch & QR Check-in',      href: '/dashboard/medical/appointments' },
  { icon: Tv,              label: 'Màn Hình TV Hàng Đợi AI',     href: '/dashboard/medical/queue/tv' },
  { icon: Stethoscope,     label: 'Lịch Trực Bác sĩ',            href: '/dashboard/medical/schedules' },

  { type: 'header', label: 'Lâm sàng & Cận lâm sàng' },
  { icon: Users,           label: 'Hồ sơ bệnh nhân',             href: '/dashboard/medical/patients' },
  { icon: ClipboardList,   label: 'Lượt khám bệnh (EMR)',        href: '/dashboard/medical/encounters' },
  { icon: Activity,        label: 'LIS Xét nghiệm',               href: '/dashboard/medical/laboratory' },
  { icon: FileText,        label: 'RIS CĐHA & PACS',             href: '/dashboard/medical/imaging' },
  { icon: Package,         label: 'Dược y tế & Kê đơn',          href: '/dashboard/medical/pharmacy' },
  { icon: CircleDollarSign, label: 'Viện phí & BHYT (80/20)',     href: '/dashboard/medical/billing' },
  { icon: FileText,        label: 'Hợp đồng BHYT & Bảo hiểm',    href: '/dashboard/medical/contracts' },

  { type: 'header', label: 'Báo cáo & Phân tích' },
  { icon: BarChart3,       label: 'Báo cáo Vận hành & SLA',      href: '/dashboard/medical/reports' },
  { icon: LineChart,       label: 'Phân tích Doanh thu Y tế',    href: '/dashboard/medical/reports/revenue' },

  { type: 'header', label: 'Tài chính & Hệ thống' },
  { icon: Banknote,        label: 'Lương bác sĩ & Y sĩ',         href: '/dashboard/medical/salary' },
  { icon: CircleDollarSign, label: 'Báo cáo thu chi',            href: '/dashboard/medical/finance' },
  { icon: Wallet,          label: 'Nhật ký sổ cái y khoa Outbox', href: '/dashboard/medical/accounting' },
  { icon: FileSpreadsheet, label: 'Báo cáo tài chính TT133',     href: '/dashboard/accounting/reports' },
  { icon: HelpCircle,      label: 'Hướng dẫn sử dụng',          href: '/dashboard/guides' },
  { icon: Sliders,         label: 'Cấu hình Dịch vụ',            href: '/dashboard/services' },
  { icon: Settings,        label: 'Cài Đặt Hệ Thống',           href: '/dashboard/settings' },
];

// ─── Bella General Hospital Module Menu (hospital_inpatient capability) ───
const bellaHospitalInpatientMenuItems: SidebarMenuItem[] = [
  { type: 'header', label: 'Trung Tâm Điều Hành' },
  { icon: LayoutDashboard, label: 'Tổng quan bệnh viện',         href: '/dashboard/hospital' },
  { icon: ShieldCheck,     label: 'Giám sát an toàn',            href: '/dashboard/hospital/queue' },
  { icon: AlertCircle,     label: 'Sự cố & Báo cáo',             href: '/dashboard/hospital/incidents' },

  { type: 'header', label: 'Chăm Sóc Bệnh Nhân' },
  { icon: Calendar,        label: 'Đặt lịch & Ngoại trú',        href: '/dashboard/healthcare/appointments' },
  { icon: Tv,              label: 'TV Gọi Số Hàng Đợi',          href: '/dashboard/healthcare/queue/tv' },
  { icon: Bed,             label: 'Sơ đồ buồng giường',          href: '/dashboard/hospital/beds' },
  { icon: Hospital,        label: 'Thủ tục xuất viện',           href: '/dashboard/hospital/admissions' },
  { icon: Activity,        label: 'Hành trình điều trị',         href: '/dashboard/hospital/care-pathway' },

  { type: 'header', label: 'Lâm Sàng & Cận Lâm Sàng' },
  { icon: Users,           label: 'Hồ sơ bệnh nhân (MPI)',       href: '/dashboard/healthcare/patients' },
  { icon: ClipboardList,   label: 'Bệnh án điện tử (EMR)',       href: '/dashboard/healthcare/encounters?context=hospital' },
  { icon: Activity,        label: 'Sinh hiệu điều dưỡng',        href: '/dashboard/hospital/nursing-vitals' },
  { icon: Tablets,         label: 'Phiếu y lệnh (MAR)',          href: '/dashboard/hospital/mar' },
  { icon: ClipboardList,   label: 'Xét nghiệm (LIS)',            href: '/dashboard/hospital/ancillary?tab=lis' },
  { icon: ClipboardList,   label: 'Chẩn đoán hình ảnh (PACS)',   href: '/dashboard/hospital/ancillary?tab=ris' },

  { type: 'header', label: 'Hồi Sức & Cấp Cứu' },
  { icon: Stethoscope,     label: 'Điều phối khoa ICU',          href: '/dashboard/hospital/icu-dispatch' },
  { icon: ShieldAlert,     label: 'Cảnh báo nguy kịch',          href: '/dashboard/hospital/queue?severity=critical' },

  { type: 'header', label: 'Vận Hành & Nhân Sự' },
  { icon: Users,           label: 'Quản lý nhân lực',            href: '/dashboard/hospital/workforce' },
  { icon: Package,         label: 'Kho dược & Cấp phát',         href: '/dashboard/hospital/pharmacy' },

  { type: 'header', label: 'Viện Phí & Bảo Hiểm' },
  { icon: CircleDollarSign, label: 'Viện phí & Thanh toán',       href: '/dashboard/hospital/billing' },
  { icon: FileText,        label: 'Cổng giám định BHYT',         href: '/dashboard/hospital/bhyt' },
  { icon: FileText,        label: 'Hợp đồng bảo hiểm',           href: '/dashboard/hospital/contracts' },

  { type: 'header', label: 'Chất Lượng & An Toàn' },
  { icon: ShieldCheck,     label: 'Sự cố an toàn bệnh nhân',     href: '/dashboard/hospital/safety/incidents' },
  { icon: ShieldCheck,     label: 'Kiểm toán an toàn',           href: '/dashboard/hospital/safety/audit' },

  { type: 'header', label: 'Phân Tích & Quản Trị' },
  { icon: BarChart3,       label: 'Báo cáo phân tích BI',        href: '/dashboard/hospital/reports' },
  { icon: LineChart,       label: 'Doanh thu & Chi phí P&L',     href: '/dashboard/hospital/reports/revenue' },
  { icon: Layers,          label: 'Quản trị nền tảng',           href: '/dashboard/rules' },
  { icon: Settings,        label: 'Cài đặt hệ thống',            href: '/dashboard/settings' },
];

// ─── Bella Education Preschool Module Menu (Dedicated) ───
const bellaEducationMenuItems: SidebarMenuItem[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', href: '/dashboard/education' },
  { icon: Baby, label: 'Quản lý trẻ', href: '/dashboard/education/enrollments' },
  { icon: BookOpen, label: 'Quản lý lớp học', href: '/dashboard/education/courses' },
  { icon: UserCheck, label: 'Quản lý giáo viên', href: '/dashboard/education/teachers' },
  { icon: Heart, label: 'Chăm sóc & Nuôi dưỡng', href: '/dashboard/education/care' },
  { icon: GraduationCap, label: 'Học tập & Hoạt động', href: '/dashboard/education/grades' },
  { icon: MessageSquare, label: 'Truyền thông', href: '/dashboard/education/communication' },
  { icon: CircleDollarSign, label: 'Tài chính', href: '/dashboard/education/finance' },
  { icon: Building2, label: 'Cơ sở vật chất', href: '/dashboard/education/facilities' },
  { icon: BarChart3, label: 'Báo cáo thống kê', href: '/dashboard/education/reports' },
  { icon: Settings, label: 'Cài đặt', href: '/dashboard/settings' },
];

const customerMenuItems: SidebarMenuItem[] = [
  { icon: Flower2,       label: 'Tiến trình liệu trình', href: '/dashboard/customer' },
  { icon: Calendar,      label: 'Lịch sử buổi làm',      href: '/dashboard/customer/history' },
  { icon: MessageSquare, label: 'Thông báo',              href: '/dashboard/customer/notifications' },
  { icon: Settings,      label: 'Hồ sơ cá nhân',          href: '/dashboard/customer/profile' },
];

const LUCIDE_ICONS_MAP: Record<string, LucideIcon> = {
  Building2,
  FolderKanban,
  Grid,
  FileText,
  Users,
  LayoutDashboard,
  Sparkles,
  Wallet,
  DollarSign,
  HelpCircle,
  Settings,
  Flower2,
  Calendar,
  MessageSquare,
  Package,
  ShoppingCart,
  Banknote,
  ClipboardList,
  LineChart,
  Sliders,
  BarChart3,
  LifeBuoy,
  Megaphone,
  FileArchive,
  FileBarChart2,
  Search,
  ShieldCheck,
  Car,
  GitCommit,
  Smile,
  CircleDollarSign,
  Wrench,
  Activity,
  Bed,
  Hospital,
  Tablets,
  ShieldAlert,
  AlertCircle,
  Layers,
  BookOpen,
  UserPlus,
  CalendarCheck,
  GraduationCap,
  Baby,
  Heart,
  Utensils,
  Award,
};


export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isDashboardHome = pathname?.replace(/\/+$/, '') === '/dashboard';
  const { product, isLoading: isUserLoading, user: currentUser, tenantSettings: fullTenantSettings, tenantPresentation } = useUser();
  const tenantSettings = tenantPresentation ?? fullTenantSettings;
  const isHaircut = product?.productKey === 'bella_haircut';
  const isPreschool = product?.productKey === 'bella_preschool';
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);
  const [tenantBrand, setTenantBrand] = useState<TenantBrandDisplay>(NEUTRAL_SIDEBAR_BRAND);
  const [isTenantBrandResolved, setIsTenantBrandResolved] = useState<boolean>(false);
  const [resolvedIdentityKey, setResolvedIdentityKey] = useState<string | null>(null);
  const identityKey = tenantSettings ? resolveDashboardPresentation(tenantSettings, product)?.identityKey ?? null : null;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMobileRefreshing, setIsMobileRefreshing] = useState(false);

  useLayoutEffect(() => {
    if (isUserLoading || !tenantSettings || !currentUser || currentUser.tenant_id !== tenantSettings.id) return;
    const presentation = resolveDashboardPresentation(tenantSettings, product);
    if (!presentation) return;
    const resolvedBrand = presentation.brand;
    setUser(currentUser);
    setTenantBrand(resolvedBrand);
    setIsTenantBrandResolved(true);
    setResolvedIdentityKey(presentation.identityKey);
    writeCachedTenantBrand(currentUser.tenant_id, resolvedBrand);
    const perms = fullTenantSettings?.role_permissions as Record<string, RolePermissions | undefined> | null | undefined;
    setRolePermissions(currentUser.role && currentUser.role !== 'admin' && currentUser.role !== 'customer' ? perms?.[currentUser.role] || null : null);
  }, [product, isUserLoading, currentUser, tenantSettings, fullTenantSettings]);

  useEffect(() => {
    if (!isTenantBrandResolved || resolvedIdentityKey !== identityKey) return;
    applyDashboardProductBrand(tenantBrand);
  }, [isTenantBrandResolved, tenantBrand, resolvedIdentityKey, identityKey]);

  useEffect(() => {
    const handleBrandChange = (e: Event) => {
      const customEvt = e as CustomEvent<TenantBrandDisplay>;
      if (customEvt.detail) {
        setTenantBrand(customEvt.detail);
        setIsTenantBrandResolved(true);
        applyDashboardProductBrand(customEvt.detail);
      }
    };
    window.addEventListener('brand-theme-change', handleBrandChange);
    return () => window.removeEventListener('brand-theme-change', handleBrandChange);
  }, []);

  const handleNavigation = () => {
    setIsOpen(false);
  };

  const handleMobileRefresh = async () => {
    if (isMobileRefreshing) return;

    setIsMobileRefreshing(true);
    const refreshEvent = createPageRefreshEvent('mobile-header');
    window.dispatchEvent(refreshEvent);

    if (!refreshEvent.detail.handled) {
      window.location.reload();
      return;
    }

    try {
      const refreshDone = refreshEvent.detail.done?.catch((error) => {
        console.error('Mobile refresh failed', error);
      }) ?? Promise.resolve();
      await Promise.race([
        refreshDone,
        new Promise<void>((resolve) => window.setTimeout(resolve, MOBILE_REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setIsMobileRefreshing(false);
    }
  };

  // ── Menu resolution: bella_auto, real_estate, bella_healthcare use hardcoded menus ──
  // Other verticals use verticalRegistry for simpler menu structure.
  const baseMenuItems: SidebarMenuItem[] = tenantBrand.moduleKey === 'pending'
    ? []
    : user?.role?.toLowerCase() === 'customer'
    ? customerMenuItems
    : tenantBrand.moduleKey === 'bella_auto'
    ? bellaAutoMenuItems
    : tenantBrand.moduleKey === 'real_estate'
    ? realEstateMenuItems
    : tenantBrand.moduleKey === 'bella_education'
    ? bellaEducationMenuItems
    : tenantBrand.moduleKey === 'bella_healthcare'
    ? (tenantBrand.isHospitalInpatient
        ? bellaHospitalInpatientMenuItems
        : /dental|nha khoa/i.test(tenantBrand.displayName) || /clinical management/i.test(tenantBrand.subtitle)
          ? bellaDentalMenuItems
          : bellaMedicalClinicMenuItems)
    : verticalRegistry.has(tenantBrand.moduleKey)
    ? [
        { type: 'header', label: verticalRegistry.get(tenantBrand.moduleKey)?.name || 'Phân hệ' },
        ...(verticalRegistry.get(tenantBrand.moduleKey)?.menus.map(m => ({
          icon: m.icon ? (LUCIDE_ICONS_MAP[m.icon] || LayoutDashboard) : LayoutDashboard,
          label: m.label,
          href: m.href
        })) || []),
        { type: 'header', label: 'Tài chính & Hệ thống' },
        { icon: Wallet,          label: 'Outbox Kế toán TT133', href: '/dashboard/accounting' },
        { icon: Settings,        label: 'Cài đặt',              href: '/dashboard/settings' },
      ]
    : menuItems.filter(item => {
        if (isMenuHeader(item)) {
          return true; // Keep headers for post-processing cleanup
        }
        if (user && user.role !== 'admin' && user.role !== 'customer') {
          return isSidebarItemAllowed({
            role: user.role,
            label: item.label,
            rolePermissions,
          });
        }
        return true;
      });

  const moduleAwareMenuItems = baseMenuItems.map((item): SidebarMenuItem => {
    if (isMenuHeader(item) || item.href !== '/dashboard/sessions') return item;
    if (isHaircut) {
      return { ...item, label: 'Gói & Membership' };
    }
    // Industrial Cleaning: "Phiếu công việc"
    if (tenantBrand.moduleKey === 'industrial_cleaning') {
      return { ...item, label: 'Phiếu công việc' };
    }
    // Beauty Spa: "Liệu trình"
    if (tenantBrand.isBeautySpa) {
      return { ...item, label: 'Liệu trình' };
    }
    // Babycare (default): "Đơn đặt lịch"
    return { ...item, label: 'Đơn đặt lịch' };
  });

  const filteredMenuItems = [...moduleAwareMenuItems];

  // KTV gets a personal income shortcut instead
  if (user?.role?.toLowerCase() === 'ktv') {
    const hasIncome = filteredMenuItems.some((item) => item.label === 'Thu nhập cá nhân');
    if (!hasIncome) {
      filteredMenuItems.push({ icon: DollarSign, label: 'Thu nhập cá nhân', href: '/ktv/earnings' });
    }
  }

  // Post-process to remove headers that have no active links following them
  const finalMenuItems: SidebarMenuItem[] = [];
  let currentHeader: MenuHeader | null = null;
  let hasItemsInHeader = false;

  filteredMenuItems.forEach((item) => {
    if (isMenuHeader(item)) {
      if (currentHeader && hasItemsInHeader) {
        finalMenuItems.push(currentHeader);
      }
      currentHeader = item;
      hasItemsInHeader = false;
    } else {
      if (currentHeader) {
        finalMenuItems.push(currentHeader);
        currentHeader = null;
      }
      finalMenuItems.push(item);
      hasItemsInHeader = true;
    }
  });

  const activeHref = finalMenuItems
    .filter((item): item is MenuLink => !isMenuHeader(item))
    .map((item) => item.href)
    .filter((href) => isPathActive(pathname, searchParams, href))
    .sort((a, b) => b.length - a.length)[0];

  const handleLogout = async () => {
    try {
      clearDashboardClientContextCache();
      clearTenantBrandRuntimeCache();
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (e) {
      console.error('Logout error:', e);
      router.push('/login');
    }
  };

  const roleLabel =
    user?.role?.toLowerCase() === 'ktv' ? 'Kỹ thuật viên'
    : user?.role?.toLowerCase() === 'ktv_lead' ? 'KTV Trưởng'
    : user?.role?.toLowerCase() === 'admin_staff' ? 'Lễ tân / Staff'
    : user?.role?.toLowerCase() === 'accountant' ? 'Kế toán'
    : user?.role?.toLowerCase() === 'hr' ? 'Nhân sự'
    : user?.role?.toLowerCase() === 'customer' ? 'Khách hàng'
    : 'Quản trị viên';
  const isBeautySpaShell = tenantBrand.isBeautySpa;
  const isIndustrialCleaningShell = tenantBrand.moduleKey === 'industrial_cleaning';
  const isRealEstateShell = tenantBrand.moduleKey === 'real_estate';
  const isBellaAutoShell = tenantBrand.moduleKey === 'bella_auto';
  const isBellaHealthcareShell = tenantBrand.moduleKey === 'bella_healthcare';
  const isBellaEducationShell = tenantBrand.moduleKey === 'bella_education';

  if (isUserLoading || !identityKey || !tenantSettings || currentUser?.tenant_id !== tenantSettings.id || !isTenantBrandResolved || resolvedIdentityKey !== identityKey) {
    return <aside aria-label="Đang tải cấu hình chi nhánh" className="hidden w-[243px] shrink-0 border-r border-slate-200 bg-slate-50 lg:block dark:border-slate-800 dark:bg-slate-950" />;
  }

  return (
    <>
      {/* ── Mobile Top Header Bar (lg:hidden) ── */}
      <div className={cn(
        "lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#091A2D]/95 border-b border-slate-200 dark:border-[#243F52] backdrop-blur-md z-30 px-6 flex items-center justify-between shadow-[0_2px_15px_rgba(0,0,0,0.02)] transition-colors duration-300",
        (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-mobile-header"
      )}>
        <div className="flex w-20 items-center justify-start">
          <button
            onClick={() => setIsOpen(true)}
            className={cn(
              "p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-sm",
              (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-icon-button"
            )}
          >
            <Menu className="w-5.5 h-5.5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <TenantBrandLogo
            displayName={tenantBrand.displayName}
            logoUrl={tenantBrand.logoUrl}
            monogram={tenantBrand.monogram}
            className="w-7 h-7 text-[10px]"
            markClassName={cn("rounded-xl", (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-logo-mark")}
          />
          <span className={cn(
            "max-w-[9rem] truncate font-sans font-extrabold text-lg text-slate-900 dark:text-white leading-none mt-0.5",
            (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-brand-script"
          )}>
            {tenantBrand.displayName.toLowerCase().endsWith('headquarter')
              ? tenantBrand.displayName.slice(0, -11).trim()
              : tenantBrand.displayName}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 relative">
          <button
            type="button"
            onClick={handleMobileRefresh}
            disabled={isMobileRefreshing}
            aria-label="Làm mới dữ liệu"
            title="Làm mới dữ liệu"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:scale-95 disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
              (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-icon-button"
            )}
          >
            <RefreshCw className={cn('h-4 w-4', isMobileRefreshing && 'animate-spin')} />
          </button>
          
          {user?.role && user.role !== 'customer' && (
            isPreschool ? <Link
              href="/dashboard/education/communication?tab=announcements"
              aria-label="Bảng tin chung"
              title="Bảng tin chung"
              onClick={handleNavigation}
              className="shrink-0 rounded-lg p-2 text-foreground transition-colors hover:bg-muted"
            ><Megaphone className="h-4 w-4" /></Link>
              : <AdminNotificationBell position="bottom" className="shrink-0" />
          )}
        </div>
      </div>

      {/* ── Overlay Backdrop for Mobile ── */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 
        Responsive Sidebar
        - Desktop: 243px sidebar in the dashboard flex layout
        - Mobile: Slide-out fixed drawer based on `isOpen` state
      */}
      <aside className={cn(
        "bg-slate-50/70 dark:bg-[#111318] border-r border-slate-200/60 dark:border-slate-800/60 p-2.5 flex flex-col h-screen lg:h-screen h-[100dvh] fixed inset-y-0 left-0 z-50 transform lg:translate-x-0 lg:relative lg:inset-auto lg:z-auto transition-transform duration-300 ease-in-out overflow-hidden shrink-0 w-[243px]",
        isBeautySpaShell && "beauty-erp-sidebar",
        isIndustrialCleaningShell && "beauty-erp-sidebar",
        isRealEstateShell && "beauty-erp-sidebar",
        isBellaAutoShell && "beauty-erp-sidebar",
        isBellaHealthcareShell && "beauty-erp-sidebar",
        isBellaEducationShell && "preschool-sidebar",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className={cn(
          "flex-1 beauty-erp-sidebar-inner rounded-[2.25rem] flex flex-col overflow-hidden shadow-2xs relative",
          isBellaEducationShell && "border-emerald-800/40 dark:border-emerald-950/60"
        )}>
        {/* Soft decorative light glows */}
        <div className={cn(
          "absolute -top-24 -left-24 w-64 h-64 bg-slate-300/20 dark:bg-slate-800/10 rounded-full blur-[100px] pointer-events-none hidden"
        )} />

        {/* Preschool subtle smiling sun watermark */}
        {isBellaEducationShell && (
          <div className="absolute bottom-28 -left-3 w-28 h-28 opacity-15 pointer-events-none text-emerald-300 select-none z-0">
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="50" cy="50" r="24" />
              <path d="M50 14v8M50 78v8M14 50h8M78 50h8M24.5 24.5l5.5 5.5M70 70l5.5 5.5M24.5 75.5l5.5-5.5M70 30l5.5-5.5" />
              <circle cx="43" cy="46" r="2.5" fill="currentColor" />
              <circle cx="57" cy="46" r="2.5" fill="currentColor" />
              <path d="M42 56c2.5 4 13.5 4 16 0" />
            </svg>
          </div>
        )}

        {/* ── Logo & Mobile Close Button ── */}
        <div className={cn(
          "px-8 pt-6 pb-4 shrink-0 relative z-10 flex items-center justify-between lg:block",
          isBellaEducationShell && "px-6 pt-4 pb-2"
        )}>
          {isBellaEducationShell ? (
            <Link href="/dashboard/education" onClick={handleNavigation} className="flex flex-col items-center group">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-xl shadow-xs mb-1.5 group-hover:scale-105 transition-transform duration-300">
                ☀️
              </div>
              <div className="text-center w-full px-2">
                <h2 className="text-base font-black text-white tracking-tight leading-tight">
                  {tenantBrand.displayName || 'Hệ thống'}
                </h2>
                <span className="text-[10px] font-bold text-emerald-200/80 block mt-0.5">
                  Nơi tuổi thơ tỏa sáng
                </span>
              </div>
            </Link>
          ) : (
            <Link href={tenantBrand.moduleKey === 'bella_auto' ? "/dashboard/bella-auto" : tenantBrand.moduleKey === 'real_estate' ? "/dashboard/real-estate" : "/dashboard"} onClick={handleNavigation} className="flex flex-col items-center group">
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-primary/20 dark:bg-[#E5B861]/15 blur-2xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-500" />
                <TenantBrandLogo
                  displayName={tenantBrand.displayName}
                  logoUrl={tenantBrand.logoUrl}
                  monogram={tenantBrand.monogram}
                  className="w-16 h-16 relative z-10 transform group-hover:rotate-[5deg] transition-transform duration-500 text-xl"
                  markClassName={cn("rounded-[1.75rem]", (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-logo-mark beauty-erp-logo-mark-large")}
                />
              </div>
              <div className="text-center w-full px-2">
                <h2 className={cn(
                  "mb-1 drop-shadow-sm text-center transition-all duration-300",
                  isBeautySpaShell 
                    ? "text-[1.8rem] font-handwriting beauty-erp-brand-script" 
                    : "text-lg font-extrabold tracking-tight uppercase font-sans beauty-erp-brand-script"
                )}>
                  {tenantBrand.displayName.toLowerCase().endsWith('headquarter') ? (
                    <span className="flex flex-col items-center">
                      <span className="leading-tight block break-words whitespace-normal">{tenantBrand.displayName.slice(0, -11).trim()}</span>
                      <span className="text-[0.75rem] mt-1 leading-none font-sans font-black tracking-widest uppercase opacity-75">
                        Headquarter
                      </span>
                    </span>
                  ) : (
                    <span className="block break-words whitespace-normal leading-snug px-1">
                      {tenantBrand.displayName}
                    </span>
                  )}
                </h2>
                {/* Subtitle hidden to prevent cross-vertical identity leaks */}
              </div>
            </Link>
          )}

          {/* Close button inside Drawer for Mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className={cn(
              "lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all",
              isBellaEducationShell && "preschool-sidebar-close",
              (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-icon-button"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <BeautyRuntimeBranchSelector enabled={isBeautySpaShell && user?.role?.toLowerCase() !== 'customer'} />

        {/* ── Nav (scrollable) ── */}
        <nav className={cn(
          "flex-1 min-h-0 px-3 space-y-1 overflow-y-auto relative z-10 pb-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent [&::-webkit-scrollbar-thumb]:rounded-full",
          isBellaEducationShell && "px-2.5 space-y-0.5 pb-1 [&::-webkit-scrollbar-thumb]:bg-emerald-800/40",
          isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell
            ? "" 
            : "[&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700",
          (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-nav-scroll"
        )}>
          {finalMenuItems.map((item, idx) => {
            if (isMenuHeader(item)) {
              return (
                <div 
                  key={`header-${idx}`} 
                  className={cn(
                    "px-3 pt-2.5 pb-1 text-[9px] font-extrabold uppercase tracking-[0.18em] relative z-10 select-none pointer-events-none mt-3 first:mt-1",
                    isBellaEducationShell
                      ? "text-[var(--education-sidebar-fg)] opacity-70"
                      : "text-primary/60 dark:text-[#E5B861]/60",
                    (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-nav-header"
                  )}
                >
                  {item.label}
                </div>
              );
            }

            const isActive = activeHref === item.href;
            const isRosePreset = tenantBrand.stylePreset === 'bella_rose' || tenantBrand.primaryColor === '#A91555' || tenantBrand.primaryColor === '#BE123C';
            const isOceanPreset = tenantBrand.stylePreset === 'ocean_clean' || tenantBrand.primaryColor === '#1E40AF';
            const isJadePreset = tenantBrand.stylePreset === 'jade_wellness' || tenantBrand.primaryColor === '#074E44';
            const isNavyPreset = tenantBrand.stylePreset === 'luxury_navy' || tenantBrand.primaryColor === '#1E3A8A';

            const activeEduClass = isRosePreset
              ? "bg-rose-100/90 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60 font-extrabold shadow-xs"
              : isOceanPreset
              ? "bg-blue-100/90 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60 font-extrabold shadow-xs"
              : isJadePreset
              ? "bg-white/15 dark:bg-white/10 text-white border border-white/20 font-bold shadow-xs backdrop-blur-xs"
              : isNavyPreset
              ? "bg-indigo-100/90 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/60 font-extrabold shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-700 font-extrabold shadow-xs";

            const inactiveEduClass = isRosePreset
              ? "text-slate-600 dark:text-slate-400 bg-transparent border-transparent hover:bg-rose-50/80 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-300 font-medium"
              : isOceanPreset
              ? "text-slate-600 dark:text-slate-400 bg-transparent border-transparent hover:bg-blue-50/80 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-300 font-medium"
              : isJadePreset
              ? "text-emerald-100/75 hover:text-white bg-transparent border-transparent hover:bg-white/10 font-medium transition-colors"
              : isNavyPreset
              ? "text-slate-600 dark:text-slate-400 bg-transparent border-transparent hover:bg-indigo-50/80 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              : "text-slate-600 dark:text-slate-400 bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium";

            const activeEduIconClass = isRosePreset
              ? "text-rose-600 dark:text-rose-400 scale-105"
              : isOceanPreset
              ? "text-blue-600 dark:text-blue-400 scale-105"
              : isJadePreset
              ? "text-emerald-300 scale-105"
              : isNavyPreset
              ? "text-indigo-600 dark:text-indigo-400 scale-105"
              : "text-slate-900 dark:text-slate-100 scale-105";

            const activeEduTextClass = isRosePreset
              ? "font-extrabold text-rose-700 dark:text-rose-300"
              : isOceanPreset
              ? "font-extrabold text-blue-700 dark:text-blue-300"
              : isJadePreset
              ? "font-bold text-white"
              : isNavyPreset
              ? "font-extrabold text-indigo-900 dark:text-indigo-300"
              : "font-extrabold text-slate-900 dark:text-white";

            const activeEduPillClass = isRosePreset
              ? "bg-rose-600 dark:bg-rose-400"
              : isOceanPreset
              ? "bg-blue-600 dark:bg-blue-400"
              : isJadePreset
              ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
              : isNavyPreset
              ? "bg-indigo-600 dark:bg-indigo-400"
              : "bg-slate-700 dark:bg-slate-300";

            return (
              <Link key={item.href} href={isPreschool && item.href === '/dashboard/education/communication'
                ? '/dashboard/education/communication?tab=announcements' : item.href} onClick={handleNavigation} aria-current={isActive ? 'page' : undefined} prefetch={false}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300 relative group cursor-pointer border border-transparent",
                    isBellaEducationShell && "py-1.5 px-2.5",
                    isBellaEducationShell && isActive
                      ? activeEduClass
                      : isBellaEducationShell
                      ? inactiveEduClass
                      : (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-nav-item",
                    (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && isActive && "beauty-erp-nav-item-active",
                    !isBellaEducationShell && (
                      // Real estate: CSS owns all visual state — emit NO color/bg classes
                      isRealEstateShell
                        ? ""
                        : isActive
                        ? (isBellaAutoShell || isBellaHealthcareShell)
                          ? "bg-white text-[#042f2e] border-amber-400/60 shadow-[0_2px_10px_rgba(0,0,0,0.18)] ring-1 ring-amber-400/40 backdrop-blur-md font-bold"
                          : (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell)
                          ? "border-transparent shadow-[0_4px_18px_rgba(0,0,0,0.22)] ring-1 ring-amber-400/40"
                          : "bg-white text-primary border-primary/20 shadow-[0_2px_10px_rgba(219,39,119,0.12)] ring-1 ring-primary/20 dark:bg-[#112E43]/70 dark:text-[#F3F5F7] dark:border-[#243F52] dark:ring-[#E5B861]/20 dark:shadow-none"
                        : (isBellaAutoShell || isBellaHealthcareShell)
                        ? "text-slate-100 bg-transparent border-transparent hover:bg-white/12 hover:text-white hover:shadow-[0_2px_10px_rgba(245,158,11,0.18)] hover:border-amber-400/35"
                        : "text-[#8A6D7C] bg-transparent border-transparent hover:bg-white/70 hover:text-primary hover:shadow-[0_2px_10px_rgba(219,39,119,0.03)] hover:border-[#FFE4E6]/50 dark:text-[#D8E3EA] dark:hover:bg-[#112E43]/50 dark:hover:text-[#F3F5F7] dark:hover:border-[#243F52]/50"
                    )
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 transition-all duration-300 shrink-0",
                    isBellaEducationShell
                      ? (isActive ? activeEduIconClass : "text-[var(--education-sidebar-fg)] opacity-75 group-hover:opacity-100")
                      // Real estate: CSS owns icon color — emit NO color classes, only scale
                      : isRealEstateShell
                      ? (isActive ? "scale-105" : "")
                      : (isBeautySpaShell || isIndustrialCleaningShell || isBellaAutoShell || isBellaHealthcareShell)
                      ? (isActive ? "text-[#042f2e] scale-105" : (isBellaAutoShell || isBellaHealthcareShell) ? "text-slate-200 opacity-90 group-hover:text-amber-300 group-hover:scale-110" : "text-inherit opacity-85 group-hover:text-white group-hover:opacity-100")
                      : (isActive ? "text-primary dark:text-[#E5B861] scale-105" : "text-[#A07888] dark:text-[#D8E3EA]/80 group-hover:text-primary dark:group-hover:text-[#E5B861]")
                  )} />
                  <span className={cn(
                    "text-[12.5px] tracking-tight transition-all duration-300 truncate",
                    isBellaEducationShell
                      ? (isActive ? activeEduTextClass : "font-medium text-[var(--education-sidebar-fg)] opacity-90 group-hover:opacity-100")
                      // Real estate: CSS owns span color — emit NO color classes, only weight hint
                      : isRealEstateShell
                      ? (isActive ? "font-extrabold" : "font-semibold")
                      : (isBeautySpaShell || isIndustrialCleaningShell || isBellaAutoShell || isBellaHealthcareShell)
                      ? (isActive ? "font-extrabold text-[#042f2e]" : (isBellaAutoShell || isBellaHealthcareShell) ? "font-semibold text-slate-100 group-hover:text-white" : "font-semibold text-inherit group-hover:text-white")
                      : (isActive ? "font-extrabold text-primary dark:text-[#F3F5F7]" : "font-semibold")
                  )}>{item.label}{isPreschool && ['/dashboard/education/teachers', '/dashboard/education/facilities', '/dashboard/education/grades', '/dashboard/education/finance'].includes(item.href) && <span className="ml-1 text-[10px] opacity-70"> · Chưa mở</span>}</span>

                  {/* Active Left Vertical Accent Bar for Preschool Shell */}
                  {isActive && isBellaEducationShell && (
                    <motion.div
                      layoutId="active-edu-indicator"
                      className={cn("w-1 h-5 rounded-full absolute left-1 top-1/2 -translate-y-1/2 shadow-xs", activeEduPillClass)}
                    />
                  )}

                  {isActive && !isBellaEducationShell && (
                    <motion.div
                      layoutId="active-indicator"
                      className={cn(
                        "absolute right-3.5 w-1.5 h-1.5 rounded-full",
                        (isBellaAutoShell || isBellaHealthcareShell)
                          ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]"
                          : isRealEstateShell
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                          : (isBeautySpaShell || isIndustrialCleaningShell)
                          ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                          : "bg-primary dark:bg-[#E5B861] shadow-[0_0_6px_rgba(219,39,119,0.4)] dark:shadow-[0_0_6px_rgba(229,184,97,0.4)]"
                      )}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* ── Theme Switcher, User Profile & Logout — pinned at bottom ── */}
        <div className={cn(
          "mt-auto shrink-0 relative z-10 px-2.5 pt-2 pb-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-2",
          isBellaEducationShell && "pt-1 pb-2 gap-1.5"
        )}>
          {/* Unified Profile & Actions Panel */}
          <div className={cn(
            "rounded-xl shadow-xs flex flex-col overflow-hidden transition-all duration-300",
            isBellaEducationShell
              ? "preschool-profile-card"
              : "bg-white dark:bg-[#181a20] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
            (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-profile-card"
          )}>
            <div className="p-2.5 flex items-center gap-2.5">
              <div className="relative shrink-0">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs transition-transform duration-300 group-hover:scale-105",
                  isBellaEducationShell ? "preschool-profile-avatar" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
                  (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-avatar"
                )}>
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 rounded-full", isBellaEducationShell ? "border-[var(--preschool-profile-bg)]" : "border-white dark:border-[#091A2D]")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs font-bold truncate leading-tight", isBellaEducationShell ? "preschool-profile-name" : "text-slate-800 dark:text-slate-100 beauty-erp-profile-name")}>
                  {user?.full_name || 'Admin'}
                </p>
                <p className={cn("text-[8.5px] font-black uppercase tracking-[0.08em] mt-0.5", isBellaEducationShell ? "preschool-profile-role" : "text-slate-500 dark:text-slate-400 beauty-erp-profile-role")}>
                  {roleLabel}
                </p>
              </div>
            </div>
            
            <div className={cn(
              "h-px w-full",
              isBellaEducationShell ? "preschool-profile-divider" : "bg-slate-200 dark:bg-slate-800",
              (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-profile-divider"
            )} />
            
            <div className="flex items-center justify-between p-1.5 gap-1 min-w-0">
               <div className="flex-1 min-w-0 px-0.5">
                 <ThemeToggle />
               </div>
               
               {user?.role && user.role !== 'customer' && !isDashboardHome && (
                 isPreschool ? <Link
                   href="/dashboard/education/communication?tab=announcements"
                   aria-label="Bảng tin chung"
                   title="Bảng tin chung"
                   onClick={handleNavigation}
                   className="preschool-profile-action shrink-0 rounded-lg p-1.5 transition-colors"
                 ><Megaphone className="h-3.5 w-3.5" /></Link>
                   : <AdminNotificationBell position="top" className={cn("shrink-0", isBellaEducationShell ? "preschool-profile-notifications" : "scale-90")} />
               )}

               <button 
                 onClick={handleLogout} 
                 title="Đăng xuất"
                 className={cn(
                   "p-1.5 rounded-lg transition-all shrink-0",
                   isBellaEducationShell ? "preschool-profile-action" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                   (isBeautySpaShell || isIndustrialCleaningShell || isRealEstateShell || isBellaAutoShell || isBellaHealthcareShell) && "beauty-erp-icon-button"
                 )}
               >
                 <LogOut className="w-3.5 h-3.5" />
               </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}



