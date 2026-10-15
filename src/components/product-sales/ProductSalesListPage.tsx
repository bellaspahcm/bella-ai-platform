'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Download, Filter, X, CheckCircle2, TrendingUp, DollarSign, ArrowLeft } from 'lucide-react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';
import { ProductSaleRow } from './ProductSaleRow';
import { ProductSaleModal } from './ProductSaleModal';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { useKTVList } from '@/hooks/useKTVList';
import { useCustomers } from '@/hooks/useCustomers';
import { queryTenantCommissionConfig } from '@/lib/supabase-commission-queries';
import { createClient } from '@/lib/supabase-client';
import type { CommissionConfig } from '@/types/commission-types';
import {
  getProductSales,
  deleteProductSale,
} from '@/modules/product-sales/actions/product-sales-actions';

interface ProductSale {
  id: string;
  ktv_id: string;
  customer_id: string | null;
  product_name: string;
  product_category: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_amount: number;
  override_commission_enabled: boolean;
  override_commission_type: 'fixed' | 'percentage' | null;
  override_commission_value: number | null;
  payment_method: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';
  sale_date: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes: string | null;
  created_at: string;
  updated_at: string;
  ktv_name?: string;
  customer_name?: string;
}

interface ProductSaleSource {
  id: string;
  ktv_id: string;
  customer_id: string | null;
  product_name: string;
  product_category: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_sales_amount: number;
  calculated_commission: number;
  override_commission_type: 'fixed' | 'percentage' | null;
  override_commission_value: number | null;
  payment_method: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';
  sale_date: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    full_name?: string | null;
  } | null;
  customers?: {
    name_mother?: string | null;
    name_baby?: string | null;
  } | null;
}

function isProductSaleSource(value: unknown): value is ProductSaleSource {
  return typeof value === 'object' && value !== null;
}

interface ProductSalesFilters {
  startDate?: string;
  endDate?: string;
  ktvId?: string;
  status?: string;
  search?: string;
}

