'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Package, Clock, User } from 'lucide-react';
import { toast } from 'sonner';
import type { AddToWaitlistInput } from '@/types/waitlist';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface AddToWaitlistModalProps {
  isOpen: boolean;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Customer {
  id: string;
  name: string; // Changed from name_mother - API returns "name"
  name_baby: string | null;
  phone: string;
  tier: 'vip' | 'loyal' | 'new';
  // total_spending removed - not needed for waitlist
}

interface Package {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface KTV {
  id: string;
  name: string;
}

export function AddToWaitlistModal({
  isOpen,
  tenantId,
  onClose,
  onSuccess,
}: AddToWaitlistModalProps) {
  // Form state
  const [formData, setFormData] = useState<Partial<AddToWaitlistInput>>({
    tenant_id: tenantId,
    preferred_start_time: '14:00',
    duration_minutes: 90,
    is_flexible: false,
  });

  // Lookup data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [ktvs, setKtvs] = useState<KTV[]>([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [isLoadingKtvs, setIsLoadingKtvs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Priority preview
  const [priorityPreview, setPriorityPreview] = useState({
    position: 0,
    score: 0,
    tierScore: 0,
    valueScore: 0,
    flexibilityBonus: 0,
  });

  const fetchCustomers = useCallback(async () => {
    setIsLoadingCustomers(true);
    try {
      const params = new URLSearchParams({
        tenant_id: tenantId,
        limit: '10',
      });
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/customers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (err: unknown) {
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [tenantId, searchQuery]);

  const fetchPackages = useCallback(async () => {
    setIsLoadingPackages(true);
    try {
      const response = await fetch(`/api/packages?tenant_id=${tenantId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (err: unknown) {
      console.error('Error fetching packages:', err);
    } finally {
      setIsLoadingPackages(false);
    }
  }, [tenantId]);

  const fetchKtvs = useCallback(async () => {
    setIsLoadingKtvs(true);
    try {
      const response = await fetch(`/api/users?tenant_id=${tenantId}&role=ktv&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setKtvs(data.users || []);
      }
    } catch (err: unknown) {
      console.error('Error fetching KTVs:', err);
    } finally {
      setIsLoadingKtvs(false);
    }
  }, [tenantId]);

  const calculatePriorityPreview = useCallback(async () => {
    const customer = customers.find((c) => c.id === formData.customer_id);
    const pkg = packages.find((p) => p.id === formData.package_id);

    if (!customer || !pkg) return;

    // Simple priority calculation (matches backend logic)
    const tierScores = { vip: 40, loyal: 25, new: 10 };
    const tierScore = tierScores[customer.tier];

    const valueScore = Math.min(30, Math.round((pkg.price / 10000000) * 30));
    const flexibilityBonus = formData.is_flexible ? 10 : 0;

    const totalScore = tierScore + valueScore + flexibilityBonus;

    // Estimate position (simplified - real calculation is in backend)
    let position = 1;
    if (totalScore < 40) position = 5;
    else if (totalScore < 60) position = 3;
    else if (totalScore < 80) position = 2;

    setPriorityPreview({
      position,
      score: totalScore,
      tierScore,
      valueScore,
      flexibilityBonus,
    });
  }, [customers, packages, formData.customer_id, formData.package_id, formData.is_flexible]);

  // Fetch customers (with debounce for search)
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const timeoutId = setTimeout(() => {
      void fetchCustomers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isOpen, tenantId, fetchCustomers]);

  // Fetch packages and KTVs on open
  useEffect(() => {
    if (!isOpen || !tenantId) return;
    void fetchPackages();
    void fetchKtvs();
  }, [isOpen, tenantId, fetchPackages, fetchKtvs]);

  // Calculate priority preview when form changes
  useEffect(() => {
    if (formData.customer_id && formData.package_id) {
      void calculatePriorityPreview();
    }
  }, [formData.customer_id, formData.package_id, calculatePriorityPreview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customer_id || !formData.package_id || !formData.preferred_date || !formData.preferred_start_time) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    const pkg = packages.find((p) => p.id === formData.package_id);
    if (!pkg) {
      toast.error('Không tìm thấy thông tin dịch vụ');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AddToWaitlistInput = {
        tenant_id: tenantId,
        customer_id: formData.customer_id,
        package_id: formData.package_id,
        preferred_date: formData.preferred_date,
        preferred_start_time: formData.preferred_start_time,
        booking_value: pkg.price,
        duration_minutes: formData.duration_minutes || pkg.duration_minutes,
        preferred_ktv_id: formData.preferred_ktv_id || undefined,
        is_flexible: formData.is_flexible || false,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Không thể thêm vào danh sách chờ');
      }

      const data = await response.json();
      
      toast.success(`Đã thêm vào vị trí #${data.position || '?'} trong hàng chờ`);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);
  const selectedPackage = packages.find((p) => p.id === formData.package_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3.5 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            Thêm khách vào danh sách chờ
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          {/* Scrollable Form Content */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Customer Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Khách hàng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc SĐT..."
                className="w-full rounded-lg border border-gray-300 px-4 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {isLoadingCustomers && (
                <div className="mt-1 text-xs text-gray-500">Đang tìm...</div>
              )}
              {customers.length > 0 && !formData.customer_id && (
                <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, customer_id: customer.id });
                        setSearchQuery('');
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <div className="text-sm font-semibold text-gray-900">
                        {customer.name}
                        {customer.name_baby && ` - Bé: ${customer.name_baby}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {customer.phone} • {customer.tier.toUpperCase()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-1.5 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3.5 py-2 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedCustomer.name}
                      {selectedCustomer.name_baby && ` - Bé: ${selectedCustomer.name_baby}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selectedCustomer.phone} • <span className="font-bold text-emerald-700">{selectedCustomer.tier.toUpperCase()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, customer_id: undefined })}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline shrink-0"
                  >
                    Chọn khách khác
                  </button>
                </div>
              )}
            </div>

            {/* Service */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Dịch vụ <span className="text-red-500">*</span>
              </label>
              <PremiumSelect
                value={formData.package_id || ''}
                onChange={(value) => setFormData({ ...formData, package_id: value })}
                disabled={isLoadingPackages}
                placeholder="Chọn dịch vụ"
                options={[
                  { value: '', label: 'Chọn dịch vụ', icon: <Package className="w-4 h-4" /> },
                  ...packages.map((pkg) => ({
                    value: pkg.id,
                    label: `${pkg.name} - ${pkg.price.toLocaleString('vi-VN')} VNĐ - ${pkg.duration_minutes} phút`,
                    icon: <Package className="w-4 h-4" />,
                  })),
                ]}
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Ngày mong muốn <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.preferred_date || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const parts = val.split('-');
                      if (parts[0] && parts[0].length > 4) {
                        parts[0] = parts[0].substring(0, 4);
                        setFormData({ ...formData, preferred_date: parts.join('-') });
                        return;
                      }
                    }
                    setFormData({ ...formData, preferred_date: val });
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  max="9999-12-31"
                  className="w-full rounded-lg border border-gray-300 px-4 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Giờ <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.preferred_start_time || ''}
                  onChange={(e) => setFormData({ ...formData, preferred_start_time: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Duration and KTV */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Thời lượng (phút)
                </label>
                <PremiumSelect
                  value={String(formData.duration_minutes || selectedPackage?.duration_minutes || 90)}
                  onChange={(value) => setFormData({ ...formData, duration_minutes: parseInt(value, 10) })}
                  options={[
                    { value: '60', label: '60 phút', icon: <Clock className="w-4 h-4" /> },
                    { value: '90', label: '90 phút', icon: <Clock className="w-4 h-4" /> },
                    { value: '120', label: '120 phút', icon: <Clock className="w-4 h-4" /> },
                    { value: '180', label: '180 phút', icon: <Clock className="w-4 h-4" /> },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Ưu tiên KTV (tùy chọn)
                </label>
                <PremiumSelect
                  value={formData.preferred_ktv_id || ''}
                  onChange={(value) => setFormData({ ...formData, preferred_ktv_id: value || undefined })}
                  disabled={isLoadingKtvs}
                  placeholder="Không chỉ định"
                  options={[
                    { value: '', label: 'Không chỉ định', icon: <User className="w-4 h-4" /> },
                    ...ktvs.map((ktv) => ({
                      value: ktv.id,
                      label: ktv.name,
                      icon: <User className="w-4 h-4" />,
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Flexibility */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.is_flexible || false}
                  onChange={(e) => setFormData({ ...formData, is_flexible: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-gray-700 font-medium">
                  Có thể nhận lịch thay thế gần giờ mong muốn (+10 điểm ưu tiên)
                </span>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Ghi chú
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Ghi chú thêm..."
                className="w-full rounded-lg border border-gray-300 px-4 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Priority Preview */}
            {formData.customer_id && formData.package_id && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
                <div className="flex items-center justify-between border-b border-blue-100/60 pb-2 mb-2">
                  <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">📊 Kết quả dự kiến</span>
                  <span className="text-[10px] text-blue-700 font-medium">Hệ thống tính điểm tự động</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2.5">
                  <div className="bg-white border border-blue-100/50 rounded-lg p-2 text-center shadow-xs">
                    <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">Vị trí hàng chờ</span>
                    <span className="text-lg font-black text-blue-600">#{priorityPreview.position}</span>
                  </div>
                  <div className="bg-white border border-blue-100/50 rounded-lg p-2 text-center shadow-xs">
                    <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">Tổng điểm ưu tiên</span>
                    <span className="text-lg font-black text-blue-600">{priorityPreview.score}<span className="text-xs text-gray-400 font-bold">/100</span></span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-500 border-t border-blue-100/40 pt-2">
                  <span>• Hạng {selectedCustomer?.tier.toUpperCase()}: <strong className="font-bold text-gray-700">+{priorityPreview.tierScore}đ</strong></span>
                  <span>• Đơn hàng: <strong className="font-bold text-gray-700">+{priorityPreview.valueScore}đ</strong></span>
                  {priorityPreview.flexibilityBonus > 0 && (
                    <span>• Giờ linh hoạt: <strong className="font-bold text-emerald-600">+{priorityPreview.flexibilityBonus}đ</strong></span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.customer_id || !formData.package_id || !formData.preferred_date}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Đang thêm...' : 'Thêm vào hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
