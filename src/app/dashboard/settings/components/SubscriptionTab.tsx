'use client';

import { useState, useEffect, useTransition } from 'react';
import { 
  CreditCard, 
  Users, 
  UserCheck, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  History, 
  AlertTriangle, 
  Loader2,
  QrCode,
  Zap
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { 
  getSubscriptionStatus, 
  getSubscriptionInvoiceHistory, 
  createUpgradeInvoice, 
  simulateInvoicePayment,
  SubscriptionInvoice 
} from '@/services/subscription-actions';
import { cn } from '@/lib/utils';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import type { Database } from '@/types/database.types';
import { UNLIMITED_QUOTA, calculateUsagePercent } from '@/lib/business-rules/subscription';

type SubscriptionPlanOption = {
  id: 'free_trial' | 'basic' | 'pro' | 'enterprise';
  name: string;
  price: number;
  features: readonly string[];
  color: string;
  glow: string;
  recommended?: boolean;
};

type Plan = SubscriptionPlanOption;
type SubscriptionStatus = Awaited<ReturnType<typeof getSubscriptionStatus>>;
type PendingSubscriptionInvoice = Database['public']['Tables']['subscription_invoices']['Row'];

function getPlans(workerLabel: string): readonly SubscriptionPlanOption[] {
  return [
    {
      id: 'free_trial',
      name: 'Dùng thử',
      price: 0,
      features: [
        `Tối đa 1 ${workerLabel}`,
        'Tối đa 15 khách hàng',
        '20 tin nhắn Zalo SMS / tháng',
        'Đầy đủ tính năng cốt lõi',
      ],
      color: 'from-slate-400 to-slate-600',
      glow: 'shadow-slate-200/20',
    },
    {
      id: 'basic',
      name: 'Cơ bản (Basic)',
      price: 499000,
      features: [
        `Tối đa 3 ${workerLabel}`,
        'Tối đa 50 khách hàng',
        '100 tin nhắn Zalo SMS / tháng',
        'Sao lưu dữ liệu tự động hàng ngày',
        'Hỗ trợ kỹ thuật qua Zalo OA',
      ],
      color: 'from-pink-400 to-rose-600',
      glow: 'shadow-pink-200/50 dark:shadow-none',
    },
    {
      id: 'pro',
      name: 'Chuyên nghiệp (Pro)',
      price: 999000,
      features: [
        `Tối đa 10 ${workerLabel}`,
        'Tối đa 500 khách hàng',
        '500 tin nhắn Zalo SMS / tháng',
        'Báo cáo phân tích nâng cao CRM',
        'Ưu tiên hỗ trợ kỹ thuật 24/7',
      ],
      color: 'from-purple-500 to-indigo-600',
      glow: 'shadow-purple-200/50',
      recommended: true,
    },
    {
      id: 'enterprise',
      name: 'Nhượng quyền (Enterprise)',
      price: 2499000,
      features: [
        `Không giới hạn ${workerLabel}`,
        'Không giới hạn số lượng khách hàng',
        '2,000 tin nhắn Zalo SMS / tháng',
        'API tích hợp & Whitelabel riêng',
        'Quản lý đa chi nhánh chuyên nghiệp',
        'Cam kết chất lượng dịch vụ SLA 99.9%',
      ],
      color: 'from-amber-500 to-orange-600',
      glow: 'shadow-orange-200/50',
    },
  ] as const;
}

function getUsagePercent(current?: number, max?: number) {
  return calculateUsagePercent(current, max);
}

function getUsageWidth(current?: number, max?: number) {
  if (max === UNLIMITED_QUOTA) return 100;
  return calculateUsagePercent(current, max);
}

function getExpiryDateString(status: SubscriptionStatus | null) {
  if (!status) return '';
  if (status.limits?.maxKtv === 999999 && status.limits?.maxCustomers === 999999) {
    return 'Vô thời hạn (Unlimited)';
  }

  const days = status.limits?.maxKtv === 1 ? 30 : 365;
  return new Date(Date.now() + days * 86400000).toLocaleDateString('vi-VN');
}

export default function SubscriptionTab() {
  const vocab = useModuleVocabulary();
  const PLANS = getPlans(vocab.worker.singular);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [duration, setDuration] = useState<number>(1); // months
  const [pendingInvoice, setPendingInvoice] = useState<PendingSubscriptionInvoice | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSimulating, setIsSimulating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const expiryDateString = getExpiryDateString(status);

  async function loadData() {
    try {
      const [statusRes, invoicesRes] = await Promise.all([
        getSubscriptionStatus(),
        getSubscriptionInvoiceHistory()
      ]);
      setStatus(statusRes);
      setInvoices(invoicesRes);
    } catch (err: unknown) {
      console.error('Error loading subscription data:', err);
      toast.error('Không thể tải thông tin gói cước');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [statusRes, invoicesRes] = await Promise.all([
          getSubscriptionStatus(),
          getSubscriptionInvoiceHistory()
        ]);
        if (!cancelled) {
          setStatus(statusRes);
          setInvoices(invoicesRes);
        }
      } catch (err: unknown) {
        console.error('Error loading subscription data:', err);
        if (!cancelled) toast.error('Không thể tải thông tin gói cước');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === 'free_trial') {
      toast.error('Không thể nâng cấp lên gói Dùng thử');
      return;
    }
    setSelectedPlan(plan);
    setPendingInvoice(null);
  };

  const calculateDiscountedPrice = (pricePerMonth: number, months: number) => {
    const rawTotal = pricePerMonth * months;
    if (months === 6) return rawTotal * 0.9; // 10% off
    if (months === 12) return rawTotal * 0.8; // 20% off
    return rawTotal;
  };

  const handleCreateInvoice = async () => {
    if (!selectedPlan) return;
    
    startTransition(async () => {
      try {
        const res = await createUpgradeInvoice(selectedPlan.id, duration);
        if (res.error) {
          toast.error('Lỗi tạo hóa đơn: ' + res.error);
        } else if (res.invoice) {
          setPendingInvoice(res.invoice);
          toast.success('Đã tạo hóa đơn gia hạn thành công!');
          loadData();
        }
      } catch (err: unknown) {
        toast.error('Đã xảy ra lỗi khi tạo hóa đơn');
        console.error(err);
      }
    });
  };

  const handleSimulatePayment = async (invoiceNumber: string) => {
    setIsSimulating(true);
    try {
      const res = await simulateInvoicePayment(invoiceNumber);
      if (res.error) {
        toast.error('Không thể kích hoạt thử nghiệm: ' + res.error);
      } else {
        toast.success('Sandbox: Đã gạch nợ thành công! Đang cập nhật gói cước...');
        setPendingInvoice(null);
        setSelectedPlan(null);
        
        // Wait for database to commit and Next.js revalidation to propagate
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Retry loading data until subscription is updated (max 3 attempts)
        let retries = 0;
        const maxRetries = 3;
        let subscriptionUpdated = false;
        
        while (retries < maxRetries && !subscriptionUpdated) {
          try {
            const [newStatus, newInvoices] = await Promise.all([
              getSubscriptionStatus(),
              getSubscriptionInvoiceHistory()
            ]);
            
            // Debug: Show what we got back
            console.log('[DEBUG] Subscription status after payment:', newStatus);
            console.log('[DEBUG] Invoice that was paid:', invoiceNumber);
            
            // Check if the invoice is now marked as paid
            const paidInvoice = newInvoices.find(
              inv => inv.invoice_number === invoiceNumber && inv.status === 'paid'
            );
            
            if (paidInvoice) {
              // Success! Update UI
              setStatus(newStatus);
              setInvoices(newInvoices);
              subscriptionUpdated = true;
              
              // Show detailed success message
              const tierName = newStatus.limits?.tierName || newStatus.tier;
              toast.success(`✅ Gói cước "${tierName}" đã được kích hoạt thành công!`);
            } else {
              // Not updated yet, retry after delay
              retries++;
              if (retries < maxRetries) {
                console.log(`[DEBUG] Retry attempt ${retries}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } catch (retryErr) {
            console.error('Retry error:', retryErr);
            retries++;
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        if (!subscriptionUpdated) {
          // Fallback: force page reload if retries exhausted
          toast.info('Đang làm mới trang để cập nhật gói cước...');
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      }
    } catch (err: unknown) {
      toast.error('Lỗi khi giả lập thanh toán');
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleConvertToFranchise = async () => {
    setIsConverting(true);
    try {
      const res = await fetch('/api/admin/tenant/convert-to-franchise', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        toast.error('Lỗi: ' + (data.error || 'Không thể chuyển sang chế độ franchise'));
        return;
      }

      toast.success('✅ Đã chuyển sang chế độ franchise! Đang tải lại...');
      
      // Reload subscription data
      await loadData();
      
      // Force page reload to clear all caches
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: unknown) {
      console.error('Convert to franchise error:', err);
      toast.error('Lỗi khi chuyển đổi chế độ franchise');
    } finally {
      setIsConverting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const activePlanName = PLANS.find(p => p.id === status?.tier)?.name || 'Dùng thử';

  return (
    <div className="space-y-12">
      {/* Title Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <CreditCard className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gói dịch vụ (SaaS)</h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Quản lý gói cước dịch vụ và hạn mức hoạt động chi nhánh
          </p>
        </div>
      </div>

      {/* Active Subscription Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-primary/10 via-slate-500/5 to-indigo-500/10 border border-primary/20 p-8 shadow-inner">
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          <Sparkles className="w-32 h-32 text-primary" />
        </div>
        
        {/* Debug: Show if tenant is HQ-owned (unlimited) */}
        {status?.tier === 'hq_owned' && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 mb-2">
                🏢 Tenant này đang ở chế độ HQ-owned (không giới hạn)
              </p>
              <p className="text-xs text-amber-700 mb-3">
                Để test subscription system, cần chuyển sang chế độ franchise. 
                Điều này sẽ bật giới hạn gói cước và cho phép nâng cấp/gia hạn gói.
              </p>
              <button
                onClick={handleConvertToFranchise}
                disabled={isConverting}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isConverting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>Chuyển sang chế độ Franchise</span>
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase bg-primary text-primary-foreground tracking-wider animate-pulse">
                Gói hiện tại
              </span>
              {status?.isExpired && (
                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase bg-destructive text-white tracking-wider">
                  Đã hết hạn
                </span>
              )}
            </div>
            <h3 className="text-3xl font-black text-foreground">{activePlanName}</h3>
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Hạn dùng:</span>
              <span className="text-foreground">
                {status?.isExpired ? 'Hết hạn ngày: ' : 'Hạn sử dụng đến: '}
                {expiryDateString}
              </span>
            </p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setSelectedPlan(PLANS.find(p => p.id === 'pro') ?? null)}
              className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-primary/20 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0"
            >
              Gia hạn / Nâng cấp
            </button>
          </div>
        </div>
      </div>

      {/* Resource Usage Gauges */}
      <div>
        <h4 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" /> Hạn mức sử dụng thực tế
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* KTV Gauge */}
          <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-black text-indigo-600">{vocab.worker.singular}</span>
            </div>
            <div>
              <div className="flex items-end justify-between mb-1">
                <span className="text-2xl font-black text-slate-800">
                  {status?.usage?.ktv?.current ?? 0}
                  <span className="text-sm font-semibold text-slate-400"> / {status?.usage?.ktv?.max === 999999 ? '∞' : status?.usage?.ktv?.max ?? 0}</span>
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {status?.usage?.ktv?.max === 999999 ? '0%' : `${getUsagePercent(status?.usage?.ktv?.current, status?.usage?.ktv?.max)}%`}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: `${getUsageWidth(status?.usage?.ktv?.current, status?.usage?.ktv?.max)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Customers Gauge */}
          <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-black text-rose-600">Khách hàng</span>
            </div>
            <div>
              <div className="flex items-end justify-between mb-1">
                <span className="text-2xl font-black text-slate-800">
                  {status?.usage?.customer?.current ?? 0}
                  <span className="text-sm font-semibold text-slate-400"> / {status?.usage?.customer?.max === 999999 ? '∞' : status?.usage?.customer?.max ?? 0}</span>
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {status?.usage?.customer?.max === 999999 ? '0%' : `${getUsagePercent(status?.usage?.customer?.current, status?.usage?.customer?.max)}%`}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                  style={{ width: `${getUsageWidth(status?.usage?.customer?.current, status?.usage?.customer?.max)}%` }}
                />
              </div>
            </div>
          </div>

          {/* SMS Allotment Gauge */}
          <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-xs font-black text-amber-600">Zalo ZNS SMS</span>
            </div>
            <div>
              <div className="flex items-end justify-between mb-1">
                <span className="text-2xl font-black text-slate-800">
                  {status?.usage?.sms?.current ?? 0}
                  <span className="text-sm font-semibold text-slate-400"> / {status?.usage?.sms?.max ?? 0}</span>
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {getUsagePercent(status?.usage?.sms?.current, status?.usage?.sms?.max)}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: `${getUsageWidth(status?.usage?.sms?.current, status?.usage?.sms?.max)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Plans Grid */}
      <div>
        <h4 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Bảng giá & Gói cước Premium
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              onClick={() => handleSelectPlan(plan)}
              className={cn(
                "p-8 rounded-[2.5rem] bg-white border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between",
                plan.recommended ? "border-primary shadow-xl shadow-pink-100 dark:shadow-none ring-2 ring-primary/20 scale-[1.03] lg:scale-[1.05]" : "border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200",
                selectedPlan?.id === plan.id ? "ring-2 ring-primary/50" : ""
              )}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] font-black px-4 py-1 rounded-bl-2xl uppercase tracking-wider">
                  Bán chạy nhất
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <h5 className="font-black text-lg text-slate-800">{plan.name}</h5>
                  <p className="text-sm font-semibold text-slate-400 mt-1">Hạn mức vượt trội</p>
                </div>

                <div className="flex items-baseline">
                  <span className="text-3xl font-black text-slate-800">
                    {plan.price === 0 ? 'Miễn phí' : plan.price.toLocaleString('vi-VN')}
                  </span>
                  {plan.price > 0 && <span className="text-xs font-semibold text-slate-400 ml-1">/ tháng</span>}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-500 font-medium leading-normal">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan);
                  }}
                  className={cn(
                    "w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                    plan.recommended
                      ? "bg-primary text-primary-foreground hover:bg-primary-hover shadow-lg shadow-primary/20 dark:shadow-none"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100"
                  )}
                >
                  {plan.price === 0 ? 'Đang hoạt động' : 'Chọn gói'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Configuration Modal / Panel */}
      {selectedPlan && (
        <div className="p-8 rounded-[3.0rem] bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-8 animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <Zap className="w-6 h-6 text-primary animate-bounce" /> Cấu hình gia hạn {selectedPlan.name}
            </h4>
            <button
              onClick={() => { setSelectedPlan(null); setPendingInvoice(null); }}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
            >
              Hủy
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Duration select */}
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Thời hạn sử dụng</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { val: 1, label: '1 Tháng', desc: 'Giá gốc' },
                    { val: 6, label: '6 Tháng', desc: 'Giảm 10%', badge: '-10%' },
                    { val: 12, label: '12 Tháng', desc: 'Giảm 20%', badge: '-20%' },
                  ].map((dur) => (
                    <button
                      key={dur.val}
                      onClick={() => { setDuration(dur.val); setPendingInvoice(null); }}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all relative overflow-hidden group",
                        duration === dur.val
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      )}
                    >
                      {dur.badge && (
                        <span className="absolute top-0 right-0 bg-accent text-white text-[7px] font-black px-2 py-0.5 rounded-bl-lg uppercase">
                          {dur.badge}
                        </span>
                      )}
                      <div className="font-black text-sm">{dur.label}</div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-1">{dur.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price details */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 font-semibold text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Giá cước / tháng:</span>
                  <span>{selectedPlan.price.toLocaleString('vi-VN')} VND</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Thời gian:</span>
                  <span>{duration} tháng</span>
                </div>
                {duration > 1 && (
                  <div className="flex justify-between text-rose-500 font-bold">
                    <span>Ưu đãi thời hạn:</span>
                    <span>-{duration === 6 ? '10%' : '20%'}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 my-2 pt-3 flex justify-between items-baseline text-slate-800 font-black">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="text-xl text-primary">
                    {calculateDiscountedPrice(selectedPlan.price, duration).toLocaleString('vi-VN')} VND
                  </span>
                </div>
              </div>

              {!pendingInvoice && (
                <button
                  onClick={handleCreateInvoice}
                  disabled={isPending}
                  className="w-full bg-primary hover:bg-primary-hover text-primary-foreground py-4 rounded-2xl font-black transition-all shadow-lg shadow-primary/20 dark:shadow-none flex items-center justify-center gap-3"
                >
                  {isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <QrCode className="w-5 h-5" />
                  )}
                  <span>Tiến hành tạo QR Thanh toán</span>
                </button>
              )}
            </div>

            {/* VietQR display */}
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              {pendingInvoice ? (
                <div className="space-y-6 w-full flex flex-col items-center">
                  <div className="p-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-md relative group flex flex-col items-center max-w-[320px]">
                    <span className="absolute top-3 left-3 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase animate-pulse">
                      Đang chờ chuyển khoản
                    </span>
                    <Image
                      src={`https://img.vietqr.io/image/MB-190365701493-compact.png?amount=${pendingInvoice.amount}&addInfo=SUB%20${pendingInvoice.invoice_number}&accountName=BELLA%20HQ%20SUBSCRIPTION`} 
                      alt="VietQR Code" 
                      width={200}
                      height={200}
                      unoptimized
                      className="w-[200px] h-[200px] object-contain mb-4 rounded-xl mt-4" 
                    />
                    <div className="text-center space-y-1">
                      <div className="text-xs text-slate-400 font-black tracking-wider uppercase">Cú pháp CK bắt buộc</div>
                      <div className="px-4 py-2 bg-slate-100 rounded-xl font-mono text-sm font-black text-slate-800 tracking-wider">
                        SUB {pendingInvoice.invoice_number}
                      </div>
                    </div>
                  </div>

                  <div className="w-full space-y-3 max-w-[320px]">
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold leading-normal flex gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Vui lòng quét mã QR hoặc chuyển khoản đúng số tài khoản và nội dung <strong>SUB {pendingInvoice.invoice_number}</strong> để hệ thống tự động kích hoạt ngay lập tức!</span>
                    </div>

                    <button
                      onClick={() => handleSimulatePayment(pendingInvoice.invoice_number)}
                      disabled={isSimulating}
                      className="w-full bg-primary hover:bg-primary-hover text-primary-foreground py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2.5 uppercase tracking-wider"
                    >
                      {isSimulating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 text-accent animate-pulse" />
                      )}
                      <span>Giả lập Thanh toán (Sandbox)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3 p-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl w-full flex flex-col items-center justify-center">
                  <QrCode className="w-12 h-12 stroke-[1.5] text-slate-300" />
                  <p className="text-xs font-semibold max-w-[200px] leading-relaxed">
                    Nhấn vào nút &quot;Tiến hành tạo QR Thanh toán&quot; để hiển thị VietQR tự động.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice History Table */}
      <div className="space-y-6">
        <h4 className="text-lg font-black text-foreground flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" /> Lịch sử hóa đơn thanh toán
        </h4>
        <div className="overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-sm">
          <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
            <table className="bella-data-table min-w-[64rem] text-left text-xs font-semibold text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Mã hóa đơn</th>
                  <th className="px-6 py-4">Ngày tạo</th>
                  <th className="px-6 py-4">Gói cước</th>
                  <th className="px-6 py-4">Thời hạn</th>
                  <th className="px-6 py-4">Số tiền (VND)</th>
                  <th className="px-6 py-4">Phương thức</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400 font-semibold">
                      Chưa có hóa đơn nào được khởi tạo.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const planName = PLANS.find(p => p.id === inv.tier)?.name || inv.tier;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-800">{inv.invoice_number}</td>
                        <td className="px-6 py-4">{new Date(inv.created_at).toLocaleDateString('vi-VN')}</td>
                        <td className="px-6 py-4 font-bold text-indigo-600">{planName}</td>
                        <td className="px-6 py-4">{inv.duration_months} tháng</td>
                        <td className="px-6 py-4 font-black text-slate-800">{inv.amount.toLocaleString('vi-VN')}</td>
                        <td className="px-6 py-4">{inv.payment_method || '—'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                            inv.status === 'paid' && "bg-emerald-50 text-emerald-600 border border-emerald-100",
                            inv.status === 'pending' && "bg-amber-50 text-amber-600 border border-amber-100",
                            inv.status === 'cancelled' && "bg-rose-50 text-rose-600 border border-rose-100"
                          )}>
                            {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'pending' ? 'Chờ thanh toán' : 'Đã hủy'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
