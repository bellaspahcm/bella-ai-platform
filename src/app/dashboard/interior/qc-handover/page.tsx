'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Interior OS — Kiểm Soát Chất Lượng QC, Punch List & Bàn Giao
 *
 * Executive Quality Control, Handover Gate & Punch List Lifecycle Dashboard.
 * Connects directly to real database:
 * - Real project selection backed by /api/interior/projects
 * - Real Punch List lifecycle: Open → In Progress → Rectified → Verified backed by
 *   /api/interior/delivery/punch-list and /api/interior/delivery/punch-list/[id]
 * - Handover Gate Enforcement: Blocks handover acceptance when unverified critical/major items remain
 * - Real Handover Acceptance & Customer Signature flow backed by /api/interior/delivery/handover
 *   and /api/interior/delivery/handover/acceptances/[approvalId]
 *
 * HARD CONSTRAINTS:
 * - DO NOT touch src/components/layout/sidebar.tsx
 * - No math in UI component
 * - Light theme: bg-[#F8FAFC], green primary #10b981 / #064e3b
 * - Zero `any` types
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  QCHandoverOverviewResponse,
} from '@/products/bella-interior/domain/qc-handover-overview.types';
import type { PunchListItem, PunchListStatus } from '@/app/api/interior/delivery/punch-list/route';
import AcceptanceSessionModal from './acceptance-session-modal';
import OperationalAuditTrailCard from '@/components/interior/OperationalAuditTrailCard';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface HandoverAcceptanceData {
  approvalId: string;
  token?: string;
  status: string;
  expiresAt: string;
  customerAcceptanceEndpoint: string;
  dossier: Record<string, unknown>;
}

const HANDOVER_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80';

// ─── Inline Clean Icons ───────────────────────────────────────────────────────

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
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

function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
    </svg>
  );
}

function IconFileText({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconClipboardCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
    </svg>
  );
}

function IconFilter({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  );
}

function IconPen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  );
}

