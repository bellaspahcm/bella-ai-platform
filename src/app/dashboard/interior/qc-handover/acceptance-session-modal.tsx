'use client';

/**
 * Bella Interior OS — Acceptance & Handover Sessions Management Modal (Batch O4)
 *
 * Implements:
 * 1. Multi-Session Acceptance Overview.
 * 2. Visual representation of Three Independent State Dimensions:
 *    - Inspection Result (ACCEPTED_WITHOUT_ISSUES | ACCEPTED_WITH_REMARKS | PENDING_REMEDIATION)
 *    - Approval Status (PENDING | APPROVED | REJECTED)
 *    - Documentation Status (NONE | PARTIAL | COMPLETE)
 * 3. 7 Categories of Acceptance Notes with downstream routing indicators.
 * 4. Evidence Package upload with Server-Side SHA-256 calculation & object versioning.
 * 5. Manager Approval Decision Gate (interior:handover:approve) without auto-closing defects.
 * 6. Post-Approval Evidence Supplementation preserving approval history.
 *
 * @module src/app/dashboard/interior/qc-handover
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEvidenceDeletions } from '@/products/bella-interior/lib/use-evidence-deletions';
import type {
  AcceptanceCampaign,
  AcceptanceSession,
  AcceptanceNoteItem,
  AcceptanceEvidenceObject,
  AcceptanceSessionType,
  NoteCategory,
  NoteSeverity,
  AssessmentStatus,
  EvidenceCategory,
} from '@/products/bella-interior/domain/acceptance-handover.types';

// ─── Inline Clean Icons ───────────────────────────────────────────────────────

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
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

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

interface AcceptanceSessionModalProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly onClose: () => void;
  readonly onUpdated?: () => void;
}

type TabKey = 'sessions' | 'new_session' | 'notes' | 'evidence' | 'approval';

export default function AcceptanceSessionModal({
  projectId,
  projectName,
  onClose,
  onUpdated,
}: AcceptanceSessionModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('sessions');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data states
  const [campaigns, setCampaigns] = useState<AcceptanceCampaign[]>([]);
  const [sessions, setSessions] = useState<AcceptanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionNotes, setSessionNotes] = useState<AcceptanceNoteItem[]>([]);
  const [sessionEvidence, setSessionEvidence] = useState<AcceptanceEvidenceObject[]>([]);

  // Create session form
  const [newSessionCode, setNewSessionCode] = useState('SS-01');
  const [newSessionType, setNewSessionType] = useState<AcceptanceSessionType>('ROOM_BY_ROOM');
  const [newInspectionScope, setNewInspectionScope] = useState('Phòng khách & Ban công (Sofa, Kệ tivi)');
  const [newInspectionDate, setNewInspectionDate] = useState('2026-11-21');
  const [newCustomerRep, setNewCustomerRep] = useState('Nguyễn Văn A');
  const [newCustomerContact, setNewCustomerContact] = useState('0901234567');

  // Create note form
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('QUALITY_ISSUE');
  const [noteSeverity, setNoteSeverity] = useState<NoteSeverity>('medium');
  const [noteAssessment, setNoteAssessment] = useState<AssessmentStatus>('DEFECT_REMEDIATION_REQUIRED');
  const [noteDesc, setNoteDesc] = useState('');
  const [notePlan, setNotePlan] = useState('');
  const [noteFixer, setNoteFixer] = useState('');
  const [noteDeadline, setNoteDeadline] = useState('2026-11-24');

  // Evidence upload form
  const [evidenceCategory, setEvidenceCategory] = useState<EvidenceCategory>('OVERALL');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Approval form
  const [approvalDecision, setApprovalDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvalNotes, setApprovalNotes] = useState('Duyệt bàn giao có điều kiện. Tồn đọng xử lý đúng hạn.');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // ─── Fetch Campaigns & Sessions ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch campaigns
      let camps: AcceptanceCampaign[] = [];
      const campRes = await fetch(`/api/interior/delivery/acceptance/campaigns?projectId=${projectId}`);
      if (campRes.ok) {
        const json = await campRes.json();
        if (json.success && Array.isArray(json.data)) {
          camps = json.data;
        }
      }

      // If no campaign exists, automatically create default campaign for project
      if (camps.length === 0) {
        const createCampRes = await fetch('/api/interior/delivery/acceptance/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            campaignCode: `CP-${Date.now().toString().slice(-4)}`,
            campaignName: `Chiến dịch nghiệm thu & bàn giao ${projectName}`,
            description: 'Đặc tả nghiệm thu hiện trường và bàn giao chất lượng v2.0',
          }),
        });
        if (createCampRes.ok) {
          const campJson = await createCampRes.json();
          if (campJson.success && campJson.data) {
            camps = [campJson.data];
          }
        }
      }
      setCampaigns(camps);

      // 2. Fetch sessions
      const sessRes = await fetch(`/api/interior/delivery/acceptance/sessions?projectId=${projectId}`);
      if (sessRes.ok) {
        const json = await sessRes.json();
        if (json.success && Array.isArray(json.data)) {
          setSessions(json.data);
          if (json.data.length > 0 && !selectedSessionId) {
            setSelectedSessionId(json.data[0].id);
          }
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối với dịch vụ nghiệm thu.' });
    } finally {
      setLoading(false);
    }
  }, [projectId, projectName, selectedSessionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Fetch Notes & Evidence for Selected Session ────────────────────────────

  const loadSessionDetails = useCallback(async (sessId: string) => {
    try {
      const [notesRes, evRes] = await Promise.all([
        fetch(`/api/interior/delivery/acceptance/sessions/${sessId}/notes`),
        fetch(`/api/interior/delivery/acceptance/sessions/${sessId}/evidence`),
      ]);
      if (notesRes.ok) {
        const nJson = await notesRes.json();
        if (nJson.success && Array.isArray(nJson.data)) setSessionNotes(nJson.data);
      }
      if (evRes.ok) {
        const eJson = await evRes.json();
        if (eJson.success && Array.isArray(eJson.data)) setSessionEvidence(eJson.data);
      }
    } catch {
      // ignore detail error
    }
  }, []);
  const deletions = useEvidenceDeletions(projectId, () => {
    if (selectedSessionId) void loadSessionDetails(selectedSessionId);
  });

  useEffect(() => {
    if (selectedSessionId) {
      void loadSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId, loadSessionDetails]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (campaigns.length === 0) {
      setFeedback({ type: 'error', message: 'Chưa có chiến dịch nghiệm thu cho dự án này.' });
      return;
    }
    try {
      const res = await fetch('/api/interior/delivery/acceptance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaigns[0].id,
          projectId,
          sessionCode: newSessionCode.trim(),
          sessionType: newSessionType,
          inspectionScope: newInspectionScope.trim(),
          inspectionDate: newInspectionDate,
          customerRepresentative: newCustomerRep.trim(),
          customerContact: newCustomerContact.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFeedback({ type: 'error', message: json.error || 'Tạo đợt nghiệm thu thất bại.' });
        return;
      }
      setFeedback({ type: 'success', message: `Đã tạo đợt nghiệm thu ${newSessionCode}.` });
      setActiveTab('sessions');
      await loadData();
      if (json.data?.id) setSelectedSessionId(json.data.id);
      if (onUpdated) onUpdated();
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi tạo đợt nghiệm thu.' });
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !noteDesc.trim()) return;
    try {
      const res = await fetch(`/api/interior/delivery/acceptance/sessions/${selectedSessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: noteCategory,
          severity: noteSeverity,
          assessmentStatus: noteAssessment,
          description: noteDesc.trim(),
          remediationPlan: notePlan.trim() || null,
          assignedFixer: noteFixer.trim() || null,
          targetDeadline: noteDeadline || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFeedback({ type: 'error', message: json.error || 'Không thể lưu ghi chú nghiệm thu.' });
        return;
      }
      setFeedback({ type: 'success', message: 'Đã lưu ghi chú và tự động điều hướng xử lý.' });
      setNoteDesc('');
      setNotePlan('');
      await loadSessionDetails(selectedSessionId);
      await loadData();
      if (onUpdated) onUpdated();
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi lưu ghi chú.' });
    }
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !fileToUpload) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch(`/api/interior/delivery/acceptance/sessions/${selectedSessionId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evidenceCategory,
            fileName: fileToUpload.name,
            fileBase64: base64Data,
            mimeType: fileToUpload.type,
            storagePath: `acceptance/${selectedSessionId}/${fileToUpload.name}`,
          }),
        });
        const json = await res.json();
        setIsUploading(false);
        if (!res.ok || !json.success) {
          setFeedback({ type: 'error', message: json.error || 'Tải bằng chứng thất bại.' });
          return;
        }
        setFeedback({
          type: 'success',
          message: `Đã lưu tệp bằng chứng. SHA-256 máy chủ: ${json.data.sha256Hash?.slice(0, 12)}...`,
        });
        setFileToUpload(null);
        await loadSessionDetails(selectedSessionId);
        await loadData();
        if (onUpdated) onUpdated();
      };
      reader.readAsDataURL(fileToUpload);
    } catch {
      setIsUploading(false);
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi tải tệp lên.' });
    }
  };

  const handleApprovalDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) return;
    setIsSubmittingApproval(true);
    try {
      const res = await fetch(`/api/interior/delivery/acceptance/sessions/${selectedSessionId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: approvalDecision,
          approvalNotes: approvalNotes.trim() || null,
          rejectionReason: approvalDecision === 'REJECTED' ? rejectionReason.trim() : null,
        }),
      });
      const json = await res.json();
      setIsSubmittingApproval(false);
      if (!res.ok || !json.success) {
        setFeedback({ type: 'error', message: json.error || 'Phê duyệt thất bại.' });
        return;
      }
      setFeedback({
        type: 'success',
        message: `Đã ghi nhận quyết định: ${approvalDecision}. Lỗi tồn đọng được bảo toàn độc lập!`,
      });
      await loadData();
      if (onUpdated) onUpdated();
    } catch {
      setIsSubmittingApproval(false);
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi gửi phê duyệt.' });
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        {/* ═══ Header ════════════════════════════════════════════════════════ */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <IconShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm md:text-base">
                Quản Lý Nghiệm Thu Hiện Trường (Multi-Session Acceptance)
              </h2>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <span>Dự án: <strong className="text-slate-700">{projectName}</strong></span>
                {campaigns.length > 0 && (
                  <span className="font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[10px]">
                    {campaigns[0].campaignCode}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* ═══ Feedback Banner ═══════════════════════════════════════════════ */}
        {feedback && (
          <div
            className={`flex items-center justify-between px-4 py-2 text-xs font-semibold border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="p-0.5 hover:opacity-70">
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ═══ Navigation Tabs ═══════════════════════════════════════════════ */}
        <div className="flex items-center gap-1 p-2 bg-slate-50/80 border-b border-slate-100 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'sessions'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            📋 Các Đợt Nghiệm Thu ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('new_session')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'new_session'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <IconPlus className="w-3.5 h-3.5" />
              Tạo Đợt Mới
            </span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            disabled={!selectedSessionId}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40 ${
              activeTab === 'notes'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            📝 Ghi Chú &amp; Lỗi ({sessionNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            disabled={!selectedSessionId}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40 ${
              activeTab === 'evidence'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            📎 Bằng Chứng SHA-256 ({sessionEvidence.length})
          </button>
          <button
            onClick={() => setActiveTab('approval')}
            disabled={!selectedSessionId}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40 ${
              activeTab === 'approval'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            ⚖️ Phê Duyệt Quản Lý
          </button>
        </div>

        {/* ═══ Tab Content ════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 text-xs">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* TAB 1: SESSIONS LIST */}
              {activeTab === 'sessions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-600">
                      Mỗi công trình có nhiều đợt nghiệm thu độc lập với 3 chiều trạng thái riêng biệt:
                    </p>
                    <button
                      onClick={() => setActiveTab('new_session')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs inline-flex items-center gap-1"
                    >
                      <IconPlus className="w-3.5 h-3.5" /> Thêm đợt nghiệm thu
                    </button>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                      Chưa có đợt nghiệm thu nào. Hãy nhấn &quot;Tạo Đợt Mới&quot; để bắt đầu.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sessions.map((s) => {
                        const isSelected = s.id === selectedSessionId;
                        return (
                          <div
                            key={s.id}
                            onClick={() => setSelectedSessionId(s.id)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/20 shadow-sm ring-1 ring-emerald-500'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                {s.sessionCode}
                              </span>
                              <span className="text-slate-400 font-mono">{s.inspectionDate}</span>
                            </div>

                            <div>
                              <div className="font-bold text-slate-800 text-xs">{s.inspectionScope}</div>
                              <div className="text-[11px] text-slate-500">Đại diện khách: {s.customerRepresentative}</div>
                            </div>

                            {/* 3 Independent State Dimensions Badges */}
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 text-[10px]">
                              {/* Inspection Result */}
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold ${
                                  s.inspectionResult === 'ACCEPTED_WITHOUT_ISSUES'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : s.inspectionResult === 'ACCEPTED_WITH_REMARKS'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {s.inspectionResult === 'ACCEPTED_WITHOUT_ISSUES' && '✓ Đạt chuẩn'}
                                {s.inspectionResult === 'ACCEPTED_WITH_REMARKS' && '⚠ Đạt có ý kiến'}
                                {s.inspectionResult === 'PENDING_REMEDIATION' && '✕ Cần khắc phục'}
                              </span>

                              {/* Approval Status */}
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold ${
                                  s.approvalStatus === 'APPROVED'
                                    ? 'bg-emerald-600 text-white'
                                    : s.approvalStatus === 'REJECTED'
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {s.approvalStatus === 'APPROVED' && 'ĐÃ DUYỆT'}
                                {s.approvalStatus === 'REJECTED' && 'TỪ CHỐI'}
                                {s.approvalStatus === 'PENDING' && 'CHỜ QUẢN LÝ DUYỆT'}
                              </span>

                              {/* Documentation Status */}
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold ${
                                  s.documentationStatus === 'COMPLETE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : s.documentationStatus === 'PARTIAL'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {s.documentationStatus === 'COMPLETE' && 'Hồ sơ đầy đủ'}
                                {s.documentationStatus === 'PARTIAL' && 'Hồ sơ một phần'}
                                {s.documentationStatus === 'NONE' && 'Chưa có hồ sơ'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CREATE NEW SESSION */}
              {activeTab === 'new_session' && (
                <form onSubmit={handleCreateSession} className="max-w-xl mx-auto space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Mã đợt nghiệm thu</label>
                      <input
                        type="text"
                        value={newSessionCode}
                        onChange={(e) => setNewSessionCode(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Loại nghiệm thu</label>
                      <select
                        value={newSessionType}
                        onChange={(e) => setNewSessionType(e.target.value as AcceptanceSessionType)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="ROOM_BY_ROOM">Theo từng phòng (ROOM_BY_ROOM)</option>
                        <option value="ITEM_BASED">Theo sản phẩm/nội thất (ITEM_BASED)</option>
                        <option value="DELIVERY_BATCH">Theo đợt giao hàng (DELIVERY_BATCH)</option>
                        <option value="POST_REMEDIATION">Tái kiểm tra sau khắc phục (POST_REMEDIATION)</option>
                        <option value="FINAL_HANDOVER">Bàn giao toàn diện (FINAL_HANDOVER)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phạm vi kiểm tra hiện trường</label>
                    <input
                      type="text"
                      value={newInspectionScope}
                      onChange={(e) => setNewInspectionScope(e.target.value)}
                      placeholder="Ví dụ: Phòng khách & Ban công (Sofa Orlinor, Bàn trà, Kệ tivi)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Ngày nghiệm thu</label>
                      <input
                        type="date"
                        value={newInspectionDate}
                        onChange={(e) => setNewInspectionDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Đại diện khách hàng</label>
                      <input
                        type="text"
                        value={newCustomerRep}
                        onChange={(e) => setNewCustomerRep(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Số điện thoại</label>
                      <input
                        type="text"
                        value={newCustomerContact}
                        onChange={(e) => setNewCustomerContact(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('sessions')}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                    >
                      Tạo Đợt Nghiệm Thu
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: NOTES & DEFECTS */}
              {activeTab === 'notes' && selectedSession && (
                <div className="space-y-5">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">Đợt: {selectedSession.sessionCode}</span> —{' '}
                      <span className="text-slate-600">{selectedSession.inspectionScope}</span>
                    </div>
                    <span className="font-mono text-slate-500">{selectedSession.inspectionDate}</span>
                  </div>

                  {/* Existing Notes List */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-800">Danh Sách Ý Kiến &amp; Lỗi Hiện Trường ({sessionNotes.length})</h3>
                    {sessionNotes.length === 0 ? (
                      <p className="text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                        Chưa ghi nhận ý kiến phát sinh nào.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {sessionNotes.map((note) => (
                          <div key={note.id} className="p-3 space-y-1 hover:bg-slate-50/50">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{note.category}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                                  {note.severity}
                                </span>
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  Điều hướng: {note.routedEntityType || 'N/A'}
                                </span>
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {note.remediationStatus}
                                </span>
                              </div>
                            </div>
                            <p className="text-slate-700">{note.description}</p>
                            {note.remediationPlan && (
                              <p className="text-slate-500 text-[11px]">
                                🛠 Phương án: {note.remediationPlan} | Người sửa: {note.assignedFixer || 'Chưa gán'} | Hạn: {note.targetDeadline || 'N/A'}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleCreateNote} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-900">Ghi Nhận Ý Kiến / Lỗi Mới</h4>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Nhóm ý kiến (7 nhóm)</label>
                        <select
                          value={noteCategory}
                          onChange={(e) => setNoteCategory(e.target.value as NoteCategory)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="QUALITY_ISSUE">Lỗi chất lượng hoàn thiện (Punch List)</option>
                          <option value="INSTALLATION_ISSUE">Lỗi lắp đặt kết cấu (Punch List)</option>
                          <option value="CUSTOMER_REQUEST">Yêu cầu bổ sung của khách (Change Order)</option>
                          <option value="MISSING_ITEM">Thiếu phụ kiện/sản phẩm (Replenishment)</option>
                          <option value="DAMAGE">Hư hỏng/sứt mẻ (Warranty Ticket)</option>
                          <option value="FOLLOW_UP">Theo dõi kiểm tra sau (Re-inspection)</option>
                          <option value="GENERAL_NOTE">Ghi chú hiện trường chung (CRM Note)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Mức độ nghiêm trọng</label>
                        <select
                          value={noteSeverity}
                          onChange={(e) => setNoteSeverity(e.target.value as NoteSeverity)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="low">Thấp (Minor)</option>
                          <option value="medium">Trung bình (Medium)</option>
                          <option value="high">Cao (Major)</option>
                          <option value="critical">Nghiêm trọng (Critical - Chặn bàn giao)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Đánh giá kỹ thuật</label>
                        <select
                          value={noteAssessment}
                          onChange={(e) => setNoteAssessment(e.target.value as AssessmentStatus)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="DEFECT_REMEDIATION_REQUIRED">Cần khắc phục (DEFECT_REQUIRED)</option>
                          <option value="MINOR_MONITORING">Theo dõi thêm (MINOR_MONITORING)</option>
                          <option value="INCOMPLETE_ITEMS">Chưa hoàn thiện (INCOMPLETE_ITEMS)</option>
                          <option value="NO_ISSUES">Đạt chuẩn không lỗi (NO_ISSUES)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Mô tả cụ thể</label>
                      <input
                        type="text"
                        value={noteDesc}
                        onChange={(e) => setNoteDesc(e.target.value)}
                        placeholder="Ví dụ: Vết trầy nhẹ chân ghế sofa bên phải..."
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Kế hoạch khắc phục</label>
                        <input
                          type="text"
                          value={notePlan}
                          onChange={(e) => setNotePlan(e.target.value)}
                          placeholder="Dặm vá sơn PU..."
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Người phụ trách sửa</label>
                        <input
                          type="text"
                          value={noteFixer}
                          onChange={(e) => setNoteFixer(e.target.value)}
                          placeholder="Tổ sơn..."
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Hạn xử lý</label>
                        <input
                          type="date"
                          value={noteDeadline}
                          onChange={(e) => setNoteDeadline(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold shadow-xs"
                      >
                        Lưu Ý Kiến &amp; Điều Hướng
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 4: EVIDENCE PACKAGE */}
              {activeTab === 'evidence' && selectedSession && (
                <div className="space-y-5">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">Bằng chứng đợt: {selectedSession.sessionCode}</span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Mã SHA-256 được tính toán độc lập tại máy chủ backend để đảm bảo tính toàn vẹn pháp lý.
                      </div>
                    </div>
                    <span className="font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                      Tình trạng: {selectedSession.documentationStatus}
                    </span>
                  </div>

                  {/* Existing Evidence List */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-800">Các Tệp Bằng Chứng Đã Lưu ({sessionEvidence.length})</h3>
                    {deletions.message && <p role="status" className="text-xs text-slate-600">{deletions.message}</p>}
                    {sessionEvidence.length === 0 ? (
                      <p className="text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                        Chưa có hình ảnh hoặc biên bản nghiệm thu nào được tải lên.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {sessionEvidence.map((ev) => (
                          <div key={ev.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{ev.fileName}</span>
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                                  v{ev.version}
                                </span>
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700">
                                  {ev.evidenceCategory}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">
                                SHA-256: <strong className="text-slate-600">{ev.sha256Hash}</strong>
                              </div>
                            </div>
                            <div className="text-right text-[11px] text-slate-500">
                              <div>{(ev.fileSizeBytes / 1024).toFixed(1)} KB</div>
                              <div className="text-[10px] text-slate-400">{ev.uploadedAt.split('T')[0]}</div>
                              <a className="text-blue-700 underline" href={`/api/interior/delivery/acceptance/sessions/${selectedSessionId}/evidence?evidenceId=${encodeURIComponent(ev.id)}`}>
                                Tải tệp
                              </a>
                              {deletions.allowed && (
                                <div>
                                  {deletions.pending.filter((item) => item.kind === 'O4' && item.recordId === ev.id).map((item) => (
                                    <button key={item.requestId} type="button" disabled={deletions.busy}
                                      onClick={() => void deletions.execute(item.requestId)} className="text-rose-700 underline">
                                      {item.status === 'DELETE_FAILED' ? 'Thử lại xóa' : 'Thực hiện xóa'}
                                    </button>
                                  ))}
                                  {!deletions.pending.some((item) => item.kind === 'O4' && item.recordId === ev.id) && (
                                    <button type="button" disabled={deletions.busy} onClick={() => void deletions.requestDeletion('O4', ev.id)}
                                      className="text-rose-700 underline">Yêu cầu xóa</button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload Form */}
                  <form onSubmit={handleUploadEvidence} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-900">Tải Lên Bằng Chứng / Biên Bản Ký Mới</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Loại bằng chứng</label>
                        <select
                          value={evidenceCategory}
                          onChange={(e) => setEvidenceCategory(e.target.value as EvidenceCategory)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="OVERALL">Ảnh chụp tổng thể hiện trường (OVERALL)</option>
                          <option value="DETAIL">Ảnh chụp cận cảnh chi tiết/lỗi (DETAIL)</option>
                          <option value="COMPLETED_PRODUCT">Ảnh sản phẩm sau hoàn thiện (COMPLETED_PRODUCT)</option>
                          <option value="CUSTOMER_SIGNOFF">Biên bản giấy có chữ ký khách hàng (CUSTOMER_SIGNOFF)</option>
                          <option value="REMEDIATION_PROOF">Bằng chứng đã khắc phục xong (REMEDIATION_PROOF)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Chọn tệp (ảnh hoặc PDF)</label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setFileToUpload(e.target.files[0]);
                            }
                          }}
                          className="w-full px-2.5 py-1 border border-slate-200 rounded-lg bg-white file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-semibold"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={!fileToUpload || isUploading}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <IconUpload className="w-3.5 h-3.5" />
                        {isUploading ? 'Đang tải & băm SHA-256...' : 'Tải Lên Máy Chủ'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 5: MANAGER APPROVAL */}
              {activeTab === 'approval' && selectedSession && (
                <form onSubmit={handleApprovalDecision} className="max-w-xl mx-auto space-y-4">
                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1.5">
                    <div className="font-bold text-emerald-900 flex items-center gap-2">
                      <IconShieldCheck className="w-4 h-4 text-emerald-600" />
                      Cổng Phê Duyệt Của Quản Lý (Server-Enforced Authorization)
                    </div>
                    <p className="text-emerald-800 text-[11px] leading-relaxed">
                      Phê duyệt nghiệm thu xác nhận bàn giao có điều kiện hoặc chính thức. Hệ thống bảo toàn 2 quy tắc bất biến:
                      <br />• <strong>Hồ sơ giấy không chặn phê duyệt</strong>: Cho phép duyệt khi hồ sơ là NONE hoặc PARTIAL.
                      <br />• <strong>Duyệt không tự đóng lỗi</strong>: Các mục lỗi trong Punch List vẫn giữ nguyên trạng thái OPEN/IN_PROGRESS.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800">Thông tin đợt hiện tại:</div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>Mã: <strong className="font-mono">{selectedSession.sessionCode}</strong></div>
                      <div>Kiểm tra: <strong>{selectedSession.inspectionResult}</strong></div>
                      <div>Hồ sơ: <strong>{selectedSession.documentationStatus}</strong></div>
                    </div>
                    {selectedSession.approvalStatus === 'APPROVED' && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-emerald-700 font-semibold text-[11px]">
                        ✓ Đã được phê duyệt lúc {selectedSession.approvedAt?.split('T')[0]}.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Quyết định phê duyệt</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="decision"
                          value="APPROVED"
                          checked={approvalDecision === 'APPROVED'}
                          onChange={() => setApprovalDecision('APPROVED')}
                          className="text-emerald-600"
                        />
                        <span className="font-bold text-emerald-700">Phê duyệt nghiệm thu (APPROVED)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="decision"
                          value="REJECTED"
                          checked={approvalDecision === 'REJECTED'}
                          onChange={() => setApprovalDecision('REJECTED')}
                          className="text-rose-600"
                        />
                        <span className="font-bold text-rose-700">Từ chối nghiệm thu (REJECTED)</span>
                      </label>
                    </div>
                  </div>

                  {approvalDecision === 'APPROVED' ? (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Ghi chú phê duyệt</label>
                      <textarea
                        rows={2}
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Nội dung điều kiện bàn giao..."
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-rose-700">Lý do từ chối (bắt buộc)</label>
                      <textarea
                        rows={2}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Nêu rõ lý do chưa đạt chuẩn bàn giao..."
                        className="w-full px-3 py-1.5 border border-rose-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('sessions')}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingApproval}
                      className={`px-4 py-1.5 rounded-lg text-white font-semibold shadow-xs disabled:opacity-50 ${
                        approvalDecision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {isSubmittingApproval ? 'Đang ghi nhận...' : 'Xác Nhận Quyết Định'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
