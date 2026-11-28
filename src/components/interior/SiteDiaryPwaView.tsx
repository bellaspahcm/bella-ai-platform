'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  INTERIOR_ROLES,
  INTERIOR_ROLE_CHANGE_EVENT,
  getInteriorRoleDisplayName,
  normalizeInteriorRoleKey,
  getSimulatedInteriorRole,
  setSimulatedInteriorRole,
  type InteriorRoleKey,
} from '@/products/bella-interior/lib/interior-rbac-navigation';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
  status: string;
  customerName?: string;
  siteAddress?: string;
}

export interface DiaryPhotoUploadItem {
  id: string;
  url: string;
  filename: string;
  size: number;
  status: 'uploaded';
}

export interface SiteDiaryPhotoMeta {
  index: number;
  url?: string;
  storageType: 'supabase_storage' | 'r2_legacy' | 'cloudflare_r2';
  status: 'available' | 'r2_dns_pending';
  label: string;
}

export interface SiteDiaryItem {
  id: string;
  projectId: string;
  date: string;
  supervisorName: string;
  workersPresent: number;
  weatherCondition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  activitiesCompleted: string[];
  issuesEncountered: string[];
  notes: string;
  createdAt: string;
  photoUrls?: string[];
  photos?: SiteDiaryPhotoMeta[];
}

export interface ActorRoleEntry {
  id: string;
  roleKey: string;
  displayName: string;
  scopeType: 'TENANT' | 'BRANCH' | 'PROJECT' | 'SELF';
  scopeId: string | null;
}

export interface ActorDelegationEntry {
  id: string;
  roleKey: string;
  displayName: string;
}

export interface ActorDirectGrantEntry {
  id: string;
  permissionId: string;
  scopeType: 'TENANT' | 'BRANCH' | 'PROJECT' | 'SELF';
  scopeId: string | null;
}

export interface SiteCapabilities {
  canReadDiaries: boolean;
  canCreateDiary: boolean;
  canUpdateDiary: boolean;
  canUploadSitePhoto: boolean;
  canReadQc: boolean;
  canCreateQc: boolean;
  canUpdateQc: boolean;
  canApproveQc: boolean;
  canReadSchedule: boolean;
  canUpdateSchedule: boolean;
  canReadProduction: boolean;
  canReadWarranty: boolean;
  canCreateWarranty: boolean;
  canManageRoles: boolean;
}

interface SelfAccessPayload {
  actor: {
    id: string;
    email: string;
    fullName: string;
    legacyRole: string | null;
  };
  primaryRoleKey: InteriorRoleKey | null;
  roles: ActorRoleEntry[];
  delegations: ActorDelegationEntry[];
  directGrants: ActorDirectGrantEntry[];
  assignedProjectIds: string[];
  capabilities: SiteCapabilities;
}

interface QcPunchListItem {
  id: string;
  description: string;
  category: 'finishing' | 'structural' | 'furniture_fit' | 'electrical_coordination' | 'painting';
  severity: 'critical' | 'major' | 'minor';
  status: 'open' | 'in_progress' | 'rectified' | 'verified';
  roomZoneName?: string;
  createdAt: string;
}

interface InstallationRoomItem {
  id: string;
  roomZoneName?: string;
  roomName?: string;
  status: string;
  installerTeamLeader?: string;
  progressPercent: number;
  targetInstallDate?: string;
}

interface InstallationPlanItem {
  id: string;
  planNumber: string;
  siteSupervisorName: string;
  scheduledStartDate: string;
  scheduledEndDate: string;
  overallProgressPercent: number;
  rooms: InstallationRoomItem[];
}

interface ProductionOrderSummary {
  id: string;
  orderNumber: string;
  mode: string;
  status: string;
  workshopManagerName?: string;
  scheduledStartDate?: string;
  scheduledCompletionDate?: string;
}

interface WarrantyCertificateSummary {
  id: string;
  certificateNumber: string;
  status: string;
  warrantyEndDate: string;
  coverageScope?: string;
}

