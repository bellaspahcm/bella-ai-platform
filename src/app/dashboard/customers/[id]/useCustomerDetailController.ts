'use client';

import type { ReceiptData } from '@/components/common/PaymentReceiptTemplate';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { calculateBookingPaymentState, normalizeDiscountPercent } from '@/lib/business-rules/payment';
import {
  getCustomerGenderPresentation,
  getTenantModulePresentationOrNeutral,
} from '@/lib/business-rules/tenant-module-presentation';
import {
  getDefaultTenantModuleKey,
  resolveTenantBrandIdentity,
  type ResolvedTenantBrandIdentity,
  type TenantModuleKey,
} from '@/lib/business-rules/tenant-modules';
import { createClient } from '@/lib/supabase-client';
import { parseMoneyInput } from '@bella/shared';
import { parseIntegerInput, formatViDate, copyToClipboard } from '@/lib/utils';
import { generateShareToken, getBookingsByCustomerId, recordRemainingPayment, reusePackage, updateBooking } from '@/core/services/order';
import { getCustomerById, updateCustomer } from '@/services/customer-actions';
import { getTenantSettings } from '@/services/tenant-actions';
import { getCurrentUser, getUsers } from '@/services/user-actions';
import { toPng } from 'html-to-image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CustomerDetailBooking, CustomerDetailRecord, EditBookingData, EditCustomerData, KtvOption, PaymentData } from './types';

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  return error instanceof Error ? error.message : fallback;
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMetadataPrimitive(
  metadata: unknown,
  key: string,
): string | number | null | undefined {
  if (!isUnknownRecord(metadata)) {
    return undefined;
  }

  const value = metadata[key];
  return typeof value === 'string' || typeof value === 'number' || value === null ? value : undefined;
}

function getGiftSessions(metadata: unknown) {
  return parseIntegerInput(getMetadataPrimitive(metadata, 'gift_sessions'));
}

function toCustomerDetailRecord(
  data: Awaited<ReturnType<typeof getCustomerById>>,
  bookings: CustomerDetailBooking[],
  moduleKey: TenantModuleKey | null,
): CustomerDetailRecord | null {
  if (!data) return null;
  const labels = getTenantModulePresentationOrNeutral(moduleKey);
  const gender = getCustomerGenderPresentation(data.gender_baby, moduleKey);

  return {
    ...data,
    baby: {
      name: data.name_baby || labels.secondaryFallback,
      dob: data.dob_baby || data.dob_expected || 'Chưa cập nhật',
      gender: gender.label,
    },
    sessions: (data as { sessions?: unknown[] }).sessions || [],
    allBookings: bookings || [],
  };
}

function pickDefaultBooking(bookings: CustomerDetailBooking[], targetBookingId: string | null) {
  if (targetBookingId) {
    const found = bookings.find((booking) => booking.id === targetBookingId);
    if (found) return found;
  }

  const priority = (status: string) => {
    if (status === 'active' || status === 'in_progress') return 0;
    if (status === 'booked') return 1;
    if (status === 'deposit_pending') return 2;
    if (status === 'completed') return 3;
    return 4;
  };

  return [...bookings].sort((a, b) => {
    const pA = priority(a.status || '');
    const pB = priority(b.status || '');

    if (pA !== pB) return pA - pB;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  })[0];
}

