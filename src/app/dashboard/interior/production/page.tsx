'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Factory,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  Building,
  RefreshCw,
  X,
  Package,
  Truck,
  Layers,
  Wrench,
  Boxes,
  Cpu,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  clientName: string;
}

type ProductionStage =
  | 'design_locked'
  | 'cutting_cnc'
  | 'edge_banding'
  | 'assembly'
  | 'workshop_qc'
  | 'packing'
  | 'dispatched';

interface ProductionOrderItem {
  description: string;
  quantity: number;
  unit: string;
  estimatedHours: number;
}

interface ProductionOrderDisplay {
  id: string;
  orderNumber: string;
  project: string;
  description: string;
  stage: ProductionStage;
  assignedCraftsman: string;
  startDate: string;
  targetDate: string;
  percentComplete: number;
  manufacturingOrderNumber?: string;
  items?: ProductionOrderItem[];
}

const STAGES: { key: ProductionStage; label: string; icon: any }[] = [
  { key: 'design_locked', label: '1. Khóa Thiết Kế', icon: ShieldCheck },
  { key: 'cutting_cnc', label: '2. Cắt Ván CNC', icon: Cpu },
  { key: 'edge_banding', label: '3. Dán Cạnh PUR', icon: Layers },
  { key: 'assembly', label: '4. Lắp Ráp Khung', icon: Wrench },
  { key: 'workshop_qc', label: '5. KCS Xưởng', icon: CheckCircle2 },
  { key: 'packing', label: '6. Đóng Gói PE', icon: Package },
  { key: 'dispatched', label: '7. Xuất Xưởng', icon: Truck },
];

