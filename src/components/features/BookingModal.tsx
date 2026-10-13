'use client';

import VietQRPaymentModal from '@/components/features/VietQRPaymentModal';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import {
  calculateBookingPaymentState,
  calculatePaymentRequest,
  normalizeDiscountPercent,
  type PaymentRevenueLike,
} from '@/lib/business-rules/payment';
import { getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import { formatMoneyInput, getLocalDateString, parseMoneyInput } from '@bella/shared';
import { cn, formatNumberWithSeparator, parseIntegerInput } from '@/lib/utils';;
import { createBooking,getBookingDetailsWithPayment,getDraftBooking,getPackages as getScopedPackages } from '@/core/services/order';
import { getCustomers as getScopedCustomers } from '@/services/customer-actions';
import { getUsers } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { AnimatePresence,motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Gift,
  Loader2,
  Package,
  Phone,
  Plus,
  Search,
  Tag,
  User,
  X
} from 'lucide-react';
import { useEffect,useState } from 'react';
import { toast } from 'sonner';
import { useScrollLock } from '@/hooks/useScrollLock';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type PackageRow = Database['public']['Tables']['packages']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];
type TenantBankInfo = Pick<
  Database['public']['Tables']['tenants']['Row'],
  'qr_bank_code' | 'qr_account_number' | 'qr_account_name' | 'name'
>;
type DraftBooking = Awaited<ReturnType<typeof getDraftBooking>>;
type BookingSubmitPayload = Parameters<typeof createBooking>[0];

// Memory cache for packages and KTVs to enable instantaneous loading on subsequent opens
let cachedPackages: PackageRow[] | null = null;
let cachedKtvs: Pick<UserRow, 'id' | 'full_name'>[] | null = null;

function getErrorMessage(error: unknown, fallback = 'Không rõ nguyên nhân. Kiểm tra console để biết thêm.') {
  return error instanceof Error ? error.message : fallback;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedCustomer?: CustomerRow | null;
}

