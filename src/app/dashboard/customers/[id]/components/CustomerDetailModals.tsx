'use client';

import { formatMoneyInput, parseMoneyInput } from '@bella/shared';
import { cn, parseIntegerInput, parsePercentInput } from '@/lib/utils';;
import {
  getTenantModulePresentationOrNeutral,
} from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { geocodeAddress } from '@/services/customer-actions';
import { motion } from 'framer-motion';
import { AlertCircle, Camera, CheckCircle2, CreditCard as CreditCardIcon, DollarSign as DollarIcon, FileText, Gift, Image as ImageIcon, Loader2, PlusCircle, Sparkles, User } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useScrollLock } from '@/hooks/useScrollLock';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { EditBookingData, EditCustomerData, ModalStateSetter, PaymentData } from '../types';

export function EditCustomerModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  data,
  setData,
  tenantModuleKey,
  customerCreatedAt,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  data: EditCustomerData;
  setData: ModalStateSetter<EditCustomerData>;
  tenantModuleKey: TenantModuleKey | null;
  customerCreatedAt?: string | null;
}) {
  const [isGeocoding, setIsGeocoding] = useState(false);
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);
  const createdAtLabel = customerCreatedAt ? new Date(customerCreatedAt).toLocaleDateString('vi-VN') : 'Mới tạo';

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleAutoGeocode = async () => {
    if (!data.address) {
      toast.error('Vui lòng nhập địa chỉ trước khi lấy tọa độ');
      return;
    }
    setIsGeocoding(true);
    try {
      const coords = await geocodeAddress(data.address);
      if (coords) {
        setData({
          ...data,
          latitude: coords.latitude,
          longitude: coords.longitude
        });
        toast.success(`Đã tìm thấy tọa độ: ${coords.latitude}, ${coords.longitude}`);
      } else {
        toast.error('Không tìm thấy tọa độ cho địa chỉ này. Vui lòng nhập thủ công.');
      }
    } catch {
      toast.error('Lỗi khi định vị địa chỉ');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#1A0A0E]/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cập nhật thông tin</h2>
              <p className="text-xs text-slate-500 font-bold italic">{customerLabels.editDescription}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-rose-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all">
            <PlusCircle className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{customerLabels.primaryNameLabel}</label>
              <input
                type="text"
                value={data.name_mother}
                onChange={(e) => setData({ ...data, name_mother: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số điện thoại</label>
              <input
                type="text"
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{customerLabels.secondaryNameLabel}</label>
              <input
                type="text"
                value={data.name_baby}
                onChange={(e) => setData({ ...data, name_baby: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{customerLabels.secondaryDateLabel}</label>
              <input
                type="date"
                value={data.dob_baby || data.dob_expected || ''}
                onChange={(e) => setData({ ...data, dob_baby: e.target.value, dob_expected: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{customerLabels.secondaryGenderLabel}</label>
            <div className="grid grid-cols-3 gap-4">
              {customerLabels.genderOptions.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setData({ ...data, gender_baby: g.id })}
                  className={cn(
                    "py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border",
                    data.gender_baby === g.id
                      ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20 scale-[1.02]"
                      : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/30"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Địa chỉ</label>
              <button
                type="button"
                onClick={handleAutoGeocode}
                disabled={isGeocoding}
                className="text-[9px] font-black text-primary hover:text-rose-600 uppercase tracking-widest flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {isGeocoding ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang tìm...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Tự động lấy tọa độ
                  </>
                )}
              </button>
            </div>
            <textarea
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700 h-20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Điểm tích lũy</label>
              <input
                type="number"
                min="0"
                value={data.loyalty_points.toString()}
                onChange={(e) => setData({ ...data, loyalty_points: parseIntegerInput(e.target.value, { min: 0, max: 1000000 }) })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Khách thân thiết</label>
              <div className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700">
                Có
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ghi chú</label>
            <textarea
              value={data.notes}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700 h-24 resize-none"
              placeholder="Nhập ghi chú chăm sóc khách hàng..."
            />
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <div className="grid grid-cols-1 gap-3 text-xs font-bold text-slate-600 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phân nhóm</p>
                <p className="mt-1 text-slate-900">Chưa phân nhóm</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nguồn khách</p>
                <p className="mt-1 text-slate-900">Giới thiệu</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ngày tạo hồ sơ</p>
                <p className="mt-1 text-slate-900">{createdAtLabel}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{customerLabels.locationLatitudeLabel}</label>
              <input
                type="number"
                step="any"
                placeholder="Ví dụ: 10.7756"
                value={data.latitude === null || data.latitude === undefined ? '' : data.latitude}
                onChange={(e) => setData({ ...data, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{customerLabels.locationLongitudeLabel}</label>
              <input
                type="number"
                step="any"
                placeholder="Ví dụ: 106.7019"
                value={data.longitude === null || data.longitude === undefined ? '' : data.longitude}
                onChange={(e) => setData({ ...data, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Hủy</button>
          <button
            disabled={isSubmitting}
            onClick={onConfirm}
            className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Lưu thay đổi
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function BookingPaymentModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  data,
  setData,
  file,
  setFile,
  customerName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  data: PaymentData;
  setData: ModalStateSetter<PaymentData>;
  file: File | null;
  setFile: ModalStateSetter<File | null>;
  customerName: string;
}) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useScrollLock(isOpen);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#1A0A0E]/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Xác nhận thanh toán</h2>
            <p className="text-sm font-bold text-primary flex items-center gap-2">
              <User className="w-4 h-4" />
              Khách hàng: {customerName}
            </p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-rose-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all">
            <PlusCircle className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <DollarIcon className="w-3.5 h-3.5" /> Số tiền thanh toán
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatMoneyInput(data.amount)}
                onChange={(e) => {
                  setData({ ...data, amount: parseMoneyInput(e.target.value) });
                }}
                data-testid="payment-amount-input"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-black text-lg text-primary"
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">VNĐ</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CreditCardIcon className="w-3.5 h-3.5" /> Phương thức
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'bank_transfer', label: 'Chuyển khoản' },
                { id: 'cash', label: 'Tiền mặt' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setData({ ...data, method: m.id })}
                  data-testid={`payment-method-${m.id}`}
                  className={cn(
                    "py-3 px-4 rounded-xl font-bold text-sm transition-all border",
                    data.method === m.id
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                      : "bg-slate-50 text-slate-500 border-slate-100 hover:border-primary/30"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" /> Minh chứng thanh toán (Bill)
            </label>

            <div className="relative group">
              {file ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 group">
                  {previewUrl && (
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 480px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => setFile(null)}
                      className="bg-white text-rose-500 p-2 rounded-xl font-black text-xs uppercase"
                    >
                      Thay đổi ảnh
                    </button>
                  </div>
                </div>
              ) : (
                <label className="w-full h-32 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 hover:border-primary/30 transition-all">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-primary">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tải lên ảnh Bill</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {!file && (
              <div className="relative group mt-3">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Hoặc dán link ảnh trực tiếp..."
                  value={data.receipt_url}
                  onChange={(e) => setData({ ...data, receipt_url: e.target.value })}
                  data-testid="payment-receipt-url-input"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-xs"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Ghi chú
            </label>
            <textarea
              placeholder="Nhập ghi chú thanh toán..."
              value={data.notes}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
              data-testid="payment-notes-input"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm h-24 resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi nhận tài chính</label>
            <div
              onClick={() => setData({ ...data, status: data.status === 'confirmed' ? 'pending' : 'confirmed' })}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all",
                data.status === 'confirmed'
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-50 border-transparent text-slate-500"
              )}
            >
              <div className="flex items-center gap-2">
                {data.status === 'confirmed' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-[10px] font-black uppercase tracking-wider">{data.status === 'confirmed' ? 'Xác nhận ngay (Vào báo cáo)' : 'Chờ phê duyệt'}</span>
              </div>
              <div className={cn(
                "w-10 h-5 rounded-full relative transition-all",
                data.status === 'confirmed' ? "bg-emerald-500" : "bg-slate-300"
              )}>
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                  data.status === 'confirmed' ? "left-6" : "left-1"
                )} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Hủy</button>
          <button
            disabled={isSubmitting || data.amount <= 0}
            onClick={onConfirm}
            data-testid="payment-submit-button"
            className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Xác nhận thu tiền
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function EditBookingModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  data,
  setData,
  bookingId,
  currentKtvId,
  currentKtvName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  data: EditBookingData;
  setData: ModalStateSetter<EditBookingData>;
  bookingId?: string;
  currentKtvId?: string;
  currentKtvName?: string;
}) {
  const [ktvAvailability, setKtvAvailability] = useState<{
    available: boolean;
    reason?: string;
    conflictType?: 'overlap' | 'break_time_violation' | 'daily_limit';
    existingBookingEndTime?: string;
    requiredBreakMinutes?: number;
    nextAvailableTime?: string;
  } | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  useScrollLock(isOpen);

  // Check KTV availability when time changes
  useEffect(() => {
    if (!isOpen || !currentKtvId || !data.start_date || !data.preferred_time) {
      setKtvAvailability(null);
      return;
    }

    const checkAvailability = async () => {
      setIsCheckingAvailability(true);
      try {
        const searchParams = new URLSearchParams({
          date: data.start_date,
          time: data.preferred_time,
          duration: '60', // Default 60 minutes
        });

        if (bookingId) {
          searchParams.append('excludeBookingId', bookingId);
        }

        const response = await fetch(`/api/bookings/check-ktv-availability?${searchParams.toString()}`);
        
        if (!response.ok) {
          console.error('[EditBookingModal] Failed to check availability');
          setKtvAvailability(null);
          return;
        }

        const result = await response.json();
        
        // Find current KTV in results
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
          (ktv: KtvAvailabilityItem) => ktv.id === currentKtvId
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
        console.error('[EditBookingModal] Error checking availability:', error);
        setKtvAvailability(null);
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    // Debounce the check
    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [isOpen, data.start_date, data.preferred_time, currentKtvId, bookingId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#1A0A0E]/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sửa gói dịch vụ</h2>
              <p className="text-xs text-slate-500 font-bold italic">Điều chỉnh chi tiết gói liệu trình của khách</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-rose-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all">
            <PlusCircle className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* KTV Availability Warning Banner */}
          {ktvAvailability && !ktvAvailability.available && currentKtvName && (
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-50/90 to-orange-50/60 border border-amber-200/50 rounded-3xl p-5 shadow-lg shadow-amber-500/[0.03] animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-orange-500" />
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-extrabold text-amber-900 text-xs uppercase tracking-wider">
                      ⚠️ {currentKtvName} không khả dụng
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
                    → Vui lòng chọn KTV khác hoặc dời lịch hẹn sang {ktvAvailability.nextAvailableTime ? <strong>{ktvAvailability.nextAvailableTime}</strong> : 'thời điểm khác'}
                  </p>
                </div>
                {isCheckingAvailability && (
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0 mt-1" />
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên gói dịch vụ</label>
            <input
              type="text"
              value={data.package_name}
              onChange={(e) => setData({ ...data, package_name: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              placeholder="Nhập tên gói dịch vụ..."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tổng cộng (Giá gốc)</label>
              <div className="relative">
                <input
                  type="text"
                  value={formatMoneyInput(data.full_price)}
                  onChange={(e) => {
                    setData({ ...data, full_price: parseMoneyInput(e.target.value) });
                  }}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">VNĐ</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chiết khấu (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={data.discount_percent.toString()}
                  onChange={(e) => setData({ ...data, discount_percent: parsePercentInput(e.target.value) })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đã thanh toán / Cọc</label>
              <div className="relative">
                <input
                  type="text"
                  value={formatMoneyInput(data.deposit_amount)}
                  onChange={(e) => {
                    setData({ ...data, deposit_amount: parseMoneyInput(e.target.value) });
                  }}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">VNĐ</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tặng thêm buổi</label>
              <input
                type="number"
                min="0"
                value={data.gift_sessions.toString()}
                onChange={(e) => setData({ ...data, gift_sessions: parseIntegerInput(e.target.value, { min: 0, max: 100 }) })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tổng số buổi</label>
              <input
                type="number"
                value={data.total_sessions.toString()}
                onChange={(e) => setData({ ...data, total_sessions: parseIntegerInput(e.target.value, { min: 0, max: 100 }) })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buổi đã hoàn thành</label>
              <input
                type="number"
                value={data.completed_sessions.toString()}
                onChange={(e) => setData({ ...data, completed_sessions: parseIntegerInput(e.target.value, { min: 0, max: 100 }) })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Giờ chăm sóc mặc định</label>
              <input
                type="time"
                value={data.preferred_time}
                onChange={(e) => setData({ ...data, preferred_time: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày bắt đầu liệu trình</label>
              <input
                type="date"
                value={data.start_date}
                onChange={(e) => setData({ ...data, start_date: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái gói</label>
              <PremiumSelect
                value={data.status}
                onChange={(value) => setData({ ...data, status: value })}
                options={[
                  { value: 'in_progress', label: 'Đang thực hiện' },
                  { value: 'completed', label: 'Đã hoàn thành' },
                  { value: 'cancelled', label: 'Đã hủy' },
                  { value: 'deposit_pending', label: 'Chờ đặt cọc / Phiếu cọc' },
                ]}
                placeholder="Chọn trạng thái..."
                buttonClassName="w-full px-6 py-4 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 flex items-center justify-between transition-all duration-200 active:scale-[0.98]"
              />
            </div>

            {/* Real-time Total Sessions Display */}
            <div className="space-y-2 col-span-2 bg-pink-50/50 p-4 border border-pink-100/50 rounded-2xl flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Tổng số buổi thực tế (gồm tặng thêm):</span>
              <span className="text-sm font-black text-primary">
                {(data.total_sessions || 0) + (data.gift_sessions || 0)} buổi
              </span>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Hủy</button>
          <button
            disabled={isSubmitting}
            onClick={onConfirm}
            className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Lưu thay đổi
          </button>
        </div>
      </motion.div>
    </div>
  );
}
