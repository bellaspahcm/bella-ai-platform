'use client';

import React, { useState, useTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car,
  Search,
  PlusCircle,
  Download,
  Upload,
  ChevronDown,
  AlertCircle,
  X,
  CheckCircle2,
  ArrowRight,
  Info,
  Fuel,
  Cog,
  MapPin,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { VehicleStatusMachineService, type VehicleStatus } from '@/modules/bella-auto/services/VehicleStatusMachineService';
import {
  listMobilityVehicleInventory,
  type MobilityVehicleInventoryItem,
} from '@/platform/mobility/supabase-vehicle-contract';
import { useEffect } from 'react';

type VehicleInventoryItem = MobilityVehicleInventoryItem;

// Status configuration
const STATUS_CONFIG: Record<VehicleStatus, { label: string; bg: string; color: string; border: string }> = {
  in_transit: { label: 'Đang Vận Chuyển', bg: 'bg-amber-50 dark:bg-amber-950/30', color: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200/60 dark:border-amber-900/30' },
  warehouse:  { label: 'Trong Kho',       bg: 'bg-slate-50 dark:bg-slate-950/30', color: 'text-slate-700 dark:text-slate-400', border: 'border-slate-200/60 dark:border-slate-900/30' },
  showroom:   { label: 'Showroom',        bg: 'bg-cyan-50 dark:bg-cyan-950/30',   color: 'text-cyan-700 dark:text-cyan-400',   border: 'border-cyan-200/60 dark:border-cyan-900/30' },
  allocated:  { label: 'Đã Phân Bổ',      bg: 'bg-violet-50 dark:bg-violet-950/30', color: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200/60 dark:border-violet-900/30' },
  delivered:  { label: 'Đã Giao Xe',      bg: 'bg-teal-50 dark:bg-teal-950/30',  color: 'text-teal-700 dark:text-teal-400',   border: 'border-teal-200/60 dark:border-teal-900/30' },
  returned:   { label: 'Đã Trả Lại',      bg: 'bg-blue-50 dark:bg-blue-950/30',   color: 'text-blue-700 dark:text-blue-400',   border: 'border-blue-200/60 dark:border-blue-900/30' },
  scrapped:   { label: 'Thanh Lý/Hủy',    bg: 'bg-red-50 dark:bg-red-950/30',     color: 'text-red-700 dark:text-red-400',     border: 'border-red-200/60 dark:border-red-900/30' },
};

// ── Add Vehicle Modal ─────────────────────────────────────────────────────────
function AddVehicleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    vin: '', colorExterior: '', modelYear: new Date().getFullYear().toString(),
    listPrice: '', chassisNumber: '', engineNumber: '', locationNote: '',
    expectedArrivalDate: '',
  });
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.vin.length !== 17) { toast.error('Số VIN phải đúng 17 ký tự'); return; }
    if (!form.colorExterior) { toast.error('Vui lòng nhập màu ngoại thất'); return; }

      startTransition(async () => {
        try {
          const supabase = createClient();
          await new Promise(r => setTimeout(r, 900)); // Demo delay
          toast.success(`Đã thêm xe VIN ${form.vin} vào kho thành công!`);
          onSuccess();
          onClose();
        } catch (error) {
          console.error('Failed to add vehicle:', error);
          toast.error('Không thể thêm xe');
        }
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-8"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Nhập Xe Mới Vào Kho</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Trạng thái khởi đầu: Đang Vận Chuyển (In Transit)</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Số VIN (17 ký tự) *</label>
              <input
                maxLength={17}
                value={form.vin}
                onChange={e => setForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))}
                placeholder="WBAHF3C01L7D34567"
                className={`w-full px-4 py-3 rounded-xl border outline-none font-mono font-bold text-sm tracking-widest transition-all ${form.vin.length === 17 ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'}`}
              />
              <span className={`text-xs mt-1 block font-semibold ${form.vin.length === 17 ? 'text-emerald-500' : 'text-slate-400'}`}>{form.vin.length}/17 ký tự</span>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Màu Ngoại Thất *</label>
              <input value={form.colorExterior} onChange={e => setForm(f => ({ ...f, colorExterior: e.target.value }))} placeholder="Alpine White" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Năm Sản Xuất *</label>
              <input type="number" value={form.modelYear} onChange={e => setForm(f => ({ ...f, modelYear: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Giá Niêm Yết (VND) *</label>
              <input 
                type="text" 
                value={form.listPrice ? Number(form.listPrice).toLocaleString('vi-VN') : ''} 
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d]/g, ''); // Remove non-digits
                  setForm(f => ({ ...f, listPrice: raw }));
                }} 
                placeholder="2,439,000,000" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" 
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Số Khung</label>
              <input value={form.chassisNumber} onChange={e => setForm(f => ({ ...f, chassisNumber: e.target.value }))} placeholder="KHG7834" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Số Máy</label>
              <input value={form.engineNumber} onChange={e => setForm(f => ({ ...f, engineNumber: e.target.value }))} placeholder="B48A20T0-1234" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Vị Trí Kho / Showroom</label>
              <input value={form.locationNote} onChange={e => setForm(f => ({ ...f, locationNote: e.target.value }))} placeholder="Cảng Cát Lái" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Ngày Dự Kiến Về</label>
              <input type="date" value={form.expectedArrivalDate} onChange={e => setForm(f => ({ ...f, expectedArrivalDate: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white font-bold text-sm transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2">
              {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {isPending ? 'Đang thêm...' : 'Thêm vào kho'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Status Transition Popover ─────────────────────────────────────────────────
function StatusChip({ 
  vehicle, 
  onTransitioned, 
  isOpen, 
  onToggle 
}: { 
  vehicle: VehicleInventoryItem; 
  onTransitioned: () => void;
  isOpen: boolean;
  onToggle: (vehicleId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const cfg = STATUS_CONFIG[vehicle.status] || { 
    label: vehicle.status, 
    bg: 'bg-gray-50 dark:bg-gray-950/30', 
    color: 'text-gray-700 dark:text-gray-400', 
    border: 'border-gray-200/60 dark:border-gray-900/30' 
  };
  const allowed = VehicleStatusMachineService.allowedTransitions(vehicle.status);

  const handleTransition = (toStatus: VehicleStatus) => {
    onToggle('');
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 600));
      const toLabel = STATUS_CONFIG[toStatus]?.label || toStatus;
      toast.success(`Đã chuyển xe ${vehicle.vin.slice(-6)} → ${toLabel}`);
      onTransitioned();
    });
  };

  // Tính vị trí dropdown ngay tại thời điểm click (getBoundingClientRect đã là viewport coords)
  const handleToggle = () => {
    if (!allowed.length) return;
    onToggle(vehicle.id);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-dropdown-id="${vehicle.id}"]`)) {
        onToggle('');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, vehicle.id, onToggle]);

  return (
    <div className="relative" data-dropdown-id={vehicle.id}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={isPending || allowed.length === 0}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${cfg.bg} ${cfg.color} ${cfg.border} ${allowed.length > 0 ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'}`}
      >
        {isPending
          ? <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
          : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        }
        {cfg.label}
        {allowed.length > 0 && !isPending && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full mt-1 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-44"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 pb-1.5">Chuyển sang</p>
            {allowed.map(s => {
              const targetCfg = STATUS_CONFIG[s] || { label: s, color: 'text-gray-700 dark:text-gray-400' };
              return (
                <button
                  key={s}
                  onClick={() => handleTransition(s)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className={`text-xs font-bold ${targetCfg.color}`}>{targetCfg.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VehicleInventoryPage() {
  const { tenantId } = useTenantContext();
  const [vehicles, setVehicles] = useState<VehicleInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleInventoryItem | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Show 50 items per page

  // Fetch vehicles from Supabase
  const fetchVehicles = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        setIsLoading(false);
        return;
      }

      const inventory = await listMobilityVehicleInventory(supabase, { tenantId });

      console.log('[VehiclesPage] Loaded vehicles:', inventory.length);
      console.log('[VehiclesPage] Sample vehicle:', inventory[0]);

      setVehicles(inventory);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      toast.error('Không thể tải danh sách xe');
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Handle dropdown toggle - close others when opening one
  const handleDropdownToggle = useCallback((vehicleId: string) => {
    setOpenDropdownId(prev => prev === vehicleId ? '' : vehicleId);
  }, []);

  // Import CSV handler
  const handleImportCSV = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await new Promise(r => setTimeout(r, 1200));
      toast.success(`Đã nhập ${file.name} — Đang xử lý hàng loạt VIN...`);
    };
    input.click();
  }, []);

  const handleExportCSV = () => {
    const headers = ['VIN', 'Thương Hiệu', 'Dòng Xe', 'Phiên Bản', 'Năm', 'Màu Ngoại Thất', 'Trạng Thái', 'Giá Niêm Yết', 'Vị Trí'];
    const rows = filtered.map(v => [v.vin, v.brandName, v.modelName, v.variantName, v.modelYear, v.colorExterior, STATUS_CONFIG[v.status].label, v.listPrice, v.locationNote ?? '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().getTime(); // Move Date.now() out of render
    a.href = url; a.download = `bella-auto-inventory-${timestamp}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất danh sách kho xe!');
  };

  const filtered = vehicles.filter(v => {
    const matchSearch = !search || v.vin.includes(search.toUpperCase()) || (v.modelName ?? '').toLowerCase().includes(search.toLowerCase()) || (v.variantName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVehicles = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Summary counts
  const counts = vehicles.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-10">
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Đang tải danh sách xe...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 dark:border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-indigo-500/15 dark:from-cyan-500/20 dark:to-indigo-500/5 border border-cyan-100/50 dark:border-cyan-900/30 text-cyan-600 dark:text-cyan-400 shadow-sm shrink-0">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Kho Xe & Số Khung VIN</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Vehicle Lifecycle Center — Quản lý trạng thái vòng đời từng số khung xe</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleImportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs shadow-sm">
            <Upload className="w-4 h-4" /> Nhập CSV/Excel
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all text-xs shadow-md hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0">
            <PlusCircle className="w-4 h-4" /> Nhập Xe Mới
          </button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-200 ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
          }`}
        >
          Tất cả
          <span className="bg-current/10 rounded-md px-1.5 py-0.5 font-extrabold tabular-nums">{vehicles.length}</span>
        </button>
        {(Object.keys(STATUS_CONFIG) as VehicleStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-200 ${
              statusFilter === s
                ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].border} shadow-sm`
                : 'bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800/80 text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            {STATUS_CONFIG[s].label}
            {(counts[s] ?? 0) > 0 && (
              <span className={`rounded-md px-1.5 py-0.5 font-extrabold tabular-nums ${
                statusFilter === s ? 'bg-current/10' : 'bg-slate-100 dark:bg-slate-900'
              }`}>{counts[s] ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm VIN, dòng xe, phiên bản..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-xl focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-xs font-semibold placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-sm"
          />
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all text-xs shadow-sm">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {/* Table */}
      <div className={`bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] ${openDropdownId ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className={openDropdownId ? "overflow-x-auto overflow-y-visible" : "overflow-x-auto"}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-900 text-[10px] font-extrabold uppercase text-slate-400 tracking-widest">
                <th className="py-4 px-5">Xe & Phiên Bản</th>
                <th className="py-4 px-5">Số VIN / Số Khung</th>
                <th className="py-4 px-5">Màu Sắc</th>
                <th className="py-4 px-5">Trạng Thái</th>
                <th className="py-4 px-5">Vị Trí</th>
                <th className="py-4 px-5 text-right">Giá Niêm Yết</th>
                <th className="py-4 px-5">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-900/80">
              {paginatedVehicles.length > 0 ? paginatedVehicles.map((vehicle, idx) => (
                <motion.tr
                  key={vehicle.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-all text-xs group"
                >
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-900 dark:text-white">{vehicle.brandName} {vehicle.modelName}</div>
                    <div className="text-xs text-slate-400 font-semibold">{vehicle.variantName} · {vehicle.modelYear}</div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-mono font-bold text-xs tracking-widest text-indigo-600 dark:text-indigo-400">{vehicle.vin}</div>
                    {vehicle.chassisNumber && <div className="text-[10px] text-slate-400 font-mono mt-0.5">Khung: {vehicle.chassisNumber}</div>}
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-slate-200 bg-slate-100" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{vehicle.colorExterior}</span>
                    </div>
                    {vehicle.colorInterior && <div className="text-[10px] text-slate-400 mt-0.5 font-semibold">Nội thất: {vehicle.colorInterior}</div>}
                  </td>
                  <td className="py-4 px-5 overflow-visible">
                    <StatusChip 
                      vehicle={vehicle} 
                      onTransitioned={() => {
                        void fetchVehicles();
                      }}
                      isOpen={openDropdownId === vehicle.id}
                      onToggle={handleDropdownToggle}
                    />
                  </td>
                  <td className="py-4 px-5">
                    {vehicle.locationNote ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">{vehicle.locationNote}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 font-semibold italic">—</span>
                    )}
                    {vehicle.expectedArrivalDate && (
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] text-amber-600 font-bold">Dự kiến: {vehicle.expectedArrivalDate}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {(vehicle.listPrice / 1_000_000_000).toFixed(3)}B
                    </span>
                    <span className="text-[10px] text-slate-400 block">đồng</span>
                  </td>
                  <td className="py-4 px-5">
                    <button
                      onClick={() => setSelectedVehicle(vehicle === selectedVehicle ? null : vehicle)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 text-slate-500 transition-all"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </motion.tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold italic text-sm">Không tìm thấy xe nào khớp với điều kiện lọc</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Drawer */}
        <AnimatePresence>
          {selectedVehicle && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 bg-slate-50/40 dark:bg-slate-900/20 grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  { label: 'Số Máy', value: selectedVehicle.engineNumber ?? '—', mono: true },
                  { label: 'Giá Vốn', value: `${(selectedVehicle.costPrice / 1_000_000).toLocaleString('vi-VN')} tr.đ`, mono: false },
                  { label: 'Ngày Về Kho', value: selectedVehicle.actualArrivalDate ?? '—', mono: false },
                  { label: 'Lần Cập Nhật', value: new Date(selectedVehicle.updatedAt).toLocaleDateString('vi-VN'), mono: false },
                ].map((item, i) => (
                  <div key={i} className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl p-3.5">
                    <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">{item.label}</p>
                    <p className={`font-bold text-xs text-slate-700 dark:text-slate-200 ${item.mono ? 'font-mono tracking-wider' : ''}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            Hiển thị <span className="text-slate-900 dark:text-white font-bold">{startIndex + 1}</span> đến{' '}
            <span className="text-slate-900 dark:text-white font-bold">{Math.min(endIndex, filtered.length)}</span> trong tổng số{' '}
            <span className="text-slate-900 dark:text-white font-bold">{filtered.length}</span> xe
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              ← Trước
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Tiếp →
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddVehicleModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              void fetchVehicles();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