export function BookingModal({ isOpen, onClose, onSuccess, preselectedCustomer }: BookingModalProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPackagesLoading, setIsPackagesLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { tenantModuleKey, refreshTenantModuleKey } = useTenantModuleKey();
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);

  useScrollLock(isOpen);

  // VietQR deposit states
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ bookingNumber: string; amount: number; tenantInfo: TenantBankInfo | null } | null>(null);

  const handleCloseQrModal = () => {
    setShowQrModal(false);
    if (onSuccess) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const [newCustomer, setNewCustomer] = useState({
    name_mother: '',
    phone: '',
    address: '',
  });

  const [ktvs, setKtvs] = useState<Pick<UserRow, 'id' | 'full_name'>[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [draftBooking, setDraftBooking] = useState<DraftBooking>(null);
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [giftSessions, setGiftSessions] = useState<string>('');

  const [ktvAvailability, setKtvAvailability] = useState<{
    available: boolean;
    reason?: string;
    conflictType?: 'overlap' | 'break_time_violation' | 'daily_limit';
    existingBookingEndTime?: string;
    requiredBreakMinutes?: number;
    nextAvailableTime?: string;
  } | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [formData, setFormData] = useState({
    package_id: '',
    package_name: '',
    full_price: 0,
    deposit_amount: 0,
    total_sessions: 21,
    start_date: getLocalDateString(),
    preferred_time: '08:00',
    assigned_ktv_id: '',
  });

  async function fetchPackages() {
    if (cachedPackages && cachedPackages.length > 0) {
      setPackages(cachedPackages);
      return;
    }
    setIsPackagesLoading(true);
    try {
      const data = await getScopedPackages();
      cachedPackages = data || [];
      setPackages(cachedPackages);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Không thể tải gói dịch vụ theo phân hệ');
    } finally {
      setIsPackagesLoading(false);
    }
  }

  async function fetchKtvs() {
    if (cachedKtvs && cachedKtvs.length > 0) {
      setKtvs(cachedKtvs);
      return;
    }
    try {
      const data = await getUsers();
      cachedKtvs = data
        .filter((user) => user.role === 'ktv' && user.status === 'active')
        .map((user) => ({ id: user.id, full_name: user.full_name }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
      setKtvs(cachedKtvs);
    } catch (error) {
      console.error('Error fetching KTVs:', error);
    }
  }

  async function fetchCustomers() {
    setIsLoading(true);
    try {
      const data = await getScopedCustomers();
      const activeCustomers = (data || [])
        .filter((customer) => customer.status === 'active')
        .sort((a, b) => (a.name_mother || '').localeCompare(b.name_mother || ''));
      setCustomers(activeCustomers);
      setFilteredCustomers(activeCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Không thể tải danh sách khách hàng');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (preselectedCustomer) {
        setSelectedCustomer(preselectedCustomer);
        setStep(2);
        setMode('search');
      } else {
        setStep(1);
        setMode('search');
        setSelectedCustomer(null);
      }
      setSearchQuery('');
      setNewCustomer({ name_mother: '', phone: '', address: '' });
      setDiscountPercent('');
      void refreshTenantModuleKey();
      fetchCustomers();
      fetchKtvs();
      fetchPackages();
    }
  }, [isOpen, preselectedCustomer, refreshTenantModuleKey]);

  // Load draft booking when customer is selected
  useEffect(() => {
    if (selectedCustomer?.id) {
      const loadDraft = async () => {
        let draft: DraftBooking = null;
        try {
          draft = await getDraftBooking(selectedCustomer.id);
        } catch (error) {
          console.error('Error loading draft booking:', error);
          toast.error('Khong the tai booking nhap cua khach hang');
          setDraftBooking(null);
          return;
        }

        if (draft) {
          const draftPaymentState = calculateBookingPaymentState({
            fullPrice: draft.full_price || 0,
            discountPercent: draft.discount_percent || 0,
            depositAmount: draft.deposit_amount || 0,
            bookingStatus: draft.status,
            revenues: draft.revenue,
          });
          const draftDepositAmount = draftPaymentState.totalPaid;
          setDraftBooking(draft);
          // Pre-fill form data if draft exists
          setFormData(prev => ({
            ...prev,
            package_name: draft.package_name || '',
            full_price: draft.full_price || 0,
            deposit_amount: 0,
            total_sessions: draft.total_sessions || 21,
            start_date: draft.start_date || prev.start_date,
            preferred_time: draft.preferred_time || prev.preferred_time,
            assigned_ktv_id: draft.assigned_ktv_id || '',
          }));
          setDiscountPercent(draft.discount_percent ? String(draft.discount_percent) : '');
          
          if (draft.package_name) {
            toast.success(`Đã tự động nạp thông tin gói "${draft.package_name}" và số tiền cọc cũ.`);
          } else if (draftDepositAmount > 0) {
            toast.info(`Khách hàng có số tiền cọc chờ: ${formatNumberWithSeparator(draftDepositAmount)}đ. Vui lòng chọn gói dịch vụ.`);
          }
        } else {
          setDraftBooking(null);
          // Clear if no draft (unless it was already set by user selection)
          if (step === 1) {
            setFormData({
              package_id: '',
              package_name: '',
              full_price: 0,
              deposit_amount: 0,
              total_sessions: 21,
              start_date: getLocalDateString(),
              preferred_time: '08:00',
              assigned_ktv_id: '',
            });
            setDiscountPercent('');
          }
        }
      };
      loadDraft();
    }
  }, [selectedCustomer, step]);

  // Automatically calculate package price based on total_sessions for single session packages (gói lẻ)
  useEffect(() => {
    if (!formData.package_id) return;
    
    const selectedPkg = packages.find(p => p.id === formData.package_id);
    if (!selectedPkg) return;

    const baseSessions = Number(selectedPkg.total_sessions || 1);
    const basePrice = Number(selectedPkg.price || selectedPkg.full_price || 0);

    if (baseSessions === 1) {
      const calculatedPrice = basePrice * formData.total_sessions;
      setFormData(prev => {
        if (prev.full_price === calculatedPrice) return prev;
        return {
          ...prev,
          full_price: calculatedPrice
        };
      });
    }
  }, [formData.package_id, formData.total_sessions, packages]);

  // Check KTV availability when KTV/date/time changes
  useEffect(() => {
    if (!isOpen || !formData.assigned_ktv_id || !formData.start_date || !formData.preferred_time) {
      setKtvAvailability(null);
      return;
    }

    const checkAvailability = async () => {
      setIsCheckingAvailability(true);
      try {
        const searchParams = new URLSearchParams({
          date: formData.start_date,
          time: formData.preferred_time,
          duration: '60', // Default 60 minutes
        });

        const response = await fetch(`/api/bookings/check-ktv-availability?${searchParams.toString()}`);
        
        if (!response.ok) {
          console.error('[BookingModal] Failed to check availability');
          setKtvAvailability(null);
          return;
        }

        const result = await response.json();
        
        interface KtvAvailabilityItem {
          id: string;
          available: boolean;
          reason?: string;
          conflictType?: 'overlap' | 'break_time_violation' | 'daily_limit';
          conflictDetails?: {
            existingBookingEndTime?: string;
            requiredBreakMinutes?: number;
            nextAvailableTime?: string;
          };
        }
        
        const currentKtvResult = [
          ...(result.available || []),
          ...(result.unavailable || [])
        ].find(
          (ktv: KtvAvailabilityItem) => ktv.id === formData.assigned_ktv_id
        );

        if (currentKtvResult && !currentKtvResult.available) {
          setKtvAvailability({
            available: false,
            reason: currentKtvResult.reason,
            conflictType: currentKtvResult.conflictType,
            existingBookingEndTime: currentKtvResult.conflictDetails?.existingBookingEndTime,
            requiredBreakMinutes: currentKtvResult.conflictDetails?.requiredBreakMinutes,
            nextAvailableTime: currentKtvResult.conflictDetails?.nextAvailableTime,
          });
        } else {
          setKtvAvailability({ available: true });
        }
      } catch (error) {
        console.error('[BookingModal] Error checking availability:', error);
        setKtvAvailability(null);
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    // Debounce the check
    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [isOpen, formData.start_date, formData.preferred_time, formData.assigned_ktv_id]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => 
          c.name_mother?.toLowerCase().includes(query) || 
          c.phone?.includes(query)
        )
      );
    }
  }, [searchQuery, customers]);

  const handleSelectService = (pkg: PackageRow) => {
    const pkgPrice = Number(pkg.price || pkg.full_price || 0);
    const pkgSessions = Number(pkg.total_sessions || 1);

    if (pkgSessions === 1) {
      // Single-session (retail) package: keep current total_sessions from form,
      // and immediately calculate total price = unit_price × sessions
      const currentSessions = formData.total_sessions || 1;
      setFormData({
        ...formData,
        package_id: pkg.id,
        package_name: pkg.name,
        full_price: pkgPrice * currentSessions,
        total_sessions: currentSessions, // Keep existing sessions count
      });
    } else {
      // Multi-session (combo) package: price is fixed, set sessions from package
      setFormData({
        ...formData,
        package_id: pkg.id,
        package_name: pkg.name,
        full_price: pkgPrice,
        total_sessions: parseIntegerInput(pkg.total_sessions, { min: 1, max: 100, fallback: 10 })
      });
    }
    setGiftSessions('');
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === '') {
      setDiscountPercent('');
      return;
    }

    const numericValue = Number(val);
    if (Number.isFinite(numericValue)) {
      setDiscountPercent(String(normalizeDiscountPercent(numericValue)));
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const isCustomerSelected = mode === 'new' 
      ? (newCustomer.name_mother && newCustomer.phone)
      : selectedCustomer;

    if (!isCustomerSelected) {
      toast.error('Vui lòng chọn khách hàng');
      return;
    }

    if (!formData.package_name) {
      toast.error('Vui lòng chọn gói dịch vụ');
      return;
    }

    setIsSubmitting(true);
    try {
      const baseSessions = parseIntegerInput(formData.total_sessions, { min: 1, max: 100, fallback: 15 });
      const extraSessions = parseIntegerInput(giftSessions, { min: 0, max: 100, fallback: 0 });
      const totalSessions = baseSessions + extraSessions;

      // Guard: Recalculate full_price for single-session (lẻ) packages at submit time.
      // This prevents stale draft data from carrying the wrong unit price as total price.
      let finalFullPrice = formData.full_price;
      if (formData.package_id) {
        const selectedPkg = packages.find(p => p.id === formData.package_id);
        if (selectedPkg && Number(selectedPkg.total_sessions || 1) === 1) {
          const unitPrice = Number(selectedPkg.price || selectedPkg.full_price || 0);
          finalFullPrice = unitPrice * baseSessions;
        }
      }

      const payload: BookingSubmitPayload = {
        ...formData,
        full_price: finalFullPrice,
        total_sessions: totalSessions,
        discount_percent: normalizeDiscountPercent(discountPercent),
        customer_id: mode === 'new' ? 'new' : selectedCustomer?.id || '',
        metadata: {
          gift_sessions: extraSessions,
        },
      };

      if (mode === 'new') {
        payload.newCustomer = {
          ...newCustomer,
          address: newCustomer.address || 'Chưa cập nhật'
        };
      }

      // Create the booking (atomic customer + booking if mode === 'new')
      const result = await createBooking(payload);

      console.log('[BookingModal] createBooking result:', result);

      if (result?.error) {
        const isKtvConflict = result.error.includes('Kỹ thuật viên') || 
                             result.error.includes('giãn cách') || 
                             result.error.includes('không khả dụng');
        if (isKtvConflict) {
          const overlapMatch = result.error.match(/\(từ (\d{2}:\d{2}) đến (\d{2}:\d{2})\)/);
          const nextMatch = result.error.match(/sau: (\d{2}:\d{2})/);
          
          setKtvAvailability({
            available: false,
            reason: result.error.split('.')[0] + '.',
            existingBookingEndTime: overlapMatch?.[2],
            nextAvailableTime: nextMatch?.[1]
          });
        } else {
          toast.error('Lỗi tạo lịch hẹn: ' + result.error);
        }
      } else {
        const booking = result?.data;
        if (booking && booking.status === 'deposit_pending' && Number(booking.deposit_amount || 0) > 0) {
          toast.success('Tạo lịch hẹn thành công! Đang tải mã QR đặt cọc...');
          try {
            const payDetails = await getBookingDetailsWithPayment(booking.id);
            if (payDetails.data) {
              const paymentRequest = calculatePaymentRequest({
                fullPrice: payDetails.data.full_price,
                discountPercent: payDetails.data.discount_percent,
                depositAmount: payDetails.data.deposit_amount,
                bookingStatus: payDetails.data.status,
                revenues: payDetails.data.revenue,
                selectedTab: 'deposit',
              });
              if (paymentRequest.amountToPay > 0) {
                setQrModalData({
                  bookingNumber: payDetails.data.booking_number,
                  amount: paymentRequest.amountToPay,
                  tenantInfo: payDetails.data.tenants || null
                });
                setShowQrModal(true);
                return; // Dừng ở đây để hiển thị modal QR, không đóng BookingModal hay gọi onSuccess ngay lập tức
              }
            }
          } catch (err: unknown) {
            console.error("Error loading deposit QR:", err);
          }
        }

        toast.success('Tạo lịch hẹn thành công!');
        if (onSuccess) {
          await onSuccess();
        } else {
          onClose();
        }
      }
    } catch (error: unknown) {
      console.error('[BookingModal] Exception in handleSubmit:', error);
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDiscountPercent = normalizeDiscountPercent(discountPercent);
  const existingConfirmedPaidAmount = draftBooking
    ? calculateBookingPaymentState({
        fullPrice: draftBooking.full_price || 0,
        discountPercent: selectedDiscountPercent,
        depositAmount: draftBooking.deposit_amount || 0,
        bookingStatus: draftBooking.status,
        revenues: draftBooking.revenue,
      }).totalPaid
    : 0;
  const previewPaymentState = calculateBookingPaymentState({
    fullPrice: formData.full_price,
    discountPercent: selectedDiscountPercent,
    depositAmount: 0,
    bookingStatus: draftBooking?.status,
    revenues: [
      ...((draftBooking?.revenue || []) as PaymentRevenueLike[]),
      ...(formData.deposit_amount > 0
        ? [{ amount: formData.deposit_amount, status: 'confirmed', revenue_type: 'deposit' }]
        : []),
    ],
  });
  const previewDiscountAmount = Math.max(0, formData.full_price - previewPaymentState.priceAfterDiscount);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          data-testid="booking-modal"
          className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white"
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-4">
              {step === 2 && (
                <button 
                  onClick={() => setStep(1)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-primary"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  {step === 1 ? 'Chọn khách hàng' : 'Thông tin lịch hẹn'}
                </h2>
                <p className="text-sm text-slate-500 font-bold">Bước {step} / 2</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-rose-50 rounded-2xl transition-all text-slate-400 hover:text-rose-500 group"
            >
              <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          <div className="p-8 max-h-[70vh] overflow-y-auto">
            {step === 1 ? (
              <div className="space-y-6">
                {/* Mode Toggle */}
                <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                  <button 
                    onClick={() => setMode('search')}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2",
                      mode === 'search' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Search className="w-4 h-4" /> Khách cũ
                  </button>
                  <button 
                    onClick={() => setMode('new')}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2",
                      mode === 'new' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Plus className="w-4 h-4" /> Khách mới
                  </button>
                </div>

                {mode === 'search' ? (
                  <>
                    {/* Search */}
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
                      <input 
                        type="text" 
                        placeholder={`Tìm theo ${customerLabels.primaryNameLabel.toLowerCase()} hoặc số điện thoại...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                        autoFocus
                      />
                    </div>

                    {/* Customer List */}
                    <div className="space-y-3">
                      {isLoading ? (
                        <div className="py-20 text-center">
                          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                          <p className="text-slate-500 font-bold">Đang tải danh sách...</p>
                        </div>
                      ) : filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setStep(2);
                            }}
                            className="w-full flex items-center justify-between p-5 rounded-[1.5rem] border border-slate-100 hover:border-primary hover:bg-primary/5 transition-all group text-left"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                <User className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors">{customer.name_mother}</h4>
                                <p className="text-sm text-slate-500 font-bold flex items-center gap-2">
                                  <Phone className="w-4 h-4" /> {customer.phone}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </button>
                        ))
                      ) : (
                        <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                          <p className="text-slate-400 font-bold italic mb-4">Không tìm thấy khách hàng</p>
                          <button 
                            onClick={() => setMode('new')}
                            className="px-6 py-3 bg-white border border-primary text-primary rounded-xl font-black hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2 mx-auto"
                          >
                            <Plus className="w-5 h-5" /> Thêm khách hàng mới
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User className="w-4 h-4" /> {customerLabels.primaryNameLabel}
                      </label>
                      <input 
                        type="text" 
                        placeholder={customerLabels.primaryNamePlaceholder}
                        value={newCustomer.name_mother}
                        onChange={(e) => setNewCustomer({...newCustomer, name_mother: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Phone className="w-4 h-4" /> Số điện thoại
                      </label>
                      <input 
                        type="text" 
                        placeholder="Nhập số điện thoại..." 
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Search className="w-4 h-4" /> Địa chỉ
                      </label>
                      <input 
                        type="text" 
                        placeholder="Nhập địa chỉ..." 
                        value={newCustomer.address}
                        onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Selected Customer Summary */}
                <div className="flex items-center gap-4 p-5 bg-primary/5 rounded-3xl border border-primary/10">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">
                      {mode === 'new' ? newCustomer.name_mother : selectedCustomer?.name_mother}
                    </h4>
                    <p className="text-sm text-slate-500 font-bold">
                      {mode === 'new' ? newCustomer.phone : selectedCustomer?.phone}
                    </p>
                  </div>
                  {mode === 'new' && (
                    <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-1 rounded-full font-black uppercase">Mới</span>
                  )}
                </div>

                {/* KTV Availability Warning Banner */}
                {ktvAvailability && !ktvAvailability.available && formData.assigned_ktv_id && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-amber-50/90 to-orange-50/60 border border-amber-200/50 rounded-3xl p-5 shadow-lg shadow-amber-500/[0.03] animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-orange-500" />
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0 mt-0.5">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="font-extrabold text-amber-900 text-xs uppercase tracking-wider">
                            ⚠️ {ktvs.find(k => k.id === formData.assigned_ktv_id)?.full_name || 'Kỹ thuật viên'} không khả dụng
                          </p>
                          <p className="text-amber-800 text-[11px] font-bold mt-0.5">
                            {ktvAvailability.reason || 'Đang có lịch trùng hoặc không đủ thời gian nghỉ'}
                          </p>
                        </div>

                        {/* Timeline breakdown */}
                        {(ktvAvailability.existingBookingEndTime || ktvAvailability.requiredBreakMinutes) && (
                          <div className="flex flex-wrap items-center gap-2">
                            {ktvAvailability.existingBookingEndTime && (
                              <span className="flex items-center gap-1 bg-amber-100/60 border border-amber-200/40 text-amber-900 px-2.5 py-1 rounded-xl font-bold text-[10px]">
                                🔚 Ca kết thúc: {ktvAvailability.existingBookingEndTime}
                              </span>
                            )}
                            {ktvAvailability.requiredBreakMinutes && (
                              <span className="flex items-center gap-1 bg-amber-100/60 border border-amber-200/40 text-amber-900 px-2.5 py-1 rounded-xl font-bold text-[10px]">
                                ⏱ Nghỉ giữa ca: +{ktvAvailability.requiredBreakMinutes} phút
                              </span>
                            )}
                          </div>
                        )}

                        {ktvAvailability.nextAvailableTime && (
                          <div className="w-fit flex items-center gap-2.5 bg-emerald-500/[0.04] border border-emerald-500/15 rounded-2xl px-5 py-2.5 shadow-sm">
                            <div className="w-6 h-6 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/15 flex-shrink-0 font-bold text-xs">
                              ✓
                            </div>
                            <p className="text-emerald-900 text-xs font-black">
                              Gợi ý chọn lịch từ <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-lg font-black text-xs shadow-sm shadow-emerald-500/15">{ktvAvailability.nextAvailableTime}</span> trở đi
                            </p>
                          </div>
                        )}

                        <p className="text-amber-700/80 text-[10px] font-bold italic">
                          → Vui lòng chọn KTV khác hoặc đặt lịch từ {ktvAvailability.nextAvailableTime ? <strong>{ktvAvailability.nextAvailableTime}</strong> : 'thời điểm khác'}
                        </p>
                      </div>
                      {isCheckingAvailability && (
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                )}

                {/* Service Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-4 h-4" /> Chọn gói dịch vụ
                  </label>
                  {isPackagesLoading ? (
                    <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-slate-400 font-bold text-xs">Đang tải danh sách gói...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() => handleSelectService(pkg)}
                          data-testid="booking-package-option"
                          data-package-id={pkg.id}
                          className={cn(
                            "p-4 rounded-2xl border text-left transition-all relative group",
                            formData.package_id === pkg.id
                              ? "border-primary bg-primary/5 shadow-lg shadow-primary/5"
                              : "border-slate-100 hover:border-primary/50"
                          )}
                        >
                          {(formData.package_id === pkg.id || formData.package_name === pkg.name) && (
                            <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary" />
                          )}
                          <h5 className="font-black text-slate-900 group-hover:text-primary transition-colors">{pkg.name}</h5>
                          <p className="text-xs text-slate-500 font-bold mt-1">
                            {Number(pkg.total_sessions || 1) === 1
                              ? `Gói lẻ - ${formatNumberWithSeparator(pkg.price || pkg.full_price || 0)}đ/buổi`
                              : `${pkg.total_sessions} buổi - ${formatNumberWithSeparator(pkg.price || pkg.full_price || 0)}đ`
                            }
                          </p>
                        </button>
                      ))}
                      {packages.length === 0 && (
                        <p className="col-span-2 text-center py-4 text-slate-400 italic font-bold">
                          Chưa có dữ liệu gói dịch vụ trong hệ thống.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* KTV & Date Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User className="w-4 h-4" /> Kỹ thuật viên phụ trách
                    </label>
                    <div className="relative">
                      <PremiumSelect 
                        value={formData.assigned_ktv_id}
                        options={[
                          { value: '', label: 'Chưa phân công' },
                          ...ktvs.map(k => ({ value: k.id, label: k.full_name }))
                        ]}
                        onChange={(val) => setFormData({...formData, assigned_ktv_id: val})}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Ngày bắt đầu
                    </label>
                    <input 
                      type="date" 
                      value={formData.start_date}
                      min={getLocalDateString()}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      data-testid="booking-start-date-input"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Giờ làm mặc định
                    </label>
                    <input 
                      type="time" 
                      value={formData.preferred_time}
                      onChange={(e) => setFormData({...formData, preferred_time: e.target.value})}
                      data-testid="booking-time-input"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {(() => {
                        const selPkg = packages.find(p => p.id === formData.package_id);
                        return selPkg && Number(selPkg.total_sessions || 1) === 1
                          ? `Số buổi mua lẻ (${formatNumberWithSeparator(Number(selPkg.price || selPkg.full_price || 0))}đ/buổi)`
                          : 'Số buổi liệu trình';
                      })()}
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="1"
                        max="100"
                        value={formData.total_sessions}
                        onChange={(e) => setFormData({...formData, total_sessions: parseIntegerInput(e.target.value, { min: 1, max: 100, fallback: 1 })})}
                        data-testid="booking-total-sessions-input"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Gift className="w-4 h-4" /> Tặng thêm buổi
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        value={giftSessions}
                        onChange={(e) => setGiftSessions(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Tiền đặt cọc bổ sung (VNĐ) {existingConfirmedPaidAmount > 0 && <span className="text-primary normal-case">(Đã cọc trước: {formatNumberWithSeparator(existingConfirmedPaidAmount)}đ)</span>}
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="0"
                        value={formatMoneyInput(formData.deposit_amount)}
                        onChange={(e) => {
                          setFormData({...formData, deposit_amount: parseMoneyInput(e.target.value)});
                        }}
                        data-testid="booking-deposit-input"
                        className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">đ</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Tag className="w-4 h-4" /> Ưu đãi giảm giá (%)
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="0"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={handleDiscountChange}
                        className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>

                {/* Real-time Total Sessions Display */}
                <div className="bg-pink-50/50 p-4 border border-pink-100/50 rounded-2xl flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">Tổng số buổi thực tế (gồm tặng thêm):</span>
                  <span className="text-sm font-black text-primary">
                    {(formData.total_sessions || 0) + parseIntegerInput(giftSessions, { min: 0, max: 100, fallback: 0 })} buổi
                  </span>
                </div>

                {/* Pricing Summary */}
                <div className="p-6 luxury-card-pink rounded-[2rem]">
                  <div className="flex justify-between items-center mb-4 opacity-70">
                    <span className="font-bold">Tổng tiền gói</span>
                    <span className="font-bold">{formatNumberWithSeparator(formData.full_price)}đ</span>
                  </div>
                  {selectedDiscountPercent > 0 && (
                    <div className="flex justify-between items-center mb-4 opacity-70">
                      <span className="font-bold">Khuyến mãi giảm giá ({discountPercent}%)</span>
                      <span className="font-bold text-rose-300">-{formatNumberWithSeparator(previewDiscountAmount)}đ</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-4 opacity-70">
                    <span className="font-bold">Tiền đã đặt cọc (Tổng)</span>
                    <span className="font-bold">-{formatNumberWithSeparator(previewPaymentState.totalPaid)}đ</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="font-bold">Cần thanh toán thêm</span>
                    <span className={cn(
                      "text-2xl font-bold text-primary",
                      tenantModuleKey === 'beauty_spa' && "text-[#34d399] !text-[#34d399]"
                    )}>
                      {formatNumberWithSeparator(previewPaymentState.remainingDebt)}đ
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all uppercase tracking-widest active:scale-95"
            >
              Hủy
            </button>
            <button 
              disabled={
                (step === 1 && mode === 'search') || 
                (step === 1 && mode === 'new' && (!newCustomer.name_mother || !newCustomer.phone)) ||
                (step === 2 && (!formData.package_name || isSubmitting))
              }
              onClick={() => {
                if (step === 1) setStep(2);
                else handleSubmit();
              }}
              data-testid={step === 1 ? "booking-next-button" : "booking-submit-button"}
              className={cn(
                "flex-1 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black transition-all shadow-xl shadow-primary/20 uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3",
                ((step === 1 && mode === 'search') || 
                 (step === 1 && mode === 'new' && (!newCustomer.name_mother || !newCustomer.phone)) ||
                 (step === 2 && (!formData.package_name || isSubmitting))) && "opacity-50 cursor-not-allowed grayscale"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : step === 1 ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {isSubmitting ? 'Đang lưu...' : step === 1 ? 'Tiếp tục' : 'Xác nhận tạo'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>

    {/* VietQR Payment Modal for Deposit */}
    {qrModalData && (
      <VietQRPaymentModal
        isOpen={showQrModal}
        onClose={handleCloseQrModal}
        bookingNumber={qrModalData.bookingNumber}
        amount={qrModalData.amount}
        tenantInfo={qrModalData.tenantInfo}
      />
    )}
  </>
  );
}
