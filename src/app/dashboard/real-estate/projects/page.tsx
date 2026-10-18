"use client";
/* Real Estate Projects Page — Exact V2 Enterprise Layout matching reference screenshot */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  FolderKanban, PlusCircle, Building, MapPin, Loader2,
  TrendingUp, CheckCircle2, ChevronRight, X, Calendar,
  Search, Filter, LayoutGrid, List, Building2, ArrowUpRight,
  Heart, Bell, HelpCircle, Grid3X3, KeyRound, Clock, FileText,
  AlertCircle, ShieldAlert, Sparkles, Check, ChevronDown, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchProjectsAction,
  createProjectAction,
} from "@/modules/real_estate/actions/projectActions";
import { fetchProductsAction } from "@/modules/real_estate/actions/productActions";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { Database } from "@/types/database.types";
import { downloadLandCsv, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";

type ProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"];
type ProductRow = Database["public"]["Tables"]["real_estate_products"]["Row"];

interface ProjectStats {
  total: number;
  available: number;
  booked: number;
  deposited: number;
  sold: number;
}

const DEFAULT_PROJECT_IMAGES: Record<string, string> = {
  "elyse island": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
  "vinhomes green paradise": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
  "vinhomes saigon park": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
};

const DEFAULT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80";

function getProjectImage(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [key, url] of Object.entries(DEFAULT_PROJECT_IMAGES)) {
    if (lower.includes(key)) return url;
  }
  return DEFAULT_FALLBACK_IMAGE;
}