export default function InteriorProductionPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [orders, setOrders] = useState<ProductionOrderDisplay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Production Order Modal
  const [showNewOrderModal, setShowNewOrderModal] = useState<boolean>(false);
  const [newOrderDesc, setNewOrderDesc] = useState('Gia công bộ nội thất phòng khách & tủ bếp đảo');
  const [newOrderRevId, setNewOrderRevId] = useState('rev-001');

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

  // Load Production Orders
  const loadOrders = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/interior/production/orders?projectId=${encodeURIComponent(projId)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const mapped: ProductionOrderDisplay[] = json.data.map((o: any) => ({
          id: o.id,
          orderNumber: o.manufacturingOrderNumber || o.id.toUpperCase(),
          project: 'Dubai Luxury Villa Fitout',
          description: o.description || 'Lệnh sản xuất module nội thất',
          stage: o.stage || 'cutting_cnc',
          assignedCraftsman: 'Tổ trưởng xưởng CNC 01',
          startDate: o.createdAt ? o.createdAt.slice(0, 10) : '2026-11-06',
          targetDate: o.updatedAt ? o.updatedAt.slice(0, 10) : '2026-11-20',
          percentComplete: o.stage === 'dispatched' ? 100 : o.stage === 'workshop_qc' ? 90 : o.stage === 'assembly' ? 65 : 35,
          manufacturingOrderNumber: o.manufacturingOrderNumber,
          items: o.items || [],
        }));
        setOrders(mapped);
      } else {
        // Fallback demo orders
        setOrders([
          {
            id: 'po-001',
            orderNumber: 'MFG-WO-2026-001',
            project: 'Dubai Luxury Villa Fitout',
            description: 'Vách ốp nan gỗ óc chó kết hợp tủ rượu cánh kính',
            stage: 'assembly',
            assignedCraftsman: 'Nguyễn Văn Hùng (Tổ trưởng Mộc)',
            startDate: '2026-11-01',
            targetDate: '2026-11-15',
            percentComplete: 65,
            manufacturingOrderNumber: 'MFG-WO-2026-001',
          },
          {
            id: 'po-002',
            orderNumber: 'MFG-WO-2026-002',
            project: 'Dubai Luxury Villa Fitout',
            description: 'Bàn đảo bếp mặt đá Vicostone và ray Blum Legrabox',
            stage: 'cutting_cnc',
            assignedCraftsman: 'Trần Minh Đức (Kỹ thuật CNC)',
            startDate: '2026-11-03',
            targetDate: '2026-11-18',
            percentComplete: 30,
            manufacturingOrderNumber: 'MFG-WO-2026-002',
          },
          {
            id: 'po-003',
            orderNumber: 'MFG-WO-2026-003',
            project: 'Dubai Luxury Villa Fitout',
            description: 'Giường ngủ 2mx2m2 bọc da bò Ý cao cấp',
            stage: 'workshop_qc',
            assignedCraftsman: 'Lê Hoàng Long (KCS Xưởng)',
            startDate: '2026-10-28',
            targetDate: '2026-11-10',
            percentComplete: 90,
            manufacturingOrderNumber: 'MFG-WO-2026-003',
          },
        ]);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể tải danh sách lệnh sản xuất.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadOrders(selectedProjectId);
    }
  }, [selectedProjectId, loadOrders]);

  // Handle Dispatch to Platform Manufacturing OS
  const handleDispatchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/interior/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          designRevisionId: newOrderRevId,
          description: newOrderDesc,
          items: [
            { description: 'Module thùng tủ bếp dưới MDF chống ẩm', quantity: 4, unit: 'module', estimatedHours: 12 },
            { description: 'Mặt cánh Acrylic noline An Cường', quantity: 8, unit: 'cánh', estimatedHours: 6 },
            { description: 'Bản lề giảm chấn Blum Clip Top 110', quantity: 16, unit: 'cái', estimatedHours: 2 },
          ],
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setShowNewOrderModal(false);
        setFeedback({
          type: 'success',
          message: `Đã phát lệnh sản xuất thành công! Ủy quyền tới Platform Manufacturing OS (Mã lệnh: ${
            json.data.manufacturingOrderNumber || json.data.id
          }).`,
        });
        await loadOrders(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Phát lệnh sản xuất thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi gửi lệnh sản xuất.' });
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
              <h1 className="text-xl font-bold text-white">Điều Phối Sản Xuất Xưởng (Platform Manufacturing)</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Manufacturing Bridge
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
            onClick={() => loadOrders(selectedProjectId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewOrderModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Phát Lệnh Sản Xuất Xưởng
          </button>
          <Link
            href="/dashboard/interior/installation"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
          >
            Tiến Độ Lắp Đặt Hiện Trường
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Architectural Notice: Port Delegation */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Factory className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-slate-200">
            Ủy Quyền Sản Xuất Qua Platform Manufacturing Adapter (Không Duplicate Engine)
          </div>
          <p className="text-slate-400 leading-relaxed">
            Hệ thống áp dụng đúng ranh giới kiến trúc đã xác lập: Interior OS đóng vai trò Client ủy quyền yêu cầu sản
            xuất tới <span className="text-amber-300 font-mono">Platform Manufacturing OS</span>. Mọi lệnh sản xuất
            được ràng buộc bất biến với <span className="text-emerald-400 font-semibold">Approved Design Lock</span>.
          </p>
        </div>
      </div>

      {/* 7 Stages Pipeline Tracker Strip */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {STAGES.map((s) => {
          const Icon = s.icon;
          const count = orders.filter((o) => o.stage === s.key).length;
          return (
            <div
              key={s.key}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1"
            >
              <div className="flex items-center justify-center text-slate-400">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-semibold text-slate-300">{s.label}</div>
              <div className="text-base font-bold font-mono text-amber-400">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Orders List / Table */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Boxes className="h-4 w-4 text-amber-400" />
            Danh Sách Lệnh Sản Xuất Xưởng ({orders.length} lệnh)
          </h3>
          <span className="text-xs text-slate-400 font-mono">Xưởng mộc &amp; đá trung tâm</span>
        </div>

        <div className="divide-y divide-slate-800/70">
          {orders.map((o) => (
            <div
              key={o.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
            >
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-300 font-mono text-xs">{o.orderNumber}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-300">
                    {o.assignedCraftsman}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white">{o.description}</div>
                <p className="text-[11px] text-slate-400">
                  Thời gian: <span className="text-slate-300 font-mono">{o.startDate}</span> →{' '}
                  <span className="text-slate-300 font-mono">{o.targetDate}</span>
                </p>
              </div>

              <div className="flex items-center gap-6">
                {/* Progress bar */}
                <div className="w-36 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Tiến độ</span>
                    <span className="font-mono text-white">{o.percentComplete}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${
                        o.percentComplete === 100
                          ? 'bg-emerald-500'
                          : o.percentComplete >= 60
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${o.percentComplete}%` }}
                    />
                  </div>
                </div>

                {/* Stage Badge */}
                <div className="w-32 text-center">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
                    {o.stage === 'dispatched'
                      ? 'Đã xuất xưởng'
                      : o.stage === 'workshop_qc'
                      ? 'Nghiệm thu xưởng'
                      : o.stage === 'assembly'
                      ? 'Đang lắp ráp'
                      : o.stage === 'edge_banding'
                      ? 'Dán cạnh PUR'
                      : o.stage === 'cutting_cnc'
                      ? 'Cắt ván CNC'
                      : 'Đã khóa bản vẽ'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: New Production Order */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Factory className="h-5 w-5 text-amber-400" /> Phát Lệnh Sản Xuất Xưởng
              </h3>
              <button onClick={() => setShowNewOrderModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleDispatchOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Bản vẽ thiết kế đã duyệt (Approved Lock) *</label>
                <select
                  value={newOrderRevId}
                  onChange={(e) => setNewOrderRevId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="rev-001">Phương án R1.0 (Approved Lock) - 06/11/2026</option>
                  <option value="rev-approved-001">Phương án R2.0 (Approved Lock) - Sheikh Al-Maktoum</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nội dung lệnh sản xuất *</label>
                <textarea
                  rows={3}
                  required
                  value={newOrderDesc}
                  onChange={(e) => setNewOrderDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-slate-400">
                <div className="font-semibold text-slate-300">Ranh giới kiến trúc:</div>
                <div>• Ủy quyền qua PlatformManufacturingAdapter.</div>
                <div>• Tạo ProductionOrder trên Platform Manufacturing OS.</div>
                <div>• Đồng bộ trạng thái 7 công đoạn xưởng.</div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                >
                  Gửi Lệnh Sản Xuất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
