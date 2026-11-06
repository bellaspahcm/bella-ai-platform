'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  ShieldCheck,
  Plus,
  Palette,
  Maximize2,
  ChevronRight,
  AlertCircle,
  FolderOpen,
  Lock,
  Unlock,
  Building,
  RefreshCw,
  ExternalLink,
  Sparkles,
  X,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  clientName: string;
  contractValue: number;
}

interface RevisionSummary {
  id: string;
  projectId: string;
  revisionName: string;
  revisionNumber: string;
  status: 'draft' | 'review' | 'approved' | 'rejected';
  designedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface DesignAssetItem {
  id: string;
  type: string;
  title: string;
  fileUrl: string;
  notes?: string;
}

interface MaterialSpecItem {
  id: string;
  itemCategory: string;
  brand: string;
  code: string;
  name: string;
  colorTone?: string;
  specDescription: string;
  approvedForUse: boolean;
}

interface RoomZoneItem {
  id: string;
  code: string;
  name: string;
  floor: number;
  areaSquareMeters?: number;
}

interface FullRevisionDetail {
  id: string;
  projectId: string;
  versionNumber: number;
  title: string;
  status: string;
  submittedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  changeSummary?: string;
  assets: DesignAssetItem[];
  materialSpecs: MaterialSpecItem[];
}

export default function InteriorDesignStudioPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selectedRevId, setSelectedRevId] = useState<string>('');
  const [revisionDetail, setRevisionDetail] = useState<FullRevisionDetail | null>(null);
  const [roomZones, setRoomZones] = useState<RoomZoneItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [approving, setApproving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [showNewRevModal, setShowNewRevModal] = useState<boolean>(false);
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [previewAsset, setPreviewAsset] = useState<DesignAssetItem | null>(null);

  // New Project Form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectBudget, setNewProjectBudget] = useState('500000000');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // New Revision Form
  const [newRevName, setNewRevName] = useState('');
  const [newRevNumber, setNewRevNumber] = useState('R2.0');

  // Approval Form
  const [approvalNotes, setApprovalNotes] = useState('');

  // 1. Load Projects
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/interior/projects');
      const json = await res.json();
      if (json.success && json.data?.projects) {
        setProjects(json.data.projects);
        if (json.data.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(json.data.projects[0].id);
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối đến máy chủ lấy danh sách dự án.' });
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 2. Load Revisions when Project changes
  const loadRevisions = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/interior/design/revisions?projectId=${encodeURIComponent(projId)}`);
      const json = await res.json();
      if (json.success && json.data?.revisions) {
        const revs: RevisionSummary[] = json.data.revisions;
        setRevisions(revs);
        if (revs.length > 0) {
          // Select approved revision if available, otherwise first revision
          const defaultRev = revs.find((r) => r.status === 'approved') || revs[0];
          setSelectedRevId(defaultRev.id);
        } else {
          setSelectedRevId('');
          setRevisionDetail(null);
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể tải danh sách phiên bản thiết kế.' });
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadRevisions(selectedProjectId);
    }
  }, [selectedProjectId, loadRevisions]);

  // 3. Load Revision Details when Revision changes
  const loadRevisionDetail = useCallback(async (revId: string) => {
    if (!revId) return;
    try {
      const res = await fetch(`/api/interior/design/revisions/${encodeURIComponent(revId)}`);
      const json = await res.json();
      if (json.success && json.data?.revision) {
        setRevisionDetail(json.data.revision);
        if (json.data.roomZones) {
          setRoomZones(json.data.roomZones);
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    if (selectedRevId) {
      loadRevisionDetail(selectedRevId);
    }
  }, [selectedRevId, loadRevisionDetail]);

  // Active Project object
  const activeProject = projects.find((p) => p.id === selectedProjectId) || {
    id: 'proj-001',
    name: 'Dubai Luxury Villa Fitout',
    code: 'INT-DUBAI-001',
    status: 'design',
    clientName: 'Sheikh Al-Maktoum Office',
    contractValue: 850_000_000,
  };

  // Active Revision object
  const activeRev = revisions.find((r) => r.id === selectedRevId);
  const isApproved = activeRev?.status === 'approved' || revisionDetail?.status === 'approved';

  // Handle Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !newProjectCode || !newProjectClient) {
      setFeedback({ type: 'error', message: 'Vui lòng điền đầy đủ Tên, Mã dự án và Khách hàng.' });
      return;
    }
    try {
      const res = await fetch('/api/interior/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          code: newProjectCode,
          clientPartyId: newProjectClient,
          estimatedBudget: parseFloat(newProjectBudget) || 0,
          description: newProjectDesc,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.project) {
        setShowNewProjectModal(false);
        setNewProjectName('');
        setNewProjectCode('');
        setNewProjectClient('');
        setFeedback({ type: 'success', message: `Đã khởi tạo dự án ${json.data.project.code} thành công!` });
        await loadProjects();
        setSelectedProjectId(json.data.project.id);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Tạo dự án thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi tạo dự án.' });
    }
  };

  // Handle Create Revision
  const handleCreateRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRevName || !newRevNumber) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập tên và số hiệu phiên bản.' });
      return;
    }
    try {
      const res = await fetch('/api/interior/design/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          revisionName: newRevName,
          revisionNumber: newRevNumber,
          designedByUserId: 'user-architect-lead',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.revision) {
        setShowNewRevModal(false);
        setNewRevName('');
        setFeedback({ type: 'success', message: `Đã tạo phiên bản ${json.data.revision.revisionNumber} thành công!` });
        await loadRevisions(selectedProjectId);
        setSelectedRevId(json.data.revision.id);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Tạo version thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi tạo version.' });
    }
  };

  // Handle Approve Design Lock
  const handleApproveLock = async () => {
    if (!selectedRevId) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/interior/design/revisions/${encodeURIComponent(selectedRevId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes }),
      });
      const json = await res.json();
      if (json.success) {
        setShowApproveModal(false);
        setApprovalNotes('');
        setFeedback({
          type: 'success',
          message: 'Bản vẽ đã khóa phê duyệt thành công (Approved Design Lock)! Đã đủ điều kiện sang BOQ / Sản xuất.',
        });
        // Refresh revisions
        await loadRevisions(selectedProjectId);
        await loadRevisionDetail(selectedRevId);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Không thể phê duyệt bản vẽ.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi khi gửi yêu cầu phê duyệt.' });
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 font-sans">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/interior"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Studio Quản Lý Thiết Kế &amp; Bản Vẽ</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Design &amp; Specification
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Dự án:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-amber-300 rounded px-2 py-0.5 font-medium focus:outline-none focus:border-amber-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="hover:text-amber-400 inline-flex items-center gap-1 text-[11px] underline"
              >
                + Thêm dự án
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadRevisions(selectedProjectId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewRevModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Tạo Version mới
          </button>
        </div>
      </div>

      {/* Version Selector & Lock Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold uppercase text-slate-400">Phiên bản thiết kế:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {revisions.map((rev) => (
              <button
                key={rev.id}
                onClick={() => setSelectedRevId(rev.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                  selectedRevId === rev.id
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {rev.revisionNumber} {rev.status === 'approved' && '• APPROVED'}
              </button>
            ))}
          </div>
        </div>

        {/* Lock Status & Actions */}
        <div className="flex items-center gap-2">
          {isApproved ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Approved Design Lock — Bản vẽ đã khóa sản xuất</span>
              </div>
              <Link
                href={`/dashboard/interior/boq?revisionId=${selectedRevId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors"
              >
                Lập BOQ / Dự toán
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>Dự thảo (Chưa khóa phê duyệt)</span>
              </div>
              <button
                onClick={() => setShowApproveModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Lock className="h-3.5 w-3.5" />
                Phê duyệt &amp; Khóa (Lock)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Room Zones Navigation Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-medium shrink-0">Không gian thiết kế:</span>
        {roomZones.length > 0 ? (
          roomZones.map((z) => (
            <span
              key={z.id}
              className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 shrink-0"
            >
              {z.name} ({z.code}) {z.areaSquareMeters ? `• ${z.areaSquareMeters}m²` : ''}
            </span>
          ))
        ) : (
          <>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
              Phòng khách Luxury • 65m²
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
              Bếp &amp; Phòng ăn Master • 45m²
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
              Phòng ngủ Master Suite • 52m²
            </span>
          </>
        )}
      </div>

      {/* Design Studio Layout: Rooms, 3D Render & Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Rooms & 3D Renderings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-400" />
                Phối Cảnh 3D &amp; Bản Vẽ Kỹ Thuật ({activeRev?.revisionNumber || 'R1.0'})
              </h3>
              <span className="text-xs text-slate-400">
                {revisionDetail?.title || 'Phối cảnh tổng thể Luxury Villa Fitout'}
              </span>
            </div>

            {/* 3D Render Viewer Canvas */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center group">
              <img
                src={
                  revisionDetail?.assets?.[0]?.fileUrl ||
                  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80'
                }
                alt="Phối cảnh 3D"
                className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent z-10" />
              <div className="text-center p-6 space-y-2 z-20 mt-auto">
                <div className="text-base font-bold text-white drop-shadow">
                  {revisionDetail?.assets?.[0]?.title || 'Phối cảnh 3D Phòng Khách & Bàn Đảo Bếp V2'}
                </div>
                <p className="text-xs text-slate-300 max-w-md drop-shadow">
                  {revisionDetail?.assets?.[0]?.notes ||
                    'Veneer óc chó tự nhiên Bắc Mỹ, vách đá Marble Calacatta nhân tạo Vicostone, phụ kiện ray Blum.'}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() =>
                      setPreviewAsset(
                        revisionDetail?.assets?.[0] || {
                          id: 'sample',
                          type: 'concept_3d',
                          title: 'Phối cảnh 3D Phòng Khách & Bàn Đảo Bếp V2',
                          fileUrl:
                            'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
                        }
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-900/90 text-slate-200 border border-slate-700 hover:bg-amber-600 hover:text-white transition-colors"
                  >
                    <Maximize2 className="h-3 w-3 text-amber-400" /> Xem ảnh phóng to
                  </button>
                </div>
              </div>
            </div>

            {/* Technical Drawing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-500">Mặt cắt kỹ thuật</span>
                <div className="font-semibold text-slate-200">2D-SEC-KIT-01.pdf</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Đã ký duyệt
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-500">Chi tiết phụ kiện</span>
                <div className="font-semibold text-slate-200">BLUM-TANDEM-SPEC.pdf</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Đã chốt mã
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-500">Mặt bằng bố trí</span>
                <div className="font-semibold text-slate-200">LAYOUT-F1-REV2.dwg</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Cốt hiện trạng
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Material Specifications Board */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Palette className="h-4 w-4 text-amber-400" />
                Quy Cách Vật Liệu &amp; Phụ Kiện
              </h3>
              <span className="text-xs text-amber-400">
                {revisionDetail?.materialSpecs?.length || 4} vật tư định danh
              </span>
            </div>

            <div className="space-y-3">
              {(revisionDetail?.materialSpecs && revisionDetail.materialSpecs.length > 0
                ? revisionDetail.materialSpecs
                : [
                    {
                      id: 'spec-1',
                      itemCategory: 'wood_board',
                      brand: 'An Cường',
                      code: 'MS 440 EV',
                      name: 'Veneer Óc Chó Bắc Mỹ',
                      colorTone: 'Walnut Deep Brown',
                      specDescription: 'Hoàn thiện sơn bóng mờ 50% PU cao cấp',
                      approvedForUse: true,
                    },
                    {
                      id: 'spec-2',
                      itemCategory: 'stone',
                      brand: 'Vicostone',
                      code: 'BQ8628 Nero Marquina',
                      name: 'Đá Thạch Anh Nhân Tạo',
                      colorTone: 'Black Marquina',
                      specDescription: 'Dày 20mm bo mòi 45 độ',
                      approvedForUse: true,
                    },
                    {
                      id: 'spec-3',
                      itemCategory: 'hardware',
                      brand: 'Blum Austria',
                      code: 'Clip Top BLUMOTION 110',
                      name: 'Bản Lề Giảm Chấn Thép',
                      colorTone: 'Nikel Silver',
                      specDescription: 'Bảo hành 5 năm cơ cấu đóng êm',
                      approvedForUse: true,
                    },
                    {
                      id: 'spec-4',
                      itemCategory: 'glass_metal',
                      brand: 'EuroClass',
                      code: 'SLIM-CHAMPAGNE-05',
                      name: 'Khung Cánh Kính Slim',
                      colorTone: 'Champagne Gold',
                      specDescription: 'Kính xám khói cường lực 5mm viền nhôm anode champagne',
                      approvedForUse: true,
                    },
                  ]
              ).map((spec) => (
                <div
                  key={spec.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{spec.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {spec.brand}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Code: <span className="text-slate-200 font-medium">{spec.code}</span> • {spec.specDescription}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: New Project */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building className="h-5 w-5 text-amber-400" /> Khởi Tạo Dự Án Nội Thất Mới
              </h3>
              <button onClick={() => setShowNewProjectModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tên dự án *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Căn hộ Duplex Vinhomes Central Park"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Mã dự án *</label>
                  <input
                    type="text"
                    required
                    placeholder="INT-2026-003"
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Khách hàng / Chủ đầu tư *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={newProjectClient}
                    onChange={(e) => setNewProjectClient(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Dự toán dự kiến (VNĐ)</label>
                <input
                  type="number"
                  value={newProjectBudget}
                  onChange={(e) => setNewProjectBudget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Địa chỉ công trình</label>
                <textarea
                  rows={2}
                  placeholder="Số nhà, đường, quận/huyện..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                >
                  Lưu &amp; Tạo dự án
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Revision */}
      {showNewRevModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-400" /> Tạo Phiên Bản Thiết Kế Mới
              </h3>
              <button onClick={() => setShowNewRevModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRevision} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Số hiệu Revision *</label>
                <input
                  type="text"
                  required
                  placeholder="R2.0"
                  value={newRevNumber}
                  onChange={(e) => setNewRevNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tên phương án thiết kế *</label>
                <input
                  type="text"
                  required
                  placeholder="Phương án điều chỉnh phòng khách & quầy bar"
                  value={newRevName}
                  onChange={(e) => setNewRevName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewRevModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                >
                  Tạo Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve & Lock */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" /> Phê Duyệt &amp; Khóa Bản Vẽ
              </h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Khi thực hiện phê duyệt, hệ thống sẽ kích hoạt quy tắc{' '}
                <span className="text-emerald-400 font-semibold">Approved Design Lock</span>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Bản vẽ và quy cách vật liệu của phiên bản này sẽ bị khóa vĩnh viễn (immutable).</li>
                <li>Không cho phép chỉnh sửa hoặc phê duyệt lại lần 2.</li>
                <li>Phiên bản này sẽ trở thành căn cứ pháp lý để lập BOQ, ký hợp đồng và sản xuất.</li>
              </ul>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Ghi chú phê duyệt (Tùy chọn)</label>
                <textarea
                  rows={2}
                  placeholder="Khách hàng đã ký biên bản chốt phương án ngày 06/11/2026..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  onClick={handleApproveLock}
                  disabled={approving}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-all disabled:opacity-50"
                >
                  {approving ? 'Đang khóa...' : 'Xác nhận Khóa &amp; Phê duyệt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Preview Asset */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-sm font-semibold text-white">{previewAsset.title}</span>
              <button onClick={() => setPreviewAsset(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black max-h-[70vh] flex items-center justify-center">
              <img src={previewAsset.fileUrl} alt={previewAsset.title} className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