function IconHistory({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function InteriorQCHandoverPage() {
  const [data, setData] = useState<QCHandoverOverviewResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Real Projects State
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Real Punch List State
  const [punchList, setPunchList] = useState<PunchListItem[]>([]);
  const [punchLoading, setPunchLoading] = useState(false);

  // Modals
  const [showNewPunchModal, setShowNewPunchModal] = useState<boolean>(false);
  const [showInternalSessionsModal, setShowInternalSessionsModal] = useState<boolean>(false);
  const [showCustomerHandoverModal, setShowCustomerHandoverModal] = useState<boolean>(false);
  const [rectifyingItem, setRectifyingItem] = useState<PunchListItem | null>(null);
  const [selectedAuditItem, setSelectedAuditItem] = useState<PunchListItem | null>(null);
  const [rectificationInput, setRectificationInput] = useState('');

  // Form states for new punch item
  const [punchZone, setPunchZone] = useState('Phòng khách');
  const [punchCategory, setPunchCategory] = useState<'finishing' | 'structural' | 'furniture_fit' | 'electrical_coordination' | 'painting'>('furniture_fit');
  const [punchDesc, setPunchDesc] = useState('');
  const [punchSeverity, setPunchSeverity] = useState<'critical' | 'major' | 'minor'>('major');

  // Customer Acceptance flow states
  const [handoverData, setHandoverData] = useState<HandoverAcceptanceData | null>(null);
  const [handoverRequesting, setHandoverRequesting] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('Đã kiểm tra hiện trường, hoàn toàn đồng ý nghiệm thu.');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signingAcceptance, setSigningAcceptance] = useState(false);
  const [handoverCompleted, setHandoverCompleted] = useState(false);

  // ─── 1. Fetch Projects ──────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/projects', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as {
          success: boolean;
          data?: { projects?: Array<Record<string, unknown>> };
        };
        if (json.success && Array.isArray(json.data?.projects)) {
          const mapped: ProjectOption[] = json.data.projects.map((p) => ({
            id: String(p.id || ''),
            code: String(p.code || ''),
            name: String(p.name || ''),
            status: String(p.status || ''),
          })).filter((p) => p.id !== '');

          setProjects(mapped);
          if (mapped.length > 0) {
            const aquaBay = mapped.find((p) => p.code === 'INT-2024-004' || p.id === 'd450fc00-a593-484f-a8ad-ff8aebf756df');
            setSelectedProjectId((prev) => (prev ? prev : (aquaBay ? aquaBay.id : mapped[0].id)));
          }
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // ─── 2. Fetch Base Analytics Overview (for layout & metadata) ───────────────
  const fetchAnalytics = useCallback(async (projectId?: string) => {
    try {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const res = await fetch(`/api/interior/qc-handover/analytics${q}`, { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; data: { overview: QCHandoverOverviewResponse } };
        if (json.success && json.data?.overview) {
          setData(json.data.overview);
          return;
        }
      }
      setData(null);
    } catch {
      setData(null);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  // ─── 3. Fetch Real Punch List Items from Database ───────────────────────────
  const fetchPunchList = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setPunchLoading(true);
    try {
      const res = await fetch(`/api/interior/delivery/punch-list?projectId=${encodeURIComponent(projectId)}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as { success?: boolean; data?: PunchListItem[] };
      if (res.ok && json.success && Array.isArray(json.data)) {
        setPunchList(json.data);
      } else {
        setPunchList([]);
      }
    } catch {
      setPunchList([]);
    } finally {
      setPunchLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    void fetchAnalytics(selectedProjectId || undefined);
    if (selectedProjectId) {
      void fetchPunchList(selectedProjectId);
    }
  }, [selectedProjectId, fetchAnalytics, fetchPunchList]);

  // ─── Punch List State Transitions (Open → In Progress → Rectified → Verified) ─

  const handleStartProgress = async (item: PunchListItem) => {
    try {
      const res = await fetch(`/api/interior/delivery/punch-list/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; reason?: string };
      if (res.ok && json.success) {
        setFeedback({ type: 'success', message: `Hạng mục ${item.id.slice(0, 8)} đã chuyển sang đang xử lý!` });
        await fetchPunchList(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || json.reason || 'Không thể chuyển trạng thái.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối đến máy chủ.' });
    }
  };

  const handleConfirmRectified = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rectifyingItem) return;
    try {
      const res = await fetch(`/api/interior/delivery/punch-list/${rectifyingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rectified',
          rectificationNote: rectificationInput.trim() || 'Đã khắc phục lỗi tại hiện trường',
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; reason?: string };
      if (res.ok && json.success) {
        setRectifyingItem(null);
        setRectificationInput('');
        setFeedback({ type: 'success', message: 'Đã báo cáo khắc phục thành công! Đang chờ QC nghiệm thu.' });
        await fetchPunchList(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || json.reason || 'Không thể cập nhật khắc phục.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối đến máy chủ.' });
    }
  };

  const handleVerifyItem = async (item: PunchListItem) => {
    try {
      const res = await fetch(`/api/interior/delivery/punch-list/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'verified',
          rectificationNote: item.rectificationNote || 'Đã kiểm tra đạt yêu cầu kỹ thuật',
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; reason?: string };
      if (res.ok && json.success) {
        setFeedback({ type: 'success', message: `QC đã nghiệm thu (Verified) thành công khiếm khuyết!` });
        await fetchPunchList(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || json.reason || 'Không thể nghiệm thu lỗi.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối đến máy chủ.' });
    }
  };

  // ─── Create Punch List Item ────────────────────────────────────────────────
  const handleCreatePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !punchDesc.trim()) return;
    try {
      const response = await fetch('/api/interior/delivery/punch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          description: punchDesc.trim(),
          category: punchCategory,
          severity: punchSeverity,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        setFeedback({ type: 'error', message: result.error || 'Không thể lưu punch list.' });
        return;
      }
      setShowNewPunchModal(false);
      setPunchDesc('');
      setFeedback({ type: 'success', message: 'Đã lập biên bản khiếm khuyết Punch List thành công vào DB!' });
      await fetchPunchList(selectedProjectId);
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối để lưu punch list.' });
    }
  };

  // ─── Handover Acceptance & Customer Signoff Flow ────────────────────────────
  const handleInitiateHandover = async () => {
    if (!selectedProjectId) return;
    setHandoverRequesting(true);
    setHandoverData(null);
    setHandoverCompleted(false);
    try {
      const res = await fetch('/api/interior/delivery/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: HandoverAcceptanceData;
      };
      if (res.ok && json.success && json.data) {
        setHandoverData(json.data);
        setShowCustomerHandoverModal(true);
        setFeedback({ type: 'success', message: 'Đã khởi tạo yêu cầu nghiệm thu bàn giao thành công!' });
      } else {
        const errorMsg = json.error === 'INTERIOR_HANDOVER_OPEN_QC_ITEMS_REMAIN'
          ? 'Không thể bàn giao: Vẫn còn khiếm khuyết Critical/Major chưa được QC nghiệm thu (Verified)!'
          : json.error === 'INTERIOR_HANDOVER_SIGNED_CONTRACT_REQUIRED'
          ? 'Không thể bàn giao: Cần có hợp đồng đã ký kết hợp lệ trước khi bàn giao!'
          : json.error || 'Không thể khởi tạo bàn giao.';
        setFeedback({ type: 'error', message: errorMsg });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối đến dịch vụ bàn giao.' });
    } finally {
      setHandoverRequesting(false);
    }
  };

  const handleSubmitCustomerSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverData || !signatureFile) {
      setFeedback({ type: 'error', message: 'Vui lòng đính kèm tệp chữ ký số hoặc biên bản bàn giao đã ký.' });
      return;
    }
    setSigningAcceptance(true);
    try {
      const form = new FormData();
      form.append('decision', 'approved');
      form.append('customerNotes', customerNotes);
      form.append('signature', signatureFile);

      const res = await fetch(handoverData.customerAcceptanceEndpoint, {
        method: 'POST',
        body: form,
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && json.success) {
        setHandoverCompleted(true);
        setFeedback({ type: 'success', message: 'Khách hàng đã ký nghiệm thu bàn giao thành công! Hồ sơ đã lưu trữ vào DB.' });
        await fetchPunchList(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Xác nhận bàn giao không thành công.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể gửi biên bản ký nhận.' });
    } finally {
      setSigningAcceptance(false);
    }
  };

  if (!hasLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#10b981] border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-8">
        <p role="alert" className="max-w-lg text-center text-sm text-slate-600">
          Dữ liệu QC và bàn giao chưa khả dụng hoặc bạn chưa được cấp quyền đọc.
        </p>
      </div>
    );
  }

  const { projectHeader, projectInfoCard, qualityRoadmap, commitmentBanner } = data;
  const currentProject = projects.find((p) => p.id === selectedProjectId);

  // ─── Punch list counts & Handover Gate check ────────────────────────────────
  const totalPunchCount = punchList.length;
  const openPunchCount = punchList.filter((i) => i.status === 'open').length;
  const inProgPunchCount = punchList.filter((i) => i.status === 'in_progress').length;
  const rectifiedPunchCount = punchList.filter((i) => i.status === 'rectified').length;
  const verifiedPunchCount = punchList.filter((i) => i.status === 'verified').length;

  const unverifiedCriticalMajor = punchList.filter(
    (i) => (i.severity === 'critical' || i.severity === 'major') && i.status !== 'verified',
  );
  const isHandoverBlocked = unverifiedCriticalMajor.length > 0;

  const filteredPunchItems = punchList.filter(
    (item) => activeTab === 'all' || item.status === activeTab,
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-6 space-y-4 font-sans">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <IconCheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <IconAlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:text-slate-600 p-1">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ═══ 1. HEADER ROW ═══════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
        {/* Left: Back button & Interactive Project selector */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/interior"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <IconArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>

          {/* Interactive Project Selector */}
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 transition-colors">
            <span className="text-slate-500 mr-1.5 font-medium">Dự án:</span>
            <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center text-[10px] font-bold mr-1.5">
              🏛
            </div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-4"
              aria-label="Chọn dự án kiểm tra chất lượng"
            >
              {projects.length > 0 ? (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))
              ) : (
                <option value={projectHeader.id}>{projectHeader.selectorLabel}</option>
              )}
            </select>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void fetchAnalytics();
              if (selectedProjectId) void fetchPunchList(selectedProjectId);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <IconRefresh className="w-3.5 h-3.5 text-slate-500" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewPunchModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <IconFileText className="w-3.5 h-3.5" />
            Lập Biên Bản Punch List
          </button>
          <button
            onClick={handleInitiateHandover}
            disabled={handoverRequesting}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors text-white ${
              isHandoverBlocked
                ? 'bg-slate-700 hover:bg-slate-800'
                : 'bg-[#10b981] hover:bg-[#059669]'
            }`}
          >
            <IconCheckCircle className="w-3.5 h-3.5" />
            {isHandoverBlocked ? 'Kiểm Tra Điều Kiện Bàn Giao' : 'Nghiệm Thu Bàn Giao'}
          </button>
          <button
            onClick={() => setShowInternalSessionsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
          >
            <IconShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            Đợt Nghiệm Thu Nội Bộ (O4)
          </button>
        </div>
      </div>

      {/* ═══ 2. TITLE ROW ════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 pt-1">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
          <IconShieldCheck className="w-4 h-4" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          Kiểm Soát Chất Lượng QC, Punch List &amp; Bàn Giao
        </h1>
      </div>

      {/* ═══ 3. HANDOVER GATE HERO BANNER (REAL DATA ENFORCEMENT) ════════════ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row items-center justify-between">
        <div className="p-5 md:p-6 space-y-3 max-w-xl">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-full text-white flex items-center justify-center shadow-xs shrink-0 ${
                isHandoverBlocked ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            >
              {isHandoverBlocked ? <IconAlertTriangle className="w-5 h-5" /> : <IconShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-slate-900">
                  {isHandoverBlocked ? 'Cổng Kiểm Soát Bàn Giao (Handover Gate)' : 'Sẵn Sàng Bàn Giao (Ready for Handover)'}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    isHandoverBlocked
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isHandoverBlocked ? 'CHẶN BÀN GIAO' : 'ĐỦ ĐIỀU KIỆN'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {isHandoverBlocked ? (
              <span>
                Chính sách nghiệm thu yêu cầu 100% khiếm khuyết Critical và Major phải được xử lý và kiểm định (Verified) trước khi trình ký biên bản bàn giao. Hiện tại còn <strong className="text-rose-600 font-bold">{unverifiedCriticalMajor.length} khiếm khuyết</strong> chưa được nghiệm thu xác thực.
              </span>
            ) : (
              <span>
                Toàn bộ khiếm khuyết chất lượng đã được xác thực hoàn tất (100% Verified). Công trình đủ điều kiện pháp lý và kỹ thuật để trình đại diện khách hàng ký nhận biên bản bàn giao.
              </span>
            )}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleInitiateHandover}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
                isHandoverBlocked
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              <IconCheckCircle className="w-3.5 h-3.5" />
              <span>{isHandoverBlocked ? 'Xem Điều Kiện Bàn Giao' : 'Tiến Hành Nghiệm Thu & Ký Số'}</span>
            </button>
            <Link
              href="/dashboard/interior/warranty"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
            >
              <IconFileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Xem Chứng Thư Bảo Hành</span>
            </Link>
          </div>
        </div>

        <div className="w-full md:w-80 lg:w-96 h-40 md:h-44 shrink-0 overflow-hidden relative">
          <img
            src={HANDOVER_HERO_IMAGE_URL}
            alt="Handover Ready Living Room"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-transparent md:block hidden" />
        </div>
      </div>

      {/* ═══ 4. FILTER TABS BAR (REAL COUNTS) ════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold px-2">
          <IconFilter className="w-3.5 h-3.5" />
          <span>Lọc theo trạng thái:</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {[
            { id: 'all', label: 'Tất cả khiếm khuyết', count: totalPunchCount },
            { id: 'open', label: 'Chờ xử lý (Open)', count: openPunchCount },
            { id: 'in_progress', label: 'Đang xử lý (In Progress)', count: inProgPunchCount },
            { id: 'rectified', label: 'Đã khắc phục (Rectified)', count: rectifiedPunchCount },
            { id: 'verified', label: 'Đã nghiệm thu (Verified)', count: verifiedPunchCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#064e3b] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 5. 4 KPI CARDS ROW (REAL DATA SUMMARY) ═════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng Punch List */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <IconClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Tổng khiếm khuyết</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{totalPunchCount}</div>
            </div>
          </div>
        </div>

        {/* KPI 2: Chưa xử lý */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <IconAlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Đang tồn đọng (Open + In Prog)</div>
              <div className="text-2xl font-black text-amber-600 mt-0.5">{openPunchCount + inProgPunchCount}</div>
            </div>
          </div>
        </div>

        {/* KPI 3: Đã khắc phục / Chờ QC */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <IconClock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Chờ QC nghiệm thu (Rectified)</div>
              <div className="text-2xl font-black text-purple-600 mt-0.5">{rectifiedPunchCount}</div>
            </div>
          </div>
        </div>

        {/* KPI 4: Đã nghiệm thu */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <IconCheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Đã nghiệm thu (Verified)</div>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">{verifiedPunchCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 6. PUNCH LIST TABLE (REAL DATA & STATE MACHINE ACTIONS) ═════════ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconClipboardCheck className="w-4 h-4 text-slate-600" />
            <h2 className="text-xs md:text-sm font-bold text-slate-900">
              Danh Sách Khiếm Khuyết Hiện Trường{' '}
              <span className="font-normal text-slate-500">
                ({filteredPunchItems.length} hạng mục)
              </span>
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-medium">
            Quy trình: Open → In Progress → Rectified → Verified
          </span>
        </div>

        <div className="overflow-x-auto">
          {punchLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Đang tải danh sách khiếm khuyết từ cơ sở dữ liệu…</div>
          ) : filteredPunchItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 space-y-2">
              <p>Chưa có khiếm khuyết nào được ghi nhận cho dự án này.</p>
              <button
                onClick={() => setShowNewPunchModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-xs font-semibold"
              >
                <IconFileText className="w-3.5 h-3.5" />
                Lập biên bản đầu tiên
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[1100px]">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold whitespace-nowrap">
                  <tr>
                    <th className="px-3.5 py-3 whitespace-nowrap">#</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Mã lỗi</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Khu vực</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Hạng mục</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Mô tả khiếm khuyết</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Mức độ</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Khởi tạo &amp; Phụ trách</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Hạn xử lý</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Dấu vết &amp; Lead Time</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Trạng thái</th>
                    <th className="px-3.5 py-3 whitespace-nowrap text-right">Thao tác chuyển trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                  {filteredPunchItems.map((item, index) => {
                    const severityBadgeClass =
                      item.severity === 'critical'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : item.severity === 'major'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700';

                    const statusBadgeClass =
                      item.status === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.status === 'rectified'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : item.status === 'in_progress'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200';

                    const categoryLabel =
                      item.category === 'finishing'
                        ? 'Hoàn thiện'
                        : item.category === 'structural'
                        ? 'Kết cấu'
                        : item.category === 'furniture_fit'
                        ? 'Đồ gỗ & Nội thất'
                        : item.category === 'electrical_coordination'
                        ? 'Cơ điện'
                        : 'Sơn tường';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3.5 py-3 font-semibold text-slate-700 whitespace-nowrap">{index + 1}</td>
                        <td className="px-3.5 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">{item.id.slice(0, 8)}</td>
                        <td className="px-3.5 py-3 font-medium text-slate-800 whitespace-nowrap">{item.roomZoneName || 'Khu vực chính'}</td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{categoryLabel}</td>
                        <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">
                          <span className="font-medium">{item.description}</span>
                          {item.rectificationNote && (
                            <span className="text-[11px] text-purple-700 ml-2 italic">
                              (Khắc phục: {item.rectificationNote})
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${severityBadgeClass}`}>
                            {item.severity === 'critical' && <IconAlertTriangle className="w-3 h-3" />}
                            {item.severity === 'major' && <IconAlertCircle className="w-3 h-3" />}
                            {item.severity === 'minor' && <IconCheckCircle className="w-3 h-3" />}
                            {item.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap text-xs">
                          <div className="font-semibold text-slate-800">{item.assignedFixer || 'Chưa phân công'}</div>
                          <div className="text-[10px] text-slate-400">Tạo: {item.createdByName || 'Giám sát QC'}</div>
                        </td>
                        <td className="px-3.5 py-3 font-mono text-slate-600 whitespace-nowrap">
                          {item.deadline || item.createdAt.slice(0, 10)}
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold border border-indigo-200 transition-colors cursor-pointer"
                          >
                            <IconHistory className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{item.executionDuration ? item.executionDuration : 'Chi tiết'}</span>
                          </button>
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeClass}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {item.status === 'open'
                              ? 'Chờ xử lý'
                              : item.status === 'in_progress'
                              ? 'Đang xử lý'
                              : item.status === 'rectified'
                              ? 'Đã khắc phục'
                              : 'Đã nghiệm thu'}
                          </span>
                        </td>

                        {/* State Machine Action Button */}
                        <td className="px-3.5 py-3 text-right whitespace-nowrap">
                          {item.status === 'open' && (
                            <button
                              onClick={() => void handleStartProgress(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-[11px] transition-colors"
                            >
                              <IconPlay className="w-3 h-3" />
                              Tiếp nhận xử lý
                            </button>
                          )}
                          {item.status === 'in_progress' && (
                            <button
                              onClick={() => {
                                setRectifyingItem(item);
                                setRectificationInput('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-semibold text-[11px] transition-colors"
                            >
                              <IconPen className="w-3 h-3" />
                              Báo cáo khắc phục
                            </button>
                          )}
                          {item.status === 'rectified' && (
                            <button
                              onClick={() => void handleVerifyItem(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px] transition-colors shadow-2xs"
                            >
                              <IconCheckCircle className="w-3 h-3" />
                              QC Nghiệm thu (Verify)
                            </button>
                          )}
                          {item.status === 'verified' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <IconCheckCircle className="w-3.5 h-3.5" />
                              Đã xác nhận
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══ 7. BOTTOM 3-COLUMN SECTION ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Column 1: Project Info Card */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">
              i
            </div>
            <h3 className="text-xs font-bold text-slate-900">{projectInfoCard.title}</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="font-semibold text-slate-800">
              {currentProject ? `${currentProject.name} (${currentProject.code})` : projectInfoCard.projectName}
            </div>
            <div className="text-slate-600">Trạng thái: <span className="font-mono font-semibold text-blue-700">{currentProject?.status.toUpperCase() || 'INSTALLATION'}</span></div>
            <div className="text-slate-600">Địa điểm: {projectInfoCard.location}</div>
          </div>
        </div>

        {/* Column 2: Quality Roadmap */}
        <div className="md:col-span-6 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-900">{qualityRoadmap.title}</h3>
          <div className="flex items-center justify-between pt-1 relative">
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 z-0">
              <div className={`h-full bg-emerald-500 ${isHandoverBlocked ? 'w-3/4' : 'w-full'}`} />
            </div>
            {qualityRoadmap.steps.map((step) => (
              <div key={step.stepNumber} className="flex flex-col items-center gap-1.5 z-10 text-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${
                    step.stepNumber === 5 && isHandoverBlocked
                      ? 'bg-slate-100 text-slate-500 border border-slate-300'
                      : step.circleClass
                  }`}
                >
                  {step.stepNumber === 5 && !isHandoverBlocked ? (
                    <IconCheckCircle className="w-4 h-4 text-white" />
                  ) : step.status === 'completed' ? (
                    <IconCheckCircle className="w-4 h-4" />
                  ) : (
                    step.stepNumber
                  )}
                </div>
                <div>
                  <div className={`text-[10px] leading-tight ${step.textClass}`}>{step.name}</div>
                  <div className="text-[9px] text-slate-400 leading-tight">{step.subName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Quality Commitment */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-hidden flex flex-col justify-between relative group">
          <div className="space-y-1.5 z-10">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center">
                <IconShieldCheck className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-900">{commitmentBanner.title}</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              {commitmentBanner.description}
            </p>
          </div>
          <div className="mt-3 h-16 w-full rounded-xl overflow-hidden relative">
            <img
              src={commitmentBanner.imageUrl}
              alt="Quality Commitment"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-emerald-950/10" />
          </div>
        </div>
      </div>

      {/* ═══ 8. MODAL: LẬP BIÊN BẢN PUNCH LIST MỚI ════════════════════════════ */}
      {showNewPunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <IconFileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Lập Biên Bản Punch List Mới</h3>
                  <p className="text-[11px] text-slate-500">
                    Dự án: {currentProject ? `${currentProject.name} (${currentProject.code})` : projectHeader.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewPunchModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePunch} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Khu vực kiểm định</label>
                  <input
                    type="text"
                    value={punchZone}
                    onChange={(e) => setPunchZone(e.target.value)}
                    placeholder="VD: Phòng khách, Bếp, Ban công"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Hạng mục kiểm soát</label>
                  <select
                    value={punchCategory}
                    onChange={(e) =>
                      setPunchCategory(
                        e.target.value as 'finishing' | 'structural' | 'furniture_fit' | 'electrical_coordination' | 'painting',
                      )
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="furniture_fit">Đồ gỗ &amp; Nội thất (Furniture Fit)</option>
                    <option value="painting">Sơn tường &amp; Bề mặt (Painting)</option>
                    <option value="electrical_coordination">Cơ điện &amp; Thiết bị (Electrical)</option>
                    <option value="structural">Kết cấu &amp; Trần thạch cao (Structural)</option>
                    <option value="finishing">Hoàn thiện tổng thể (Finishing)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mức độ nghiêm trọng</label>
                <select
                  value={punchSeverity}
                  onChange={(e) => setPunchSeverity(e.target.value as 'critical' | 'major' | 'minor')}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="critical">Critical (Nghiêm trọng — Bắt buộc chặn bàn giao)</option>
                  <option value="major">Major (Lớn — Phải xử lý và nghiệm thu trước bàn giao)</option>
                  <option value="minor">Minor (Nhỏ — Khắc phục theo tiến độ bảo hành)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mô tả chi tiết khiếm khuyết</label>
                <textarea
                  rows={3}
                  value={punchDesc}
                  onChange={(e) => setPunchDesc(e.target.value)}
                  placeholder="Ghi rõ hiện trạng vết xước, độ hở, sai lệch so với bản vẽ thiết kế..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPunchModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold shadow-xs"
                >
                  Tạo Biên Bản Vào DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ 9. MODAL: BÁO CÁO KHẮC PHỤC KHIẾM KHUYẾT (RECTIFY MODAL) ═════════ */}
      {rectifyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <IconPen className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Báo Cáo Khắc Phục Khiếm Khuyết</h3>
              </div>
              <button
                onClick={() => setRectifyingItem(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRectified} className="p-5 space-y-3.5 text-xs">
              <div>
                <span className="font-semibold text-slate-600">Khiếm khuyết:</span>
                <p className="font-medium text-slate-900 mt-0.5">{rectifyingItem.description}</p>
              </div>

              <div className="pt-1">
                <OperationalAuditTrailCard
                  createdAt={rectifyingItem.createdAt}
                  createdByName={rectifyingItem.createdByName}
                  startedAt={rectifyingItem.startedAt}
                  startedByName={rectifyingItem.startedByName}
                  completedAt={rectifyingItem.completedAt}
                  completedByName={rectifyingItem.completedByName}
                  executionDuration={rectifyingItem.executionDuration}
                  statusHistory={rectifyingItem.statusHistory}
                  status={rectifyingItem.status}
                  title="Dấu vết thời gian xử lý khiếm khuyết"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nội dung đã khắc phục</label>
                <textarea
                  rows={3}
                  value={rectificationInput}
                  onChange={(e) => setRectificationInput(e.target.value)}
                  placeholder="Mô tả cụ thể phương án và kết quả đã xử lý (ví dụ: đã xả nhám, sơn lót và sơn phủ lại 2 lớp đạt độ bóng đồng đều)..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRectifyingItem(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs"
                >
                  Xác Nhận Đã Khắc Phục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ 10. MODAL: NGHIỆM THU BÀN GIAO & KÝ SỐ KHÁCH HÀNG ═══════════════ */}
      {showCustomerHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <IconShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Biên Bản Nghiệm Thu &amp; Bàn Giao Công Trình</h3>
                  <p className="text-[11px] text-slate-500">
                    Dự án: {currentProject ? `${currentProject.name} (${currentProject.code})` : projectHeader.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomerHandoverModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {handoverCompleted ? (
                <div className="text-center space-y-3 py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <IconCheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base text-slate-900">Bàn Giao Hoàn Tất Thành Công!</h4>
                  <p className="text-slate-600 text-xs max-w-sm mx-auto">
                    Biên bản bàn giao và chữ ký số của khách hàng đã được lưu trữ an toàn, toàn vẹn vào cơ sở dữ liệu. Hệ thống đã kích hoạt chứng thư bảo hành.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/dashboard/interior/warranty"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
                    >
                      <IconFileText className="w-4 h-4" />
                      Xem Chứng Thư Bảo Hành
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitCustomerSignature} className="space-y-3.5">
                  {/* Preflight Check summary */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <IconCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Điều kiện nghiệm thu bàn giao: ĐẠT</span>
                    </div>
                    <ul className="list-disc pl-5 text-[11px] text-emerald-900 space-y-0.5">
                      <li>100% khiếm khuyết Critical và Major đã được QC nghiệm thu xác thực.</li>
                      <li>Hồ sơ dự án và thông tin liên hệ khách hàng hợp lệ.</li>
                      <li>Mã yêu cầu bàn giao: <span className="font-mono font-semibold">{handoverData?.approvalId.slice(0, 8)}</span></li>
                    </ul>
                  </div>

                  {/* Customer Signature File Input */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Tệp chữ ký số hoặc biên bản bàn giao có chữ ký khách hàng:
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                      className="block w-full text-[11px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Hỗ trợ PDF, PNG, JPEG (tối đa 5MB). File sẽ được băm SHA-256 bảo vệ tính toàn vẹn.
                    </p>
                  </div>

                  {/* Customer Notes */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Ý kiến xác nhận của khách hàng
                    </label>
                    <textarea
                      rows={2}
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomerHandoverModal(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={signingAcceptance}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs disabled:opacity-50"
                    >
                      {signingAcceptance ? 'Đang xác thực & lưu ký…' : 'Xác Nhận Ký Bàn Giao Vào DB'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 11. MODAL: ĐỢT NGHIỆM THU NỘI BỘ MULTI-SESSION (BATCH O4) ════════ */}
      {showInternalSessionsModal && (
        <AcceptanceSessionModal
          projectId={selectedProjectId || projectHeader.id}
          projectName={currentProject ? currentProject.name : projectHeader.name}
          onClose={() => setShowInternalSessionsModal(false)}
          onUpdated={() => {
            void fetchAnalytics();
            if (selectedProjectId) void fetchPunchList(selectedProjectId);
          }}
        />
      )}

      {/* ═══ 12. MODAL: DẤU VẾT THỜI GIAN & LỊCH SỬ PHÊ DUYỆT PUNCH LIST ═══ */}
      {selectedAuditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Dấu Vết Lịch Sử &amp; Hiệu Suất Khiếm Khuyết QC
                </h3>
                <p className="text-xs text-slate-500">
                  Mã mục: #{selectedAuditItem.id.slice(0, 8)} — {selectedAuditItem.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditItem(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <OperationalAuditTrailCard
              createdAt={selectedAuditItem.createdAt}
              createdByName={selectedAuditItem.createdByName}
              startedAt={selectedAuditItem.startedAt}
              startedByName={selectedAuditItem.startedByName}
              completedAt={selectedAuditItem.completedAt}
              completedByName={selectedAuditItem.completedByName}
              executionDuration={selectedAuditItem.executionDuration}
              statusHistory={selectedAuditItem.statusHistory}
              status={selectedAuditItem.status}
              title="Dấu vết thời gian &amp; Lịch sử vòng đời lỗi QC"
            />

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
