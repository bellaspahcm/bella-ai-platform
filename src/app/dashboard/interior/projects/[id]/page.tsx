'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  FileText,
  HardHat,
  Home,
  Layers,
  MapPin,
  Maximize2,
  Phone,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  Wrench,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  siteAddress: string;
  projectType: string;
  totalFloorAreaSquareMeters: number;
  contractValue: number;
  targetCompletionDate: string;
  leadArchitectId: string;
  leadArchitectName: string;
  activeApprovedRevisionId?: string | null;
  rooms: Array<{
    id: string;
    code: string;
    name: string;
    floor: number;
    areaSquareMeters: number;
  }>;
  materials: Array<{
    category: string;
    brand: string;
    name: string;
    spec: string;
  }>;
  progress: {
    designPercent: number;
    workshopPercent: number;
    installPercent: number;
    overallPercent: number;
  };
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'timeline' | 'handover'>('overview');

  const fetchProjectDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/interior/projects/${projectId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProject(json.data);
      } else {
        setError(json.error || 'Không thể tải thông tin dự án');
      }
    } catch {
      setError('Lỗi kết nối khi tải hồ sơ dự án');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProjectDetail();
  }, [projectId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'production':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Đang sản xuất xưởng</span>;
      case 'installation':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Đang thi công lắp đặt</span>;
      case 'handover':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Nghiệm thu bàn giao</span>;
      case 'completed':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Hoàn thành & Bảo hành</span>;
      case 'design':
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">Thiết kế 3D & Duyệt mẫu</span>;
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Đang tải hồ sơ dự án #{projectId}...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Link
          href="/dashboard/interior/projects"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách dự án
        </Link>
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-base">Không tìm thấy thông tin dự án</h3>
            <p className="text-sm mt-1 text-rose-700">{error || 'Dự án không tồn tại hoặc đã bị xóa.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Top Breadcrumb & Navigation ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/dashboard/interior" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Tổng quan
          </Link>
          <span>/</span>
          <Link href="/dashboard/interior/projects" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Dự án
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-semibold">{project.code}</span>
        </div>

        <button
          onClick={() => void fetchProjectDetail()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-2xs transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Làm mới
        </button>
      </div>

      {/* ── Project Header Card ── */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {project.code}
              </span>
              {getStatusBadge(project.status)}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {project.siteAddress}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> {project.projectType}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> KTS: <strong className="text-slate-700 dark:text-slate-300">{project.leadArchitectName}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/interior/design?projectId=${project.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Compass className="w-3.5 h-3.5" /> Studio Thiết Kế
            </Link>
            <Link
              href={`/dashboard/interior/boq?projectId=${project.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> BOQ & Báo Giá
            </Link>
            <Link
              href={`/dashboard/interior/production?projectId=${project.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" /> Lệnh Sản Xuất
            </Link>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Giá trị hợp đồng</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(project.contractValue)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Đã ký & giải ngân đợt 1
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Quy mô thi công</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {project.totalFloorAreaSquareMeters} m²
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Gồm {project.rooms.length} phòng chức năng
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Tiến độ tổng thể</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {project.progress.overallPercent}%
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress.overallPercent}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">Hạn bàn giao cam kết</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {new Date(project.targetCompletionDate).toLocaleDateString('vi-VN')}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Đúng tiến độ cam kết
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Mặt Bằng & Phân Khu ({project.rooms.length})
        </button>
        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'materials'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Vật Liệu & Thiết Bị ({project.materials.length})
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'timeline'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Sản Xuất & Thi Công
        </button>
        <button
          onClick={() => setActiveTab('handover')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'handover'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Nghiệm Thu & Bảo Hành
        </button>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                Danh sách phòng & Phân khu chức năng
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Mã phòng</th>
                      <th className="py-2.5 px-3">Tên phòng</th>
                      <th className="py-2.5 px-3">Tầng</th>
                      <th className="py-2.5 px-3 text-right">Diện tích</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {project.rooms.map((room) => (
                      <tr key={room.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                          {room.code}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          {room.name}
                        </td>
                        <td className="py-3 px-3 text-slate-500">Tầng {room.floor}</td>
                        <td className="py-3 px-3 text-right font-medium text-slate-900 dark:text-white">
                          {room.areaSquareMeters} m²
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/dashboard/interior/design?projectId=${project.id}&room=${room.id}`}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                          >
                            Xem 3D <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Thông tin Khách hàng
              </h2>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-400 font-medium">Chủ đầu tư</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm mt-0.5">
                    {project.customerName}
                  </div>
                </div>
                {project.customerPhone && (
                  <div>
                    <div className="text-slate-400 font-medium">Điện thoại liên hệ</div>
                    <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {project.customerPhone}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-slate-400 font-medium">Địa chỉ công trình</div>
                  <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {project.siteAddress}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/dashboard/interior/customers"
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center block text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Xem hồ sơ CRM khách hàng
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Chủng loại vật liệu & Thương hiệu chỉ định (Spec Lock)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.materials.map((mat, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-3.5"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {mat.category}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {mat.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Thương hiệu: <strong className="text-slate-700 dark:text-slate-300">{mat.brand}</strong> • {mat.spec}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Tiến độ sản xuất xưởng & Lắp đặt công trình
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 mb-1">Giai đoạn thiết kế</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">100% Hoàn thành</div>
              <p className="text-xs text-slate-500 mt-1">Đã ký duyệt Approved Design Lock</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 mb-1">Giai đoạn xưởng sản xuất</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{project.progress.workshopPercent}% Tiến độ</div>
              <p className="text-xs text-slate-500 mt-1">Cắt CNC, Dán cạnh PUR & Lắp ráp cụm</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 mb-1">Giai đoạn thi công hiện trường</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{project.progress.installPercent}% Tiến độ</div>
              <p className="text-xs text-slate-500 mt-1">Lắp dựng khung & Hoàn thiện phụ kiện</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              href={`/dashboard/interior/installation?projectId=${project.id}`}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <HardHat className="w-4 h-4" /> Xem Nhật Ký Thi Công & Punch List
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'handover' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Nghiệm thu bàn giao & Bảo hành sau bàn giao
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hồ sơ nghiệm thu kỹ thuật theo tiêu chuẩn nghiệm thu 3 bên (KTS - Thợ thi công - Chủ đầu tư).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> Biên bản Nghiệm thu Bàn giao (HDO)
              </div>
              <p className="text-xs text-slate-500">
                Toàn bộ các hạng mục hoàn thiện đã được đối soát qua Punch List không còn lỗi nghiêm trọng.
              </p>
              <Link
                href={`/dashboard/interior/qc-handover?projectId=${project.id}`}
                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-semibold"
              >
                Mở hồ sơ nghiệm thu QC <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                <Shield className="w-5 h-5 text-blue-600" /> Chứng thư Bảo hành 24 Tháng
              </div>
              <p className="text-xs text-slate-500">
                Bảo hành phần gỗ nội thất 24 tháng, phụ kiện ngũ kim trọn đời hoặc theo bảo hành chính hãng.
              </p>
              <Link
                href={`/dashboard/interior/warranty?projectId=${project.id}`}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                Mở trung tâm bảo hành <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

