'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  ClipboardList,
  History,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { BUSINESS_RULES } from '@bella/shared';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { cn } from '@/lib/utils';
import { addInventoryItem, consumeInventory } from '@/services/inventory-actions';
import { MONTHS, YEARS } from './constants';
import { InventoryCreateRequestModal } from './components/InventoryCreateRequestModal';
import { InventoryReconciliationPanel } from './components/InventoryReconciliationPanel';
import { InventoryRestockModal } from './components/InventoryRestockModal';
import { useInventoryPageState } from './hooks/useInventoryPageState';
import type { ActiveInventoryTab, InventoryItem, NewInventoryItem } from './types';

type InteriorTabKey = Exclude<ActiveInventoryTab, 'sales'>;

interface InteriorProjectOption {
  id: string;
  name: string;
  code: string;
}

const INTERIOR_MATERIAL_CATEGORIES = [
  'Gỗ & Ván công nghiệp',
  'Phụ kiện kim khí',
  'Chỉ nẹp & Keo dán',
  'Sơn & Hoàn thiện',
  'Đá, Kính & Kim loại',
  'Thiết bị & Đèn LED',
  'Thành phẩm gia công',
] as const;

const INTERIOR_UNITS = [
  'Tấm',
  'Bộ',
  'Cặp',
  'Cuộn',
  'Thùng',
  'm²',
  'Cái',
  'Mét',
  'Kg',
] as const;

const INTERIOR_STARTER_CATALOG: ReadonlyArray<{
  name: string;
  sku: string;
  unit: string;
  category: string;
  stock_level: number;
  min_stock_level: number;
  price_per_unit: number;
  notes: string;
}> = [
  {
    name: 'Ván MDF chống ẩm An Cường 17mm lõi xanh E1 (1.22x2.44m)',
    sku: 'VAN-MDF17-AC',
    unit: 'Tấm',
    category: 'Gỗ & Ván công nghiệp',
    stock_level: 120,
    min_stock_level: 30,
    price_per_unit: 385000,
    notes: 'Nhà cung cấp: Gỗ An Cường — Dùng cho thùng tủ bếp, tủ áo.',
  },
  {
    name: 'Ván Plywood phủ Melamine An Cường 18mm chịu ẩm',
    sku: 'VAN-PLY18-AC',
    unit: 'Tấm',
    category: 'Gỗ & Ván công nghiệp',
    stock_level: 48,
    min_stock_level: 20,
    price_per_unit: 620000,
    notes: 'Nhà cung cấp: Gỗ An Cường — Khung chậu rửa & khu vực ẩm.',
  },
  {
    name: 'Ray trượt âm giảm chấn Blum Tandem 450mm (Toàn phần)',
    sku: 'RAY-BLUM-450',
    unit: 'Bộ',
    category: 'Phụ kiện kim khí',
    stock_level: 35,
    min_stock_level: 15,
    price_per_unit: 690000,
    notes: 'NPP Blum / Tân Kỷ Nguyên — Phụ kiện ngăn kéo cao cấp.',
  },
  {
    name: 'Bản lề hơi giảm chấn Hafele Inox 304 (Thẳng / Cong)',
    sku: 'BL-HAFELE-304',
    unit: 'Cái',
    category: 'Phụ kiện kim khí',
    stock_level: 240,
    min_stock_level: 80,
    price_per_unit: 48000,
    notes: 'NPP Hafele Việt Nam — Chịu lực cánh tủ bếp & tủ áo.',
  },
  {
    name: 'Chỉ dán cạnh PVC An Cường 1x28mm (Cuộn 100m)',
    sku: 'CHI-PVC-28-AC',
    unit: 'Cuộn',
    category: 'Chỉ nẹp & Keo dán',
    stock_level: 18,
    min_stock_level: 8,
    price_per_unit: 295000,
    notes: 'Nẹp chỉ PVC đồng màu bề mặt Melamine/Laminate.',
  },
  {
    name: 'Keo dán cạnh PUR chống thấm Jowat (Thùng 20kg)',
    sku: 'KEO-PUR-JOWAT',
    unit: 'Thùng',
    category: 'Chỉ nẹp & Keo dán',
    stock_level: 6,
    min_stock_level: 4,
    price_per_unit: 3450000,
    notes: 'Chạy máy dán cạnh tự động CNC xưởng.',
  },
  {
    name: 'Sơn lót & Sơn phủ PU Inchem 2K (Bộ 20kg)',
    sku: 'SON-INCHEM-PU',
    unit: 'Bộ',
    category: 'Sơn & Hoàn thiện',
    stock_level: 9,
    min_stock_level: 4,
    price_per_unit: 4200000,
    notes: 'Sơn hoàn thiện cánh Shaker & veneer gỗ tự nhiên.',
  },
  {
    name: 'Đá nhân tạo Vicostone Misterio BQ8660 (Khổ 20mm)',
    sku: 'DA-VICO-BQ8660',
    unit: 'm²',
    category: 'Đá, Kính & Kim loại',
    stock_level: 22,
    min_stock_level: 10,
    price_per_unit: 3850000,
    notes: 'Mặt bàn đảo bếp & lavabo cao cấp.',
  },
];

