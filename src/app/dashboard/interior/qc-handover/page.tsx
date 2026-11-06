'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  FileText,
  Building,
  RefreshCw,
  X,
  Lock,
  UserCheck,
  Award,
  ChevronRight,
  Filter,
  Wrench,
  ClipboardCheck,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  clientName: string;
}

type PunchCategory =
  | 'finishing'
  | 'structural'
  | 'furniture_fit'
  | 'electrical_coordination'
  | 'painting';

type PunchSeverity = 'critical' | 'major' | 'minor';

type PunchStatus = 'open' | 'in_progress' | 'rectified' | 'verified';

interface PunchItemDisplay {
  id: string;
  roomZoneId: string | null;
  description: string;
  category: PunchCategory;
  severity: PunchSeverity;
  status: PunchStatus;
  reportedByUserId: string;
  assignedToUserId: string | null;
  photoUrl: string | null;
  createdAt: string;
}

export default function InteriorQCHandoverPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [punchItems, setPunchItems] = useState<PunchItemDisplay[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Punch Item Modal
  const [showNewPunchModal, setShowNewPunchModal] = useState<boolean>(false);
  const [punchRoom, setPunchRoom] = useState('Phòng Khách Luxury');
  const [punchDesc, setPunchDesc] = useState('');
  const [punchCategory, setPunchCategory] = useState<PunchCategory>('furniture_fit');
  const [punchSeverity, setPunchSeverity] = useState<PunchSeverity>('major');
  const [punchAssignee, setPunchAssignee] = useState('Đội mộc hoàn thiện 1');

  // Rectify Modal
  const [rectifyingItem, setRectifyingItem] = useState<PunchItemDisplay | null>(null);
  const [rectifierName, setRectifierName] = useState('Thợ chính Nguyễn Văn Hùng');
  const [rectifyNote, setRectifyNote] = useState('Đã căn chỉnh lại bản lề, khe hở 2mm đều khít');

  // Handover Modal
  const [showHandoverModal, setShowHandoverModal] = useState<boolean>(false);
  const [handoverClientRep, setHandoverClientRep] = useState('Sheikh Al-Maktoum Office');
  const [handoverNotes, setHandoverNotes] = useState('Biên bản nghiệm thu hoàn thành đạt chất lượng cao cấp.');

  // Load Projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/projects');
      const json = await res.json();
      if (json.success && json.data?.projects) {
        setProjects(json.data.projects);
        if (json.data.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(json.data.projects[0].id);
        }
      }
    } catch {
      // fallback
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load Punch List
  const loadPunchList = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/interior/delivery/punch-list?projectId=${encodeURIComponent(projId)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setPunchItems(json.data);
      } else {
        // Fallback default sample items
        setPunchItems([
          {
            id: 'pli-001',
            roomZoneId: 'Phòng Khách Luxury',
            description: 'Cánh tủ rượu bị lệch khe hở 3mm — bản lề chưa siết ốc định vị',
            category: 'furniture_fit',
            severity: 'major',
            status: 'rectified',
            reportedByUserId: 'KTS. Lê Hoàng Sơn',
            assignedToUserId: 'Thợ chính Nguyễn Văn Hùng',
            photoUrl: null,
            createdAt: '2026-11-05T10:00:00Z',
          },
          {
            id: 'pli-002',
            roomZoneId: 'Bếp Đảo Master',
            description: 'Đường keo dán mặt đá Vicostone với bồn rửa chưa gạt sạch bavia',
            category: 'finishing',
            severity: 'minor',
            status: 'verified',
            reportedByUserId: 'Giám sát QC',
            assignedToUserId: 'Đội đá Thạch Anh',
            photoUrl: null,
            createdAt: '2026-11-04T14:30:00Z',
          },
          {
            id: 'pli-003',
            roomZoneId: 'Phòng Ngủ Master',
            description: 'Vết xước nhẹ 15mm trên tay vịn gỗ óc chó do vận chuyển',
            category: 'painting',
            severity: 'minor',
            status: 'open',
            reportedByUserId: 'KTS. Lê Hoàng Sơn',
            assignedToUserId: 'Thợ sơn PU',
            photoUrl: null,
            createdAt: '2026-11-06T09:00:00Z',
          },
        ]);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể tải danh mục lỗi Punch List.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadPunchList(selectedProjectId);
    }
  }, [selectedProjectId, loadPunchList]);

  // Handle Create Punch Item
  const handleCreatePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchDesc) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập mô tả lỗi tồn đọng.' });
      return;
    }
    try {
      const res = await fetch('/api/interior/delivery/punch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          roomZoneId: punchRoom,
          description: punchDesc,
          category: punchCategory,
          severity: punchSeverity,
          reportedByUserId: 'user-architect-lead',
          assignedToUserId: punchAssignee,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setShowNewPunchModal(false);
        setPunchDesc('');
        setFeedback({ type: 'success', message: 'Đã lập biên nhận lỗi vào Punch List!' });
        await loadPunchList(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Tạo punch item thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi gửi punch item.' });
    }
  };

  // Handle Mark Rectified
  const handleMarkRectified = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rectifyingItem) return;
    try {
      const res = await fetch(`/api/interior/delivery/punch-list/${encodeURIComponent(rectifyingItem.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rectified',
          rectifiedBy: rectifierName,
          rectificationNote: rectifyNote,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRectifyingItem(null);
        setFeedback({
          type: 'success',
          message: 'Lỗi đã được khắc phục (Rectified). Đang chờ Giám sát QC kiểm tra lại để xác thực (Verified)!',
        });
        // Update local state
        setPunchItems((prev) =>
          prev.map((item) => (item.id === rectifyingItem.id ? { ...item, status: 'rectified' } : item))
        );
      } else {
        setFeedback({ type: 'error', message: json.error || 'Cập nhật khắc phục thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi cập nhật.' });
    }
  };

  // Handle Verify Punch Item (Inspector Sign-off)
  const handleVerifyPunch = async (itemId: string) => {
    try {
      const res = await fetch(`/api/interior/delivery/punch-list/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'verified',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({
          type: 'success',
          message: 'Đã nghiệm thu đạt (Verified)! Chữ ký kiểm định đã được gán tự động từ tài khoản thanh tra.',
        });
        setPunchItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, status: 'verified' } : item))
        );
      } else {
        setFeedback({ type: 'error', message: json.error || 'Xác thực lỗi thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi xác thực.' });
    }
  };

  // Critical open items check
  const criticalUnverified = punchItems.filter(
    (i) => i.severity === 'critical' && i.status !== 'verified'
  );
  const isHandoverBlocked = criticalUnverified.length > 0;

  // Handle Complete Handover
  const handleCompleteHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHandoverBlocked) {
      setFeedback({
        type: 'error',
        message: `Bàn giao bị chặn: Còn ${criticalUnverified.length} lỗi nghiêm trọng (Critical) chưa được nghiệm thu Verified!`,
      });
      return;
    }
    try {
      const res = await fetch('/api/interior/delivery/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          handedOverByUserId: 'user-architect-lead',
          clientRepresentative: handoverClientRep,
          notes: handoverNotes,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setShowHandoverModal(false);
        setFeedback({
          type: 'success',
          message: `Nghiệm thu bàn giao hoàn tất! Hồ sơ ${json.data.dossierId} đã lập, bảo hành 12 tháng đã được kích hoạt!`,
        });
      } else {
        setFeedback({ type: 'error', message: json.error || 'Nghiệm thu bàn giao thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi bàn giao.' });
    }
  };

  const filteredItems = filterStatus === 'all'
    ? punchItems
    : punchItems.filter((i) => i.status === filterStatus);

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
              <h1 className="text-xl font-bold text-white">Kiểm Soát Chất Lượng QC, Punch List &amp; Bàn Giao</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                QC &amp; Handover
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
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPunchList(selectedProjectId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewPunchModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Lập Biên Bản Punch List
          </button>
          <button
            onClick={() => setShowHandoverModal(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-all ${
              isHandoverBlocked
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            Nghiệm Thu Bàn Giao
          </button>
        </div>
      </div>

      {/* Handover Gate Status Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isHandoverBlocked ? (
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
          )}
          <div className="space-y-0.5 text-xs">
            <div className="font-bold text-white flex items-center gap-2">
              <span>Cổng Kiểm Định Nghiệm Thu (Handover Gate)</span>
              {isHandoverBlocked ? (
                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  BLOCKED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  READY FOR HANDOVER
                </span>
              )}
            </div>
            <p className="text-slate-400">
              {isHandoverBlocked
                ? `Còn ${criticalUnverified.length} lỗi Critical chưa đạt chữ ký kiểm tra verified. Nghiệm thu bị khóa theo đúng Invariant!`
                : 'Tất cả hạng mục Critical đã đạt Verified. Đã đủ điều kiện ký biên bản bàn giao và kích hoạt bảo hành!'}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/interior/warranty"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 shrink-0"
        >
          Chứng Thư Bảo Hành
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Punch List Items Filter Strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-slate-400 font-medium">Lọc theo trạng thái:</span>
          {(['all', 'open', 'in_progress', 'rectified', 'verified'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-lg border transition-all ${
                filterStatus === st
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {st === 'all'
                ? `Tất cả (${punchItems.length})`
                : st === 'open'
                ? `Mới mở (${punchItems.filter((i) => i.status === 'open').length})`
                : st === 'in_progress'
                ? `Đang sửa (${punchItems.filter((i) => i.status === 'in_progress').length})`
                : st === 'rectified'
                ? `Đã sửa xong (${punchItems.filter((i) => i.status === 'rectified').length})`
                : `Đã xác thực (${punchItems.filter((i) => i.status === 'verified').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Punch List Items Cards */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-amber-400" />
            Danh Sách Chi Tiết Tồn Đọng Punch List ({filteredItems.length} hạng mục)
          </h3>
          <span className="text-xs text-slate-400 font-mono">Quy trình: Open → In Progress → Rectified → Verified</span>
        </div>

        <div className="divide-y divide-slate-800/70">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-amber-300 font-bold text-xs">{item.id}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                    {item.roomZoneId || 'Hiện trường'}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      item.severity === 'critical'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : item.severity === 'major'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Phân loại: <span className="text-slate-300">{item.category}</span>
                  </span>
                </div>

                <div className="text-xs font-semibold text-white">{item.description}</div>

                <div className="text-[11px] text-slate-400 flex items-center gap-4">
                  <span>Phụ trách: <span className="text-slate-300">{item.assignedToUserId || 'Chưa gán'}</span></span>
                  <span>Người báo: <span className="text-slate-300">{item.reportedByUserId}</span></span>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-3 shrink-0">
                {item.status === 'open' && (
                  <button
                    onClick={() => setRectifyingItem(item)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    Khắc phục (Rectify)
                  </button>
                )}

                {item.status === 'in_progress' && (
                  <button
                    onClick={() => setRectifyingItem(item)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    Báo hoàn thành (Rectify)
                  </button>
                )}

                {item.status === 'rectified' && (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Đã khắc phục (Chờ ký duyệt)
                    </span>
                    <button
                      onClick={() => handleVerifyPunch(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Xác thực (Verify)
                    </button>
                  </div>
                )}

                {item.status === 'verified' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Đã nghiệm thu (Verified)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: New Punch List Item */}
      {showNewPunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" /> Lập Biên Bản Lỗi Punch List
              </h3>
              <button onClick={() => setShowNewPunchModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePunch} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Khu vực / Phòng *</label>
                  <input
                    type="text"
                    required
                    value={punchRoom}
                    onChange={(e) => setPunchRoom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Mức độ nghiêm trọng *</label>
                  <select
                    value={punchSeverity}
                    onChange={(e) => setPunchSeverity(e.target.value as PunchSeverity)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="minor">Minor (Nhẹ - không chặn bàn giao)</option>
                    <option value="major">Major (Vừa - cần xử lý sớm)</option>
                    <option value="critical">Critical (Nghiêm trọng - CHẶN BÀN GIAO)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Phân loại lỗi *</label>
                  <select
                    value={punchCategory}
                    onChange={(e) => setPunchCategory(e.target.value as PunchCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="furniture_fit">Lắp ráp đồ gỗ (Furniture Fit)</option>
                    <option value="finishing">Hoàn thiện bề mặt (Finishing)</option>
                    <option value="painting">Sơn &amp; Dặm màu (Painting)</option>
                    <option value="electrical_coordination">Điện &amp; Đèn LED (Electrical)</option>
                    <option value="structural">Kết cấu &amp; Nề (Structural)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Gán đội thợ xử lý *</label>
                  <input
                    type="text"
                    required
                    value={punchAssignee}
                    onChange={(e) => setPunchAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Mô tả chi tiết lỗi tồn đọng *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Mô tả cụ thể vị trí, hiện tượng, sai lệch số đo..."
                  value={punchDesc}
                  onChange={(e) => setPunchDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPunchModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                >
                  Lưu Biên Bản Punch List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rectify Punch Item */}
      {rectifyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-400" /> Báo Cáo Khắc Phục Lỗi (Rectify)
              </h3>
              <button onClick={() => setRectifyingItem(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleMarkRectified} className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                <span className="text-slate-400">Nội dung lỗi:</span>
                <p className="font-semibold text-white mt-0.5">{rectifyingItem.description}</p>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Người thực hiện khắc phục (rectifiedBy) *</label>
                <input
                  type="text"
                  required
                  value={rectifierName}
                  onChange={(e) => setRectifierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Ghi chú phương án khắc phục *</label>
                <textarea
                  rows={2}
                  required
                  value={rectifyNote}
                  onChange={(e) => setRectifyNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRectifyingItem(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm"
                >
                  Xác Nhận Đã Khắc Phục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Complete Handover */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-400" /> Ký Biên Bản Nghiệm Thu Bàn Giao
              </h3>
              <button onClick={() => setShowHandoverModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCompleteHandover} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Đại diện chủ đầu tư / Khách hàng *</label>
                <input
                  type="text"
                  required
                  value={handoverClientRep}
                  onChange={(e) => setHandoverClientRep(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Ý kiến đánh giá bàn giao</label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 space-y-1">
                <div className="font-semibold">Hậu nghiệm thu tự động:</div>
                <div>• Tạo Hồ sơ bàn giao Handover Dossier chính thức.</div>
                <div>• Kích hoạt Chứng thư bảo hành 12 tháng tại công trình.</div>
                <div>• Giải phóng đợt thanh toán quyết toán cuối cùng.</div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
                >
                  Ký Nghiệm Thu &amp; Kích Hoạt Bảo Hành
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
