'use client';

/**
 * Product Sale Modal Component
 * 
 * Modal form to record product sales with commission calculation.
 * Supports flexible commission input (fixed amount or percentage).
 * 
 * @module components/product-sales/ProductSaleModal
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, ShoppingCart, Plus, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  createProductSale, 
  updateProductSale 
} from '@/modules/product-sales/actions/product-sales-actions';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { CommissionOverrideInput } from '@/components/bookings/CommissionOverrideInput';
import { calculateProductSalesCommission } from '@/lib/business-rules/commission';
import type { CommissionType } from '@/lib/business-rules/commission';
import type { CommissionConfig } from '@/types/commission-types';

interface KTV {
  id: string;
  full_name: string;
  email?: string | null;
}

interface Customer {
  id: string;
  name_mother: string;
  name_baby?: string | null;
}

interface ProductSaleData {
  id: string;
  ktv_id: string;
  customer_id: string | null;
  product_name: string;
  product_category: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  override_commission_type: CommissionType | null;
  override_commission_value: number | null;
  payment_method: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';
  sale_date: string;
  notes: string | null;
}

interface ProductSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  tenantId: string;
  ktvList: KTV[];
  customers?: Customer[];
  commissionDefaults?: CommissionConfig;
  initialData?: ProductSaleData;
}

interface FormData {
  ktvId: string;
  customerId: string;
  productName: string;
  productCategory: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  totalSalesAmount: number;
  overrideType: CommissionType | null;
  overrideValue: number | null;
  paymentMethod: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';
  saleDate: string;
  notes: string;
}

export function ProductSaleModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  ktvList,
  customers = [],
  commissionDefaults,
  initialData,
}: ProductSaleModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Detect edit mode
  const isEditMode = !!initialData;
  
  // Extract commission defaults with fallback
  const defaultType = commissionDefaults?.product_sales_commission_default?.type || 'percentage';
  const defaultValue = commissionDefaults?.product_sales_commission_default?.value || 10;

  const [formData, setFormData] = useState<FormData>({
    ktvId: '',
    customerId: '',
    productName: '',
    productCategory: '',
    productSku: '',
    quantity: 1,
    unitPrice: 0,
    totalSalesAmount: 0,
    overrideType: null,
    overrideValue: null,
    paymentMethod: 'cash',
    saleDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        ktvId: initialData.ktv_id,
        customerId: initialData.customer_id || '',
        productName: initialData.product_name,
        productCategory: initialData.product_category || '',
        productSku: initialData.product_sku || '',
        quantity: Number(initialData.quantity || 1),
        unitPrice: Number(initialData.unit_price || 0),
        totalSalesAmount: Number(initialData.total_amount || 0),
        overrideType: initialData.override_commission_type,
        overrideValue: initialData.override_commission_value !== null && initialData.override_commission_value !== undefined ? Number(initialData.override_commission_value) : null,
        paymentMethod: initialData.payment_method,
        saleDate: initialData.sale_date,
        notes: initialData.notes || '',
      });
    } else {
      // Reset to defaults when creating new
      setFormData({
        ktvId: '',
        customerId: '',
        productName: '',
        productCategory: '',
        productSku: '',
        quantity: 1,
        unitPrice: 0,
        totalSalesAmount: 0,
        overrideType: null,
        overrideValue: null,
        paymentMethod: 'cash',
        saleDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
  }, [initialData]);

  // Calculate total sales amount when quantity or unit price changes
  useEffect(() => {
    const total = formData.quantity * formData.unitPrice;
    setFormData((prev) => ({ ...prev, totalSalesAmount: total }));
  }, [formData.quantity, formData.unitPrice]);

  // Calculate commission preview
  const calculatedCommission = calculateProductSalesCommission({
    totalSalesAmount: formData.totalSalesAmount,
    overrideType: formData.overrideType,
    overrideValue: formData.overrideValue,
    defaultType: defaultType,
    defaultValue: defaultValue,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let result;
      
      if (isEditMode && initialData) {
        // Update existing product sale
        result = await updateProductSale(initialData.id, {
          ktvId: formData.ktvId,
          customerId: formData.customerId || null,
          productName: formData.productName,
          productCategory: formData.productCategory || null,
          productSku: formData.productSku || null,
          quantity: formData.quantity,
          unitPrice: formData.unitPrice,
          overrideCommissionType: formData.overrideType,
          overrideCommissionValue: formData.overrideValue,
          paymentMethod: formData.paymentMethod,
          saleDate: formData.saleDate,
          notes: formData.notes || null,
        });
      } else {
        // Create new product sale
        result = await createProductSale({
          tenantId,
          ktvId: formData.ktvId,
          customerId: formData.customerId || null,
          productName: formData.productName,
          productCategory: formData.productCategory || null,
          productSku: formData.productSku || null,
          quantity: formData.quantity,
          unitPrice: formData.unitPrice,
          totalSalesAmount: formData.totalSalesAmount,
          overrideCommissionType: formData.overrideType,
          overrideCommissionValue: formData.overrideValue,
          paymentMethod: formData.paymentMethod,
          saleDate: formData.saleDate,
          notes: formData.notes || null,
        });
      }

      if (result.success) {
        router.refresh();
        onSuccess?.();
        onClose();
        
        // Reset form only when creating (not editing)
        if (!isEditMode) {
          setFormData({
            ktvId: '',
            customerId: '',
            productName: '',
            productCategory: '',
            productSku: '',
            quantity: 1,
            unitPrice: 0,
            totalSalesAmount: 0,
            overrideType: null,
            overrideValue: null,
            paymentMethod: 'cash',
            saleDate: new Date().toISOString().split('T')[0],
            notes: '',
          });
        }
      } else {
        setError(result.error || `Không thể ${isEditMode ? 'cập nhật' : 'lưu'} bán hàng`);
      }
    } catch (err: unknown) {
      console.error('Error creating product sale:', err);
      setError('Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[28px] sm:rounded-[32px] bg-white shadow-2xl border border-slate-100/50"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-md px-6 py-5 rounded-t-[28px] sm:rounded-t-[32px]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-serif font-semibold text-slate-900 tracking-wide">
                  {isEditMode ? 'Chỉnh sửa bán hàng' : 'Ghi nhận bán hàng'}
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {isEditMode ? 'Cập nhật thông tin giao dịch' : 'Thêm giao dịch bán sản phẩm'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-full p-2.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all duration-200 disabled:opacity-50"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-200 p-4"
              >
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">Lỗi</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Section 1: KTV & Customer */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-100/80 bg-slate-50/30 dark:border-[#3E3A35]/30 dark:bg-[#1C1B19]/20 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">
                Người bán & Khách hàng
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {/* KTV Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    KTV phụ trách <span className="text-rose-500 font-normal">*</span>
                  </label>
                  <PremiumSelect
                    options={ktvList.map((ktv) => ({
                      value: ktv.id,
                      label: ktv.email ? `${ktv.full_name} (${ktv.email})` : ktv.full_name,
                    }))}
                    value={formData.ktvId}
                    onChange={(ktvId) => setFormData((prev) => ({ ...prev, ktvId }))}
                    placeholder="-- Chọn kỹ thuật viên --"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Customer Selection (Optional) */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Khách hàng <span className="text-slate-400 font-normal font-sans">(tùy chọn)</span>
                  </label>
                  <PremiumSelect
                    options={customers.map((customer) => ({
                      value: customer.id,
                      label: customer.name_baby 
                        ? `${customer.name_mother} (${customer.name_baby})`
                        : customer.name_mother,
                    }))}
                    value={formData.customerId}
                    onChange={(customerId) =>
                      setFormData((prev) => ({ ...prev, customerId }))
                    }
                    placeholder="-- Chọn khách hàng --"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Product Details */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-100/80 bg-slate-50/30 dark:border-[#3E3A35]/30 dark:bg-[#1C1B19]/20 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">
                Thông tin sản phẩm
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Product Name */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Tên sản phẩm <span className="text-rose-500 font-normal">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.productName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, productName: e.target.value }))
                    }
                    placeholder="Nhập tên sản phẩm"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 placeholder:text-slate-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:opacity-50 font-bold"
                  />
                </div>

                {/* Product Category */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Danh mục <span className="text-slate-400 font-normal font-sans">(tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.productCategory}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, productCategory: e.target.value }))
                    }
                    placeholder="VD: Mỹ phẩm, Sữa tắm..."
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 placeholder:text-slate-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:opacity-50 font-bold"
                  />
                </div>

                {/* Product SKU */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Mã SKU <span className="text-slate-400 font-normal font-sans">(tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.productSku}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, productSku: e.target.value }))
                    }
                    placeholder="VD: PRD-001"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 placeholder:text-slate-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:opacity-50 font-bold font-mono"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Số lượng <span className="text-rose-500 font-normal">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        quantity: parseFloat(e.target.value) || 1,
                      }))
                    }
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:opacity-50 font-bold"
                  />
                </div>

                {/* Unit Price */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Đơn giá <span className="text-rose-500 font-normal">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={
                      formData.unitPrice === 0
                        ? ''
                        : formData.unitPrice.toLocaleString('vi-VN')
                    }
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setFormData((prev) => ({
                        ...prev,
                        unitPrice: parseInt(value) || 0,
                      }));
                    }}
                    placeholder="0"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 placeholder:text-slate-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:opacity-50 font-bold"
                  />
                </div>

                {/* Total Sales Amount (readonly) */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">Tổng tiền</label>
                  <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4 shadow-sm">
                    <span className="text-sm font-semibold text-slate-600 dark:text-[#E5D5C8]">Thành tiền (VND):</span>
                    <span className="text-2xl font-black text-primary">
                      {formData.totalSalesAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Commission Override */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-100/80 bg-slate-50/30 dark:border-[#3E3A35]/30 dark:bg-[#1C1B19]/20 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">
                Cài đặt hoa hồng
              </h3>
              <CommissionOverrideInput
                enabled={formData.overrideType !== null}
                overrideType={formData.overrideType || 'fixed'}
                overrideValue={formData.overrideValue || 0}
                onToggle={(enabled) => {
                  if (enabled) {
                    setFormData((prev) => ({
                      ...prev,
                      overrideType: 'percentage',
                      overrideValue: 10,
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      overrideType: null,
                      overrideValue: null,
                    }));
                  }
                }}
                onTypeChange={(type) =>
                  setFormData((prev) => ({ ...prev, overrideType: type }))
                }
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, overrideValue: value }))
                }
                disabled={isSubmitting}
              />

              {/* Commission Preview */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 dark:text-[#E5D5C8]">
                    Hoa hồng dự kiến cho KTV:
                  </span>
                  <span className="text-xl font-black text-primary">
                    {calculatedCommission.toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-[#D4C5B6] border-t border-primary/10 pt-2.5">
                  💡 Hoa hồng này sẽ được tính trực tiếp vào tổng thu nhập tháng của Kỹ thuật viên.
                  {formData.overrideType
                    ? ' Đang áp dụng thiết lập hoa hồng tùy chỉnh.'
                    : ` Đang sử dụng hoa hồng mặc định của hệ thống (${
                        defaultType === 'fixed'
                          ? `${defaultValue.toLocaleString('vi-VN')}đ`
                          : `${defaultValue}%`
                      }).`}
                </p>
              </div>
            </div>

            {/* Section 4: Payment & Date */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-100/80 bg-slate-50/30 dark:border-[#3E3A35]/30 dark:bg-[#1C1B19]/20 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">
                Thông tin thanh toán
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Payment Method */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Phương thức <span className="text-rose-500 font-normal">*</span>
                  </label>
                  <PremiumSelect
                    options={[
                      { value: 'cash', label: 'Tiền mặt' },
                      { value: 'bank_transfer', label: 'Chuyển khoản' },
                      { value: 'zalo_pay', label: 'ZaloPay' },
                      { value: 'momo', label: 'MoMo' },
                      { value: 'card', label: 'Thẻ' },
                    ]}
                    value={formData.paymentMethod}
                    onChange={(method) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentMethod: method as FormData['paymentMethod'],
                      }))
                    }
                    disabled={isSubmitting}
                  />
                </div>

                {/* Sale Date */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Ngày bán <span className="text-rose-500 font-normal">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.saleDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, saleDate: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:opacity-50 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Notes */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-100/80 bg-slate-50/30 dark:border-[#3E3A35]/30 dark:bg-[#1C1B19]/20 space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                Ghi chú <span className="text-slate-400 font-normal font-sans">(tùy chọn)</span>
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Thêm ghi chú về giao dịch..."
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 placeholder:text-slate-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 disabled:opacity-50 resize-none font-medium"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-6 border-t border-slate-100 bg-slate-50/50 p-6 -mx-6 -mb-6 rounded-b-[28px] sm:rounded-b-[32px]">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-bold text-slate-700 hover:bg-slate-50 transition-all duration-200 active:scale-[0.98]"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.ktvId || !formData.productName}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-black text-primary-foreground hover:bg-primary-hover shadow-lg shadow-primary/20 dark:shadow-none transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isEditMode ? 'Đang cập nhật...' : 'Đang lưu...'}
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    {isEditMode ? 'Cập nhật' : 'Lưu bán hàng'}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
