'use client';

import { cn } from '@/lib/utils';
import { Camera, Edit3, Heart, MapPin, Phone, PlusCircle, Share2, Sparkles, TrendingUp, Award, User, Calendar, MessageCircle, CheckCircle2 } from 'lucide-react';
import { getCustomerGenderPresentation, getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import { formatViDate } from '@/lib/utils';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import type { CustomerDetailRecord } from '../types';

/**
 * Top Customer Header Banner matching Image 2
 */
export function CustomerHeaderBanner({
  customer,
  tenantModuleKey,
  userRole,
  onEditCustomer,
  onOpenBooking,
  onOpenZalo,
  onSharePortal,
  isBabyCare = false,
}: {
  customer: CustomerDetailRecord;
  tenantModuleKey: TenantModuleKey | null;
  userRole: 'admin' | 'ktv';
  onEditCustomer: () => void;
  onOpenBooking: () => void;
  onOpenZalo?: () => void;
  onSharePortal?: () => void;
  isBabyCare?: boolean;
}) {
  const customerLabels = getTenantModulePresentationOrNeutral(isBabyCare ? 'babycare' : tenantModuleKey);
  const isBeauty = tenantModuleKey === 'beauty_spa';

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6 mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 flex-1 min-w-0">
          {/* Avatar with Camera badge */}
          <div className="relative shrink-0">
            <div className={cn(
              "flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-[2rem] border-2 border-white shadow-xl",
              isBeauty
                ? 'bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600 shadow-emerald-200/50'
                : 'bg-gradient-to-br from-rose-100 to-pink-50 text-rose-600 shadow-rose-200/50'
            )}>
              <Heart className="h-10 w-10 sm:h-12 sm:w-12 fill-current/20" />
            </div>
            {!isBabyCare && <button
              onClick={onEditCustomer}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md shadow-primary/20 hover:scale-110 transition-transform"
              title="Đổi ảnh đại diện"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>}
          </div>

          {/* Info Details */}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {customer.name_mother}
              </h1>
              {userRole === 'admin' && (
                <span className={cn(
                  "rounded-full px-3 py-1 text-[9.5px] font-black uppercase tracking-wider shadow-sm",
                  customer.is_fully_paid ? 'bg-blue-50 text-blue-700 border border-blue-200/60' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                  customer.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60' :
                  customer.status === 'deposit_pending' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                  'bg-slate-100 text-slate-600 border border-slate-200/60'
                )}>
                  ● {customer.is_fully_paid ? 'Đã thanh toán đủ' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? customerLabels.activeStatusLabel :
                  customer.status === 'completed' ? 'Đã hoàn tất' :
                  customer.status === 'deposit_pending' ? customerLabels.depositStatusLabel :
                  customerLabels.leadStatusLabel}
                </span>
              )}
              {!isBabyCare && customer.loyalty_points && customer.loyalty_points > 50 && (
                <span className="bg-rose-500 text-white font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  VIP
                </span>
              )}
            </div>

            {/* Line 1 */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 flex-wrap">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {customer.phone}</span>
              <span>•</span>
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> {isBabyCare
                ? `Bé: ${customer.name_baby || 'Chưa cập nhật'} · ${getCustomerGenderPresentation(customer.gender_baby, 'babycare').label}`
                : customer.baby?.gender || 'Nữ'}</span>
              {!isBabyCare && <><span>•</span><span className="text-slate-400">Chưa phân nhóm</span></>}
            </div>

            {/* Line 2 */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 flex-wrap">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {customer.address || 'Chưa có địa chỉ'}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-600 font-black"><Award className="w-3.5 h-3.5 text-amber-500" /> {customer.loyalty_points ?? 0} điểm (Loyalty)</span>
            </div>

            {/* Line 3 - Notes preview */}
            <p className="text-xs font-medium text-slate-500 line-clamp-1 pt-0.5">
              📝 <strong className="text-slate-700">Ghi chú:</strong> {customer.notes || (isBabyCare ? 'Chưa có ghi chú' : 'Khách thân thiết, ưu tiên xếp KTV tay nghề cao.')}
            </p>
          </div>
        </div>

        {/* Quick Action Top Right */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <button
            onClick={onEditCustomer}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Detailed Customer Info Card (Right Column) matching Image 2
 */
export function CustomerDetailInfoCard({
  customer,
  tenantModuleKey,
  onEditCustomer,
  isBabyCare = false,
}: {
  customer: CustomerDetailRecord;
  tenantModuleKey: TenantModuleKey | null;
  onEditCustomer: () => void;
  isBabyCare?: boolean;
}) {
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);

  const items: Array<{ label: string; value: string; isVip?: boolean; isHighlight?: boolean }> = isBabyCare ? [
    { label: 'Họ tên mẹ', value: customer.name_mother },
    { label: 'Số điện thoại', value: customer.phone },
    { label: 'Tên bé', value: customer.name_baby || 'Chưa cập nhật' },
    { label: 'Giới tính của bé', value: getCustomerGenderPresentation(customer.gender_baby, 'babycare').label },
    { label: 'Ngày sinh bé', value: customer.dob_baby ? formatViDate(customer.dob_baby) : 'Chưa cập nhật' },
    { label: 'Ngày dự sinh', value: customer.dob_expected ? formatViDate(customer.dob_expected) : 'Chưa cập nhật' },
    { label: 'Địa chỉ', value: customer.address || 'Chưa cập nhật' },
    { label: 'Điểm tích lũy', value: `${customer.loyalty_points ?? 0} điểm` },
    { label: 'Ghi chú', value: customer.notes || 'Chưa có ghi chú' },
    { label: 'Ngày tạo hồ sơ (tự động)', value: customer.created_at ? formatViDate(customer.created_at) : 'Chưa cập nhật' },
  ] : [
    { label: 'Họ và tên', value: customer.name_mother },
    { label: 'Điện thoại', value: customer.phone },
    { label: 'Giới tính', value: customer.baby?.gender || 'Nữ' },
    { label: 'Ngày sinh', value: customer.baby?.dob || '--/--/----' },
    { label: 'Địa chỉ', value: customer.address || 'Chưa cập nhật' },
    { label: 'Phân nhóm', value: 'Chưa phân nhóm' },
    { label: 'Điểm tích lũy', value: `${customer.loyalty_points ?? 0} điểm`, isVip: (customer.loyalty_points ?? 0) > 50 },
    { label: 'Khách thân thiết', value: 'Có', isHighlight: true },
    { label: 'Nguồn khách', value: 'Giới thiệu' },
    { label: 'Ngày tạo hồ sơ', value: customer.created_at ? new Date(customer.created_at).toLocaleDateString('vi-VN') : 'Mới tạo' },
  ];

  return (
    <div className="rounded-[2.5rem] border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <span>{isBabyCare ? 'Thông tin mẹ và bé' : 'Thông tin khách hàng'}</span>
        </h3>
        <button
          onClick={onEditCustomer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Chỉnh sửa
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className={cn("flex items-center justify-between py-2 border-b border-slate-100 text-xs last:border-b-0", isBabyCare && 'gap-4 items-start')}>
            <span className={cn("font-bold text-slate-500", isBabyCare && 'shrink-0 max-w-[45%]')}>{item.label}</span>
            <span className={cn("font-black text-slate-900 flex items-center gap-1.5", isBabyCare && 'min-w-0 break-words whitespace-pre-wrap text-right block')}>
              {item.value}
              {item.isVip && (
                <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded uppercase">VIP</span>
              )}
              {item.isHighlight && (
                <span className="text-emerald-600 text-[10px] font-black">✓</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerProfilePanel({
  customer,
  tenantModuleKey,
  userRole,
  onEditCustomer,
  onOpenBooking,
}: {
  customer: CustomerDetailRecord;
  tenantModuleKey: TenantModuleKey | null;
  userRole: 'admin' | 'ktv';
  onEditCustomer: () => void;
  onOpenBooking: () => void;
}) {
  return (
    <CustomerDetailInfoCard
      customer={customer}
      tenantModuleKey={tenantModuleKey}
      onEditCustomer={onEditCustomer}
    />
  );
}