interface WarrantyTicketSummary {
  id: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface SiteDiaryPwaViewProps {
  standaloneMode?: boolean;
}

// ─── Quick Task Suggestions & Constants ───────────────────────────────────────

const QUICK_ACTIVITIES = [
  'Lắp đặt hệ tủ bếp trên & dưới',
  'Lắp tủ áo và giường phòng Master',
  'Ốp vách gỗ trang trí / lam sóng',
  'Căn chỉnh bản lề, ray trượt phụ kiện',
  'Đấu nối hệ thống đèn LED nội thất',
  'Vệ sinh công nghiệp & kiểm tra mặt bằng',
] as const;

const SITE_CONDITIONS = [
  { id: 'on_track', label: 'Đạt tiến độ', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' },
  { id: 'delayed', label: 'Cần đẩy nhanh / Hỗ trợ', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800' },
  { id: 'blocked', label: 'Vướng mặt bằng / Chờ vật tư', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800' },
] as const;

const QC_CATEGORIES: Array<{ value: QcPunchListItem['category']; label: string }> = [
  { value: 'furniture_fit', label: 'Lắp ráp đồ gỗ / Khe hở' },
  { value: 'finishing', label: 'Hoàn thiện bề mặt / Chỉ nẹp' },
  { value: 'painting', label: 'Sơn PU / Màu sắc' },
  { value: 'electrical_coordination', label: 'Điện nước / Đèn LED' },
  { value: 'structural', label: 'Tường trần / Mặt bằng' },
];

const WEATHER_OPTIONS: Array<{ id: 'sunny' | 'cloudy' | 'rainy' | 'stormy'; icon: string; label: string }> = [
  { id: 'sunny', icon: '☀️', label: 'Nắng' },
  { id: 'cloudy', icon: '⛅', label: 'Mây' },
  { id: 'rainy', icon: '🌧️', label: 'Mưa' },
  { id: 'stormy', icon: '⛈️', label: 'Bão' },
];

// ─── Image Compression Helper (Browser Only) ─────────────────────────────────

async function prepareImageFileForUpload(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 2 * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1920;
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size <= 4 * 1024 * 1024) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob && blob.size > 0 && blob.size < file.size) {
              const baseName = file.name.replace(/\.[^.]+$/, '');
              resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85,
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

// ─── Simulated Role Preview Capabilities (UI Preview Only; Server Always Enforces) ─

function resolveEffectiveCapabilities(
  serverCaps: SiteCapabilities | null,
  simulatedRole: InteriorRoleKey | null,
): SiteCapabilities {
  const base: SiteCapabilities = serverCaps ?? {
    canReadDiaries: false,
    canCreateDiary: false,
    canUpdateDiary: false,
    canUploadSitePhoto: false,
    canReadQc: false,
    canCreateQc: false,
    canUpdateQc: false,
    canApproveQc: false,
    canReadSchedule: false,
    canUpdateSchedule: false,
    canReadProduction: false,
    canReadWarranty: false,
    canCreateWarranty: false,
    canManageRoles: false,
  };

  if (!simulatedRole) return base;

  const isExecutiveOrAdmin = simulatedRole === 'OWNER' || simulatedRole === 'ADMIN';
  const isSiteOrPm = simulatedRole === 'SITE_MANAGER' || simulatedRole === 'PM';
  const isQc = simulatedRole === 'QC';
  const isProd = simulatedRole === 'PRODUCTION_MANAGER';
  const isWarranty = simulatedRole === 'WARRANTY';

  return {
    canReadDiaries: isExecutiveOrAdmin || isSiteOrPm || isQc || simulatedRole === 'EXECUTIVE',
    canCreateDiary: isExecutiveOrAdmin || isSiteOrPm,
    canUpdateDiary: isExecutiveOrAdmin || isSiteOrPm,
    canUploadSitePhoto: isExecutiveOrAdmin || isSiteOrPm || isQc,
    canReadQc: isExecutiveOrAdmin || isSiteOrPm || isQc || isProd || isWarranty,
    canCreateQc: isExecutiveOrAdmin || isSiteOrPm || isQc || isProd,
    canUpdateQc: isExecutiveOrAdmin || isSiteOrPm || isQc,
    canApproveQc: isExecutiveOrAdmin || isQc,
    canReadSchedule: isExecutiveOrAdmin || isSiteOrPm || isQc || simulatedRole === 'DESIGNER' || isProd,
    canUpdateSchedule: isExecutiveOrAdmin || simulatedRole === 'PM',
    canReadProduction: isExecutiveOrAdmin || isSiteOrPm || isQc || isProd || simulatedRole === 'DESIGNER' || simulatedRole === 'QS' || simulatedRole === 'EXECUTIVE',
    canReadWarranty: isExecutiveOrAdmin || isSiteOrPm || isQc || isWarranty || simulatedRole === 'SALES' || simulatedRole === 'EXECUTIVE',
    canCreateWarranty: isExecutiveOrAdmin || isWarranty,
    canManageRoles: isExecutiveOrAdmin,
  };
}

// ─── Inline Icons ────────────────────────────────────────────────────────────

function IconCamera({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function IconCloudDone({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

export default function SiteDiaryPwaView({ standaloneMode = false }: SiteDiaryPwaViewProps) {
  // ─── State: Connectivity & PWA ──────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [authRequiredError, setAuthRequiredError] = useState<boolean>(false);

  // ─── State: Self Access, Roles, Delegations & Custom Grants ─────────────────
  const [selfAccess, setSelfAccess] = useState<SelfAccessPayload | null>(null);
  const [simulatedRole, setSimulatedRoleState] = useState<InteriorRoleKey | null>(null);
  const [isLoadingAccess, setIsLoadingAccess] = useState<boolean>(true);

  // ─── State: Projects ────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);

  // ─── State: Diaries, QC & Schedule Data ─────────────────────────────────────
  const [diaries, setDiaries] = useState<SiteDiaryItem[]>([]);
  const [isLoadingDiaries, setIsLoadingDiaries] = useState<boolean>(false);
  const [diaryReadDenied, setDiaryReadDenied] = useState<boolean>(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  const [qcItems, setQcItems] = useState<QcPunchListItem[]>([]);
  const [isLoadingQc, setIsLoadingQc] = useState<boolean>(false);
  const [qcDesc, setQcDesc] = useState<string>('');
  const [qcCategory, setQcCategory] = useState<QcPunchListItem['category']>('furniture_fit');
  const [qcSeverity, setQcSeverity] = useState<QcPunchListItem['severity']>('major');
  const [isSubmittingQc, setIsSubmittingQc] = useState<boolean>(false);

  const [plans, setPlans] = useState<InstallationPlanItem[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(false);

  const [productionOrders, setProductionOrders] = useState<ProductionOrderSummary[]>([]);
  const [isLoadingProduction, setIsLoadingProduction] = useState<boolean>(false);

  const [warrantyCerts, setWarrantyCerts] = useState<WarrantyCertificateSummary[]>([]);
  const [warrantyTickets, setWarrantyTickets] = useState<WarrantyTicketSummary[]>([]);
  const [isLoadingWarranty, setIsLoadingWarranty] = useState<boolean>(false);

  // ─── State: Daily Site Diary Form ───────────────────────────────────────────
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy'>('sunny');
  const [siteCondition, setSiteCondition] = useState<'on_track' | 'delayed' | 'blocked'>('on_track');
  const [workersCount, setWorkersCount] = useState<number>(4);
  const [carpenters, setCarpenters] = useState<number>(2);
  const [electricians, setElectricians] = useState<number>(1);
  const [painters, setPainters] = useState<number>(1);
  const [activities, setActivities] = useState<string[]>([]);
  const [newActivityInput, setNewActivityInput] = useState<string>('');
  const [issues, setIssues] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // ─── State: Edit Existing Diary Modal ───────────────────────────────────────
  const [editingDiary, setEditingDiary] = useState<SiteDiaryItem | null>(null);
  const [editWorkers, setEditWorkers] = useState<number>(0);
  const [editWeather, setEditWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy'>('sunny');
  const [editActivitiesText, setEditActivitiesText] = useState<string>('');
  const [editIssuesText, setEditIssuesText] = useState<string>('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── State: Cloudflare R2 Uploads ───────────────────────────────────────────
  const [uploadedPhotos, setUploadedPhotos] = useState<DiaryPhotoUploadItem[]>([]);
  const [uploadingCount, setUploadingCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // ─── State: Navigation & Feedback ───────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'diary' | 'history' | 'qc' | 'progress' | 'production' | 'warranty'>('diary');

  // ─── Connectivity & PWA Install Event Listeners ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // ─── Sync Simulated Role with Sidebar Selector ──────────────────────────────
  useEffect(() => {
    setSimulatedRoleState(getSimulatedInteriorRole());
    const handleRoleChange = (e: Event) => {
      const customEvt = e as CustomEvent<{ role: InteriorRoleKey | null }>;
      setSimulatedRoleState(customEvt.detail?.role ?? null);
    };
    window.addEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleChange);
    return () => window.removeEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleChange);
  }, []);

  // ─── Local Draft Hydration & Save ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedProjectId || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(`bella_site_diary_draft_${selectedProjectId}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        activities?: string[];
        issues?: string;
        notes?: string;
        workersCount?: number;
        weather?: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
      };
      if (Array.isArray(draft.activities) && draft.activities.length > 0) setActivities(draft.activities);
      if (typeof draft.issues === 'string') setIssues(draft.issues);
      if (typeof draft.notes === 'string') setNotes(draft.notes);
      if (typeof draft.workersCount === 'number') setWorkersCount(draft.workersCount);
      if (draft.weather) setWeather(draft.weather);
    } catch {
      // Ignore draft parse failures
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || typeof window === 'undefined') return;
    try {
      const hasDraftContent = activities.length > 0 || issues.trim().length > 0 || notes.trim().length > 0;
      const key = `bella_site_diary_draft_${selectedProjectId}`;
      if (hasDraftContent) {
        window.localStorage.setItem(key, JSON.stringify({
          activities,
          issues,
          notes,
          workersCount,
          weather,
        }));
      }
    } catch {
      // Ignore localStorage quota issues
    }
  }, [selectedProjectId, activities, issues, notes, workersCount, weather]);

  // ─── Fetch Actor Access (Roles + Direct Grants + Delegations) ────────────────
  const fetchSelfAccess = useCallback(async (projId?: string) => {
    try {
      setIsLoadingAccess(true);
      const url = projId
        ? `/api/interior/me/access?projectId=${encodeURIComponent(projId)}`
        : '/api/interior/me/access';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 401) {
        setAuthRequiredError(true);
        return;
      }
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: SelfAccessPayload };
        if (json.success && json.data) {
          setSelfAccess(json.data);
          setAuthRequiredError(false);
        }
      }
    } catch {
      // Non-blocking on temporary network loss
    } finally {
      setIsLoadingAccess(false);
    }
  }, []);

  // ─── Fetch Real Projects (/api/interior/projects) ───────────────────────────
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      const res = await fetch('/api/interior/projects', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthRequiredError(true);
        return;
      }
      if (res.ok) {
        const json = (await res.json()) as {
          success?: boolean;
          data?: { projects?: Array<Record<string, unknown>> };
        };
        const rawList = Array.isArray(json.data?.projects) ? json.data.projects : [];
        const mapped: ProjectOption[] = rawList
          .map((p) => ({
            id: String(p.id ?? ''),
            code: String(p.code ?? ''),
            name: String(p.name ?? ''),
            status: String(p.status ?? 'in_progress'),
            customerName: typeof p.customer_name === 'string'
              ? p.customer_name
              : typeof p.clientName === 'string' ? p.clientName : undefined,
            siteAddress: typeof p.site_address === 'string'
              ? p.site_address
              : typeof p.address === 'string' ? p.address : undefined,
          }))
          .filter((p) => p.id !== '');

        setProjects(mapped);
        if (mapped.length > 0) {
          setSelectedProjectId((prev) => (prev && mapped.some((p) => p.id === prev) ? prev : mapped[0].id));
        } else {
          setSelectedProjectId('');
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể tải danh sách dự án thi công từ hệ thống.' });
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // ─── Fetch Real Site Diaries ────────────────────────────────────────────────
  const fetchDiaries = useCallback(async (projId: string) => {
    if (!projId) {
      setDiaries([]);
      return;
    }
    try {
      setIsLoadingDiaries(true);
      setDiaryReadDenied(false);
      const res = await fetch(`/api/interior/delivery/site-diary?projectId=${encodeURIComponent(projId)}`, {
        cache: 'no-store',
      });
      if (res.status === 403) {
        setDiaryReadDenied(true);
        setDiaries([]);
        return;
      }
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: SiteDiaryItem[] };
        if (json.success && Array.isArray(json.data)) {
          setDiaries(json.data);
        }
      }
    } catch {
      // Keep prior diaries on temporary offline fluctuation
    } finally {
      setIsLoadingDiaries(false);
    }
  }, []);

  // ─── Fetch Real QC Punch List Items ─────────────────────────────────────────
  const fetchQcItems = useCallback(async (projId: string) => {
    if (!projId) {
      setQcItems([]);
      return;
    }
    try {
      setIsLoadingQc(true);
      const res = await fetch(`/api/interior/delivery/punch-list?projectId=${encodeURIComponent(projId)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: QcPunchListItem[] };
        if (json.success && Array.isArray(json.data)) {
          setQcItems(json.data);
        }
      } else {
        setQcItems([]);
      }
    } catch {
      setQcItems([]);
    } finally {
      setIsLoadingQc(false);
    }
  }, []);

  // ─── Fetch Real Installation Room Plans ─────────────────────────────────────
  const fetchInstallationPlans = useCallback(async (projId: string) => {
    if (!projId) {
      setPlans([]);
      return;
    }
    try {
      setIsLoadingPlans(true);
      const res = await fetch(`/api/interior/schedule?projectId=${encodeURIComponent(projId)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: { plans?: InstallationPlanItem[] } };
        if (json.success && Array.isArray(json.data?.plans)) {
          setPlans(json.data.plans);
        } else {
          setPlans([]);
        }
      }
    } catch {
      setPlans([]);
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  const fetchProductionOrders = useCallback(async (projId: string) => {
    if (!projId) {
      setProductionOrders([]);
      return;
    }
    try {
      setIsLoadingProduction(true);
      const res = await fetch(`/api/interior/production/orders?projectId=${encodeURIComponent(projId)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: { orders?: ProductionOrderSummary[] } };
        setProductionOrders(json.success && Array.isArray(json.data?.orders) ? json.data.orders : []);
      } else {
        setProductionOrders([]);
      }
    } catch {
      setProductionOrders([]);
    } finally {
      setIsLoadingProduction(false);
    }
  }, []);

  const fetchWarrantyOverview = useCallback(async (projId: string) => {
    if (!projId) {
      setWarrantyCerts([]);
      setWarrantyTickets([]);
      return;
    }
    try {
      setIsLoadingWarranty(true);
      const [certRes, ticketRes] = await Promise.all([
        fetch(`/api/interior/delivery/warranty?projectId=${encodeURIComponent(projId)}&type=certificates`, { cache: 'no-store' }),
        fetch(`/api/interior/delivery/warranty?projectId=${encodeURIComponent(projId)}&type=tickets`, { cache: 'no-store' }),
      ]);
      if (certRes.ok) {
        const certJson = (await certRes.json()) as { success?: boolean; data?: { certificates?: WarrantyCertificateSummary[] } };
        setWarrantyCerts(certJson.success && Array.isArray(certJson.data?.certificates) ? certJson.data.certificates : []);
      } else {
        setWarrantyCerts([]);
      }
      if (ticketRes.ok) {
        const ticketJson = (await ticketRes.json()) as { success?: boolean; data?: { tickets?: WarrantyTicketSummary[] } };
        setWarrantyTickets(ticketJson.success && Array.isArray(ticketJson.data?.tickets) ? ticketJson.data.tickets : []);
      } else {
        setWarrantyTickets([]);
      }
    } catch {
      setWarrantyCerts([]);
      setWarrantyTickets([]);
    } finally {
      setIsLoadingWarranty(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
    void fetchSelfAccess();
  }, [fetchProjects, fetchSelfAccess]);

  useEffect(() => {
    if (selectedProjectId) {
      void fetchSelfAccess(selectedProjectId);
      void fetchDiaries(selectedProjectId);
      void fetchQcItems(selectedProjectId);
      void fetchInstallationPlans(selectedProjectId);
    }
  }, [
    selectedProjectId,
    fetchSelfAccess,
    fetchDiaries,
    fetchQcItems,
    fetchInstallationPlans,
  ]);

  // ─── Effective Permissions & Active Tab Guard ───────────────────────────────
  const effectiveCaps = resolveEffectiveCapabilities(selfAccess?.capabilities ?? null, simulatedRole);
  const displayRoleKey = simulatedRole ?? selfAccess?.primaryRoleKey ?? 'SITE_MANAGER';
  const canAdminSimulate =
    selfAccess?.primaryRoleKey === 'ADMIN'
    || selfAccess?.primaryRoleKey === 'OWNER'
    || selfAccess?.roles.some((r) => r.roleKey === 'ADMIN' || r.roleKey === 'OWNER');

  useEffect(() => {
    if (!selectedProjectId || isLoadingAccess) return;
    if (effectiveCaps.canReadProduction) {
      void fetchProductionOrders(selectedProjectId);
    } else {
      setProductionOrders([]);
    }
    if (effectiveCaps.canReadWarranty) {
      void fetchWarrantyOverview(selectedProjectId);
    } else {
      setWarrantyCerts([]);
      setWarrantyTickets([]);
    }
  }, [
    selectedProjectId,
    isLoadingAccess,
    effectiveCaps.canReadProduction,
    effectiveCaps.canReadWarranty,
    fetchProductionOrders,
    fetchWarrantyOverview,
  ]);

  useEffect(() => {
    if (isLoadingAccess) return;
    if (!effectiveCaps.canCreateDiary && activeTab === 'diary') {
      if (displayRoleKey === 'PRODUCTION_MANAGER' && effectiveCaps.canReadProduction) {
        setActiveTab('production');
      } else if (displayRoleKey === 'WARRANTY' && effectiveCaps.canReadWarranty) {
        setActiveTab('warranty');
      } else if (effectiveCaps.canReadQc && !effectiveCaps.canReadDiaries) {
        setActiveTab('qc');
      } else if (effectiveCaps.canReadDiaries) {
        setActiveTab('history');
      }
    }
  }, [
    isLoadingAccess,
    displayRoleKey,
    effectiveCaps.canCreateDiary,
    effectiveCaps.canReadQc,
    effectiveCaps.canReadDiaries,
    effectiveCaps.canReadProduction,
    effectiveCaps.canReadWarranty,
    activeTab,
  ]);

  // ─── Real Image Upload to Cloudflare R2 Handler ─────────────────────────────
  const uploadPhotosToR2 = async (
    files: FileList | null,
    onSuccessUrl: (result: { id: string; url: string; filename: string; size: number }) => void,
  ) => {
    if (!files || files.length === 0 || !selectedProjectId) return;
    setUploadingCount((c) => c + files.length);
    setFeedback(null);

    for (const rawFile of Array.from(files)) {
      const preparedFile = await prepareImageFileForUpload(rawFile);
      const form = new FormData();
      form.append('file', preparedFile);
      form.append('projectId', selectedProjectId);

      try {
        const res = await fetch(
          `/api/interior/delivery/site-diary/upload?projectId=${encodeURIComponent(selectedProjectId)}`,
          {
            method: 'POST',
            body: form,
          },
        );
        const json = (await res.json()) as {
          success?: boolean;
          data?: { url: string; key: string; filename: string; size: number };
          error?: string;
          message?: string;
        };

        if (res.ok && json.success && json.data) {
          onSuccessUrl({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            url: json.data.url,
            filename: json.data.filename,
            size: json.data.size,
          });
        } else {
          setFeedback({
            type: 'error',
            message: `Tải ảnh ${rawFile.name} lên Cloudflare R2 thất bại: ${json.message || json.error || `HTTP ${res.status}`}`,
          });
        }
      } catch {
        setFeedback({
          type: 'error',
          message: `Lỗi mạng khi gửi ảnh ${rawFile.name} lên Cloudflare R2.`,
        });
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }
  };

  // ─── Form Activity Helpers ──────────────────────────────────────────────────
  const handleAddActivity = (text?: string) => {
    const candidate = (text ?? newActivityInput).trim();
    if (!candidate || activities.includes(candidate)) return;
    setActivities((prev) => [...prev, candidate]);
    if (!text) setNewActivityInput('');
  };

  const removeActivity = (index: number) => {
    setActivities((prev) => prev.filter((_, i) => i !== index));
  };

  const syncWorkersFromBreakdown = () => {
    setWorkersCount(carpenters + electricians + painters);
  };

  // ─── Submit Daily Diary (Text -> Supabase DB, Photos -> R2 URLs in DB) ─────
  const handleSubmitDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn công trình trước khi gửi báo cáo.' });
      return;
    }
    if (activities.length === 0) {
      setFeedback({ type: 'error', message: 'Vui lòng thêm ít nhất 1 đầu việc đã thi công trong ngày.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const conditionLabel = SITE_CONDITIONS.find((c) => c.id === siteCondition)?.label ?? '';
    const structuredSummary = [
      conditionLabel ? `Hiện trạng: ${conditionLabel}` : '',
      `Phân bổ đội thợ: ${carpenters} Mộc/Lắp ráp, ${electricians} Điện/ME, ${painters} Sơn/Hoàn thiện`,
      notes.trim() ? notes.trim() : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const photoUrls = uploadedPhotos.map((p) => p.url);

    try {
      const res = await fetch('/api/interior/delivery/site-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: entryDate,
          workersPresent: workersCount,
          weatherCondition: weather,
          activitiesCompleted: activities,
          issuesEncountered: issues.trim() ? [issues.trim()] : [],
          notes: structuredSummary,
          photoUrls,
        }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string; reason?: string; message?: string };

      if (res.ok && json.success) {
        setFeedback({
          type: 'success',
          message: `Đã lưu báo cáo hiện trạng ngày ${entryDate} vào Database (${photoUrls.length} ảnh lưu tại Cloudflare R2).`,
        });
        setUploadedPhotos([]);
        setActivities([]);
        setIssues('');
        setNotes('');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(`bella_site_diary_draft_${selectedProjectId}`);
        }
        await fetchDiaries(selectedProjectId);
        setActiveTab('history');
      } else {
        setFeedback({
          type: 'error',
          message: `Không thể gửi báo cáo: ${json.reason || json.message || json.error || 'Thiếu quyền tạo nhật ký'}`,
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Lỗi kết nối: Không thể lưu báo cáo lên hệ thống. Nội dung đã được giữ lại ở bản nháp trên máy.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Edit Existing Diary Handlers ───────────────────────────────────────────
  const openEditDiary = (diary: SiteDiaryItem) => {
    setEditingDiary(diary);
    setEditWorkers(diary.workersPresent);
    setEditWeather(diary.weatherCondition);
    setEditActivitiesText(diary.activitiesCompleted.join('\n'));
    setEditIssuesText(diary.issuesEncountered?.join('; ') || diary.notes || '');
    setEditPhotos(Array.isArray(diary.photoUrls) ? diary.photoUrls : []);
  };

  const handleSaveEditDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiary || !selectedProjectId) return;
    const parsedActivities = editActivitiesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (parsedActivities.length === 0) {
      setFeedback({ type: 'error', message: 'Cần có ít nhất 1 đầu việc khi cập nhật nhật ký.' });
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch('/api/interior/delivery/site-diary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diaryId: editingDiary.id,
          projectId: selectedProjectId,
          workersPresent: editWorkers,
          weatherCondition: editWeather,
          activitiesCompleted: parsedActivities,
          issuesEncountered: editIssuesText.trim() ? [editIssuesText.trim()] : [],
          photoUrls: editPhotos,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; reason?: string };
      if (res.ok && json.success) {
        setEditingDiary(null);
        setFeedback({ type: 'success', message: `Đã cập nhật nhật ký ngày ${editingDiary.date} thành công.` });
        await fetchDiaries(selectedProjectId);
      } else {
        setFeedback({
          type: 'error',
          message: `Cập nhật thất bại: ${json.reason || json.error || 'Thiếu quyền cập nhật nhật ký'}`,
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi mạng khi cập nhật nhật ký.' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ─── Create Quick QC Defect Item ────────────────────────────────────────────
  const handleCreateQcDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !qcDesc.trim()) return;
    setIsSubmittingQc(true);
    try {
      const res = await fetch('/api/interior/delivery/punch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          description: qcDesc.trim(),
          category: qcCategory,
          severity: qcSeverity,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; reason?: string };
      if (res.ok && json.success) {
        setQcDesc('');
        setFeedback({ type: 'success', message: 'Đã ghi nhận phiếu kiểm soát lỗi QC vào hệ thống.' });
        await fetchQcItems(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: `Không thể tạo phiếu QC: ${json.reason || json.error}` });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi lưu phiếu QC.' });
    } finally {
      setIsSubmittingQc(false);
    }
  };

  const handleSwitchSimulatedRole = (roleKey: string) => {
    if (!roleKey) {
      setSimulatedRoleState(null);
      setSimulatedInteriorRole(null);
      return;
    }
    const normalized = normalizeInteriorRoleKey(roleKey);
    if (normalized) {
      setSimulatedRoleState(normalized);
      setSimulatedInteriorRole(normalized);
    }
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const currentPlan = plans[0] ?? null;

  if (authRequiredError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Cần đăng nhập để sử dụng Giám Sát PWA</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Phiên làm việc đã hết hạn hoặc bạn chưa đăng nhập tài khoản nhân sự Bella Interior.
          </p>
          <Link
            href="/login?next=/site-pwa"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${
        standaloneMode ? 'p-3 pb-24 max-w-xl mx-auto' : 'p-4 md:p-6 max-w-5xl mx-auto'
      }`}
    >
      {/* ─── Offline Banner ─── */}
      {!isOnline && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
          <span>Mất kết nối internet tại công trình. Nội dung đang gõ được lưu nháp an toàn trên thiết bị.</span>
        </div>
      )}

      {/* ─── Header: Identity, Role & Custom Delegations ─── */}
      <header className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0">
              📲
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Giám Sát Công Trình PWA
                </h1>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                  Cloudflare R2 + DB
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhật ký hiện trường, nhân sự, tiến độ &amp; hình ảnh theo phân quyền
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void fetchProjects();
              if (selectedProjectId) {
                void fetchSelfAccess(selectedProjectId);
                void fetchDiaries(selectedProjectId);
              }
            }}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Đồng bộ lại dữ liệu"
          >
            <IconRefresh className="w-5 h-5" />
          </button>
        </div>

        {/* Real User Role & Special Delegations Strip */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 dark:text-slate-400">Nhân sự:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {selfAccess?.actor.fullName || 'Đang xác thực...'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
              {getInteriorRoleDisplayName(displayRoleKey)}
              {simulatedRole ? ' (Xem thử UI)' : ''}
            </span>

            {/* Secondary assigned roles */}
            {selfAccess && selfAccess.roles.length > 1 && (
              <span className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                +{selfAccess.roles.length - 1} vai trò khác ({selfAccess.roles.map((r) => `${r.roleKey}:${r.scopeType}`).join(', ')})
              </span>
            )}
          </div>

          {/* Direct Grants & Delegations Badge */}
          {selfAccess && (selfAccess.directGrants.length > 0 || selfAccess.delegations.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
                ⭐ Phân quyền / Ủy quyền bổ sung:{' '}
                {[
                  ...selfAccess.delegations.map((d) => `Ủy quyền ${d.roleKey}`),
                  ...selfAccess.directGrants.map((g) => `${g.permissionId} (${g.scopeType})`),
                ].join(' • ')}
              </span>
            </div>
          )}

          {/* Admin Role UI Simulator */}
          {canAdminSimulate && (
            <div className="w-full min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 text-[11px]">
              <label htmlFor="pwa-role-preview" className="text-slate-500 dark:text-slate-400 shrink-0">
                Xem UI theo role:
              </label>
              <select
                id="pwa-role-preview"
                value={simulatedRole ?? ''}
                onChange={(e) => handleSwitchSimulatedRole(e.target.value)}
                className="w-full min-w-0 max-w-full sm:flex-1 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Theo quyền thật ({selfAccess?.primaryRoleKey || 'Active'})</option>
                {INTERIOR_ROLES.map((r) => (
                  <option key={r.roleKey} value={r.roleKey}>
                    {r.badgeLabel} ({r.displayName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* ─── Project Selector ─── */}
      <section className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <label htmlFor="project-select" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
          Công trình / Dự án thi công được phân công:
        </label>
        {isLoadingProjects ? (
          <div className="h-11 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
        ) : projects.length === 0 ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-400">
            Chưa tìm thấy dự án nào trong phạm vi phân công tài khoản của bạn. Hãy liên hệ PM/Admin để được gán công trình.
          </div>
        ) : (
          <div className="space-y-2">
            <select
              id="project-select"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full min-w-0 max-w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {projects.map((p) => {
                const isAssigned = selfAccess?.assignedProjectIds.includes(p.id);
                return (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}{isAssigned ? ' ★ (Được phân công)' : ''}
                  </option>
                );
              })}
            </select>
            {currentProject && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>
                  {currentProject.customerName ? `Khách hàng: ${currentProject.customerName}` : 'Dự án nội thất'}
                  {currentProject.siteAddress ? ` • ${currentProject.siteAddress}` : ''}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold">
                  {currentProject.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── Capability Summary Banner (Dynamic Functions by Role / Grant) ─── */}
      <nav aria-label="Chức năng theo phân quyền" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('diary')}
          className={`min-h-[44px] py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
            activeTab === 'diary'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
          }`}
        >
          <span>✍️</span> Báo cáo hôm nay
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`min-h-[44px] py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
          }`}
        >
          <span>📋</span> Nhật ký ({diaries.length})
        </button>

        {(effectiveCaps.canReadQc || effectiveCaps.canCreateQc) && (
          <button
            type="button"
            onClick={() => setActiveTab('qc')}
            className={`min-h-[44px] py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
              activeTab === 'qc'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
            }`}
          >
            <span>🛡️</span> QC ({qcItems.length})
          </button>
        )}

        {(effectiveCaps.canReadSchedule || effectiveCaps.canReadDiaries) && (
          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className={`min-h-[44px] py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
              activeTab === 'progress'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
            }`}
          >
            <span>🏗️</span> Hạng mục lắp đặt
          </button>
        )}

        {effectiveCaps.canReadProduction && (
          <button
            type="button"
            onClick={() => setActiveTab('production')}
            className={`min-h-[44px] py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
              activeTab === 'production'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
            }`}
          >
            <span>🏭</span> Xưởng SX ({productionOrders.length})
          </button>
        )}

        {effectiveCaps.canReadWarranty && (
          <button
            type="button"
            onClick={() => setActiveTab('warranty')}
            className={`min-h-[44px] py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
              activeTab === 'warranty'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
            }`}
          >
            <span>🎗️</span> Bảo hành ({warrantyTickets.length})
          </button>
        )}
      </nav>

      {/* ─── Feedback Alert ─── */}
      {feedback && (
        <div
          role="alert"
          className={`mb-4 px-4 py-3 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white ml-2 px-1.5 py-0.5 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: GHI NHẬT KÝ & BÁO CÁO HIỆN TRẠNG HÀNG NGÀY                        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'diary' && (
        !isLoadingAccess && !effectiveCaps.canCreateDiary ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3 shadow-xs">
            <span className="text-3xl">🔒</span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Tài khoản chưa có quyền ghi Nhật ký công trình
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Vai trò hiện tại ({getInteriorRoleDisplayName(displayRoleKey)}) cần được phân quyền{' '}
              <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">interior:installation:create</code>{' '}
              hoặc ủy quyền quản lý hiện trường cho công trình này. Bạn vẫn có thể xem lịch sử nhật ký hoặc mục QC nếu được cấp quyền đọc.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitDiary} className="space-y-4">
            {/* Thời gian, Thời tiết & Hiện trạng chung */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>📅</span> Ngày Báo Cáo, Thời Tiết &amp; Hiện Trạng Công Trình
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label htmlFor="diary-date-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Ngày ghi nhận:
                  </label>
                  <input
                    id="diary-date-input"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full min-w-0 max-w-full box-border min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Thời tiết hiện trường:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {WEATHER_OPTIONS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWeather(w.id)}
                        className={`min-h-[42px] py-1.5 px-2 rounded-xl border text-xs font-medium flex flex-col items-center justify-center transition ${
                          weather === w.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-base leading-none">{w.icon}</span>
                        <span className="text-[10px] mt-1">{w.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tình trạng chung */}
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Đánh giá hiện trạng thi công hôm nay:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SITE_CONDITIONS.map((cond) => (
                    <button
                      key={cond.id}
                      type="button"
                      onClick={() => setSiteCondition(cond.id)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                        siteCondition === cond.id
                          ? `${cond.className} ring-2 ring-emerald-500/40`
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {cond.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Nhân sự có mặt tại công trình */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>👷</span> Nhân Sự Tại Công Trình
                </h2>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                  Tổng quân số: {workersCount} người
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
                <span className="text-xs text-slate-700 dark:text-slate-200 font-semibold">
                  Số nhân sự đang làm việc:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWorkersCount((c) => Math.max(0, c - 1))}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-white flex items-center justify-center active:scale-95"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    aria-label="Tổng quân số nhân sự"
                    min="0"
                    value={workersCount}
                    onChange={(e) => setWorkersCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-16 h-10 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-emerald-700 dark:text-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => setWorkersCount((c) => c + 1)}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-white flex items-center justify-center active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                  <label htmlFor="workers-carpenters" className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Thợ mộc / Lắp ráp
                  </label>
                  <input
                    id="workers-carpenters"
                    type="number"
                    min="0"
                    value={carpenters}
                    onChange={(e) => setCarpenters(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-14 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-1 mt-1 font-semibold"
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                  <label htmlFor="workers-me" className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Thợ điện / ME
                  </label>
                  <input
                    id="workers-me"
                    type="number"
                    min="0"
                    value={electricians}
                    onChange={(e) => setElectricians(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-14 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-1 mt-1 font-semibold"
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                  <label htmlFor="workers-paint" className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Thợ sơn / Vệ sinh
                  </label>
                  <input
                    id="workers-paint"
                    type="number"
                    min="0"
                    value={painters}
                    onChange={(e) => setPainters(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-14 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-1 mt-1 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={syncWorkersFromBreakdown}
                  className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                >
                  Cộng tổng quân số theo chi tiết ({carpenters + electricians + painters} người)
                </button>
              </div>
            </div>

            {/* Công việc theo ngày */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>🔨</span> Công Việc Hoàn Thành / Thực Hiện Trong Ngày
              </h2>

              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIVITIES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddActivity(preset)}
                    className="text-[11px] bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 transition"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              {activities.length > 0 && (
                <div className="space-y-2 pt-1">
                  {activities.map((act, idx) => (
                    <div
                      key={`${act}-${idx}`}
                      className="flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                        <span>{act}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeActivity(idx)}
                        className="text-slate-400 hover:text-rose-500 ml-2 p-1"
                        title="Xóa đầu việc"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập hạng mục công việc đã làm trong ngày..."
                  value={newActivityInput}
                  onChange={(e) => setNewActivityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddActivity();
                    }
                  }}
                  className="flex-1 min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddActivity()}
                  className="min-h-[42px] bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
                >
                  + Thêm
                </button>
              </div>
            </div>

            {/* Vướng mắc & Ghi chú hiện trạng */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>⚠️</span> Vấn Đề Phát Sinh &amp; Ghi Chú Chi Tiết
              </h2>
              <textarea
                rows={2}
                placeholder="Sự cố / vướng mắc (nếu có): thiếu phụ kiện, vướng mặt bằng bên ME, sai kích thước tường..."
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <textarea
                rows={2}
                placeholder="Ghi chú thêm về hiện trạng công trường, kế hoạch ngày mai..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Hình ảnh hiện trạng đẩy trực tiếp lên Cloudflare R2 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <IconCamera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Hình Ảnh Hiện Trạng Công Trình
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ảnh được đẩy trực tiếp lên Cloudflare R2 (tối đa 10MB/ảnh), đường dẫn lưu vào DB.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                  {uploadedPhotos.length} ảnh
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingCount > 0 || !selectedProjectId || !effectiveCaps.canUploadSitePhoto}
                  className="min-h-[46px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  <IconCamera className="w-5 h-5" />
                  <span>Chụp ảnh camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingCount > 0 || !selectedProjectId || !effectiveCaps.canUploadSitePhoto}
                  className="min-h-[46px] py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                >
                  <IconCloudDone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Chọn từ thư viện</span>
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void uploadPhotosToR2(e.target.files, (res) => {
                    setUploadedPhotos((prev) => [...prev, { ...res, status: 'uploaded' }]);
                  });
                  e.target.value = '';
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void uploadPhotosToR2(e.target.files, (res) => {
                    setUploadedPhotos((prev) => [...prev, { ...res, status: 'uploaded' }]);
                  });
                  e.target.value = '';
                }}
              />

              {uploadingCount > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="w-4 h-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin shrink-0" />
                  <span>Đang tải {uploadingCount} ảnh lên Cloudflare R2...</span>
                </div>
              )}

              {uploadedPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                  {uploadedPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 aspect-video shadow-xs"
                    >
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setViewingPhotoUrl(photo.url)}
                      />
                      <div className="absolute top-1 left-1 bg-black/70 text-[10px] text-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <IconCheck className="w-3 h-3 text-emerald-400" /> R2
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadedPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                        className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-500 text-white p-1.5 rounded-lg shadow transition"
                        title="Gỡ ảnh"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || uploadingCount > 0 || !selectedProjectId}
              className="w-full min-h-[48px] py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Đang lưu nhật ký vào hệ thống...</span>
                </>
              ) : (
                <span>Gửi Báo Cáo Hiện Trạng &amp; Lưu DB</span>
              )}
            </button>
          </form>
        )
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: LỊCH SỬ BÁO CÁO & ẢNH CLOUDFLARE R2                                */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Nhật ký đã ghi nhận ({diaries.length} ngày)
            </h2>
            {effectiveCaps.canCreateDiary && (
              <button
                type="button"
                onClick={() => setActiveTab('diary')}
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
              >
                + Ghi nhật ký mới
              </button>
            )}
          </div>

          {diaryReadDenied ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-600 dark:text-slate-400">
              Tài khoản chưa được cấp quyền đọc nhật ký lắp đặt (`interior:installation:read`) cho dự án này.
            </div>
          ) : isLoadingDiaries ? (
            <div className="p-8 text-center text-slate-500 text-xs">Đang tải dữ liệu nhật ký từ DB...</div>
          ) : diaries.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2 shadow-xs">
              <span className="text-3xl">📝</span>
              <p className="text-sm text-slate-600 dark:text-slate-400">Chưa có báo cáo hiện trạng nào cho dự án này.</p>
            </div>
          ) : (
            diaries.map((diary) => (
              <article
                key={diary.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{diary.date}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {WEATHER_OPTIONS.find((w) => w.id === diary.weatherCondition)?.icon}{' '}
                      {WEATHER_OPTIONS.find((w) => w.id === diary.weatherCondition)?.label || diary.weatherCondition}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Bởi: <strong className="text-slate-800 dark:text-slate-200">{diary.supervisorName}</strong>
                    </span>
                    {effectiveCaps.canUpdateDiary && (
                      <button
                        type="button"
                        onClick={() => openEditDiary(diary)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold transition"
                      >
                        Chỉnh sửa
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <span>👷</span>
                  <span>
                    Nhân sự có mặt: <strong>{diary.workersPresent} người</strong>
                  </span>
                </div>

                {Array.isArray(diary.activitiesCompleted) && diary.activitiesCompleted.length > 0 && (
                  <div>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1">
                      Công việc trong ngày:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {diary.activitiesCompleted.map((act, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(diary.issuesEncountered?.length > 0 || diary.notes) && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl p-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-semibold block mb-0.5">Ghi chú &amp; Hiện trạng:</span>
                    <p>{diary.issuesEncountered?.join('; ') || diary.notes}</p>
                  </div>
                )}

                {Array.isArray(diary.photoUrls) && diary.photoUrls.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
                      <IconCloudDone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Hình ảnh hiện trạng ({diary.photoUrls.length} ảnh):
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {diary.photoUrls.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setViewingPhotoUrl(url)}
                          className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-emerald-500 transition group"
                        >
                          <img
                            src={url}
                            alt={`Hiện trường ${diary.date} #${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: QC PUNCH LIST (DỮ LIỆU THẬT TỪ /api/interior/delivery/punch-list)  */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'qc' && (effectiveCaps.canReadQc || effectiveCaps.canCreateQc) && (
        <div className="space-y-4">
          {effectiveCaps.canCreateQc && (
            <form
              onSubmit={handleCreateQcDefect}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  🛡️ Ghi Nhận Lỗi / Hạng Mục Kiểm Soát QC Mới
                </h2>
                <Link
                  href="/dashboard/interior/qc-handover"
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                >
                  Trang QC đầy đủ ↗
                </Link>
              </div>
              <textarea
                rows={2}
                required
                placeholder="Mô tả lỗi kỹ thuật / chi tiết cần khắc phục tại hiện trường..."
                value={qcDesc}
                onChange={(e) => setQcDesc(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Hạng mục lỗi QC"
                  value={qcCategory}
                  onChange={(e) => setQcCategory(e.target.value as QcPunchListItem['category'])}
                  className="w-full min-w-0 max-w-full min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 text-xs"
                >
                  {QC_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Mức độ nghiêm trọng QC"
                  value={qcSeverity}
                  onChange={(e) => setQcSeverity(e.target.value as QcPunchListItem['severity'])}
                  className="w-full min-w-0 max-w-full min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 text-xs"
                >
                  <option value="minor">Nhẹ (Minor)</option>
                  <option value="major">Trung bình / Cần sửa (Major)</option>
                  <option value="critical">Nghiêm trọng (Critical)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmittingQc || !selectedProjectId}
                className="w-full min-h-[42px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition disabled:opacity-50"
              >
                {isSubmittingQc ? 'Đang lưu phiếu QC...' : '+ Tạo Phiếu Lỗi QC'}
              </button>
            </form>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Danh sách QC Punch List hiện trường ({qcItems.length})
            </h3>
            {isLoadingQc ? (
              <div className="p-4 text-center text-xs text-slate-500">Đang tải danh sách QC...</div>
            ) : qcItems.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có hạng mục Punch List nào cho công trình này.
              </p>
            ) : (
              <div className="space-y-2">
                {qcItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{item.description}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === 'verified'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : item.severity === 'critical'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {item.status} • {item.severity}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Loại: {item.category} {item.roomZoneName ? `• Khu vực: ${item.roomZoneName}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: HẠNG MỤC LẮP ĐẶT & TIẾN ĐỘ PHÒNG (DỮ LIỆU THẬT TỪ /api/interior/schedule) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'progress' && (effectiveCaps.canReadSchedule || effectiveCaps.canReadDiaries) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                🏗️ Tiến Độ Lắp Đặt Theo Kế Hoạch Công Trình
              </h2>
              {currentPlan && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kế hoạch {currentPlan.planNumber} • Chỉ huy: {currentPlan.siteSupervisorName} • Tổng: {currentPlan.overallProgressPercent}%
                </p>
              )}
            </div>
            <Link
              href="/dashboard/interior/installation"
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
            >
              Mở Bảng Thi Công ↗
            </Link>
          </div>

          {isLoadingPlans ? (
            <div className="p-6 text-center text-xs text-slate-500">Đang tải dữ liệu lắp đặt từ hệ thống...</div>
          ) : !currentPlan || !Array.isArray(currentPlan.rooms) || currentPlan.rooms.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Công trình này chưa có kế hoạch lắp đặt từng phòng được khởi tạo trong DB.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {currentPlan.rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                    <span>{room.roomZoneName || room.roomName || 'Khu vực lắp đặt'}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono">{room.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, room.progressPercent))}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Trạng thái: {room.status}</span>
                    {room.installerTeamLeader && <span>Tổ trưởng: {room.installerTeamLeader}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: LỆNH SẢN XUẤT XƯỞNG (/api/interior/production/orders)             */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'production' && effectiveCaps.canReadProduction && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>🏭</span> Lệnh Sản Xuất Xưởng
            </h2>
            <Link
              href="/dashboard/interior/production"
              className="text-xs font-semibold text-emerald-700 dark:text-amber-400 hover:underline"
            >
              Mở trang Xưởng →
            </Link>
          </div>
          {isLoadingProduction ? (
            <p className="text-xs text-slate-500 py-4 text-center">Đang tải lệnh sản xuất...</p>
          ) : productionOrders.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Chưa có lệnh sản xuất nào cho dự án này.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {productionOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 font-semibold text-slate-900 dark:text-white">
                    <span className="font-mono">{order.orderNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {order.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Hình thức: {order.mode === 'outsource' ? 'Gia công ngoài' : 'Xưởng nội bộ'}</span>
                    {order.workshopManagerName && <span>Quản đốc: {order.workshopManagerName}</span>}
                    {order.scheduledCompletionDate && <span>Hạn xong: {order.scheduledCompletionDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: CHỨNG THƯ & PHIẾU BẢO HÀNH (/api/interior/delivery/warranty)       */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'warranty' && effectiveCaps.canReadWarranty && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>🎗️</span> Bảo Hành &amp; Hậu Mãi
            </h2>
            <Link
              href="/dashboard/interior/warranty"
              className="text-xs font-semibold text-emerald-700 dark:text-amber-400 hover:underline"
            >
              Mở trang Bảo hành →
            </Link>
          </div>
          {isLoadingWarranty ? (
            <p className="text-xs text-slate-500 py-4 text-center">Đang tải hồ sơ bảo hành...</p>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Chứng thư bảo hành ({warrantyCerts.length})
                </p>
                {warrantyCerts.length === 0 ? (
                  <p className="text-slate-500 text-xs">Chưa có chứng thư bảo hành cho dự án.</p>
                ) : (
                  warrantyCerts.map((cert) => (
                    <div
                      key={cert.id}
                      className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                        <span className="font-mono">{cert.certificateNumber}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {cert.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hết hạn: {cert.warrantyEndDate}
                        {cert.coverageScope ? ` • ${cert.coverageScope}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Phiếu yêu cầu bảo trì ({warrantyTickets.length})
                </p>
                {warrantyTickets.length === 0 ? (
                  <p className="text-slate-500 text-xs">Không có phiếu bảo hành tồn đọng.</p>
                ) : (
                  warrantyTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                        <span>{ticket.description}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                          {ticket.priority} • {ticket.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Ngày báo: {ticket.createdAt}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Edit Site Diary Modal ─── */}
      {editingDiary && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveEditDiary}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Chỉnh Sửa Nhật Ký Ngày {editingDiary.date}
              </h2>
              <button
                type="button"
                onClick={() => setEditingDiary(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label htmlFor="edit-workers" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Nhân sự có mặt:
                </label>
                <input
                  id="edit-workers"
                  type="number"
                  min="0"
                  value={editWorkers}
                  onChange={(e) => setEditWorkers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 font-semibold"
                />
              </div>
              <div>
                <label htmlFor="edit-weather" className="block text-slate-600 dark:text-slate-400 mb-1">
                  Thời tiết:
                </label>
                <select
                  id="edit-weather"
                  value={editWeather}
                  onChange={(e) => setEditWeather(e.target.value as typeof editWeather)}
                  className="w-full min-w-0 max-w-full min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3"
                >
                  {WEATHER_OPTIONS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.icon} {w.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label htmlFor="edit-activities" className="block text-slate-600 dark:text-slate-400 mb-1">
                Công việc hoàn thành (mỗi dòng 1 đầu việc):
              </label>
              <textarea
                id="edit-activities"
                rows={3}
                value={editActivitiesText}
                onChange={(e) => setEditActivitiesText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5"
              />
            </div>

            <div className="text-xs">
              <label htmlFor="edit-issues" className="block text-slate-600 dark:text-slate-400 mb-1">
                Vướng mắc / Ghi chú:
              </label>
              <textarea
                id="edit-issues"
                rows={2}
                value={editIssuesText}
                onChange={(e) => setEditIssuesText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Ảnh hiện trạng ({editPhotos.length})</span>
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={uploadingCount > 0}
                  className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
                >
                  + Thêm ảnh lên R2
                </button>
              </div>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void uploadPhotosToR2(e.target.files, (res) => {
                    setEditPhotos((prev) => [...prev, res.url]);
                  });
                  e.target.value = '';
                }}
              />
              {editPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {editPhotos.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={url} alt={`Ảnh #${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded p-0.5 text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDiary(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || uploadingCount > 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isSavingEdit ? 'Đang lưu...' : 'Lưu Cập Nhật'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Lightbox Modal for R2 Photo Preview ─── */}
      {viewingPhotoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setViewingPhotoUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewingPhotoUrl}
              alt="Hình ảnh hiện trạng phóng to"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-700"
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-slate-300">Lưu trữ: Cloudflare R2 CDN</span>
              <a
                href={viewingPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-600 px-3 py-1.5 rounded-xl"
              >
                Mở ảnh gốc ↗
              </a>
              <button
                type="button"
                onClick={() => setViewingPhotoUrl(null)}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PWA Install Banner ─── */}
      {installPrompt && (
        <div className="mt-6 p-4 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-sm">
          <div>
            <strong className="block text-slate-900 dark:text-white">Cài đặt App Giám Sát Công Trình (PWA)</strong>
            <span className="text-slate-500 dark:text-slate-400">
              Ghìm ứng dụng lên màn hình chính điện thoại để mở nhanh ngoài công trình.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void installPrompt.prompt();
              setInstallPrompt(null);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl whitespace-nowrap shadow-xs"
          >
            Cài đặt PWA
          </button>
        </div>
      )}
    </div>
  );
}
