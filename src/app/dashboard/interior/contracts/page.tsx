'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  Building,
  CreditCard,
  Download,
  RefreshCw,
  Send,
  X,
  FileCheck,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  clientName: string;
}

interface PaymentMilestoneDisplay {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'invoiced' | 'paid' | 'overdue';
}

interface ContractDisplay {
  id: string;
  projectId: string;
  contractNumber?: string;
  client: string;
  contractValue: number;
  signedDate: string;
  status: 'draft' | 'signed' | 'active' | 'completed' | 'terminated';
  milestones: PaymentMilestoneDisplay[];
}

export default function InteriorContractsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [contracts, setContracts] = useState<ContractDisplay[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Contract Modal
  const [showNewContractModal, setShowNewContractModal] = useState<boolean>(false);
  const [newContractVal, setNewContractVal] = useState('418000000');
  const [newContractClient, setNewContractClient] = useState('Sheikh Al-Maktoum Office');

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

  // Load Contracts
  const loadContracts = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/interior/contracts?projectId=${encodeURIComponent(projId)}`);
      const json = await res.json();
      if (json.success && json.data?.contracts && json.data.contracts.length > 0) {
        const mapped: ContractDisplay[] = json.data.contracts.map((c: any) => ({
          id: c.id,
          projectId: c.projectId,
          contractNumber: c.id,
          client: c.clientPartyId || 'Chủ đầu tư',
          contractValue: c.contractValue || 418_000_000,
          signedDate: c.createdAt ? c.createdAt.slice(0, 10) : '2024-02-06',
          status: c.status || 'active',
          milestones: (c.milestones || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            percentage: m.percentageOfTotal || m.percentage || 20,
            amount: m.amount || 0,
            dueDate: m.dueDate || '2024-03-01',
            status: m.status || 'pending',
          })),
        }));
        setContracts(mapped);
        setSelectedContractId(mapped[0].id);
      } else {
        // Fallback default sample contract
        const defaultContract: ContractDisplay = {
          id: 'CON-DUBAI-001',
          projectId: projId,
          contractNumber: 'CON-DUBAI-001',
          client: 'Sheikh Al-Maktoum Office',
          contractValue: 418_000_000,
          signedDate: '2024-02-06',
          status: 'active',
          milestones: [
            { id: 'm1', name: 'Đợt 1: Đặt cọc ký hợp đồng (Tạm ứng vật tư)', percentage: 30, amount: 125_400_000, dueDate: '2024-02-10', status: 'paid' },
            { id: 'm2', name: 'Đợt 2: Duyệt thiết kế khóa sản xuất (Approved Lock)', percentage: 20, amount: 83_600_000, dueDate: '2024-02-25', status: 'paid' },
            { id: 'm3', name: 'Đợt 3: Khởi công xuất xưởng (Ra phôi ván & đá)', percentage: 30, amount: 125_400_000, dueDate: '2024-03-20', status: 'invoiced' },
            { id: 'm4', name: 'Đợt 4: Hoàn thành lắp đặt hiện trường & Punch List', percentage: 15, amount: 62_700_000, dueDate: '2024-04-10', status: 'pending' },
            { id: 'm5', name: 'Đợt 5: Nghiệm thu bàn giao quyết toán & Bảo hành', percentage: 5, amount: 20_900_000, dueDate: '2024-04-25', status: 'pending' },
          ],
        };
        setContracts([defaultContract]);
        setSelectedContractId(defaultContract.id);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể tải dữ liệu hợp đồng.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadContracts(selectedProjectId);
    }
  }, [selectedProjectId, loadContracts]);

  const activeContract = contracts.find((c) => c.id === selectedContractId) || contracts[0];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newContractVal) || 400_000_000;
    try {
      const res = await fetch('/api/interior/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          boqId: 'boq-001',
          contractValue: val,
          clientPartyId: newContractClient,
          milestones: [
            { name: 'Đợt 1: Đặt cọc ký hợp đồng', percentageOfTotal: 30, dueDate: '2026-11-15' },
            { name: 'Đợt 2: Duyệt thiết kế khóa sản xuất', percentageOfTotal: 20, dueDate: '2026-11-25' },
            { name: 'Đợt 3: Khởi công xuất xưởng', percentageOfTotal: 30, dueDate: '2026-12-10' },
            { name: 'Đợt 4: Hoàn thành lắp đặt hiện trường', percentageOfTotal: 15, dueDate: '2026-12-25' },
            { name: 'Đợt 5: Nghiệm thu bàn giao & bảo hành', percentageOfTotal: 5, dueDate: '2027-01-10' },
          ],
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setShowNewContractModal(false);
        setFeedback({ type: 'success', message: `Hợp đồng ${json.data.id} đã được khởi tạo thành công!` });
        await loadContracts(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Tạo hợp đồng thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi tạo hợp đồng.' });
    }
  };

  // Calculate payment progress
  const totalPaid = activeContract?.milestones
    ?.filter((m) => m.status === 'paid')
    .reduce((sum, m) => sum + m.amount, 0) || 0;
  const paidPercent = activeContract?.contractValue
    ? Math.round((totalPaid / activeContract.contractValue) * 100)
    : 0;

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
              <h1 className="text-xl font-bold text-white">Quản Lý Báo Giá, Hợp Đồng & Tiến Độ Thu Tiền</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Commercial Contracts
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
            onClick={() => loadContracts(selectedProjectId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewContractModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Tạo Hợp Đồng Mới
          </button>
          <Link
            href="/dashboard/interior/production"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
          >
            Chuyển Lệnh Sang Xưởng
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {activeContract ? (
        <div className="space-y-6">
          {/* Contract Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold uppercase text-slate-400">Số Hợp Đồng & Khách Hàng</span>
              <div className="text-base font-bold font-mono text-amber-300 mt-1">{activeContract.id}</div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">{activeContract.client}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold uppercase text-slate-400">Tổng Giá Trị Hợp Đồng</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {formatCurrency(activeContract.contractValue)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Ngày ký: {activeContract.signedDate}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/40 bg-emerald-950/20">
              <span className="text-xs font-semibold uppercase text-emerald-400">Đã Thực Thu (Cash Flow)</span>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                {formatCurrency(totalPaid)} ({paidPercent}%)
              </div>
              <p className="text-xs text-emerald-400/80 mt-0.5">Tiền về tài khoản doanh nghiệp</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold uppercase text-slate-400">Trạng Thái Hợp Đồng</span>
              <div className="mt-1.5">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Đang hiệu lực (Active)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Căn cứ xuất lệnh sản xuất xưởng</p>
            </div>
          </div>

          {/* Payment Milestones Timeline & Invoicing */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                Tiến Độ Thanh Toán Theo Giai Đoạn Hợp Đồng (Payment Milestones)
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                5 đợt thanh toán chuẩn
              </span>
            </div>

            <div className="divide-y divide-slate-800/70">
              {activeContract.milestones.map((m, idx) => (
                <div key={m.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 text-xs">{m.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {m.percentage}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Hạn thanh toán: <span className="text-slate-300 font-mono">{m.dueDate}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-100 text-sm">
                        {formatCurrency(m.amount)}
                      </div>
                      <div className="text-[11px] text-slate-400">Số tiền đợt</div>
                    </div>

                    <div className="w-32 text-center">
                      {m.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Đã thu tiền
                        </span>
                      ) : m.status === 'invoiced' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="h-3.5 w-3.5" /> Đã xuất HĐ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          Chờ thanh toán
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
          Chưa có hợp đồng nào cho dự án này. Vui lòng bấm "Tạo Hợp Đồng Mới".
        </div>
      )}

      {/* Modal: New Contract */}
      {showNewContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-amber-400" /> Tạo Hợp Đồng Thi Công Nội Thất
              </h3>
              <button onClick={() => setShowNewContractModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateContract} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Chủ đầu tư / Khách hàng *</label>
                <input
                  type="text"
                  required
                  value={newContractClient}
                  onChange={(e) => setNewContractClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Giá trị hợp đồng chốt (VNĐ) *</label>
                <input
                  type="number"
                  required
                  value={newContractVal}
                  onChange={(e) => setNewContractVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-slate-400">
                <div className="font-semibold text-slate-300">Phân kỳ 5 đợt thanh toán tự động:</div>
                <div>• Đợt 1 (30%): Đặt cọc ký hợp đồng</div>
                <div>• Đợt 2 (20%): Duyệt thiết kế khóa sản xuất</div>
                <div>• Đợt 3 (30%): Khởi công xuất xưởng</div>
                <div>• Đợt 4 (15%): Hoàn thành lắp đặt hiện trường</div>
                <div>• Đợt 5 (5%): Bàn giao quyết toán & bảo hành</div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewContractModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                >
                  Ký Hợp Đồng & Kích Hoạt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