export function useCustomerDetailController() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const targetBookingId = searchParams.get('bookingId');

  const [customer, setCustomer] = useState<CustomerDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);         // Phase 1: critical data
  const [secondaryLoading, setSecondaryLoading] = useState(true); // Phase 2: KTVs, role
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<CustomerDetailBooking | null>(null);
  const [ktvs, setKtvs] = useState<KtvOption[]>([]);
  const [isUpdatingKTV, setIsUpdatingKTV] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData>({
    amount: 0,
    method: 'bank_transfer',
    notes: '',
    receipt_url: '',
    status: 'confirmed',
  });
  const [userRole, setUserRole] = useState<'admin' | 'ktv'>('ktv');
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey | null>(null);
  const [tenantBrand, setTenantBrand] = useState<ResolvedTenantBrandIdentity | null>(null);
  const [bankInfo, setBankInfo] = useState<{ ownerName: string; accountNumber: string; bankName: string }>({
    ownerName: '',
    accountNumber: '',
    bankName: '',
  });
  const [tenantPhone, setTenantPhone] = useState<string>('');
  const [isExportingQuotation, setIsExportingQuotation] = useState(false);
  const [isExportingCombinedQuotation, setIsExportingCombinedQuotation] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [editData, setEditData] = useState<EditCustomerData>({
    name_mother: '',
    phone: '',
    name_baby: '',
    dob_expected: '',
    dob_baby: '',
    address: '',
    notes: '',
    gender_baby: 'unknown',
    latitude: null,
    longitude: null,
  });
  const [isEditBookingModalOpen, setIsEditBookingModalOpen] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [editBookingData, setEditBookingData] = useState<EditBookingData>({
    package_name: '',
    full_price: 0,
    deposit_amount: 0,
    discount_percent: 0,
    total_sessions: 0,
    gift_sessions: 0,
    completed_sessions: 0,
    preferred_time: '08:00',
    start_date: '',
    status: 'in_progress',
  });
  const [isReusing, setIsReusing] = useState(false);
  // ── Combine mode: multi-select bookings for combined quotation/portal ────────
  const [isCombineMode, setIsCombineMode] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());
  const quotationRef = useRef<HTMLDivElement>(null);
  const combinedQuotationRef = useRef<HTMLDivElement>(null);
  const customerBookingIdsRef = useRef<Set<string>>(new Set());
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBookingIdRef = useRef<string | null>(null); // Track user-selected booking
  
  // Wrapper to update both state and ref when user manually changes booking
  const setActiveBookingWithTracking = useCallback((booking: CustomerDetailBooking | null) => {
    console.log('[setActiveBooking] User selected:', booking?.id, booking?.package_name);
    setActiveBooking(booking);
    activeBookingIdRef.current = booking?.id || null;
  }, []);

  const loadData = useCallback(async (options?: { preserveSelection?: boolean }) => {
    if (!id) return;

    // ─── PHASE 1: Critical data — customer profile + bookings ───────────────────
    // Runs immediately and clears the full-page spinner as soon as possible.
    // Tenant settings are deferred to Phase 2 since they only affect
    // branding labels, not core booking data.
    try {
      const [data, bookings] = await Promise.all([
        getCustomerById(id),
        getBookingsByCustomerId(id) as Promise<CustomerDetailBooking[]>,
      ]);

      customerBookingIdsRef.current = new Set(bookings.map((booking) => booking.id));
      // Use a placeholder module key so the page renders immediately;
      // it will be updated once tenant settings arrive in Phase 2.
      const customerRecord = toCustomerDetailRecord(data, bookings, tenantModuleKey);

      if (customerRecord) {
        setCustomer(customerRecord);

        // ALWAYS try to preserve user's selection first
        // Only fall back to pickDefaultBooking if:
        // 1. No prior selection (activeBookingIdRef.current is null)
        // 2. Prior selection no longer exists
        if (activeBookingIdRef.current) {
          const currentBookingStillExists = bookings.some(b => b.id === activeBookingIdRef.current);
          if (currentBookingStillExists) {
            const updatedActiveBooking = bookings.find(b => b.id === activeBookingIdRef.current) || null;
            setActiveBooking(updatedActiveBooking);
            // Keep ref unchanged - user is still viewing this booking
          } else {
            // User's selected booking was deleted - fall back to default
            const defaultBooking = bookings.length > 0 ? pickDefaultBooking(bookings, targetBookingId) : null;
            setActiveBooking(defaultBooking);
            activeBookingIdRef.current = defaultBooking?.id || null;
          }
        } else {
          // First load - no prior selection, use default
          const defaultBooking = bookings.length > 0 ? pickDefaultBooking(bookings, targetBookingId) : null;
          setActiveBooking(defaultBooking);
          activeBookingIdRef.current = defaultBooking?.id || null;
        }
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      // Phase 1 complete — UI is now visible and interactive
      setLoading(false);
    }

    // ─── PHASE 2: Secondary data — tenant branding, loaded silently ─────────────
    // Does NOT block UI. Runs after the page is already visible.
    try {
      const tenant = await getTenantSettings();
      const nextTenantModuleKey = getDefaultTenantModuleKey(tenant?.enabled_modules);
      setTenantModuleKey(nextTenantModuleKey);
      setTenantBrand(resolveTenantBrandIdentity({
        enabledModules: tenant?.enabled_modules,
        brandTheme: tenant?.brand_theme,
        logoUrl: tenant?.logo_url,
        tenantName: tenant?.name,
        surface: 'invoice',
      }));
      setBankInfo({
        ownerName: tenant?.qr_account_name || '',
        accountNumber: tenant?.qr_account_number || '',
        bankName: tenant?.qr_bank_code || '',
      });
      if (tenant?.contact_phone) {
        setTenantPhone(tenant.contact_phone);
      }
      // Re-map customer record now that we have the correct module key
      setCustomer(prev => prev ? { ...prev } : prev);
    } catch (error) {
      console.error('[Phase 2] Error loading tenant settings:', error);
    } finally {
      setSecondaryLoading(false);
    }
  }, [id, targetBookingId, tenantModuleKey]);

  // Phase 2b: KTV list — loaded in background after critical UI is visible
  const fetchKtvs = useCallback(async () => {
    try {
      const allUsers = await getUsers();
      const allKtvs = allUsers.filter((user) => user.role?.toLowerCase() === 'ktv');
      setKtvs(allKtvs);
    } catch (err: unknown) {
      console.error('Error fetching KTVs:', err);
    }
  }, []);

  const scheduleDataReload = useCallback(() => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      void loadData({ preserveSelection: true }); // Preserve selection during background reload
    }, 400);
  }, [loadData]);

  // Phase 2c: Current user role — loaded in background, doesn't block initial render
  useEffect(() => {
    async function checkRole() {
      const user = await getCurrentUser();
      if (user?.role) {
        const role = user.role.toLowerCase();
        setUserRole(role === 'admin' ? 'admin' : 'ktv');
      }
    }

    void checkRole();
  }, []);

  useEffect(() => {
    // Phase 1 fires immediately; Phase 2 (KTV list) fires after a short delay
    // so it never competes with the critical customer+booking data request.
    void loadData();
    const secondaryTimer = setTimeout(() => {
      void fetchKtvs();
    }, 200); // 200ms head-start for critical data

    const supabase = createClient();
    const channel = supabase
      .channel(`customer-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${id}` }, () => {
        scheduleDataReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, (payload) => {
        const record = (payload.new || payload.old || {}) as { booking_id?: string | null };

        if (!record.booking_id || customerBookingIdsRef.current.has(record.booking_id)) {
          scheduleDataReload();
        }
      })
      .subscribe();

    return () => {
      clearTimeout(secondaryTimer);
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only re-run when customer ID changes, not when callbacks change

  // Separate effect to refresh KTV list when active booking or customer bookings change
  useEffect(() => {
    if (customer) {
      void fetchKtvs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBooking, customer]);

  const refreshPageData = useCallback(async () => {
    await Promise.all([loadData(), fetchKtvs()]);
  }, [fetchKtvs, loadData]);

  usePageRefresh(refreshPageData);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenSessions = useCallback(() => {
    if (!customer) return;
    router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}`);
  }, [customer, router]);

  const handleOpenBookingSessions = useCallback(() => {
    if (!customer) return;
    router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking?.id || ''}`);
  }, [activeBooking, customer, router]);

  const handleOpenEditCustomer = useCallback(() => {
    if (!customer) return;

    setEditData({
      name_mother: customer.name_mother,
      phone: customer.phone,
      name_baby: customer.name_baby || '',
      dob_expected: customer.dob_expected || '',
      dob_baby: customer.dob_baby || '',
      address: customer.address || '',
      notes: customer.notes || '',
      gender_baby: customer.gender_baby || 'unknown',
      latitude: customer.latitude || null,
      longitude: customer.longitude || null,
    });
    setIsEditModalOpen(true);
  }, [customer]);

  const handleUpdateKTV = useCallback(async (ktvId: string) => {
    if (!activeBooking) return;

    setIsUpdatingKTV(true);
    try {
      const result = await updateBooking(activeBooking.id, { assigned_ktv_id: ktvId });
      if (result.error) throw new Error(result.error);
      
      // Optimistic update: Update local state immediately without waiting for full data reload
      // This ensures the dropdown shows the new KTV right away (better UX)
      const selectedKtv = ktvs.find(k => k.id === ktvId);
      setActiveBooking((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assigned_ktv_id: ktvId,
          assigned_ktv_name: selectedKtv?.full_name || null,
          users: selectedKtv ? { 
            id: selectedKtv.id, 
            full_name: selectedKtv.full_name,
            role: selectedKtv.role,
          } : null,
        };
      });
      
      toast.success('Đã cập nhật KTV phụ trách');
      // Background refresh to sync any other changes (optional)
      void loadData();
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
      // On error, reload data to revert optimistic update
      await loadData();
    } finally {
      setIsUpdatingKTV(false);
    }
  }, [activeBooking, ktvs, loadData]);

  const handleUpdateCustomer = useCallback(async () => {
    setIsUpdatingCustomer(true);
    try {
      const result = await updateCustomer(id, editData);
      if (result.error) throw new Error(result.error);

      if (result.warning) {
        toast.success('Cập nhật thành công các thông tin khác!');
        toast.warning(result.warning, { duration: 10000 });
      } else {
        toast.success('Cập nhật hồ sơ thành công!');
      }

      setIsEditModalOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsUpdatingCustomer(false);
    }
  }, [editData, id, loadData]);

  const handleSaveBooking = useCallback(async () => {
    if (isSavingBooking) return;
    if (!activeBooking) return;

    const baseSessions = parseIntegerInput(editBookingData.total_sessions, { min: 0, max: 100 });
    const giftSessions = parseIntegerInput(editBookingData.gift_sessions, { min: 0, max: 100 });
    const totalSessions = baseSessions + giftSessions;

    // ── OPTIMISTIC UI UPDATE ──────────────────────────────────────────────────
    // Close modal immediately for better UX (don't block on server response)
    setIsEditBookingModalOpen(false);
    
    // Update local state optimistically
    setActiveBooking(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        package_name: editBookingData.package_name || prev.package_name,
        full_price: parseMoneyInput(editBookingData.full_price),
        deposit_amount: parseMoneyInput(editBookingData.deposit_amount),
        discount_percent: normalizeDiscountPercent(editBookingData.discount_percent),
        total_sessions: totalSessions,
        completed_sessions: parseIntegerInput(editBookingData.completed_sessions, { min: 0, max: 100 }),
        preferred_time: editBookingData.preferred_time || prev.preferred_time,
        start_date: editBookingData.start_date || prev.start_date,
        status: editBookingData.status,
        metadata: {
          ...((prev.metadata as Record<string, unknown>) || {}),
          gift_sessions: giftSessions,
        },
      };
    });

    // Show background loading toast
    toast.loading('Đang lưu thay đổi...', { id: 'save-booking' });
    setIsSavingBooking(true);

    // ── BACKGROUND SERVER UPDATE ──────────────────────────────────────────────
    try {
      const result = await updateBooking(activeBooking.id, {
        package_name: editBookingData.package_name || null,
        full_price: parseMoneyInput(editBookingData.full_price),
        deposit_amount: parseMoneyInput(editBookingData.deposit_amount),
        discount_percent: normalizeDiscountPercent(editBookingData.discount_percent),
        total_sessions: totalSessions,
        completed_sessions: parseIntegerInput(editBookingData.completed_sessions, { min: 0, max: 100 }),
        preferred_time: editBookingData.preferred_time || '08:00',
        start_date: editBookingData.start_date || null,
        status: editBookingData.status,
        metadata: {
          ...((activeBooking.metadata as Record<string, unknown>) || {}),
          gift_sessions: giftSessions,
        },
      });

      if (result.error) throw new Error(result.error);

      toast.success('Cập nhật gói dịch vụ thành công!', { id: 'save-booking' });
      // Refresh from server to get authoritative state
      await loadData();
    } catch (error: unknown) {
      toast.error('Lỗi cập nhật gói: ' + getErrorMessage(error), { id: 'save-booking' });
      // On error, reload data to revert optimistic update
      await loadData();
    } finally {
      setIsSavingBooking(false);
    }
  }, [activeBooking, editBookingData, isSavingBooking, loadData]);

  const handleReusePackage = useCallback(async (bookingId: string) => {
    if (isReusing) return;
    if (!bookingId || !customer) return;
    const confirmed = window.confirm(`Bạn có chắc chắn muốn tái sử dụng gói dịch vụ nhanh cho khách hàng ${customer.name_mother}?`);
    if (!confirmed) return;

    setIsReusing(true);
    try {
      const result = await reusePackage(bookingId);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else if ('data' in result && result.data) {
        toast.success('Đã tái sử dụng gói dịch vụ thành công!');
        await loadData();
      }
    } catch (error) {
      console.error('Reuse failed:', error);
      toast.error('Có lỗi xảy ra khi xử lý');
    } finally {
      setIsReusing(false);
    }
  }, [customer, isReusing, loadData]);

  const handleReuseActivePackage = useCallback(() => {
    if (!activeBooking) return;
    void handleReusePackage(activeBooking.id);
  }, [activeBooking, handleReusePackage]);

  const handleRecordPayment = useCallback(async () => {
    if (isRecordingPayment) return;
    if (!activeBooking) return;
    if (paymentData.amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setIsRecordingPayment(true);
    try {
      let finalReceiptUrl = paymentData.receipt_url;

      if (paymentFile) {
        const supabase = createClient();
        const fileExt = paymentFile.name.split('.').pop();
        const fileName = `${activeBooking.id}-${Date.now()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, paymentFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          if (uploadError.message.includes('bucket not found')) {
            toast.error('Hệ thống Storage chưa được cấu hình. Vui lòng tạo bucket "receipts".');
          }
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from('receipts').getPublicUrl(filePath);
          finalReceiptUrl = publicUrl;
        }
      }

      const result = await recordRemainingPayment({
        booking_id: activeBooking.id,
        customer_id: id,
        amount: paymentData.amount,
        payment_method: paymentData.method,
        notes: paymentData.notes,
        receipt_url: finalReceiptUrl,
        status: paymentData.status,
      });

      if (result.error) throw new Error(result.error);

      toast.success('Đã ghi nhận thanh toán thành công!');
      await loadData();
      setIsPaymentModalOpen(false);
      setPaymentFile(null);
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsRecordingPayment(false);
    }
  }, [activeBooking, id, isRecordingPayment, loadData, paymentData, paymentFile]);

  const receiptData = useMemo<ReceiptData | null>(() => {
    if (!customer || !activeBooking || !tenantBrand) return null;
    const paymentState = calculateBookingPaymentState({
      fullPrice: activeBooking.full_price,
      discountPercent: activeBooking.discount_percent,
      depositAmount: activeBooking.deposit_amount,
      bookingStatus: activeBooking.status,
      revenues: activeBooking.revenue,
    });

    return {
      customerName: customer.name_mother || 'Chưa cập nhật',
      phone: customer.phone || 'Chưa cập nhật',
      address: customer.address || 'Chưa cập nhật',
      serviceNote: `${activeBooking.package_name || activeBooking.packages?.name || 'Gói dịch vụ'} (Bắt đầu gói từ ${activeBooking.start_date ? formatViDate(activeBooking.start_date) : 'Chưa cập nhật'})`,
      brand: {
        displayName: tenantBrand.invoiceDisplayName || tenantBrand.displayName,
        logoUrl: tenantBrand.logoUrl,
        primaryColor: tenantBrand.primaryColor,
        accentColor: tenantBrand.accentColor,
        monogram: tenantBrand.monogram,
      },
      items: [
        {
          id: 1,
          name: activeBooking.package_name || activeBooking.packages?.name || 'Gói dịch vụ',
          sessions: (() => {
            const gift = getGiftSessions(activeBooking.metadata);
            return Math.max(0, (activeBooking.total_sessions || 15) - gift);
          })(),
          unitPrice: (() => {
            const gift = getGiftSessions(activeBooking.metadata);
            const paidSessions = Math.max(1, (activeBooking.total_sessions || 15) - gift);
            return Math.round((activeBooking.full_price || 0) / paidSessions);
          })(),
          total: activeBooking.full_price || 0,
          discountNote: (() => {
            const disc = activeBooking.discount_percent || 0;
            const gift = getGiftSessions(activeBooking.metadata);
            if (disc > 0 && gift > 0) return `Giảm ${disc}% + Tặng ${gift} buổi`;
            if (disc > 0) return `Giảm ${disc}%`;
            if (gift > 0) return `Tặng ${gift} buổi`;
            return 'Không có';
          })(),
          prepaid: paymentState.totalPaid,
          finalPayment: paymentState.remainingDebt,
        },
      ],
      totalAmount: Math.round(paymentState.priceAfterDiscount),
      bankInfo: {
        ownerName: bankInfo.ownerName || 'Chưa cấu hình',
        accountNumber: bankInfo.accountNumber || 'Chưa cấu hình',
        bankName: bankInfo.bankName || 'Chưa cấu hình',
      },
    };
  }, [activeBooking, customer, tenantBrand, bankInfo]);

  const handleExportQuotation = useCallback(async () => {
    if (!quotationRef.current || !customer) return;

    setIsExportingQuotation(true);
    toast.loading('Đang khởi tạo ảnh báo giá...', { id: 'quotation-export' });

    try {
      const dataUrl = await toPng(quotationRef.current, {
        quality: 1,
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `Bao_Gia_${(customer.name_mother || 'Khach').replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Đã xuất ảnh báo giá thành công!', { id: 'quotation-export' });
    } catch (error) {
      console.error('Failed to export image', error);
      toast.error('Lỗi khi xuất ảnh. Vui lòng thử lại!', { id: 'quotation-export' });
    } finally {
      setIsExportingQuotation(false);
    }
  }, [customer]);

  const handleBookingSuccess = useCallback(async () => {
    await loadData();
    setIsBookingModalOpen(false);
  }, [loadData]);

  // ── Combine mode handlers ────────────────────────────────────────────────────
  const handleToggleCombineMode = useCallback(() => {
    setIsCombineMode(prev => {
      if (prev) {
        // Exiting combine mode: clear selection
        setSelectedBookingIds(new Set());
      }
      return !prev;
    });
  }, []);

  const handleToggleBookingSelection = useCallback((bookingId: string) => {
    setSelectedBookingIds(prev => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
  }, []);

  const combinedReceiptData = useMemo<ReceiptData | null>(() => {
    if (!customer || !tenantBrand) return null;
    if (selectedBookingIds.size < 2) return null;

    const selectedBookings = (customer.allBookings || []).filter(b => selectedBookingIds.has(b.id));
    if (selectedBookings.length < 2) return null;

    const items = selectedBookings.map((booking, idx) => {
      const paymentState = calculateBookingPaymentState({
        fullPrice: booking.full_price,
        discountPercent: booking.discount_percent,
        depositAmount: booking.deposit_amount,
        bookingStatus: booking.status,
        revenues: booking.revenue,
      });
      const disc = booking.discount_percent || 0;
      const gift = getGiftSessions(booking.metadata);
      const discountNote = (() => {
        if (disc > 0 && gift > 0) return `Giảm ${disc}% + Tặng ${gift} buổi`;
        if (disc > 0) return `Giảm ${disc}%`;
        if (gift > 0) return `Tặng ${gift} buổi`;
        return 'Không có';
      })();

      return {
        id: idx + 1,
        name: booking.package_name || booking.packages?.name || 'Gói dịch vụ',
        sessions: (() => {
          const giftSess = getGiftSessions(booking.metadata);
          return Math.max(0, (booking.total_sessions || 1) - giftSess);
        })(),
        unitPrice: (() => {
          const giftSess = getGiftSessions(booking.metadata);
          const paidSess = Math.max(1, (booking.total_sessions || 1) - giftSess);
          return Math.round((booking.full_price || 0) / paidSess);
        })(),
        total: booking.full_price || 0,
        discountNote,
        prepaid: paymentState.totalPaid,
        finalPayment: paymentState.remainingDebt,
      };
    });

    const totalAmount = selectedBookings.reduce((sum, b) => {
      const ps = calculateBookingPaymentState({
        fullPrice: b.full_price,
        discountPercent: b.discount_percent,
        depositAmount: b.deposit_amount,
        bookingStatus: b.status,
        revenues: b.revenue,
      });
      return sum + Math.round(ps.priceAfterDiscount);
    }, 0);

    return {
      customerName: customer.name_mother || 'Chưa cập nhật',
      phone: customer.phone || 'Chưa cập nhật',
      address: customer.address || 'Chưa cập nhật',
      serviceNote: `Báo giá gộp ${selectedBookings.length} gói dịch vụ`,
      brand: {
        displayName: tenantBrand.invoiceDisplayName || tenantBrand.displayName,
        logoUrl: tenantBrand.logoUrl,
        primaryColor: tenantBrand.primaryColor,
        accentColor: tenantBrand.accentColor,
        monogram: tenantBrand.monogram,
      },
      items,
      totalAmount,
      bankInfo: {
        ownerName: bankInfo.ownerName || 'Chưa cấu hình',
        accountNumber: bankInfo.accountNumber || 'Chưa cấu hình',
        bankName: bankInfo.bankName || 'Chưa cấu hình',
      },
    };
  }, [customer, tenantBrand, selectedBookingIds, bankInfo]);

  const handleExportCombinedQuotation = useCallback(async () => {
    if (!combinedQuotationRef.current || !customer) return;

    setIsExportingCombinedQuotation(true);
    toast.loading('Đang khởi tạo ảnh báo giá gộp...', { id: 'combined-quotation-export' });

    try {
      const dataUrl = await toPng(combinedQuotationRef.current, {
        quality: 1,
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `Bao_Gia_Gop_${(customer.name_mother || 'Khach').replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Đã xuất ảnh báo giá gộp thành công!', { id: 'combined-quotation-export' });
    } catch (error) {
      console.error('Failed to export combined quotation image', error);
      toast.error('Lỗi khi xuất ảnh. Vui lòng thử lại!', { id: 'combined-quotation-export' });
    } finally {
      setIsExportingCombinedQuotation(false);
    }
  }, [customer]);

  const handleShareCombinedPortal = useCallback(async () => {
    if (selectedBookingIds.size < 2 || !customer?.allBookings) return;

    const selectedBookings = customer.allBookings.filter(b => selectedBookingIds.has(b.id));
    toast.loading('Đang tạo link gộp...', { id: 'combined-portal' });

    try {
      const tokens: string[] = [];
      for (const booking of selectedBookings) {
        let token = booking.share_token;
        if (!token) {
          const result = await generateShareToken(booking.id);
          if (result.error || !result.data) {
            throw new Error(`Lỗi tạo token cho gói "${booking.package_name}": ${result.error || 'Unknown'}`);
          }
          token = result.data.share_token;
        }
        if (!token) {
          throw new Error(`Không thể khởi tạo token chia sẻ cho gói "${booking.package_name}"`);
        }
        tokens.push(token);
      }

      if (tokens.length < 2) throw new Error('Không đủ token để tạo link gộp');

      // Build URL: /portal/[token1]?bundle=[token2]&bundle=[token3]...
      const bundleParams = tokens.slice(1).map(t => `bundle=${encodeURIComponent(t)}`).join('&');
      const url = `${window.location.origin}/portal/${tokens[0]}?${bundleParams}`;
      const success = await copyToClipboard(url);
      if (success) {
        toast.success(`Đã sao chép link gộp ${tokens.length} gói dịch vụ!`, { id: 'combined-portal' });
      } else {
        toast.error('Không thể tự động sao chép link gộp. Vui lòng thử lại.', { id: 'combined-portal' });
      }
    } catch (error) {
      toast.error('Lỗi: ' + getErrorMessage(error), { id: 'combined-portal' });
    }
  }, [customer, selectedBookingIds]);

  const handlePayRemaining = useCallback((amount: number) => {
    if (isRecordingPayment) return;
    setPaymentData((prev) => ({
      ...prev,
      amount,
    }));
    setIsPaymentModalOpen(true);
  }, [isRecordingPayment]);

  const handleOpenZalo = useCallback(() => {
    if (!customer) return;
    const cleanPhone = customer.phone.replace(/[^\d]/g, '');
    window.open(`https://zalo.me/${cleanPhone}`, '_blank');
  }, [customer]);

  const handleSharePortal = useCallback(async () => {
    if (!activeBooking) return;
    let token = activeBooking.share_token;

    if (!token) {
      toast.loading('Đang khởi tạo link...', { id: 'portal-link' });
      const result = await generateShareToken(activeBooking.id);
      if (result.error || !result.data) {
        toast.error('Lỗi khởi tạo link: ' + (result.error || 'Unknown error'), { id: 'portal-link' });
        return;
      }
      token = result.data.share_token;
      setActiveBooking({ ...activeBooking, share_token: token });
      toast.dismiss('portal-link');
    }

    const url = `${window.location.origin}/portal/${token}`;
    const success = await copyToClipboard(url);
    if (success) {
      toast.success('Đã sao chép link Cổng thông tin khách hàng');
    } else {
      toast.error('Không thể tự động sao chép link. Vui lòng tự sao chép.');
    }
  }, [activeBooking]);

  const handleExportContract = useCallback(() => {
    toast.success('Đang khởi tạo tệp hợp đồng...');
  }, []);

  const handleOpenEditBooking = useCallback(() => {
    if (!activeBooking) return;

    const giftSessions = getGiftSessions(activeBooking.metadata);

    setEditBookingData({
      package_name: activeBooking.package_name || activeBooking.packages?.name || '',
      full_price: activeBooking.full_price || 0,
      deposit_amount: activeBooking.deposit_amount || 0,
      discount_percent: activeBooking.discount_percent || 0,
      total_sessions: (activeBooking.total_sessions || 0) - giftSessions,
      gift_sessions: giftSessions,
      completed_sessions: activeBooking.completed_sessions || 0,
      preferred_time: activeBooking.preferred_time || '08:00',
      start_date: activeBooking.start_date || '',
      status: activeBooking.status || 'in_progress',
    });
    setIsEditBookingModalOpen(true);
  }, [activeBooking]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
    try {
      // Call server action to delete booking (bypasses RLS)
      const response = await fetch('/api/bookings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      const result = await response.json();
      
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to delete booking');
      }

      toast.success('Đã xóa gói dịch vụ vĩnh viễn');
      
      // If deleted booking was the active one, clear selection
      if (activeBooking?.id === bookingId) {
        setActiveBooking(null);
        activeBookingIdRef.current = null;
      }
      
      await loadData();
    } catch (error) {
      console.error('Delete booking error:', error);
      toast.error('Lỗi khi xóa gói: ' + getErrorMessage(error));
    }
  }, [activeBooking, loadData]);

  const isDepositOnly = Boolean(activeBooking && activeBooking.status === 'deposit_pending' && !activeBooking.package_id);
  const sortedSessions = useMemo(
    () => (activeBooking?.session_logs ? [...activeBooking.session_logs].sort((a, b) => (a.session_number || 0) - (b.session_number || 0)) : []),
    [activeBooking]
  );
  const nextSession = sortedSessions.find((session) => session.status === 'scheduled');
  const activePaymentState = activeBooking
    ? calculateBookingPaymentState({
        fullPrice: activeBooking.full_price,
        discountPercent: activeBooking.discount_percent,
        depositAmount: activeBooking.deposit_amount,
        bookingStatus: activeBooking.status,
        revenues: activeBooking.revenue,
      })
    : null;
  const activeDepositAmount = activePaymentState?.totalPaid || 0;
  const activeNetPrice = Math.round(activePaymentState?.priceAfterDiscount || 0);
  const isCompleted = Boolean(activeBooking && (activeBooking.completed_sessions || 0) >= (activeBooking.total_sessions || 15));

  return {
    activeBooking,
    activeDepositAmount,
    activeNetPrice,
    customer,
    editBookingData,
    editData,
    handleBack,
    handleBookingSuccess,
    handleDeleteBooking,
    handleExportContract,
    handleExportCombinedQuotation,
    handleExportQuotation,
    handleOpenBookingSessions,
    handleOpenEditBooking,
    handleOpenEditCustomer,
    handleOpenSessions,
    handleOpenZalo,
    handlePayRemaining,
    handleRecordPayment,
    handleReuseActivePackage,
    handleSaveBooking,
    handleShareCombinedPortal,
    handleSharePortal,
    handleToggleBookingSelection,
    handleToggleCombineMode,
    handleUpdateCustomer,
    handleUpdateKTV,
    isBookingModalOpen,
    isCombineMode,
    isCompleted,
    isDepositOnly,
    isEditBookingModalOpen,
    isEditModalOpen,
    isExportingCombinedQuotation,
    isExportingQuotation,
    isPaymentModalOpen,
    isRecordingPayment,
    isReusing,
    isSavingBooking,
    isUpdatingCustomer,
    isUpdatingKTV,
    ktvs,
    loading,
    nextSession,
    paymentData,
    paymentFile,
    combinedQuotationRef,
    combinedReceiptData,
    quotationRef,
    receiptData,
    selectedBookingIds,
    setActiveBooking: setActiveBookingWithTracking, // Export wrapper instead of direct setter
    setEditBookingData,
    setEditData,
    setIsBookingModalOpen,
    setIsEditBookingModalOpen,
    setIsEditModalOpen,
    setIsPaymentModalOpen,
    setPaymentData,
    setPaymentFile,
    sortedSessions,
    tenantModuleKey,
    tenantPhone,
    userRole,
  };
}
