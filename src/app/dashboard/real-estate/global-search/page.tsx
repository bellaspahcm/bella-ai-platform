"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Building2, Users, FileText, FolderKanban, Loader2, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

import { fetchInvestorsAction } from "@/modules/real_estate/actions/investorActions";

type ResultType = "project" | "product" | "customer" | "lead";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_CONFIG: Record<ResultType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  project:  { icon: FolderKanban, color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-100 dark:bg-blue-900/40",    label: "Dự Án" },
  product:  { icon: Building2,    color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-100 dark:bg-amber-900/40",  label: "Căn Hộ" },
  customer: { icon: Users,        color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40", label: "Khách Hàng" },
  lead:     { icon: FileText,     color: "text-violet-600 dark:text-violet-400",bg: "bg-violet-100 dark:bg-violet-900/40",label: "Lead cục bộ" },
};

export default function GlobalSearchPage() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const router = useRouter();
  const requestVersion = useRef(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string, version: number) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true); setSearchError(null);
    setSearched(true);
    try {
      const supabase = createClient();
      const like = '"%' + q.trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"').replace(/[%_]/g, '\\$&') + '%"';
      const lowerQ = q.trim().toLowerCase();
      const projectTerms = [`name.ilike.${like}`, `code.ilike.${like}`];
      if (lowerQ.includes("mở bán")) projectTerms.push('status.eq.on_sale');
      else if (lowerQ.includes("hoàn thành")) projectTerms.push('status.eq.completed');
      else if (lowerQ.includes("quy hoạch")) projectTerms.push('status.eq.planning');
      const projQuery = supabase.from("real_estate_projects").select("id, name, status, code").or(projectTerms.join(','));
      // Enum columns support equality; keep ilike on text fields only.
      const productTerms = [`product_code.ilike.${like}`];
      if (lowerQ.includes("giữ chỗ")) productTerms.push('status.in.(booked,held)');
      else if (lowerQ.includes("cọc")) productTerms.push('status.eq.deposited');
      else if (lowerQ.includes("hđmb")) productTerms.push('status.eq.contracted');
      else if (lowerQ.includes("đã bán")) productTerms.push('status.eq.paid');
      else if (lowerQ.includes("trống")) productTerms.push('status.eq.available');
      const types: Record<string, string> = { 'căn hộ': 'apartment', apartment: 'apartment', 'nhà phố': 'townhouse', townhouse: 'townhouse', shophouse: 'shophouse', 'biệt thự': 'villa', villa: 'villa', 'đất nền': 'land_plot', land_plot: 'land_plot', 'văn phòng': 'office', office: 'office' };
      const type = types[lowerQ];
      if (type) productTerms.push(`product_type.eq.${type}`);
      const prodQuery = supabase.from("real_estate_products").select("id, product_code, product_type, status, project_id, block, floor").or(productTerms.join(','));

      const [projRes, prodRes, custRes] = await Promise.allSettled([
        projQuery.limit(5),
        prodQuery.limit(5),
        fetchInvestorsAction()
      ]);

      const all: SearchResult[] = [];
      let partialFailure = projRes.status === "rejected" || (projRes.status === "fulfilled" && Boolean(projRes.value.error)) || prodRes.status === "rejected" || (prodRes.status === "fulfilled" && Boolean(prodRes.value.error)) || custRes.status === "rejected" || (custRes.status === "fulfilled" && !custRes.value.success);

      // Add Projects
      if (projRes.status === "fulfilled" && projRes.value.data) {
        projRes.value.data.forEach(p => {
          const statusMap: Record<string, string> = {
            planning: "Đang Quy Hoạch",
            on_sale: "Đang Mở Bán",
            completed: "Đã Hoàn Thành",
            sold_out: "Đã Bán Hết"
          };
          all.push({
            id: p.id,
            type: "project",
            title: p.name,
            subtitle: `Mã: ${p.code || "—"} • Trạng thái: ${statusMap[p.status] || p.status}`,
            href: `/dashboard/real-estate/projects`,
          });
        });
      }

      // Add Products
      if (prodRes.status === "fulfilled" && prodRes.value.data) {
        prodRes.value.data.forEach(p => {
          const statusMap: Record<string, string> = {
            available: "Còn trống",
            booked: "Giữ chỗ",
            held: "Giữ căn",
            deposited: "Đã đặt cọc",
            contracted: "Đã ký HĐMB",
            paid: "Đã thanh toán",
            handed_over: "Đã bàn giao",
            cancelled: "Đã hủy"
          };
          const typeMap: Record<string, string> = {
            apartment: "Căn hộ",
            townhouse: "Nhà phố",
            shophouse: "Shophouse",
            villa: "Biệt thự"
          };
          all.push({
            id: p.id,
            type: "product",
            title: `${p.product_code} — ${typeMap[p.product_type] || p.product_type}`,
            subtitle: `Block: ${p.block || "—"} • Tầng: ${p.floor || "—"} • Trạng thái: ${statusMap[p.status] || p.status}`,
            href: `/dashboard/real-estate/apartments?projectId=${encodeURIComponent(p.project_id)}`,
          });
        });
      }

      // Add Customers (Investors)
      if (custRes.status === "fulfilled" && custRes.value.success && custRes.value.data) {
        const filteredCust = custRes.value.data.filter(inv => {
          const matchesText =
            inv.fullName.toLowerCase().includes(lowerQ) ||
            inv.phone.includes(lowerQ) ||
            inv.email.toLowerCase().includes(lowerQ) ||
            (inv.cccd && inv.cccd.includes(lowerQ)) ||
            inv.saleOwner.toLowerCase().includes(lowerQ) ||
            inv.interestedProjects.some(p => p.toLowerCase().includes(lowerQ));
          
          let matchesStatus = false;
          if (lowerQ.includes("cọc") || lowerQ.includes("won") || lowerQ.includes("chốt") || lowerQ.includes("thành công")) {
            matchesStatus = inv.status === "closed_won";
          } else if (lowerQ.includes("đàm phán") || lowerQ.includes("thương lượng")) {
            matchesStatus = inv.status === "negotiating";
          } else if (lowerQ.includes("mới") || lowerQ.includes("lead")) {
            matchesStatus = inv.status === "lead";
          }
          
          return matchesText || matchesStatus;
        });

        filteredCust.slice(0, 5).forEach(inv => {
          const statusMap: Record<string, string> = {
            lead: "Lead Mới",
            contacted: "Đã Liên Hệ",
            negotiating: "Đang Đàm Phán",
            closed_won: "Chốt Thành Công",
            closed_lost: "Không Tiếp Tục"
          };
          all.push({
            id: inv.id,
            type: "customer",
            title: inv.fullName,
            subtitle: `SĐT: ${inv.phone} • Trạng thái: ${statusMap[inv.status] || inv.status} • Sale: ${inv.saleOwner}`,
            href: `/dashboard/real-estate/customers`,
          });
        });
      }

      // Add Leads (from localStorage)
      try {
        const savedLeadsStr = localStorage.getItem('bella_re_managed_leads');
        if (savedLeadsStr) {
          type SavedLead = {
            id?: string;
            fullName?: string;
            phone?: string;
            email?: string;
            interestedProject?: string;
            notes?: string;
            currentSaleName?: string;
            state?: "unassigned" | "waiting_accept" | "in_progress" | "converted" | "lost";
          };
          const leadsList = JSON.parse(savedLeadsStr) as unknown;
          if (!Array.isArray(leadsList)) throw new Error("INVALID_LOCAL_LEADS");
          const filteredLeads = (leadsList as SavedLead[]).filter(l => {
            const matchesText =
              (l.fullName && l.fullName.toLowerCase().includes(lowerQ)) ||
              (l.phone && l.phone.includes(lowerQ)) ||
              (l.email && l.email.toLowerCase().includes(lowerQ)) ||
              (l.interestedProject && l.interestedProject.toLowerCase().includes(lowerQ)) ||
              (l.notes && l.notes.toLowerCase().includes(lowerQ)) ||
              (l.currentSaleName && l.currentSaleName.toLowerCase().includes(lowerQ));

            let matchesState = false;
            if (lowerQ.includes("cọc") || lowerQ.includes("chốt") || lowerQ.includes("converted") || lowerQ.includes("thành công")) {
              matchesState = l.state === "converted";
            } else if (lowerQ.includes("đang chăm sóc") || lowerQ.includes("chăm sóc") || lowerQ.includes("in_progress")) {
              matchesState = l.state === "in_progress";
            } else if (lowerQ.includes("chờ") || lowerQ.includes("nhận") || lowerQ.includes("waiting")) {
              matchesState = l.state === "waiting_accept";
            }
            
            return matchesText || matchesState;
          });

          filteredLeads.slice(0, 5).forEach(l => {
            const stateMap: Record<string, string> = {
              unassigned: "Chưa phân phối",
              waiting_accept: "Chờ nhận lead",
              in_progress: "Đang chăm sóc",
              converted: "Đã chốt cọc",
              lost: "Đã mất/Từ chối"
            };
            const stateLabel = l.state ? stateMap[l.state] || l.state : "Chưa phân phối";
            all.push({
              id: l.id || l.phone || l.email || l.fullName || "lead",
              type: "lead",
              title: l.fullName || "Lead",
              subtitle: `SĐT: ${l.phone} • Trạng thái: ${stateLabel} • Sale: ${l.currentSaleName || "Chưa phân phối"}`,
              href: `/dashboard/real-estate/leads`,
            });
          });
        }
      } catch (err: unknown) {
        partialFailure = true;
      }

      if (version !== requestVersion.current) return;
      setResults(all);
      setSearchError(partialFailure ? "Một số nguồn chưa tải được; kết quả tìm kiếm chưa đầy đủ." : null);
    } catch (e) {
      if (version === requestVersion.current) { setResults([]); setSearchError("Không thể tìm kiếm. Vui lòng thử lại."); }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  const handleInput = (q: string) => {
    const version = ++requestVersion.current;
    setQuery(q); setResults([]); setSearchError(null); setLoading(false); setSearched(false);
    clearTimeout(debounceRef.current);
    if (q.trim().length >= 2) debounceRef.current = setTimeout(() => void doSearch(q, version), 350);
  };

  useEffect(() => () => { clearTimeout(debounceRef.current); ++requestVersion.current; }, []);

  const SUGGESTIONS = ["The Grand Tower", "Riverside", "CH001"];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* ─ Header ─ */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
          Tìm Kiếm Toàn Cục
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Tìm dự án, căn hộ, khách hàng và lead cục bộ
        </p>
      </div>

      {/* ─ Search Box ─ */}
      <div className="relative">
        <div className={`flex items-center gap-3 bg-white dark:bg-slate-900 border ${
          query
            ? "border-amber-400 dark:border-amber-500/50 shadow-lg shadow-amber-500/10"
            : "border-slate-200 dark:border-slate-700 shadow-sm"
        } rounded-2xl px-5 py-4 transition-all`}>
          {loading ? (
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <input
            autoFocus
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="Nhập tên dự án, mã căn hộ, tên khách hàng..."
            className="flex-1 bg-transparent text-slate-900 dark:text-white text-lg placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {query && (
            <button
              aria-label="Xóa tìm kiếm" onClick={() => handleInput("")}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─ Suggestions ─ */}
      {!query && (
        <div className="space-y-3">
          <p className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest font-semibold">
            Gợi ý tìm kiếm phổ biến
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleInput(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-all shadow-sm"
              >
                <Search className="w-3 h-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchError && <p role="alert">{searchError}</p>}
      {/* ─ Results ─ */}
      <AnimatePresence mode="wait">
        {searched && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {results.length === 0 && !loading && !searchError && (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  Không tìm thấy kết quả cho &ldquo;<span className="text-slate-600 dark:text-slate-300 font-semibold">{query}</span>&rdquo;
                </p>
              </div>
            )}

            {results.length > 0 && (
              <>
                <p className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest font-semibold mb-3">
                  {results.length} kết quả
                </p>
                {results.map((res, i) => {
                  const cfg = TYPE_CONFIG[res.type];
                  const Icon = cfg.icon;
                  return (
                    <motion.button
                      key={`${res.type}:${res.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => router.push(res.href)}
                      className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all text-left group shadow-sm"
                    >
                      <div className={`p-2.5 rounded-xl ${cfg.bg} shrink-0`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white font-bold truncate">{res.title}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{res.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
                      </div>
                    </motion.button>
                  );
                })}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─ Category Shortcuts ─ */}
      {!searched && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          {(Object.entries(TYPE_CONFIG) as [ResultType, typeof TYPE_CONFIG[ResultType]][]).map(([type, cfg]) => {
            const Icon = cfg.icon;
            const routes: Record<ResultType, string> = {
              project:  "/dashboard/real-estate/projects",
              product:  "/dashboard/real-estate/apartments",
              customer: "/dashboard/real-estate/customers",
              lead:     "/dashboard/real-estate/leads",
            };
            return (
              <button
                key={type}
                onClick={() => router.push(routes[type])}
                className={`flex flex-col items-center gap-2 p-5 ${cfg.bg} border border-slate-200 dark:border-slate-700/50 rounded-2xl hover:shadow-md transition-all`}
              >
                <Icon className={`w-7 h-7 ${cfg.color}`} />
                <span className="text-slate-700 dark:text-slate-300 text-sm font-semibold">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
