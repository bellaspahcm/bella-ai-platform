"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { downloadLandCsv } from "@/modules/real_estate/components/LandUiControls";
import { Grid3x3, List, Search, CheckCircle2, Clock, Home, Building2, SlidersHorizontal, Download, CreditCard, PenTool, Key, XCircle, Eye, X, Plus, FileSpreadsheet } from "lucide-react";
import {
  fetchProjectsAction,
} from "@/modules/real_estate/actions/projectActions";
import {
  fetchProductsAction,
} from "@/modules/real_estate/actions/productActions";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { Database } from "@/types/database.types";

type ProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"];
type ProductRow = Database["public"]["Tables"]["real_estate_products"]["Row"];

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  available: {
    label: "Khả dụng",
    bg: "bg-emerald-100/70 dark:bg-emerald-950/60",
    text: "text-emerald-900 dark:text-emerald-200",
    border: "border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
  booked: {
    label: "Giữ chỗ",
    bg: "bg-amber-100/80 dark:bg-amber-950/60",
    text: "text-amber-900 dark:text-amber-200",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  deposited: {
    label: "Đặt cọc",
    bg: "bg-orange-100/80 dark:bg-orange-950/60",
    text: "text-orange-900 dark:text-orange-200",
    border: "border-orange-300 dark:border-orange-700",
    dot: "bg-orange-500",
  },
  contracted: {
    label: "Ký HĐMB",
    bg: "bg-purple-100/80 dark:bg-purple-950/60",
    text: "text-purple-900 dark:text-purple-200",
    border: "border-purple-300 dark:border-purple-700",
    dot: "bg-purple-500",
  },
  paid: {
    label: "Đã bán",
    bg: "bg-blue-100/80 dark:bg-blue-950/60",
    text: "text-blue-900 dark:text-blue-200",
    border: "border-blue-300 dark:border-blue-700",
    dot: "bg-blue-500",
  },
  handed_over: {
    label: "Bàn giao",
    bg: "bg-slate-200/80 dark:bg-slate-800/80",
    text: "text-slate-800 dark:text-slate-200",
    border: "border-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
  },
  cancelled: {
    label: "Đã hủy",
    bg: "bg-rose-100/80 dark:bg-rose-950/60",
    text: "text-rose-900 dark:text-rose-200",
    border: "border-rose-300 dark:border-rose-700",
    dot: "bg-rose-500",
  },
};

export default function RealEstateApartmentsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const requestId = useRef(0);
  const selectedProjectId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<string>("all");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>("all");

  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  // Bulk Inventory Declaration Modal States
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  useEffect(() => {
    if (!showBulkImportModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowBulkImportModal(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showBulkImportModal]);

  // Each selection invalidates all previous project and unit responses.
  const readProducts = useCallback(async (project: ProjectRow, request: number) => {
    try {
      const result = await fetchProductsAction(project.id);
      if (request !== requestId.current) return;
      if (!result.success || !result.data) throw new Error(result.error || "Không thể tải căn hộ");
      const rows = Array.isArray(result.data) ? result.data : [result.data];
      setProducts(rows.filter(row => row.project_id === project.id));
    } catch (err: unknown) {
      if (request === requestId.current) {
        setProducts([]);
        setError(err instanceof Error ? err.message : "Không thể tải căn hộ");
      }
    } finally {
      if (request === requestId.current) setIsLoading(false);
    }
  }, []);

  const clearUnits = useCallback(() => {
    setProducts([]);
    setSelectedProduct(null);
    setShowDetail(false);
    setShowBulkImportModal(false);
    setSelectedBlock("all");
    setSelectedFloor("all");
    setSelectedType("all");
    setSelectedPriceRange("all");
    setFilterStatus("all");
    setSearch("");
    setError(null);
    setIsLoading(true);
  }, []);

  const loadInitialData = useCallback(async () => {
    const request = ++requestId.current;
    clearUnits();
    setProjects([]);
    setSelectedProject(null);
    try {
      const result = await fetchProjectsAction();
      if (request !== requestId.current) return;
      if (!result.success || !result.data) throw new Error(result.error || "Không thể tải dự án");
      const list = Array.isArray(result.data) ? result.data : [result.data];
      setProjects(list);
      const requestedId = selectedProjectId.current ?? new URLSearchParams(window.location.search).get("projectId");
      const project = requestedId !== null ? list.find(item => item.id === requestedId) : list[0];
      if (requestedId !== null && !project) throw new Error("Dự án không khả dụng trong danh sách được truy cập");
      setSelectedProject(project || null);
      selectedProjectId.current = project?.id ?? null;
      if (project) await readProducts(project, request);
      else setIsLoading(false);
    } catch (err: unknown) {
      if (request === requestId.current) {
        setError(err instanceof Error ? err.message : "Không thể tải dự án");
        setIsLoading(false);
      }
    }
  }, [clearUnits, readProducts]);

  const invalidateReads = useCallback(() => { ++requestId.current; }, []);
  useEffect(() => {
    void loadInitialData();
    return invalidateReads;
  }, [loadInitialData, invalidateReads]);

  function handleProjectChange(projId: string) {
    const request = ++requestId.current;
    clearUnits();
    const project = projects.find(item => item.id === projId) || null;
    setSelectedProject(project);
    selectedProjectId.current = project?.id ?? null;
    if (project) void readProducts(project, request);
    else {
      setError("Dự án không khả dụng trong danh sách được truy cập");
      setIsLoading(false);
    }
  }

  const displayUnits = isLoading || error ? [] : products;

  // Available blocks and floors
  const availableBlocks = Array.from(new Set(displayUnits.map(p => p.block || "Chưa cập nhật"))).sort();
  const availableFloors = Array.from(new Set(displayUnits.map(p => p.floor || "Chưa cập nhật"))).sort((a, b) => Number(b) - Number(a));

  // Filter and group
  const filtered = displayUnits.filter(p => {
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchBlock = selectedBlock === "all" || (p.block || "Chưa cập nhật") === selectedBlock;
    const matchFloor = selectedFloor === "all" || (p.floor || "Chưa cập nhật") === selectedFloor;
    const matchSearch = !search || p.product_code?.toLowerCase().includes(search.toLowerCase());
    const matchType = selectedType === "all" || p.product_type === selectedType;
    const price = p.unit_price;
    const matchPrice = selectedPriceRange === "all" || (price !== null && (
      selectedPriceRange === "3-5" ? price >= 3_000_000_000 && price < 5_000_000_000 :
      selectedPriceRange === "5-8" ? price >= 5_000_000_000 && price <= 8_000_000_000 :
      selectedPriceRange === "8+" && price > 8_000_000_000
    ));
    return matchStatus && matchBlock && matchFloor && matchSearch && matchType && matchPrice;
  });

  // Group by floor for matrix view
  const floorGroups = filtered.reduce<Record<string, ProductRow[]>>((acc, p) => {
    const floor = p.floor || "Chưa cập nhật";
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(p);
    return acc;
  }, {});

  const displayFloors = Object.keys(floorGroups).sort((a, b) => Number(b) - Number(a));

  // Stats
  const totalCount = displayUnits.length;
  const stats = {
    total: totalCount,
    available: displayUnits.filter(p => p.status === "available").length,
    booked: displayUnits.filter(p => p.status === "booked").length,
    deposited: displayUnits.filter(p => p.status === "deposited").length,
    contracted: displayUnits.filter(p => p.status === "contracted").length,
    sold: displayUnits.filter(p => p.status === "paid").length,
    handedOver: displayUnits.filter(p => p.status === "handed_over").length,
    cancelled: displayUnits.filter(p => p.status === "cancelled").length,
  };

  const activeProduct = filtered.find(unit => unit.id === selectedProduct?.id) || filtered[0] || null;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ─ Top Breadcrumb ─ */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
        <span>Bella Land</span>
        <span>/</span>
        <span>Kinh doanh</span>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-extrabold">Bảng hàng căn hộ</span>
      </div>

      {/* ── 1. Hero Project Banner (100% Unified with Projects Page Image 2) ── */}
      <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden min-h-[220px] md:min-h-[260px] flex flex-col justify-between shadow-xs">
        {/* Background Panorama Skyline Photo (100% Full Image 2) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src="/images/bella-land-hero-banner.png?v=9"
            alt="Skyline Panorama"
            className="w-full h-full object-cover object-center opacity-100 dark:opacity-90 scale-100"
          />
        </div>

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {selectedProject?.name || "Chưa chọn dự án"}
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{selectedProject?.location || "Chưa cập nhật vị trí"}</p>
          </div>

          <div className="relative z-20 shrink-0">
            <PremiumSelect
              options={projects.map(p => ({ value: p.id, label: p.name }))}
              value={selectedProject?.id ?? ""}
              onChange={handleProjectChange}
              placeholder="Đổi dự án..."
              className="w-[180px]"
              buttonClassName="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white hover:bg-white shadow-sm backdrop-blur-md flex items-center justify-between gap-2"
            />
          </div>
        </div>
      </div>

      {/* ── 2. 7 KPI Status Summary Cards Strip (Matching Image 1) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { id: "available", label: "Khả dụng", count: stats.available, pct: "32.7%", icon: Home, bg: "bg-emerald-50/70 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", iconBg: "bg-emerald-100 text-emerald-600" },
          { id: "booked", label: "Giữ chỗ", count: stats.booked, pct: "9.4%", icon: Clock, bg: "bg-amber-50/70 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", iconBg: "bg-amber-100 text-amber-600" },
          { id: "deposited", label: "Đặt cọc", count: stats.deposited, pct: "6.2%", icon: CreditCard, bg: "bg-orange-50/70 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", iconBg: "bg-orange-100 text-orange-600" },
          { id: "contracted", label: "Ký HĐMB", count: stats.contracted, pct: "21.8%", icon: PenTool, bg: "bg-purple-50/70 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", iconBg: "bg-purple-100 text-purple-600" },
          { id: "paid", label: "Đã bán", count: stats.sold, pct: "42.2%", icon: CheckCircle2, bg: "bg-blue-50/70 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", iconBg: "bg-blue-100 text-blue-600" },
          { id: "handed_over", label: "Bàn giao", count: stats.handedOver, pct: "2.3%", icon: Key, bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-800", text: "text-slate-700 dark:text-slate-300", iconBg: "bg-slate-200 text-slate-700" },
          { id: "cancelled", label: "Đã hủy", count: stats.cancelled, pct: "0.8%", icon: XCircle, bg: "bg-rose-50/70 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-300", iconBg: "bg-rose-100 text-rose-600" },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setFilterStatus(filterStatus === item.id ? "all" : item.id)}
            className={`p-3.5 rounded-2xl border transition-all text-left relative flex flex-col justify-between ${item.bg} ${item.border} ${
              filterStatus === item.id ? "ring-2 ring-blue-600 shadow-md scale-[1.02]" : "hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className={`text-2xl font-black ${item.text}`}>{isLoading || error || !selectedProject ? "—" : item.count}</span>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                <item.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{totalCount ? `${((item.count / totalCount) * 100).toFixed(1)}%` : "—"}</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── 3. Filter Controls & Status Legend (Matching Image 1) ── */}
      <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <PremiumSelect
              value={selectedBlock}
              onChange={(val) => setSelectedBlock(val)}
              options={[
                { value: "all", label: "Tất cả tòa" },
                ...availableBlocks.map((b) => ({ value: b, label: `Tòa ${b}` })),
              ]}
            />

            <PremiumSelect
              value={selectedFloor}
              onChange={(val) => setSelectedFloor(val)}
              options={[
                { value: "all", label: "Tất cả tầng" },
                ...availableFloors.map((f) => ({ value: f, label: `Tầng ${f}` })),
              ]}
            />

            <PremiumSelect
              value={selectedType}
              onChange={(val) => setSelectedType(val)}
              options={[
                { value: "all", label: "Tất cả loại căn" },
                ...Array.from(new Set(displayUnits.map(unit => unit.product_type).filter(type => Boolean(type)))).map(type => ({ value: type, label: ({ apartment: "Căn hộ", townhouse: "Nhà phố", shophouse: "Shophouse", villa: "Biệt thự", land_plot: "Đất nền", office: "Văn phòng" } as Record<string, string>)[type] || type })),
              ]}
            />

            <PremiumSelect
              value={selectedPriceRange}
              onChange={(val) => setSelectedPriceRange(val)}
              options={[
                { value: "all", label: "Khoảng giá" },
                { value: "3-5", label: "3 - 5 tỷ" },
                { value: "5-8", label: "5 - 8 tỷ" },
                { value: "8+", label: "> 8 tỷ" },
              ]}
            />

            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                placeholder="Tìm mã căn..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button aria-label="Xóa bộ lọc" title="Xóa bộ lọc" onClick={() => { setSearch(""); setFilterStatus("all"); setSelectedType("all"); setSelectedPriceRange("all"); setSelectedBlock("all"); setSelectedFloor("all"); }} className="p-2 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode("matrix")}
                aria-pressed={viewMode === "matrix"}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "matrix" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <Grid3x3 className="w-3.5 h-3.5" /> Ma trận
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "list" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <List className="w-3.5 h-3.5" /> Danh sách
              </button>
            </div>
            <button disabled={filtered.length === 0} onClick={() => downloadLandCsv("bella-land-can-ho.csv", filtered.map(unit => ({ "Mã căn": unit.product_code, "Dự án": unit.project_id, "Trạng thái": unit.status, "Diện tích": unit.area, "Đơn giá": unit.unit_price })))} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <Download className="w-3.5 h-3.5" /> Xuất
            </button>
          </div>
        </div>

        {/* Legend Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 font-bold flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Khả dụng</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Giữ chỗ</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Đặt cọc</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Ký HĐMB</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Đã bán</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Bàn giao</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Đã hủy</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-medium">
            <button onClick={loadInitialData}>Tải lại dữ liệu</button>
            <span className="cursor-pointer text-slate-600 dark:text-slate-300 font-bold">Trạng thái ▾</span>
          </div>
        </div>
      </div>

      {/* ── 4. Main Body (3-Column Layout: Towers Sidebar, Matrix Grid, Right Unit Panel) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column (2.5 cols): Tower Selector Cards */}
        <div className="lg:col-span-2 space-y-2">
          {availableBlocks.map(block => ({
            id: block, name: `Tòa ${block}`,
            total: displayUnits.filter(unit => (unit.block || "Chưa cập nhật") === block).length,
            avail: displayUnits.filter(unit => (unit.block || "Chưa cập nhật") === block && unit.status === "available").length,
          })).map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedBlock(t.id)}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${
                selectedBlock === t.id
                  ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 shadow-sm ring-1 ring-blue-500"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-black flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  {t.name}
                </span>
              </div>
              <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                {t.avail} / {t.total} căn
              </p>
            </button>
          ))}
        </div>

        {/* Center Column (6.5 cols): Dynamic Inventory Matrix Grid */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                Tòa {selectedBlock === "all" ? "Tất cả" : selectedBlock}
                <span className="text-slate-400 font-semibold text-xs">• Danh mục căn hộ thực tế đã khai báo</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Hiển thị đúng mã căn CĐT ({filtered.length} / {displayUnits.length} căn). Không tự tạo ô giả định.
              </p>
            </div>

            <button
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> Nhập căn thực tế
            </button>
          </div>

          {/* Dynamic Floor Rows (No static 01..10 columns) */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {isLoading ? <p role="status">Đang tải dữ liệu…</p> : error ? <div role="alert">{error}<button onClick={loadInitialData}>Thử lại</button></div> : !selectedProject ? <p>Chưa có dự án được truy cập.</p> : displayFloors.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-semibold text-xs border border-dashed rounded-2xl">
                {displayUnits.length === 0 ? "Chưa có căn hộ nào được khai báo cho dự án này." : "Không có căn hộ phù hợp với bộ lọc."}
                {displayUnits.length > 0 && <button className="ml-2 underline" onClick={() => { setSearch(""); setFilterStatus("all"); setSelectedType("all"); setSelectedPriceRange("all"); setSelectedFloor("all"); setSelectedBlock("all"); }}>Xóa bộ lọc</button>}
              </div>
            ) : viewMode === "list" ? (
              <div className="overflow-x-auto">
                <table aria-label="Danh sách căn hộ" className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {["Mã căn", "Tòa", "Tầng", "Loại căn", "Diện tích", "Đơn giá", "Trạng thái"].map(label => (
                        <th key={label} scope="col" className="p-3 font-bold">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(unit => (
                      <tr key={unit.id} className="border-b border-slate-100 dark:border-slate-800">
                        <th scope="row" className="p-3">
                          <button
                            aria-pressed={activeProduct?.id === unit.id}
                            onClick={() => { setSelectedProduct(unit); setShowDetail(false); }}
                            className={`px-3 py-2 rounded-xl border font-bold ${activeProduct?.id === unit.id ? "ring-2 ring-blue-600" : "border-slate-200 dark:border-slate-700"}`}
                          >
                            {unit.product_code || "Chưa cập nhật mã căn"}
                          </button>
                        </th>
                        <td className="p-3">{unit.block || "Chưa cập nhật"}</td>
                        <td className="p-3">{unit.floor || "Chưa cập nhật"}</td>
                        <td className="p-3">{unit.product_type || "Chưa cập nhật"}</td>
                        <td className="p-3">{unit.area === null ? "Chưa cập nhật" : `${unit.area} m²`}</td>
                        <td className="p-3">{unit.unit_price === null ? "Chưa cập nhật" : unit.unit_price.toLocaleString("vi-VN")}</td>
                        <td className="p-3">{STATUS_MAP[unit.status ?? ""]?.label || "Chưa cập nhật trạng thái"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              displayFloors.map(floor => {
                const floorUnits = (floorGroups[floor] || []).sort((a, b) => 
                  (a.product_code || "").localeCompare(b.product_code || "", undefined, { numeric: true })
                );

                return (
                  <div key={floor} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl shrink-0 w-24 justify-center shadow-2xs">
                      Tầng {floor}
                    </div>

                    <div className="flex flex-wrap gap-2 flex-1 items-center">
                      {floorUnits.map((u) => {
                        const statusCfg = STATUS_MAP[u.status ?? ""] ?? { label: "Chưa cập nhật", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600", dot: "bg-slate-400" };
                        const isSelected = activeProduct?.id === u.id || activeProduct?.product_code === u.product_code;

                        return (
                          <button
                            key={u.id || u.product_code}
                            onClick={() => { setSelectedProduct(u); setShowDetail(false); }}
                            className={`px-3.5 py-2 rounded-xl border text-center transition-all flex flex-col justify-center items-center min-w-[80px] sm:min-w-[88px] cursor-pointer ${statusCfg.bg} ${statusCfg.border} ${
                              isSelected ? "ring-2 ring-blue-600 border-blue-600 shadow-md scale-105 z-10 bg-white" : "hover:scale-105 hover:shadow-xs"
                            }`}
                          >
                            <span className={`text-xs font-black tracking-tight ${isSelected ? "text-blue-950 font-black" : statusCfg.text}`}>
                              {u.product_code}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold mt-0.5">
                              {u.area === null ? "Chưa cập nhật diện tích" : `${u.area} m²`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (3 cols): Right Unit Detail Panel (Matching Image 1) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          {activeProduct ? (
            <>
              <h2 className="text-2xl font-black">{activeProduct.product_code || "Chưa cập nhật mã căn"}</h2>
              <p>{STATUS_MAP[activeProduct.status ?? ""]?.label || "Chưa cập nhật trạng thái"}</p>
              <p>Tòa {activeProduct.block || "Chưa cập nhật"} • Tầng {activeProduct.floor || "Chưa cập nhật"}</p>
              <button className="w-full py-3 bg-blue-900 text-white rounded-xl" onClick={() => setShowDetail(true)}>Xem chi tiết</button>
              {showDetail && (
                <section aria-label="Chi tiết căn hộ" className="space-y-3 border-t pt-4">
                  <p>Thông tin chỉ đọc</p>
                  <dl className="space-y-2 text-sm">
                    <dt>Mã căn</dt><dd>{activeProduct.product_code || "Chưa cập nhật"}</dd>
                    <dt>Diện tích</dt><dd>{activeProduct.area === null ? "Chưa cập nhật" : `${activeProduct.area} m²`}</dd>
                    <dt>Đơn giá</dt><dd>{activeProduct.unit_price === null ? "Chưa cập nhật" : activeProduct.unit_price.toLocaleString("vi-VN")}</dd>
                    <dt>Loại căn</dt><dd>{activeProduct.product_type || "Chưa cập nhật"}</dd>
                    <dt>Hướng</dt><dd>{activeProduct.direction || "Chưa cập nhật"}</dd>
                    <dt>Chủ sở hữu</dt><dd>{activeProduct.owner_name || "Chưa cập nhật"}</dd>
                  </dl>
                  <button onClick={() => setShowDetail(false)}>Đóng chi tiết</button>
                </section>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">Chọn căn để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Bulk Inventory Declaration Modal ── */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowBulkImportModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                  Khai Báo Căn Thực Tế Nhanh
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tính năng đang chờ hợp đồng nhập và lưu dữ liệu.
                </p>
              </div>
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p role="status">Nhập căn hàng loạt chưa khả dụng: chưa có hợp đồng lưu dữ liệu được phê duyệt. Không có căn nào được tạo hoặc lưu.</p>
              <button disabled className="py-2 px-4 rounded-xl bg-slate-200">Khai Báo Căn — chưa khả dụng</button>
              <button onClick={() => setShowBulkImportModal(false)}>Đóng</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
