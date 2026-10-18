"use client";
import { LandPreviewNotice, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, FileSpreadsheet, Download, Calendar, Filter, RefreshCw,
  Plus, Eye, Share2, Clock, CheckCircle2, Building2, TrendingUp,
  Users, DollarSign, Layers, ChevronDown, Sparkles, FileArchive,
  Search, ShieldCheck, Mail, ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { downloadPdfReport, downloadCsvReport } from "@/modules/real_estate/utils/exportUtils";

// ── Types & Interfaces ────────────────────────────────────────────────────────

type ReportCategoryFilter = "all" | "executive" | "sales" | "inventory" | "crm" | "finance";

interface ReportPackage {
  id: string;
  title: string;
  category: ReportCategoryFilter;
  categoryLabel: string;
  period: string;
  scope: string;
  updatedAt: string;
  author: string;
  metrics: { label: string; value: string }[];
  pdfAvailable: boolean;
  excelAvailable: boolean;
}

interface ExportAuditItem {
  id: string;
  time: string;
  title: string;
  period: string;
  author: string;
  format: "PDF" | "Excel" | "CSV";
  status: "completed" | "processing";
}

// ── Data Mock ─────────────────────────────────────────────────────────────────

const REPORT_PACKAGES: ReportPackage[] = [
  {
    id: "rep-001",
    title: "Báo cáo Điều hành Tháng 9/2026",
    category: "executive",
    categoryLabel: "Điều hành",
    period: "Tháng 9/2026 (01/09 - 30/09)",
    scope: "Toàn tập đoàn Bella Land Group",
    updatedAt: "10/09/2026 11:03",
    author: "Nguyễn Văn A (Giám đốc Điều hành)",
    metrics: [
      { label: "Doanh thu HĐMB", value: "458.5 tỷ" },
      { label: "Thực thu tiền mặt", value: "371.2 tỷ" },
      { label: "Số HĐMB đã ký", value: "142 HĐ" },
      { label: "Tỷ lệ thu tiền", value: "81.0%" },
    ],
    pdfAvailable: true,
    excelAvailable: true,
  },
  {
    id: "rep-002",
    title: "Báo cáo Kinh doanh & Doanh số Sales",
    category: "sales",
    categoryLabel: "Kinh doanh",
    period: "Tháng 9/2026",
    scope: "Chi nhánh HCM & Bình Dương & Đà Nẵng",
    updatedAt: "09/09/2026 18:30",
    author: "Trần Thị B (Trưởng phòng Kinh doanh)",
    metrics: [
      { label: "Tổng đặt cọc", value: "180 HĐ" },
      { label: "Đặt giữ chỗ", value: "240 chỗ" },
      { label: "Tỷ lệ chốt Lead → HĐ", value: "11.3%" },
      { label: "Giá trị HĐ bình quân", value: "3.2 tỷ" },
    ],
    pdfAvailable: true,
    excelAvailable: true,
  },
  {
    id: "rep-003",
    title: "Báo cáo Tồn kho & Hấp thụ Sản phẩm BĐS",
    category: "inventory",
    categoryLabel: "Tồn kho BĐS",
    period: "Kỳ Tháng 9/2026",
    scope: "Dự án Elyse Island, Grand Tower, Riverside",
    updatedAt: "08/09/2026 14:15",
    author: "Lê Hoàng C (Quản lý Kho hàng)",
    metrics: [
      { label: "Tổng sản phẩm", value: "286 căn" },
      { label: "Hàng trống (Available)", value: "119 căn" },
      { label: "Tỷ lệ lấp đầy", value: "58.3%" },
      { label: "Giá trị hàng chưa bán", value: "1,420 tỷ" },
    ],
    pdfAvailable: false,
    excelAvailable: true,
  },
  {
    id: "rep-004",
    title: "Báo cáo CRM & Hiệu quả Kênh Marketing",
    category: "crm",
    categoryLabel: "CRM & Marketing",
    period: "Tháng 9/2026",
    scope: "Mạng lưới Marketing & Đại lý F1",
    updatedAt: "07/09/2026 16:45",
    author: "Phạm Thị D (Head of Marketing)",
    metrics: [
      { label: "Tổng Lead phát sinh", value: "1,250 leads" },
      { label: "Site Visit tham quan", value: "420 lượt" },
      { label: "Kênh dẫn đầu", value: "Referral (19.3%)" },
      { label: "Chi phí / Lead", value: "420.000 đ" },
    ],
    pdfAvailable: true,
    excelAvailable: true,
  },
  {
    id: "rep-005",
    title: "Báo cáo Tài chính & Tiến độ Thu hồi nợ BĐS",
    category: "finance",
    categoryLabel: "Tài chính",
    period: "Quý 3/2026",
    scope: "Khối Tài chính Kế toán",
    updatedAt: "05/09/2026 10:20",
    author: "Vũ Văn E (Kế toán trưởng)",
    metrics: [
      { label: "Thực thu đợt 1", value: "371.2 tỷ" },
      { label: "Còn phải thu đợt 2", value: "87.3 tỷ" },
      { label: "Nợ quá hạn >30 ngày", value: "12.4 tỷ" },
      { label: "Tỷ lệ hoàn thành kế hoạch", value: "92.0%" },
    ],
    pdfAvailable: true,
    excelAvailable: true,
  },
  {
    id: "REP-005",
    title: "Báo Cáo Tiến Độ Pháp Lý & Cấp Sổ Hồng",
    category: "executive",
    categoryLabel: "Ban Giám Đốc",
    period: "Tháng 7/2026",
    scope: "Tình trạng pháp lý các dự án Bella Land",
    updatedAt: "28/07/2026",
    author: "Ban Pháp lý Dự án",
    metrics: [
      { label: "Hồ sơ pháp lý đang xử lý", value: "18 bộ" },
      { label: "Dự án đã có GPLX", value: "6 dự án" },
      { label: "Hồ sơ sổ hồng đã nộp", value: "320 bộ" },
      { label: "Tần suất cập nhật", value: "Hàng tháng" },
    ],
    pdfAvailable: true,
    excelAvailable: false,
  }
];

const EXPORT_AUDIT_TRAIL: ExportAuditItem[] = [
  { id: "aud-001", time: "10/09/2026 11:03", title: "Báo cáo Điều hành Tháng 9/2026", period: "Tháng 9/2026", author: "Nguyễn Văn A", format: "PDF", status: "completed" },
  { id: "aud-002", time: "09/09/2026 18:35", title: "Báo cáo Kinh doanh & Doanh số Sales", period: "Tháng 9/2026", author: "Trần Thị B", format: "Excel", status: "completed" },
  { id: "aud-003", time: "08/09/2026 14:20", title: "Báo cáo Tồn kho & Hấp thụ Sản phẩm", period: "Tháng 9/2026", author: "Lê Hoàng C", format: "Excel", status: "completed" },
  { id: "aud-004", time: "05/09/2026 09:12", title: "Báo cáo CRM & Hiệu quả Kênh", period: "Tháng 8/2026", author: "Phạm Thị D", format: "PDF", status: "completed" },
];

export default function ReportsPage() {
  const [activeCategory, setActiveCategory] = useState<ReportCategoryFilter>("all");
  const [selectedPeriod, setSelectedPeriod] = useState("Tháng 9/2026");
  const [selectedProject, setSelectedProject] = useState("all");
  const [previewReport, setPreviewReport] = useState<ReportPackage | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredPackages = REPORT_PACKAGES.filter(p => {
    if (activeCategory !== "all" && p.category !== activeCategory) return false;
    return true;
  });

  const handleDownload = (title: string, format: "PDF" | "CSV" | "Excel") => { unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  const handleShare = (title: string) => {
    unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
  };

  const categoryTabs: Array<{ id: ReportCategoryFilter; label: string }> = [
    { id: "all", label: `Tất cả báo cáo (${REPORT_PACKAGES.length})` },
    { id: "executive", label: "Điều hành" },
    { id: "sales", label: "Kinh doanh" },
    { id: "inventory", label: "Tồn kho BĐS" },
    { id: "crm", label: "CRM & Marketing" },
    { id: "finance", label: "Tài chính & Dòng tiền" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100">
      <LandPreviewNotice />
      
      {/* ── 1. PAGE HEADER & TOOLBAR ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">Trung tâm báo cáo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Trung tâm báo cáo
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
            Quản lý, tạo, xem, lưu, xuất và chia sẻ báo cáo quản trị chính thức Bella Land
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs font-semibold">
          <div className="relative">
            <PremiumSelect disabled
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              className="w-48"
              options={[
                { value: "Tháng 9/2026", label: "📅 Kỳ Tháng 9/2026" },
                { value: "Tháng 8/2026", label: "Kỳ Tháng 8/2026" },
                { value: "Quý 3/2026", label: "Kỳ Quý 3/2026" },
                { value: "Năm 2026", label: "Báo cáo Năm 2026" },
              ]}
            />
          </div>

          <PremiumSelect disabled
            value={selectedProject}
            onChange={setSelectedProject}
            className="w-44"
            options={[
              { value: "all", label: "Toàn bộ dự án" },
              { value: "elyse", label: "Elyse Island" },
              { value: "grand", label: "The Grand Tower" },
              { value: "riverside", label: "Riverside Heights" },
            ]}
          />

          <button
            onClick={() => unavailableLandAction("Tạo báo cáo")}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Tạo báo cáo mới ▾
          </button>
        </div>
      </div>

      {/* ── 2. REPORT CATEGORY FILTER TABS ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        {categoryTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
              activeCategory === tab.id
                ? "bg-slate-900 dark:bg-blue-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 3. OFFICIAL REPORT PACKAGES GRID (DOCUMENT CARDS) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPackages.map(pkg => (
          <div
            key={pkg.id}
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-blue-400 transition-all group"
          >
            <div className="space-y-3">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  {pkg.categoryLabel}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{pkg.updatedAt}</span>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  {pkg.title}
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">{pkg.scope}</p>
              </div>

              {/* Metric Highlights Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl grid grid-cols-2 gap-2 text-xs">
                {pkg.metrics.map((m, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block truncate">{m.label}</span>
                    <span className="font-black text-slate-900 dark:text-white text-xs">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Actions Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                <span className="truncate">Người tạo: {pkg.author}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewReport(pkg)}
                  className="flex-1 py-2 px-2.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" /> Xem trước
                </button>
                {pkg.pdfAvailable && (
                  <button
                    onClick={() => handleDownload(pkg.title, "PDF")}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                    title="Tải tệp PDF"
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                  </button>
                )}
                {pkg.excelAvailable && (
                  <button
                    onClick={() => handleDownload(pkg.title, "Excel")}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                    title="Tải tệp Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  </button>
                )}
                <button
                  onClick={() => handleShare(pkg.title)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                  title="Chia sẻ liên kết"
                >
                  <Share2 className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. REPORT CATALOG BY BUSINESS CATEGORY ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" /> Danh mục mẫu báo cáo chuẩn
          </h3>
          <span className="text-xs font-semibold text-slate-400">Mẫu báo cáo minh họa — chưa tổng hợp từ dữ liệu nghiệp vụ</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { title: "Báo cáo Điều hành Tháng", desc: "Tổng hợp KPI doanh thu, HĐMB, thu nợ & dự án dẫn đầu", icon: TrendingUp },
            { title: "Báo cáo Doanh số Sales", desc: "Chi tiết hợp đồng chốt, đặt cọc và xếp hạng nhân sự Sales", icon: FileText },
            { title: "Báo cáo Tồn kho & Lấp đầy", desc: "Trạng thái 286 căn hộ, giá trị hàng chưa bán & aging", icon: Building2 },
            { title: "Báo cáo Kênh Marketing & CRM", desc: "Đo lường chi phí Lead, tỷ lệ site visit & chuyển đổi", icon: Users },
          ].map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                <Icon className="w-5 h-5 text-blue-600" />
                <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">{cat.title}</h4>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">{cat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. EXPORT & DISTRIBUTION AUDIT TRAIL ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Lịch sử xuất & chia sẻ báo cáo (Audit Trail)
          </h3>
          <span className="text-xs font-bold text-slate-400">4 lượt xuất gần nhất</span>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-2.5">Thời gian</th>
                <th className="p-2.5">Tên báo cáo</th>
                <th className="p-2.5">Kỳ báo cáo</th>
                <th className="p-2.5">Người xuất</th>
                <th className="p-2.5 text-center">Định dạng</th>
                <th className="p-2.5 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
              {EXPORT_AUDIT_TRAIL.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-2.5 text-slate-500 font-mono text-[11px]">{item.time}</td>
                  <td className="p-2.5 font-bold text-slate-900 dark:text-white">{item.title}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-300">{item.period}</td>
                  <td className="p-2.5 font-bold text-blue-600">{item.author}</td>
                  <td className="p-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                      item.format === 'PDF' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {item.format}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Hoàn thành
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PREVIEW MODAL ── */}
      <AnimatePresence>
        {previewReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-blue-600">{previewReport.categoryLabel}</span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{previewReport.title}</h3>
                </div>
                <button onClick={() => setPreviewReport(null)} className="p-1 rounded-lg hover:bg-slate-100">
                  ✕
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Kỳ báo cáo:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{previewReport.period}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Phạm vi dữ liệu:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{previewReport.scope}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Tạo bởi:</span>
                  <span className="font-bold text-blue-600">{previewReport.author}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {previewReport.metrics.map((m, idx) => (
                  <div key={idx} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block">{m.label}</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{m.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setPreviewReport(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Đóng
                </button>
                <button
                  onClick={() => { setPreviewReport(null); handleDownload(previewReport.title, "PDF"); }}
                  className="px-4 py-2 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs"
                >
                  Tải tệp PDF chính thức
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