export default function RealEstateProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ProjectStats>>({});
  const requestVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [newProject, setNewProject] = useState({ name: "", description: "", status: "on_sale" });
  const [saving, setSaving] = useState(false);
  
  // UI Tabs & Filters
  const [topTab, setTopTab] = useState<"overview" | "list" | "map" | "analytics" | "reports">("overview");
  const [activeStatusTab, setActiveStatusTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (id: string) => {
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const loadProjects = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsLoading(true); setLoadError(null); setProjects([]); setStatsMap({}); setSelectedProject(null);
    try {
      const res = await fetchProjectsAction();
      if (version !== requestVersion.current) return;
      if (!res.success || !res.data) { setLoadError(res.error ?? "Không thể tải danh sách dự án"); return; }
      const list = Array.isArray(res.data) ? res.data : [res.data];
      setProjects(list);
      const entries = await Promise.all(list.map(async project => {
        try {
          const result = await fetchProductsAction(project.id);
          if (!result.success || !result.data) return null;
          const products = (Array.isArray(result.data) ? result.data : [result.data]).filter(product => product.project_id === project.id);
          return [project.id, {
            total: products.length,
            available: products.filter(p => p.status === "available").length,
            booked: products.filter(p => p.status === "booked").length,
            deposited: products.filter(p => p.status === "deposited").length,
            sold: products.filter(p => p.status === "paid" || p.status === "contracted").length,
          }] as [string, ProjectStats];
        } catch { return null; }
      }));
      if (version !== requestVersion.current) return;
      setStatsMap(Object.fromEntries(entries.filter((entry): entry is [string, ProjectStats] => entry !== null)));
    } catch { if (version === requestVersion.current) setLoadError("Không thể tải danh sách dự án. Vui lòng thử lại."); }
    finally { if (version === requestVersion.current) setIsLoading(false); }
  }, []);
  const invalidateReads = useCallback(() => { ++requestVersion.current; }, []);
  useEffect(() => { void loadProjects(); return invalidateReads; }, [loadProjects, invalidateReads]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name.trim()) { toast.error("Vui lòng điền tên dự án"); return; }
    if (saving) return;
    setSaving(true);
    try {
      const res = await createProjectAction({ name: newProject.name.trim(), description: newProject.description.trim() || null, status: newProject.status as ProjectRow["status"] });
      if (!res.success) { toast.error(res.error ?? "Lỗi khi tạo dự án"); return; }
      toast.success("Tạo dự án thành công"); setShowAddModal(false); setNewProject({ name: "", description: "", status: "on_sale" });
      await loadProjects();
    } catch { toast.error("Không thể tạo dự án. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  // Calculate totals
  const totals = Object.values(statsMap).reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      available: acc.available + s.available,
      reserved: acc.reserved + (s.booked + s.deposited),
      sold: acc.sold + s.sold,
    }),
    { total: 0, available: 0, reserved: 0, sold: 0 }
  );

  const inventoryComplete = !isLoading && !loadError && projects.every(project => statsMap[project.id]);
  const filteredProjects = projects.filter((proj) => {
    const matchesSearch = proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (proj.description && proj.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (activeStatusTab === "on_sale") return proj.status === "on_sale";
    if (activeStatusTab === "presale") return proj.status === "presale";
    if (activeStatusTab === "completed") return proj.status === "completed" || proj.status === "sold_out";
    if (activeStatusTab === "planning") return proj.status === "planning";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F6F7F9] dark:bg-slate-950 pb-12 font-sans text-slate-900 dark:text-slate-100">
      {/* ── 1. Top Search Header Bar ── */}
      <header className="h-14 bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        {/* Left Global Search */}
        <div className="relative w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setTopTab("overview"); }} placeholder="Tìm kiếm dự án..."
            className="w-full pl-9 pr-14 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 border border-transparent focus:border-amber-500 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all"
          />

        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-3">
          <button aria-label="Thông báo" onClick={() => unavailableLandAction("Thông báo dự án")} className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-4.5 h-4.5" />

          </button>
          <button aria-label="Trợ giúp" onClick={() => toast.info("Chọn dự án để xem chi tiết hoặc mở kho căn. Dùng ô tìm kiếm và trạng thái để lọc danh mục.")} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 my-auto" />
          <div className="flex items-center gap-2 pl-1 cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300/40 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
              <Grid3X3 className="w-4 h-4" />
            </div>
            <div className="leading-tight text-left">
              <p className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">BELLA GROUP</p>
              <p className="text-[9px] font-semibold text-slate-400">Multi-Industry Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Hero Panorama Section (100% Full Width Image 2) ── */}
      <div className="relative bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 overflow-hidden min-h-[220px] md:min-h-[260px] flex flex-col justify-between">
        {/* Background Panorama Skyline Photo (100% Full Width) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src="/images/bella-land-hero-banner.png?v=9"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1477959858617-67f30ac4ce78?auto=format&fit=crop&w=1600&q=80";
            }}
            alt="Skyline Panorama"
            className="w-full h-full object-cover object-center opacity-100 dark:opacity-90 scale-100"
          />
        </div>

        <div className="relative z-10 px-8 pt-6 pb-0 flex flex-col justify-between h-full min-h-[240px] md:min-h-[280px] lg:min-h-[310px]">
          {/* Breadcrumb & Title Area */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
              <span className="hover:text-slate-800 cursor-pointer">Bella Land</span>
              <span>/</span>
              <span className="text-slate-900 dark:text-slate-100 font-extrabold">Dự án</span>
            </div>

            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Danh mục dự án
                </h1>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-semibold mt-1">
                  Theo dõi nguồn cung, tình trạng kinh doanh và hiệu quả từng dự án.
                </p>
              </div>
              
              {/* Spacer for Right Side Built-in Slogan */}
              <div className="hidden lg:block w-80 h-16" />
            </div>
          </div>

          {/* Tab Navigation Pills (Bottom Aligned) */}
          <div className="flex items-center gap-2 mt-auto border-b border-transparent pb-3">
            {[
              { id: "overview", label: "Tổng quan" },
              { id: "list", label: "Danh sách dự án" },
              { id: "map", label: "Bản đồ dự án" },
              { id: "analytics", label: "Phân tích" },
              { id: "reports", label: "Báo cáo" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTopTab(tab.id as typeof topTab)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all relative ${
                  topTab === tab.id
                    ? "bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-2 border-amber-400 dark:border-amber-600 shadow-sm"
                    : "bg-white/95 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 shadow-2xs hover:bg-white hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. Main Content Container ── */}
      <main className="px-6 md:px-8 pt-6 space-y-6 max-w-[1600px] mx-auto">
        {loadError && <div role="alert">{loadError}<button onClick={() => void loadProjects()} className="ml-3 underline">Thử lại</button></div>}
        {!isLoading && !loadError && !inventoryComplete && <p role="status">Một số dữ liệu kho căn chưa tải được. Các số tổng chưa được xác minh.</p>}
        {!isLoading && !loadError && filteredProjects.length === 0 && <p role="status">Không có dự án phù hợp.</p>}
        {/* Tab 1: Overview View */}
        {topTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): 4 Top KPI Cards */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Tổng số căn */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Building className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/50">
                    Từ danh mục hiện tại
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Tổng số căn</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">{inventoryComplete ? totals.total : "—"}</span>
                  <span className="text-[10px] font-medium text-slate-400 block mt-1">Trong toàn bộ danh mục</span>
                </div>
              </div>

              {/* KPI 2: Căn khả dụng */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <KeyRound className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/50">
                    {inventoryComplete && totals.total ? `${Math.round(totals.available / totals.total * 100)}%` : "—"}
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Căn khả dụng</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">{inventoryComplete ? totals.available : "—"}</span>
                  <span className="text-[10px] font-medium text-slate-400 block mt-1">Sẵn sàng mở bán</span>
                </div>
              </div>

              {/* KPI 3: Đã giữ chỗ / Đặt cọc */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/50">
                    {inventoryComplete && totals.total ? `${Math.round(totals.reserved / totals.total * 100)}%` : "—"}
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Đã giữ chỗ / Đặt cọc</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">{inventoryComplete ? totals.reserved : "—"}</span>
                  <span className="text-[10px] font-medium text-slate-400 block mt-1">Đang trong giao dịch</span>
                </div>
              </div>

              {/* KPI 4: Đã bán */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <FileText className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {inventoryComplete && totals.total ? `${Math.round(totals.sold / totals.total * 100)}%` : "—"}
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Đã bán</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">{inventoryComplete ? totals.sold : "—"}</span>
                  <span className="text-[10px] font-medium text-slate-400 block mt-1">Đã hoàn tất</span>
                </div>
              </div>
            </div>

            {/* ── 4. Project List Section (`Danh sách dự án`) ── */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Danh sách dự án
                  </h2>
                </div>

                {/* Sub-Filter Tabs & Tools */}
                <div className="flex items-center gap-3">
                  {/* Status Pills */}
                  <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl">
                    {[
                      { id: "all", label: "Tất cả", count: projects.length },
                      { id: "on_sale", label: "Đang mở bán", count: projects.filter(p => p.status === "on_sale").length },
                      { id: "presale", label: "Sắp mở bán", count: projects.filter(project => project.status === "presale").length },
                      { id: "completed", label: "Đã hoàn thành", count: projects.filter(project => project.status === "completed" || project.status === "sold_out").length },
                      { id: "planning", label: "Quy hoạch", count: projects.filter(project => project.status === "planning").length },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveStatusTab(tab.id)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          activeStatusTab === tab.id
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        {tab.label} <span className="opacity-60 ml-0.5">{tab.count}</span>
                      </button>
                    ))}
                  </div>

                  {/* View Controls & Filter Button */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                      <button
                        aria-label="Danh sách dự án" onClick={() => { setViewMode("list"); setTopTab("list"); }}
                        className={`p-1 rounded-lg transition-colors ${viewMode === "list" ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-400"}`}
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        aria-label="Lưới dự án" onClick={() => setViewMode("grid")}
                        className={`p-1 rounded-lg transition-colors ${viewMode === "grid" ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-400"}`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm dự án..."
                        className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button onClick={() => { setSearchQuery(""); setActiveStatusTab("all"); }} title="Xóa bộ lọc" className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors">
                      <Filter className="w-3.5 h-3.5" />
                      <span>Bộ lọc</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Project Cards Grid (Exact matching target screenshot) */}
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {filteredProjects.map((proj) => {
                    const statsKnown = Boolean(statsMap[proj.id]);
                    const stats = statsMap[proj.id] ?? { total: 0, available: 0, booked: 0, deposited: 0, sold: 0 };
                    const occupancyPct = stats.total > 0 ? Math.round(((stats.total - stats.available) / stats.total) * 100) : 0;
                    const imgUrl = getProjectImage(proj.name);
                    const isFav = favorites[proj.id];

                    return (
                      <div
                        key={proj.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                      >
                        <div>
                          {/* Card Photo Header */}
                          <div className="relative h-44 overflow-hidden bg-slate-100">
                            <img
                              src={imgUrl}
                              alt={proj.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

                            {/* Top Badges */}
                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                              <span className="px-2.5 py-1 bg-teal-500/90 text-white font-extrabold text-[10px] rounded-full backdrop-blur-xs shadow-xs">
                                Đang mở bán
                              </span>
                              <button
                                onClick={() => toggleFavorite(proj.id)}
                                className="w-7 h-7 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-rose-500 transition-colors shadow-xs"
                              >
                                <Heart className={`w-4 h-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                              </button>
                            </div>
                          </div>

                          {/* Card Content Body */}
                          <div className="p-5 space-y-4">
                            <div>
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                                  {proj.name}
                                </h3>
                                {proj.name.toLowerCase().includes("vinhomes green") && (
                                  <span className="text-[10px] font-bold text-slate-400">active</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>Việt Nam · BELLA Group</span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {proj.description || "Tổ hợp biệt thự nghỉ dưỡng và shophouse thương mại ven biển."}
                            </p>

                            {/* Mini 4-Column Supply Stats */}
                            <div className="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl text-center border border-slate-100 dark:border-slate-800">
                              <div>
                                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{statsKnown ? stats.total : "—"}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Tổng căn</p>
                              </div>
                              <div>
                                <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{statsKnown ? stats.available : "—"}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Khả dụng</p>
                              </div>
                              <div>
                                <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{statsKnown ? stats.booked + stats.deposited : "—"}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Giữ chỗ</p>
                              </div>
                              <div>
                                <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{statsKnown ? stats.sold : "—"}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Đã bán</p>
                              </div>
                            </div>

                            {/* Absorption Rate Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Tỷ lệ hấp thụ</span>
                                <span className="font-extrabold text-slate-900 dark:text-white">{statsKnown ? `${occupancyPct}%` : "Chưa xác minh"}</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    occupancyPct >= 50 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                                  }`}
                                  style={{ width: `${occupancyPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="p-5 pt-0 grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setSelectedProject(proj)}
                            className="py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center"
                          >
                            Xem chi tiết
                          </button>
                          <button
                            onClick={() => { window.location.href = `/dashboard/real-estate/apartments?projectId=${proj.id}`; }}
                            className="py-2 px-3 bg-[#A67B27] hover:bg-[#8F681F] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <span>Bảng hàng</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 cols): Performance CTA + Timeline Cards */}
          <div className="lg:col-span-4 space-y-6"><aside className="rounded-xl border border-amber-300 p-3 text-xs text-amber-900 dark:text-amber-200">Các khối hiệu quả, hoạt động và công việc dưới đây là dữ liệu minh họa.</aside>
            {/* Top Performance CTA Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full py-3 bg-[#A67B27] hover:bg-[#8F681F] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Tạo dự án mới</span>
              </button>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Hiệu quả kinh doanh</span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 cursor-pointer hover:text-slate-800">
                    <span>Tháng này</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex items-end justify-between mt-3">
                  <div>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      ↗ 67%
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">Tỷ lệ hấp thụ trung bình</span>
                  </div>

                  {/* Gold Mini Bar Chart Visual */}
                  <div className="flex items-end gap-1 h-10 pr-2">
                    {[35, 45, 60, 50, 75, 90, 67].map((h, i) => (
                      <div
                        key={i}
                        className={`w-2.5 rounded-t-sm ${i === 6 ? "bg-[#A67B27]" : "bg-amber-100 dark:bg-amber-950/60"}`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activities Card (`Hoạt động gần đây`) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Hoạt động gần đây
                </h3>
                <span 
                  onClick={() => { window.location.href = "/dashboard/real-estate/global-search"; }} 
                  className="text-[11px] font-bold text-slate-400 hover:text-amber-600 cursor-pointer"
                >
                  Xem tất cả →
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                {[
                  { title: "Cập nhật thông tin dự án", proj: "Vinhomes Green Paradise", time: "2 giờ trước", color: "bg-blue-50 text-blue-600 border-blue-200" },
                  { title: "Thêm dự án mới", proj: "Elyse Island", time: "5 giờ trước", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
                  { title: "Cập nhật bảng hàng", proj: "Vinhomes Saigon Park", time: "1 ngày trước", color: "bg-blue-50 text-blue-600 border-blue-200" },
                  { title: "Tạo hợp đồng đặt cọc", proj: "KH. Nguyễn Văn A", time: "1 ngày trước", color: "bg-amber-50 text-amber-600 border-amber-200" },
                  { title: "Cập nhật trạng thái căn hộ", proj: "Tòa S1 - Căn 1208", time: "2 ngày trước", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
                ].map((act, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${act.color}`}>
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{act.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{act.proj}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Needing Attention (`Công việc cần chú ý`) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Công việc cần chú ý
                </h3>
                <span 
                  onClick={() => { window.location.href = "/dashboard/real-estate/schedules"; }} 
                  className="text-[11px] font-bold text-slate-400 hover:text-amber-600 cursor-pointer"
                >
                  Xem tất cả →
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  { count: "3", title: "lead quá hạn SLA", detail: "Cần xử lý ngay", bg: "bg-rose-500" },
                  { count: "2", title: "đặt cọc sắp hết hạn", detail: "Trong 3 ngày tới", bg: "bg-amber-500" },
                  { count: "1", title: "hợp đồng thiếu hồ sơ", detail: "Cần bổ sung", bg: "bg-blue-500" },
                  { count: "2", title: "dự án cần điều chỉnh giá", detail: "Cập nhật giá bán", bg: "bg-emerald-500" },
                ].map((task, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full ${task.bg} text-white font-extrabold text-[11px] flex items-center justify-center shrink-0`}>
                      {task.count}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{task.count} {task.title}</p>
                      <p className="text-[10px] text-slate-400">{task.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Tab 2: Full Project List Table View */}
        {topTab === "list" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Danh sách chi tiết dự án</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bảng dữ liệu tổng hợp toàn bộ {filteredProjects.length} dự án bất động sản</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-[#A67B27] text-white rounded-xl text-xs font-bold shadow-2xs">
                + Thêm dự án mới
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-extrabold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3">Tên dự án</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Tổng số căn</th>
                    <th className="p-3">Khả dụng</th>
                    <th className="p-3">Giữ chỗ / Cọc</th>
                    <th className="p-3">Đã bán</th>
                    <th className="p-3">Tỷ lệ hấp thụ</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProjects.map((p) => {
                    const known = Boolean(statsMap[p.id]);
                    const st = statsMap[p.id] || { total: 0, available: 0, booked: 0, deposited: 0, sold: 0 };
                    const rate = st.total > 0 ? Math.round(((st.total - st.available) / st.total) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                            {p.status === "on_sale" ? "Đang mở bán" : p.status}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">{known ? st.total : "—"}</td>
                        <td className="p-3 font-semibold text-emerald-600">{known ? st.available : "—"}</td>
                        <td className="p-3 font-semibold text-amber-600">{known ? st.booked + st.deposited : "—"}</td>
                        <td className="p-3 font-semibold text-blue-600">{known ? st.sold : "—"}</td>
                        <td className="p-3 font-bold">{known ? `${rate}%` : "—"}</td>
                        <td className="p-3 text-right space-x-2">
                          <button onClick={() => setSelectedProject(p)} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold hover:bg-slate-200">
                            Chi tiết
                          </button>
                          <button onClick={() => { window.location.href = `/dashboard/real-estate/apartments?projectId=${p.id}`; }} className="px-2.5 py-1 bg-[#A67B27] text-white rounded-lg text-[11px] font-bold">
                            Bảng hàng →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Interactive Project Map View */}
        {topTab === "map" && (<section className="rounded-xl border p-6"><h2>Bản đồ dự án</h2><p>Chưa có tọa độ dự án được xác minh để hiển thị trên bản đồ.</p></section>)}

        {/* Tab 4: Analytics & Sales Velocity */}
        {topTab === "analytics" && (<section className="rounded-xl border p-6"><h2>Phân tích dự án</h2><p>Số liệu kho căn được tổng hợp ở Tổng quan. Chưa có dữ liệu lịch sử được xác minh cho tốc độ bán và doanh thu.</p></section>)}

        {/* Tab 5: Reports & Exports */}
        {topTab === "reports" && (<section className="rounded-xl border p-6"><h2>Báo cáo danh mục</h2><p>Xuất danh mục đang lọc, gồm mã, tên và trạng thái dự án hiện có.</p><button className="rounded-lg border px-4 py-2 mt-3" disabled={isLoading || Boolean(loadError) || filteredProjects.length === 0} onClick={() => downloadLandCsv("bella-land-du-an.csv", filteredProjects.map(project => ({ "Mã dự án": project.code, "Tên": project.name, "Trạng thái": project.status })))}>Xuất CSV danh mục</button></section>)}

        {/* ── 5. Bottom Feature Banner (Exact matching screenshot footer) ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                Bella Land – Giải pháp quản lý bất động sản toàn diện
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Kết nối con người, tài sản và cơ hội. Tối ưu vận hành, gia tăng giá trị.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 relative z-10 self-end md:self-auto">
            <button 
              onClick={() => setTopTab("analytics")} 
              className="px-5 py-2.5 bg-[#A67B27] hover:bg-[#8F681F] text-white rounded-xl text-xs font-extrabold shadow-2xs transition-colors"
            >
              Tìm hiểu thêm →
            </button>
            <div className="hidden xl:block text-right text-[9px] font-black tracking-[0.2em] uppercase text-slate-300 dark:text-slate-700 leading-tight">
              DỰ ÁN LỚN HƠN<br />DOANH NGHIỆP MẠNH HƠN<br />CỘNG ĐỒNG THỊNH VƯỢNG
            </div>
          </div>
        </div>
      </main>

      {/* ── 6. Add Project Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Thêm Dự Án Mới</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tên Dự Án *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Ví dụ: Vinhomes Green Paradise"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mô Tả Dự Án</label>
                <textarea
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 h-20 resize-none"
                  placeholder="Phân khu căn hộ cao cấp bên sông..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#A67B27] hover:bg-[#8F681F] disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-2xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Xác Nhận Tạo
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── 7. Project Detail Popup Modal ── */}
      {selectedProject && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProject(null)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{selectedProject.name}</h2>
              <button
                onClick={() => setSelectedProject(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                {selectedProject.description || "Phân khu căn hộ cao cấp bên sông với không gian xanh và tiện ích 5 sao."}
              </p>
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-4 space-y-2">
                <p className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[10px]">Thống kê nguồn cung</p>
                {Object.entries(statsMap[selectedProject.id] ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-400 capitalize">{k}</span>
                    <span className="font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{v}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => { window.location.href = `/dashboard/real-estate/apartments?projectId=${selectedProject.id}`; }}
                  className="w-full py-2.5 bg-[#A67B27] hover:bg-[#8F681F] text-white font-bold rounded-xl text-xs text-center transition-colors shadow-2xs"
                >
                  Xem Bảng Hàng Căn Hộ →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