export function ProductSalesListPage() {
  const tenantContext = useTenantContext();
  const router = useRouter();
  
  // Fetch KTV list and customers for modal
  const { ktvList, isLoading: isLoadingKTV } = useKTVList(tenantContext?.tenantId);
  const { customers, isLoading: isLoadingCustomers } = useCustomers(tenantContext?.tenantId);
  
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<ProductSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<ProductSale | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [commissionDefaults, setCommissionDefaults] = useState<CommissionConfig | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Filter state
  const [filters, setFilters] = useState<ProductSalesFilters>({
    startDate: '',
    endDate: '',
    ktvId: '',
    status: '',
    search: '',
  });

  // Stats
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCommission: 0,
    completedCount: 0,
  });

  // Fetch product sales
  const fetchSales = useCallback(async () => {
    if (!tenantContext?.tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getProductSales({
        tenantId: tenantContext.tenantId,
        ktvId: filters.ktvId || undefined,
        status: filters.status || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        limit: 500, // Fetch more for client-side filtering
        offset: 0,
      });

      if (result.success && result.data) {
        console.log('[ProductSalesListPage] Raw data from API:', result.data);
        
        // Transform data to match ProductSale interface with safety checks
        const salesData = result.data.sales.filter(isProductSaleSource).map((sale, index) => {
          try {
            // Safely extract KTV name
            const ktvName = sale.users?.full_name || 'Unknown KTV';
            
            // Safely extract customer name
            let customerName = 'Khách lẻ';
            if (sale.customers && sale.customers.name_mother) {
              customerName = sale.customers.name_mother;
              if (sale.customers.name_baby) {
                customerName += ` (${sale.customers.name_baby})`;
              }
            }
            
            return {
              ...sale,
              total_amount: Number(sale.total_sales_amount || 0),
              commission_amount: Number(sale.calculated_commission || 0),
              unit_price: Number(sale.unit_price || 0),
              override_commission_value: sale.override_commission_value !== null && sale.override_commission_value !== undefined ? Number(sale.override_commission_value) : null,
              override_commission_enabled: sale.override_commission_type !== null && sale.override_commission_type !== undefined,
              ktv_name: ktvName,
              customer_name: customerName,
            };
          } catch (transformError) {
            console.error(`[ProductSalesListPage] Error transforming sale at index ${index}:`, transformError, sale);
            // Return a safe fallback object
            return {
              ...sale,
              total_amount: 0,
              commission_amount: 0,
              unit_price: 0,
              override_commission_value: null,
              override_commission_enabled: false,
              ktv_name: 'Error',
              customer_name: 'Error',
            };
          }
        }) as ProductSale[];
        
        console.log('[ProductSalesListPage] Transformed sales data:', salesData);
        setSales(salesData);
        
        // Calculate stats with extra safety
        try {
          const completed = salesData.filter(s => s && s.status === 'completed');
          setStats({
            totalSales: salesData.length,
            totalRevenue: completed.reduce((sum, s) => sum + (s?.total_amount || 0), 0),
            totalCommission: completed.reduce((sum, s) => sum + (s?.commission_amount || 0), 0),
            completedCount: completed.length,
          });
        } catch (statsError) {
          console.error('[ProductSalesListPage] Error calculating stats:', statsError);
          setStats({
            totalSales: 0,
            totalRevenue: 0,
            totalCommission: 0,
            completedCount: 0,
          });
        }
      } else {
        console.error('[ProductSalesListPage] API returned error:', result.error);
        setError(result.error || 'Không thể tải danh sách bán hàng');
      }
    } catch (err: unknown) {
      console.error('Error fetching product sales:', err);
      setError('Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, [tenantContext, filters.ktvId, filters.status, filters.startDate, filters.endDate]);

  // Initial fetch
  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Fetch commission config
  useEffect(() => {
    async function fetchCommissionConfig() {
      if (!tenantContext?.tenantId) return;

      try {
        const supabase = createClient();
        const { data, error: configError } = await queryTenantCommissionConfig(
          supabase,
          tenantContext.tenantId
        );

        if (configError) {
          console.error('[ProductSalesListPage] Error fetching commission config:', configError);
          // Use fallback defaults
          setCommissionDefaults({
            service_commission_default: {
              type: 'fixed' as const,
              value: 150000,
            },
            product_sales_commission_default: {
              type: 'percentage' as const,
              value: 10,
            },
          });
        } else {
          setCommissionDefaults(data);
        }
      } catch (err: unknown) {
        console.error('[ProductSalesListPage] Unexpected error fetching config:', err);
        // Use fallback defaults
        setCommissionDefaults({
          service_commission_default: {
            type: 'fixed' as const,
            value: 150000,
          },
          product_sales_commission_default: {
            type: 'percentage' as const,
            value: 10,
          },
        });
      }
    }

    fetchCommissionConfig();
  }, [tenantContext?.tenantId]);

  // Client-side filtering for search
  useEffect(() => {
    let filtered = [...sales];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          sale.product_name.toLowerCase().includes(searchLower) ||
          sale.product_category?.toLowerCase().includes(searchLower) ||
          sale.product_sku?.toLowerCase().includes(searchLower) ||
          sale.ktv_name?.toLowerCase().includes(searchLower) ||
          sale.customer_name?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredSales(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  }, [sales, filters.search]);

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);

  // Handlers
  const handleEdit = (sale: ProductSale) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  const handleDelete = async (saleId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi bán hàng này?')) {
      return;
    }

    const result = await deleteProductSale(saleId);

    if (result.success) {
      // Remove from list
      setSales((prev) => prev.filter((s) => s.id !== saleId));
      alert('Đã xóa bản ghi bán hàng');
    } else {
      alert(result.error || 'Không thể xóa bản ghi');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSale(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchSales(); // Refresh list
  };

  const handleFilterChange = (key: keyof ProductSalesFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      ktvId: '',
      status: '',
      search: '',
    });
  };

  const handleExportCSV = () => {
    // Simple CSV export
    const headers = [
      'Ngày bán',
      'Sản phẩm',
      'Số lượng',
      'Đơn giá',
      'Tổng tiền',
      'Hoa hồng',
      'KTV',
      'Khách hàng',
      'Trạng thái',
      'Phương thức TT',
    ];
    
    const rows = filteredSales.map((sale) => [
      sale.sale_date,
      sale.product_name,
      sale.quantity,
      sale.unit_price,
      sale.total_amount,
      sale.commission_amount,
      sale.ktv_name || '',
      sale.customer_name || '',
      sale.status,
      sale.payment_method,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `product_sales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Module check - Allow both 'spa' and 'beauty_spa' modules
  if (tenantContext?.enabledModules && 
      !(tenantContext.enabledModules as readonly string[]).includes('spa') &&
      !(tenantContext.enabledModules as readonly string[]).includes('beauty_spa')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-500">Tính năng này chỉ khả dụng cho Spa và Beauty Spa module</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-slate-100/80">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
            <ShoppingCart className="w-7 h-7 text-primary" />
          </div>
          <div>
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="group mb-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-primary transition-colors duration-200"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Quay lại</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-slate-900 tracking-wide">Bán hàng sản phẩm</h1>
            <p className="text-sm text-slate-400 font-medium mt-0.5">Quản lý các giao dịch bán sản phẩm và tính toán hoa hồng cho Kỹ thuật viên</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex flex-1 sm:flex-none items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl border transition-all duration-200 active:scale-[0.98]",
              showFilters 
                ? "bg-slate-100 border-slate-200 text-slate-800" 
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            )}
          >
            <Filter className="w-4 h-4" />
            <span>Bộ lọc</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-5 py-3 text-sm font-bold bg-white border border-slate-200 rounded-2xl text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="beauty-customer-add-cta flex flex-1 sm:flex-none items-center justify-center gap-2 px-5 py-3 text-sm font-black text-primary-foreground bg-primary rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="text-white">Thêm bán hàng</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {/* Total Sales Card */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgba(7,78,68,0.04)] hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng bán hàng</p>
              <p className="text-3xl font-black text-slate-800 mt-2">{stats.totalSales}</p>
            </div>
            <div className="p-3.5 bg-primary/10 rounded-2xl border border-primary/20 text-primary">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-4">
            Đơn hàng phát sinh
          </div>
        </div>

        {/* Completed Card */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgba(7,78,68,0.04)] hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Hoàn thành</p>
              <p className="text-3xl font-black text-primary mt-2">{stats.completedCount}</p>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-4">
            Đã thanh toán & giao hàng
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgba(7,78,68,0.04)] hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng doanh thu</p>
              <p className="text-2xl font-black text-slate-800 mt-2.5">
                {stats.totalRevenue.toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className="p-3.5 bg-primary/10 rounded-2xl border border-primary/20 text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-4">
            Doanh số từ sản phẩm
          </div>
        </div>

        {/* Commission Card */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgba(7,78,68,0.04)] hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng hoa hồng</p>
              <p className="text-2xl font-black text-primary mt-2.5">
                {stats.totalCommission.toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className="p-3.5 bg-primary/10 rounded-2xl border border-primary/20 text-primary">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-4">
            Đã cộng vào quỹ lương KTV
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-serif font-bold text-slate-800 text-lg">Bộ lọc tìm kiếm</h3>
                <button
                  onClick={handleClearFilters}
                  className="text-sm font-bold text-slate-500 hover:text-primary transition-colors"
                >
                  Xóa bộ lọc
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Tìm kiếm
                  </label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Tên sản phẩm, SKU, KTV..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 font-bold"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Trạng thái
                  </label>
                  <PremiumSelect
                    value={filters.status || ''}
                    onChange={(value) => handleFilterChange('status', value)}
                    options={[
                      { value: '', label: 'Tất cả trạng thái' },
                      { value: 'completed', label: 'Hoàn thành' },
                      { value: 'pending', label: 'Chờ xử lý' },
                      { value: 'cancelled', label: 'Đã hủy' },
                      { value: 'refunded', label: 'Đã hoàn tiền' },
                    ]}
                    ariaLabel="Lọc trạng thái bán hàng"
                    className="space-y-0"
                    buttonClassName="rounded-2xl border-slate-200 bg-white px-4 py-3.5 font-bold shadow-none hover:border-primary/50"
                    dropdownClassName="min-w-full"
                  />
                </div>

                {/* Date Range */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block ml-1">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all duration-300 font-bold"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sales List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-slate-400 font-medium">Đang tải danh sách...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <ShoppingCart className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Không thể tải danh sách bán hàng</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      ) : currentSales.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner text-primary">
            <ShoppingCart className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-serif font-bold text-slate-800 mb-2">Chưa có giao dịch bán hàng</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            {filters.search || filters.status || filters.startDate
              ? 'Không tìm thấy bản ghi nào khớp với điều kiện tìm kiếm hiện tại. Thử xóa bộ lọc.'
              : 'Chưa có bản ghi bán hàng sản phẩm nào được ghi nhận cho chi nhánh này.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="beauty-customer-add-cta inline-flex items-center gap-2 px-5 py-3 text-sm font-black text-primary-foreground bg-primary rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="text-white">Thêm giao dịch đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {currentSales.map((sale) => (
            <ProductSaleRow
              key={sale.id}
              sale={sale}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-3xl border border-slate-100 p-5 gap-4 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">
                Hiển thị <span className="font-bold text-slate-700">{startIndex + 1}</span> - <span className="font-bold text-slate-700">{Math.min(endIndex, filteredSales.length)}</span> trong tổng số{' '}
                <span className="font-bold text-slate-700">{filteredSales.length}</span> bản ghi
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Trước
                </button>

                <span className="text-sm font-bold text-slate-600">
                  Trang {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Sale Modal */}
      {isModalOpen && tenantContext?.tenantId && (
        <ProductSaleModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          tenantId={tenantContext.tenantId}
          ktvList={ktvList}
          customers={customers}
          commissionDefaults={commissionDefaults || undefined}
          initialData={selectedSale || undefined}
        />
      )}
    </div>
  );
}
