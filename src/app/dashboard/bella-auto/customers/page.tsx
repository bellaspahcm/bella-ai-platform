'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Search, 
  Car, 
  Settings, 
  TrendingUp, 
  Plus, 
  Compass, 
  CheckCircle,
  HelpCircle,
  Clock,
  ArrowUpRight,
  Filter,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { type OwnedVehicle, type AutoCustomerProfile } from '@/modules/bella-auto/services/AutoCustomerProvider';

type Customer = { id: string; name_mother: string; phone: string; address: string | null };
type CustomerDetail = { customer: Customer; profile: AutoCustomerProfile | null; ownedVehicles: OwnedVehicle[] };
const emptyPreferences = { brands: '', segments: '', budget: '', purpose: '' };

export default function Customer360Page() {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [customers, setCustomers] = useState<Customer[]>([]), [count, setCount] = useState(0), [page, setPage] = useState(1);
  const [detail, setDetail] = useState<CustomerDetail | null>(null), [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false), [error, setError] = useState('');
  const [prefForm, setPrefForm] = useState(emptyPreferences);
  const activeCustomer = detail?.customer.id === selectedCustomerId ? detail.customer : undefined;
  const activeProfile = detail?.profile;
  const activeVehicles = detail?.ownedVehicles ?? [];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/bella-auto/customers?${new URLSearchParams({ q: searchQuery, page: String(page) })}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Không tải được danh sách khách hàng.');
        const result = await response.json() as { customers: Customer[]; count: number };
        if (controller.signal.aborted) return;
        setCustomers(result.customers); setCount(result.count);
        setSelectedCustomerId(previous => result.customers.some(customer => customer.id === previous) ? previous : result.customers[0]?.id || '');
      } catch (caught: unknown) {
        if (!controller.signal.aborted) { setCustomers([]); setSelectedCustomerId(''); setError(caught instanceof Error ? caught.message : 'Không tải được khách hàng.'); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery, page]);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null); setPrefForm(emptyPreferences);
    if (!selectedCustomerId) { setDetailsLoading(false); return; }
    setDetailsLoading(true); setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/bella-auto/customers/${selectedCustomerId}/profile`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Không tải được hồ sơ khách hàng.');
        const result = await response.json() as CustomerDetail;
        if (controller.signal.aborted) return;
        setDetail(result);
        setPrefForm({ brands: result.profile?.preferredBrands.join(', ') || '', segments: result.profile?.preferredSegments.join(', ') || '',
          budget: result.profile?.budgetRange || '', purpose: result.profile?.purchasingPurpose || '' });
      } catch (caught: unknown) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Không tải được hồ sơ.');
      } finally { if (!controller.signal.aborted) setDetailsLoading(false); }
    })();
    return () => controller.abort();
  }, [selectedCustomerId]);

  const handleUpdatePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer || loading || detailsLoading || isPending) return;
    startTransition(async () => {
      setError('');
      try {
        const response = await fetch(`/api/bella-auto/customers/${activeCustomer.id}/profile`, { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            preferredBrands: prefForm.brands.split(',').map(s => s.trim()).filter(Boolean),
            preferredSegments: prefForm.segments.split(',').map(s => s.trim()).filter(Boolean),
            budgetRange: prefForm.budget.trim() || null, purchasingPurpose: prefForm.purpose.trim() || null,
          }) });
        if (!response.ok) throw new Error('Không xác minh được thay đổi đã lưu. Vui lòng tải lại trước khi thử lại.');
        setDetail(await response.json() as CustomerDetail);
        toast.success('Đã cập nhật sở thích xe của khách hàng!');
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : 'Không lưu được sở thích.';
        setError(message); toast.error(message);
      }
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      {/* Header */}
      <div className="border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <User className="w-8 h-8 text-indigo-600" />
          Hồ Sơ Khách Hàng 360°
        </h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Automotive View — Quản lý lịch sử sở hữu phương tiện, sở thích và hành vi của chủ xe
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Customers list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc SĐT..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              disabled={isPending}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
            />
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {loading && <p role="status">Đang tải khách hàng...</p>}
            {!loading && !customers.length && !error && <p>Không có khách hàng.</p>}
            {customers.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCustomerId(c.id)}
                disabled={isPending}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${c.id === selectedCustomerId ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{c.name_mother}</div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{c.phone}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <button aria-label="Trang khách hàng trước" disabled={page <= 1 || loading || isPending} onClick={() => setPage(value => value - 1)}><ArrowUpRight className="size-4 rotate-[-135deg]" /></button>
            <span>{page} / {Math.max(1, Math.ceil(count / 50))}</span>
            <button aria-label="Trang khách hàng tiếp" disabled={page * 50 >= count || loading || isPending} onClick={() => setPage(value => value + 1)}><ArrowUpRight className="size-4 rotate-45" /></button>
          </div>
        </div>

        {/* Right Side: Automotive details & Customer 360 */}
        <div className="lg:col-span-2 space-y-6">
          {detailsLoading && <p role="status">Đang tải hồ sơ...</p>}
          {activeCustomer && <>
          
          {/* Card 1: Core profile with quick statistics */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3 flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 font-bold text-lg">
                {activeCustomer.name_mother.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">{activeCustomer.name_mother}</h3>
                <p className="text-xs text-slate-400 font-semibold">{activeCustomer.phone} · {activeCustomer.address}</p>
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Số xe đang sở hữu</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-baseline gap-1.5">
                {activeProfile?.totalVehiclesOwned || 0}
                <span className="text-xs text-slate-400 font-bold">chiếc</span>
              </p>
            </div>
            
            <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ngân sách quan tâm</span>
              <p className="text-sm font-bold text-slate-850 dark:text-slate-100 mt-2 flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-indigo-500" />
                {activeProfile?.budgetRange || 'Chưa thiết lập'}
              </p>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Giá trị chi tiêu (Xe)</span>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-2">
                {((activeProfile?.totalValueSpent || 0) / 1_000_000_000).toFixed(3)}B VND
              </p>
            </div>
          </div>

          {/* Card 2: Owned Vehicles list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Car className="w-4 h-4" /> Phương Tiện Sở Hữu
            </h4>
            
            <div className="space-y-3">
              {activeVehicles.length > 0 ? activeVehicles.map(v => (
                <div key={v.ownerRecordId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/30 dark:bg-slate-950/10 rounded-2xl border border-slate-150/60 dark:border-slate-800 gap-4">
                  <div>
                    <div className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{v.brandName} {v.modelName}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{v.variantName} · {v.modelYear}</div>
                    <div className="font-mono text-[10px] text-indigo-500 font-bold mt-1 tracking-wider">VIN: {v.vin}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg px-2 py-1">Biển số: {v.licensePlate || 'Chưa ĐK'}</span>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">Đăng ký: {v.registrationDate}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-slate-400 italic text-xs font-semibold">Khách hàng hiện chưa sở hữu xe nào trong hệ thống.</div>
              )}
            </div>
          </div>

          {/* Card 3: Automotive Preferences Profile (Upsert Form) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Compass className="w-4 h-4" /> Sở Thích & Hành Vi Automotive
            </h4>
            
            <form onSubmit={handleUpdatePreferences} className="space-y-4"><fieldset disabled={isPending || loading || detailsLoading} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Thương Hiệu Quan Tâm</label>
                  <input
                    type="text"
                    value={prefForm.brands}
                    onChange={e => setPrefForm(f => ({ ...f, brands: e.target.value }))}
                    placeholder="BMW, Porsche, VinFast"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Phân Khúc Xe Quan Tâm</label>
                  <input
                    type="text"
                    value={prefForm.segments}
                    onChange={e => setPrefForm(f => ({ ...f, segments: e.target.value }))}
                    placeholder="SUV, Sedan, Crossover"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Mức Tài Chính Dự Kiến</label>
                  <input
                    type="text"
                    value={prefForm.budget}
                    onChange={e => setPrefForm(f => ({ ...f, budget: e.target.value }))}
                    placeholder="3B - 5B"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Mục Đích Mua Xe</label>
                  <input
                    type="text"
                    value={prefForm.purpose}
                    onChange={e => setPrefForm(f => ({ ...f, purpose: e.target.value }))}
                    placeholder="Đi làm, gặp khách hàng, gia đình"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
              </div>
              
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white dark:bg-white dark:text-slate-900 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  {isPending && <span className="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin mr-1" />}
                  Lưu Thay Đổi
                </button>
              </div>
            </fieldset></form>
          </div>
          </>}
        </div>

      </div>
    </div>
  );
}