const LOG_REASON_LABELS: Record<string, string> = {
  session_consumption: 'Xuất kho công trình / xưởng',
  restock: 'Nhập kho bổ sung',
  transfer_receipt: 'Nhập kho từ đơn đặt hàng',
  transfer_shipment: 'Xuất chuyển kho công trình',
  initial: 'Tồn kho ban đầu',
  monthly_reconciliation: 'Kiểm kê hao hụt tháng',
};

const TRANSFER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt mua/cấp',
  approved: 'Đã duyệt đặt hàng',
  shipped: 'Đang vận chuyển về xưởng',
  completed: 'Đã nhập kho xưởng',
  cancelled: 'Đã hủy',
};

const formatVnd = (value: number): string =>
  `${Math.round(value).toLocaleString('vi-VN')}đ`;

const createBlankInteriorItem = (): NewInventoryItem => ({
  name: '',
  sku: '',
  unit: 'Tấm',
  stock_level: 0,
  min_stock_level: BUSINESS_RULES.INVENTORY.LOW_STOCK_THRESHOLD,
  price_per_unit: 0,
  category: INTERIOR_MATERIAL_CATEGORIES[0],
});

export function InteriorInventoryView() {
  const {
    activeTab,
    setActiveTab,
    items,
    loading,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    orders,
    loadingOrders,
    showCreateRequest,
    setShowCreateRequest,
    requestCart,
    setRequestCart,
    selectedItemIndex,
    setSelectedItemIndex,
    requestQty,
    setRequestQty,
    requestNotes,
    setRequestNotes,
    submittingOrder,
    processingOrderId,
    logMonth,
    setLogMonth,
    logYear,
    setLogYear,
    restockTarget,
    setRestockTarget,
    restockAmt,
    setRestockAmt,
    submitting,
    showAdd,
    setShowAdd,
    newItem,
    setNewItem,
    reconMonth,
    setReconMonth,
    reconYear,
    setReconYear,
    reconRows,
    reconLoading,
    reconSaving,
    filteredLogs,
    lowCount,
    handleSaveReconciliation,
    updateReconRow,
    handleRestock,
    handleAddItem,
    addToCart,
    removeFromCart,
    submitTransferOrder,
    handleConfirmReceipt,
    handleCancelOrder,
    refreshPageData,
  } = useInventoryPageState();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [seedingCatalog, setSeedingCatalog] = useState(false);

  // Project dispatch modal state (real DB consumption linked to project name in audit notes)
  const [projects, setProjects] = useState<InteriorProjectOption[]>([]);
  const [dispatchTarget, setDispatchTarget] = useState<InventoryItem | null>(null);
  const [dispatchQty, setDispatchQty] = useState<number>(1);
  const [dispatchProjectId, setDispatchProjectId] = useState<string>('');
  const [dispatchNote, setDispatchNote] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      try {
        const res = await fetch('/api/interior/projects', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as {
          success?: boolean;
          data?: { projects?: Array<{ id?: unknown; name?: unknown; code?: unknown }> };
        };
        const rows = json.data?.projects ?? [];
        const parsed: InteriorProjectOption[] = [];
        for (const row of rows) {
          if (typeof row.id === 'string' && typeof row.name === 'string') {
            parsed.push({
              id: row.id,
              name: row.name,
              code: typeof row.code === 'string' ? row.code : '',
            });
          }
        }
        if (active) {
          setProjects(parsed);
          if (parsed.length > 0 && !dispatchProjectId) {
            setDispatchProjectId(parsed[0].id);
          }
        }
      } catch (err) {
        console.error('[InteriorInventoryView.loadProjects]', err);
      }
    };
    void loadProjects();
    return () => {
      active = false;
    };
  }, [dispatchProjectId]);

  usePageRefresh(() => {
    void refreshPageData();
  });

  const interiorTab: InteriorTabKey =
    activeTab === 'sales' ? 'stock' : activeTab;

  const totalInventoryValue = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.stock_level || 0) * Number(item.price_per_unit || 0),
        0
      ),
    [items]
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q);
      const isLow = item.stock_level <= item.min_stock_level;
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && isLow) ||
        (stockFilter === 'ok' && !isLow);
      const matchesCategory =
        categoryFilter === 'all' || (item.category || '') === categoryFilter;
      return matchesSearch && matchesStock && matchesCategory;
    });
  }, [categoryFilter, items, search, stockFilter]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const cat = item.category || 'Khác';
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const projectDispatchLogs = useMemo(
    () => filteredLogs.filter((log) => Number(log.change_amount) < 0),
    [filteredLogs]
  );

  const handleOpenAddModal = () => {
    setNewItem(createBlankInteriorItem());
    setShowAdd(true);
  };

  const handleSeedStarterCatalog = async () => {
    if (seedingCatalog) return;
    setSeedingCatalog(true);
    try {
      const existingSkus = new Set(
        items.map((item) => (item.sku || '').trim().toUpperCase()).filter(Boolean)
      );
      let inserted = 0;
      for (const entry of INTERIOR_STARTER_CATALOG) {
        if (existingSkus.has(entry.sku.toUpperCase())) continue;
        const result = await addInventoryItem(entry);
        if (result.success) {
          inserted += 1;
        }
      }
      if (inserted > 0) {
        toast.success(`Đã nạp ${inserted} vật tư chuẩn Nội thất vào kho.`);
        await refreshPageData();
      } else {
        toast.info('Danh mục vật tư chuẩn Nội thất đã có sẵn trong kho.');
      }
    } catch (err) {
      console.error('[InteriorInventoryView.seed]', err);
      toast.error('Không thể nạp danh mục vật tư mẫu.');
    } finally {
      setSeedingCatalog(false);
    }
  };

  const handleOpenDispatch = (item: InventoryItem) => {
    setDispatchTarget(item);
    setDispatchQty(1);
    setDispatchNote('');
  };

  const handleSubmitDispatch = async () => {
    if (!dispatchTarget) return;
    if (!Number.isFinite(dispatchQty) || dispatchQty <= 0) {
      toast.error('Vui lòng nhập số lượng xuất kho lớn hơn 0.');
      return;
    }
    if (dispatchQty > dispatchTarget.stock_level) {
      toast.error(`Tồn kho chỉ còn ${dispatchTarget.stock_level} ${dispatchTarget.unit}.`);
      return;
    }
    setDispatching(true);
    try {
      const selectedProject = projects.find((p) => p.id === dispatchProjectId);
      const projectLabel = selectedProject
        ? `${selectedProject.code ? `${selectedProject.code} - ` : ''}${selectedProject.name}`
        : 'Xưởng gia công nội thất';
      const noteText = dispatchNote.trim()
        ? `Xuất dự án [${projectLabel}]: ${dispatchNote.trim()}`
        : `Xuất vật tư cho dự án [${projectLabel}]`;

      const res = await consumeInventory(
        dispatchTarget.id,
        dispatchQty,
        undefined,
        noteText
      );
      if (!res.success) {
        toast.error(res.error || 'Không thể xuất kho vật tư.');
        return;
      }
      toast.success(`Đã xuất ${dispatchQty} ${dispatchTarget.unit} "${dispatchTarget.name}" cho ${projectLabel}.`);
      setDispatchTarget(null);
      await refreshPageData();
    } catch (err) {
      console.error('[InteriorInventoryView.dispatch]', err);
      toast.error('Lỗi khi xuất kho cho công trình.');
    } finally {
      setDispatching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <RefreshCw className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-auto bg-background/30 p-3 sm:p-6 md:space-y-8 md:p-10">
      {/* ── HEADER & INTERIOR KPI SUMMARY ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            <Layers className="h-3.5 w-3.5" />
            <span>Kho Xưởng Sản Xuất &amp; Vật Tư Công Trình</span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-[#EFE9E1] sm:text-3xl">
            Quản Lý Kho Vật Tư Nội Thất
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-[#CDBCAB]/70">
            Theo dõi gỗ ván công nghiệp, phụ kiện kim khí, phụ liệu hoàn thiện và xuất nhập kho theo từng dự án thi công.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="customer-detail-card flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg dark:border-[#3E3A35]/60 dark:bg-[#1C1B19] sm:min-w-[165px]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mã vật tư</p>
              <p className="text-xl font-black text-slate-900 dark:text-[#EFE9E1]">{items.length}</p>
            </div>
          </div>

          <div className="customer-detail-card flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg dark:border-[#3E3A35]/60 dark:bg-[#1C1B19] sm:min-w-[165px]">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                lowCount > 0
                  ? 'animate-pulse bg-amber-50 text-amber-500 dark:bg-amber-500/15'
                  : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15'
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chạm ngưỡng tồn</p>
              <p className="text-xl font-black text-slate-900 dark:text-[#EFE9E1]">{lowCount}</p>
            </div>
          </div>

          <div className="customer-detail-card flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg dark:border-[#3E3A35]/60 dark:bg-[#1C1B19] sm:min-w-[205px]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giá trị tồn kho</p>
              <p className="truncate text-lg font-black tabular-nums text-slate-900 dark:text-[#EFE9E1]">
                {formatVnd(totalInventoryValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── INTERIOR WAREHOUSE TABS ── */}
      <div className="flex gap-4 overflow-x-auto border-b border-slate-200 pb-px dark:border-[#3E3A35]/60 sm:gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={cn(
            'no-pill flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
            interiorTab === 'stock'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-[#EFE9E1]'
          )}
        >
          <Package className="h-4 w-4" /> Tồn kho Vật tư &amp; Phụ kiện
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={cn(
            'no-pill flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
            interiorTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-[#EFE9E1]'
          )}
        >
          <Truck className="h-4 w-4" /> Đề xuất Mua &amp; Cấp Vật tư
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reconciliation')}
          className={cn(
            'no-pill flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
            interiorTab === 'reconciliation'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-[#EFE9E1]'
          )}
        >
          <ClipboardCheck className="h-4 w-4" /> Kiểm kê Hao hụt Xưởng
        </button>
      </div>

      {/* ── MAIN WORKSPACE + LOGS SIDEBAR ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
        <div className="space-y-6 xl:col-span-2">
          {interiorTab === 'stock' ? (
            <div className="space-y-6">
              {/* Category Chips Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all',
                    categoryFilter === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-primary/40 dark:bg-[#1C1B19] dark:border-[#3E3A35] dark:text-[#CDBCAB]'
                  )}
                >
                  Tất cả nhóm ({items.length})
                </button>
                {INTERIOR_MATERIAL_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all',
                      categoryFilter === category
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/40 dark:bg-[#1C1B19] dark:border-[#3E3A35] dark:text-[#CDBCAB]'
                    )}
                  >
                    {category} ({categoryCounts.get(category) ?? 0})
                  </button>
                ))}
              </div>

              {/* Search + Filters + Add CTA */}
              <div className="customer-detail-card bella-toolbar flex flex-col gap-3 rounded-[2rem] border border-slate-100 bg-white p-4 shadow-xl dark:border-[#3E3A35]/60 dark:bg-[#1C1B19] sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên ván gỗ, phụ kiện Blum/Hafele, mã SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-2xl bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                </div>
                <PremiumSelect
                  value={stockFilter}
                  onChange={(value) => setStockFilter(value as 'all' | 'low' | 'ok')}
                  options={[
                    { value: 'all', label: `Tất cả (${items.length})` },
                    { value: 'low', label: `Chạm ngưỡng tồn (${lowCount})` },
                    { value: 'ok', label: `Sẵn sàng xuất (${Math.max(0, items.length - lowCount)})` },
                  ]}
                  buttonClassName="min-h-11 rounded-2xl border-slate-200 bg-slate-50 px-4 text-xs font-black text-slate-700 hover:border-primary/30 hover:bg-white dark:bg-[#11100F] dark:border-[#3E3A35] dark:text-[#EFE9E1] sm:w-[195px]"
                />
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:bg-primary-hover active:scale-95 sm:whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" /> Thêm Vật tư Nội thất
                </button>
              </div>

              {/* Starter Catalog Callout when empty */}
              {items.length === 0 && (
                <div className="flex flex-col items-start justify-between gap-4 rounded-[2rem] border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span>Khởi tạo nhanh Kho Nội thất chuẩn thực tế</span>
                    </div>
                    <p className="text-xs font-medium text-slate-600 dark:text-[#CDBCAB]">
                      Nạp sẵn 8 nhóm vật tư lõi (Ván MDF/Plywood An Cường, Ray Blum, Bản lề Hafele, Chỉ PVC, Keo PUR Jowat, Sơn Inchem, Đá Vicostone) vào cơ sở dữ liệu kho của doanh nghiệp.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSeedStarterCatalog}
                    disabled={seedingCatalog}
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-slate-800 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
                  >
                    {seedingCatalog ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Nạp 8 vật tư chuẩn Nội thất
                  </button>
                </div>
              )}

              {/* Inventory Table */}
              <div className="customer-detail-card w-full overflow-x-auto overscroll-x-contain rounded-[2rem] border border-slate-100 bg-white shadow-xl dark:border-[#3E3A35]/60 dark:bg-[#1C1B19] custom-scrollbar">
                <table className="bella-data-table min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 dark:border-[#3E3A35]/40 dark:bg-[#11100F]/50">
                      {['Vật tư & Quy cách', 'Nhóm / SKU', 'Tồn kho xưởng', 'Đơn giá & Thành tiền', 'Thao tác kho'].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                    {visibleItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-8 py-16 text-center text-sm font-semibold text-slate-400"
                        >
                          Không tìm thấy vật tư phù hợp trong kho xưởng.
                        </td>
                      </tr>
                    ) : (
                      visibleItems.map((item) => {
                        const isLow = item.stock_level <= item.min_stock_level;
                        const progress = Math.min(
                          100,
                          (item.stock_level / Math.max(1, item.min_stock_level * 2)) * 100
                        );
                        const itemTotal =
                          Number(item.stock_level || 0) * Number(item.price_per_unit || 0);
                        return (
                          <tr
                            key={item.id}
                            className="group transition-colors hover:bg-slate-50/60 dark:hover:bg-[#11100F]/20"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                                    isLow
                                      ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/15'
                                      : 'bg-slate-100 text-slate-500 dark:bg-[#2A2724] dark:text-[#CDBCAB]'
                                  )}
                                >
                                  <Package className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 dark:text-[#EFE9E1]">
                                    {item.name}
                                  </p>
                                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    ĐVT: {item.unit} • Định mức tối thiểu: {item.min_stock_level} {item.unit}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="space-y-1">
                                <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-black text-slate-600 dark:bg-[#2A2724] dark:text-[#EFE9E1]">
                                  {item.sku || 'CHUA-GAN-SKU'}
                                </span>
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#CDBCAB]/70">
                                  {item.category || 'Vật tư nội thất'}
                                </p>
                              </div>
                            </td>

                            <td className="min-w-[165px] whitespace-nowrap px-6 py-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      'text-sm font-black tabular-nums',
                                      isLow ? 'text-rose-500' : 'text-slate-900 dark:text-[#EFE9E1]'
                                    )}
                                  >
                                    {item.stock_level.toLocaleString('vi-VN')} {item.unit}
                                  </span>
                                  {isLow && (
                                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-500 dark:bg-rose-500/15">
                                      Cần nhập
                                    </span>
                                  )}
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#2A2724]">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-500',
                                      isLow ? 'bg-rose-500' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="whitespace-nowrap px-6 py-4">
                              <p className="text-xs font-black tabular-nums text-slate-700 dark:text-[#EFE9E1]">
                                {formatVnd(Number(item.price_per_unit || 0))} / {item.unit}
                              </p>
                              <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-400">
                                Tồn: {formatVnd(itemTotal)}
                              </p>
                            </td>

                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestockTarget(item);
                                    setRestockAmt(10);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 transition-all hover:bg-emerald-600 hover:text-white dark:bg-emerald-500/15 dark:text-emerald-400"
                                >
                                  <ArrowDownLeft className="h-3.5 w-3.5" /> Nhập kho
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDispatch(item)}
                                  disabled={item.stock_level <= 0}
                                  className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 transition-all hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2A2724] dark:text-[#EFE9E1]"
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" /> Xuất dự án
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : interiorTab === 'requests' ? (
            <div className="customer-detail-card overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-xl dark:border-[#3E3A35]/60 dark:bg-[#1C1B19]">
              <div className="bella-toolbar flex flex-col gap-4 border-b border-slate-100 p-6 dark:border-[#3E3A35]/40 sm:p-8 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-[#EFE9E1]">
                    <ClipboardList className="h-5 w-5 text-primary" /> Đề xuất Mua &amp; Cấp Vật tư Xưởng
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Quản lý phiếu đề xuất vật tư gửi bộ phận Thu mua (PO) hoặc cấp phát cho đội thi công.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRequestCart([]);
                    setSelectedItemIndex(-1);
                    setRequestQty(0);
                    setRequestNotes('');
                    setShowCreateRequest(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:bg-primary-hover active:scale-95"
                >
                  <ShoppingCart className="h-4 w-4" /> Tạo Phiếu Đề Xuất
                </button>
              </div>

              <div className="w-full overflow-x-auto overscroll-x-contain custom-scrollbar">
                <table className="bella-data-table min-w-[820px] text-left">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-[#11100F]/50">
                      {['Mã phiếu', 'Ngày lập', 'Vật tư đề xuất', 'Trạng thái', 'Nhà cung cấp / Giao nhận', 'Thao tác'].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-16 text-center">
                          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-16 text-center text-xs font-semibold text-slate-400">
                          Chưa có phiếu đề xuất mua hoặc cấp vật tư nào.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => (
                        <tr key={ord.id} className="text-xs transition-colors hover:bg-slate-50/40">
                          <td className="whitespace-nowrap px-6 py-4 font-mono font-black text-slate-800 dark:text-[#EFE9E1]">
                            {ord.order_number}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                            {new Date(ord.created_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {ord.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1 text-[11px] dark:bg-[#11100F]"
                                >
                                  <span className="truncate font-bold text-slate-700 dark:text-[#EFE9E1]">{it.name}</span>
                                  <span className="shrink-0 font-black text-primary">
                                    x{it.qty} {it.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={cn(
                                'rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider',
                                ord.status === 'pending' && 'bg-amber-50 text-amber-600',
                                ord.status === 'approved' && 'bg-blue-50 text-blue-600',
                                ord.status === 'shipped' && 'bg-purple-50 text-purple-600',
                                ord.status === 'completed' && 'bg-emerald-50 text-emerald-600',
                                ord.status === 'cancelled' && 'bg-slate-100 text-slate-500'
                              )}
                            >
                              {TRANSFER_STATUS_LABELS[ord.status] || ord.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-[11px]">
                            {ord.shipping_carrier ? (
                              <div>
                                <p className="font-black text-slate-800 dark:text-[#EFE9E1]">{ord.shipping_carrier}</p>
                                <p className="mt-0.5 font-mono text-slate-400">{ord.tracking_number}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex items-center gap-2">
                              {ord.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={processingOrderId === ord.id}
                                  onClick={() => handleCancelOrder(ord.id)}
                                  className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 disabled:opacity-50"
                                >
                                  Hủy phiếu
                                </button>
                              )}
                              {ord.status === 'shipped' && (
                                <button
                                  type="button"
                                  disabled={processingOrderId === ord.id}
                                  onClick={() => handleConfirmReceipt(ord.id)}
                                  className="rounded-xl bg-emerald-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-600 disabled:opacity-60"
                                >
                                  Xác nhận nhập kho
                                </button>
                              )}
                              {ord.status !== 'pending' && ord.status !== 'shipped' && (
                                <span className="text-[11px] font-semibold text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <InventoryReconciliationPanel
              reconMonth={reconMonth}
              reconYear={reconYear}
              reconRows={reconRows}
              reconLoading={reconLoading}
              reconSaving={reconSaving}
              setReconMonth={setReconMonth}
              setReconYear={setReconYear}
              updateReconRow={updateReconRow}
              handleSaveReconciliation={handleSaveReconciliation}
            />
          )}
        </div>

        {/* ── RIGHT SIDEBAR: INTERIOR WAREHOUSE LOGS ── */}
        <div className="xl:col-span-1">
          <div className="customer-detail-card flex h-full flex-col rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl dark:border-[#3E3A35]/60 dark:bg-[#1C1B19] sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-[#EFE9E1]">
                <History className="h-5 w-5 text-primary" /> Nhật ký Kho Xưởng
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 dark:bg-[#2A2724] dark:text-[#CDBCAB]">
                {projectDispatchLogs.length} xuất / {filteredLogs.length} GD
              </span>
            </div>

            <div className="mb-5 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-[#11100F]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Lọc kỳ xuất nhập kho
              </p>
              <div className="bella-toolbar grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PremiumSelect
                  value={String(logMonth)}
                  onChange={(value) => setLogMonth(Number(value))}
                  options={MONTHS.map((m, idx) => ({ value: String(idx), label: m }))}
                  buttonClassName="min-h-10 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:border-primary/30 dark:bg-[#1C1B19] dark:border-[#3E3A35] dark:text-[#EFE9E1]"
                />
                <PremiumSelect
                  value={String(logYear)}
                  onChange={(value) => setLogYear(Number(value))}
                  options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
                  buttonClassName="min-h-10 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:border-primary/30 dark:bg-[#1C1B19] dark:border-[#3E3A35] dark:text-[#EFE9E1]"
                />
              </div>
              <div className="flex justify-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {filteredLogs.length} giao dịch trong kỳ
                </span>
              </div>
            </div>

            <div className="custom-scrollbar max-h-[600px] flex-1 space-y-3 overflow-y-auto pr-1">
              {filteredLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <History className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                  <p className="text-xs font-bold text-slate-400">Chưa có giao dịch xuất/nhập kho trong kỳ này</p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-2xl border border-transparent bg-slate-50/70 p-3.5 transition-all hover:border-primary/15 hover:bg-white dark:bg-[#11100F]/60 dark:hover:bg-[#1C1B19]"
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                        log.change_amount > 0
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15'
                          : 'bg-rose-50 text-rose-500 dark:bg-rose-500/15'
                      )}
                    >
                      {log.change_amount > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-slate-800 dark:text-[#EFE9E1]">
                        {log.inventory_items?.name || 'Vật tư nội thất'}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-[#CDBCAB]">
                        {LOG_REASON_LABELS[log.reason] || log.reason}
                        {log.notes ? ` — ${log.notes}` : ''}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-xs font-black tabular-nums',
                        log.change_amount > 0 ? 'text-emerald-600' : 'text-rose-500'
                      )}
                    >
                      {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}{' '}
                      {log.inventory_items?.unit || ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: NHẬP KHO (RESTOCK) ── */}
      <InventoryRestockModal
        target={restockTarget}
        restockAmt={restockAmt}
        submitting={submitting}
        setRestockAmt={setRestockAmt}
        onClose={() => setRestockTarget(null)}
        onSubmit={handleRestock}
      />

      {/* ── MODAL: TẠO PHIẾU ĐỀ XUẤT MUA / CẤP VẬT TƯ ── */}
      <InventoryCreateRequestModal
        show={showCreateRequest}
        items={items}
        requestCart={requestCart}
        selectedItemIndex={selectedItemIndex}
        requestQty={requestQty}
        requestNotes={requestNotes}
        submittingOrder={submittingOrder}
        setSelectedItemIndex={setSelectedItemIndex}
        setRequestQty={setRequestQty}
        setRequestNotes={setRequestNotes}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        submitTransferOrder={submitTransferOrder}
        onClose={() => setShowCreateRequest(false)}
      />

      {/* ── MODAL: THÊM VẬT TƯ NỘI THẤT MỚI ── */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div
            onClick={() => setShowAdd(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-[#1C1B19] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-[#EFE9E1]">
                  Thêm Vật Tư Nội Thất Mới
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  Khai báo mã gỗ ván, phụ kiện kim khí, sơn/keo hoặc vật liệu hoàn thiện vào kho xưởng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2724]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Tên vật tư &amp; Quy cách *
                </label>
                <input
                  type="text"
                  placeholder="VD: Ván MDF chống ẩm An Cường 17mm lõi xanh..."
                  value={newItem.name}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Mã vật tư (SKU)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: VAN-MDF17-AC"
                    value={newItem.sku}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, sku: e.target.value }))}
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Nhóm vật tư Nội thất
                  </label>
                  <PremiumSelect
                    value={newItem.category || INTERIOR_MATERIAL_CATEGORIES[0]}
                    onChange={(val) => setNewItem((prev) => ({ ...prev, category: val }))}
                    options={INTERIOR_MATERIAL_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                    buttonClassName="min-h-11 w-full rounded-2xl border-transparent bg-slate-50 px-4 text-xs font-bold text-slate-800 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Đơn vị tính *
                  </label>
                  <PremiumSelect
                    value={newItem.unit || 'Tấm'}
                    onChange={(val) => setNewItem((prev) => ({ ...prev, unit: val }))}
                    options={INTERIOR_UNITS.map((u) => ({ value: u, label: u }))}
                    buttonClassName="min-h-11 w-full rounded-2xl border-transparent bg-slate-50 px-4 text-xs font-bold text-slate-800 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Đơn giá dự toán (VND)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="385000"
                    value={newItem.price_per_unit === 0 ? '' : String(newItem.price_per_unit)}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        price_per_unit: e.target.value === '' ? 0 : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Tồn kho ban đầu
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={newItem.stock_level === 0 ? '' : String(newItem.stock_level)}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        stock_level: e.target.value === '' ? 0 : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Định mức tồn tối thiểu
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="10"
                    value={newItem.min_stock_level === 0 ? '' : String(newItem.min_stock_level)}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        min_stock_level: e.target.value === '' ? 0 : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={submitting}
                className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Lưu Vật Tư Vào Kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: XUẤT KHO THEO DỰ ÁN / CÔNG TRÌNH ── */}
      {dispatchTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div
            onClick={() => setDispatchTarget(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-[#1C1B19] sm:p-8">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-[#EFE9E1]">
                  <Building2 className="h-5 w-5 text-primary" /> Xuất Vật Tư Cho Dự Án
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {dispatchTarget.name} (Hiện tồn: {dispatchTarget.stock_level} {dispatchTarget.unit})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDispatchTarget(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2724]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Dự án / Công trình nhận vật tư
                </label>
                {projects.length > 0 ? (
                  <PremiumSelect
                    value={dispatchProjectId}
                    onChange={setDispatchProjectId}
                    options={projects.map((p) => ({
                      value: p.id,
                      label: `${p.code ? `[${p.code}] ` : ''}${p.name}`,
                    }))}
                    buttonClassName="min-h-11 w-full rounded-2xl border-transparent bg-slate-50 px-4 text-xs font-bold text-slate-800 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                  />
                ) : (
                  <input
                    type="text"
                    readOnly
                    value="Xưởng gia công nội thất"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 dark:bg-[#11100F] dark:text-[#CDBCAB]"
                  />
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Số lượng xuất ({dispatchTarget.unit}) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={dispatchTarget.stock_level}
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(Number(e.target.value))}
                  className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Lệnh sản xuất / Hạng mục thi công
                </label>
                <input
                  type="text"
                  placeholder="VD: Cắt CNC thùng tủ bếp dưới — Tầng 1"
                  value={dispatchNote}
                  onChange={(e) => setDispatchNote(e.target.value)}
                  className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 dark:bg-[#11100F] dark:text-[#EFE9E1]"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setDispatchTarget(null)}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmitDispatch}
                disabled={dispatching}
                className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {dispatching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
                Xác nhận Xuất Kho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
