'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  FileText,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Shield,
  FileCheck,
  Clock,
  Layers,
  Building,
  Star,
  ExternalLink,
} from 'lucide-react';
import type { Customer360Profile } from '@/products/bella-interior/domain/crm/customer-360.types';
import { supabase } from '@/lib/supabase-client';

interface Customer360ModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly customerId: string | null;
  readonly initialCustomerName?: string;
}

function getEventBadge(type: string): { label: string; className: string } | null {
  switch (type) {
    case 'warranty_certificate_issued':
      return {
        label: 'Chứng thư BH',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      };
    case 'handover_accepted':
      return {
        label: 'Ký nghiệm thu',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
      };
    case 'payment_received':
      return {
        label: 'Thu tiền',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-900',
      };
    case 'payment_refunded':
      return {
        label: 'Hoàn tiền',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-900',
      };
    case 'contract_signed':
      return {
        label: 'Hợp đồng',
        className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      };
    case 'warranty_ticket_opened':
      return {
        label: 'Báo sự cố',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900',
      };
    case 'warranty_ticket_resolved':
      return {
        label: 'Đã xử lý BH',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
      };
    case 'site_diary_logged':
      return {
        label: 'Nhật ký',
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      };
    case 'qc_punch_list':
      return {
        label: 'Kiểm soát QC',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-900',
      };
    default:
      return null;
  }
}

export function Customer360Modal({
  isOpen,
  onClose,
  customerId,
  initialCustomerName,
}: Customer360ModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'commercial' | 'execution' | 'timeline'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Customer360Profile | null>(null);

  useEffect(() => {
    if (!isOpen || !customerId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    async function fetchCustomer360() {
      setLoading(true);
      setError(null);
      try {
        const { data: authData } = await supabase.auth.getSession();
        const token = authData?.session?.access_token;
        const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) authHeaders['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/interior/crm/customers/${encodeURIComponent(customerId!)}`, {
          headers: authHeaders,
        });
        if (!res.ok) {
          throw new Error(`Không tìm thấy hồ sơ khách hàng (Mã lỗi: ${res.status})`);
        }
        const json = await res.json();
        if (isMounted) {
          if (json.success && json.data) {
            setData(json.data);
          } else {
            throw new Error(json.error || 'Dữ liệu không hợp lệ');
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Lỗi tải hồ sơ khách hàng');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchCustomer360();

    return () => {
      isMounted = false;
    };
  }, [isOpen, customerId]);

  if (!isOpen) return null;

  const profile = data?.profile;
  const financial = data?.financialSummary;

  const tierBadgeColor = (tier?: string) => {
    switch (tier) {
      case 'vip': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
      case 'gold': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
      case 'silver': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-360-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-blue-500/20 shrink-0">
              {profile?.name ? profile.name.charAt(0) : (initialCustomerName ? initialCustomerName.charAt(0) : 'K')}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 id="customer-360-title" className="text-xl font-bold text-slate-900 dark:text-white">
                  {profile?.name || initialCustomerName || 'Hồ sơ Khách hàng'}
                </h2>
                {profile?.code && (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {profile.code}
                  </span>
                )}
                {profile?.tier && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase ${tierBadgeColor(profile.tier)}`}>
                    {profile.tier}
                  </span>
                )}
                {profile?.type && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {profile.type === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                {profile?.primaryPhone && (
                  <a
                    href={`tel:${profile.primaryPhone}`}
                    className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{profile.primaryPhone}</span>
                  </a>
                )}
                {profile?.primaryEmail && (
                  <a
                    href={`mailto:${profile.primaryEmail}`}
                    className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{profile.primaryEmail}</span>
                  </a>
                )}
                {profile?.taxCode && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" />
                    <span>MST: {profile.taxCode}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Tổng quan &amp; Dự án</span>
            {data?.projects && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {data.projects.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'contacts'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Danh bạ &amp; Địa chỉ</span>
            {data?.contacts && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {data.contacts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('commercial')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'commercial'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Hợp đồng &amp; Tài chính</span>
            {data?.commercial.contracts && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {data.commercial.contracts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('execution')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'execution'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Thi công &amp; Nghiệm thu</span>
            {data && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {(data.execution?.siteDiaries?.length || 0) +
                  (data.execution?.punchListItems?.length || 0) +
                  (data.delivery?.handovers?.length || 0) +
                  (data.aftercare?.warrantyCertificates?.length || 0) +
                  (data.aftercare?.warrantyTickets?.length || 0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Lịch sử tương tác</span>
            {data?.timeline && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {data.timeline.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Đang tổng hợp dữ liệu Customer 360...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data && (
            <div>
              {/* Tab 1: Overview & Projects */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Financial KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Tổng giá trị hợp đồng
                      </div>
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {financial?.totalContractValue.toLocaleString('vi-VN')} ₫
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Từ {financial?.totalProjects} dự án đã ký kết
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                        Đã thanh toán thực tế
                      </div>
                      <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
                        {financial?.totalPaidAmount.toLocaleString('vi-VN')} ₫
                      </div>
                      <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                        Đã đối soát chứng từ thanh toán
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${
                      (financial?.receivableDebt || 0) > 0
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40'
                        : (financial?.overpaidAmount || 0) > 0
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                    }`}>
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                        {(financial?.overpaidAmount || 0) > 0 ? 'Dư nợ có (Trả thừa)' : 'Công nợ còn phải thu'}
                      </div>
                      <div className={`text-lg font-extrabold ${
                        (financial?.receivableDebt || 0) > 0
                          ? 'text-amber-800 dark:text-amber-300'
                          : (financial?.overpaidAmount || 0) > 0
                          ? 'text-blue-800 dark:text-blue-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {(financial?.overpaidAmount || 0) > 0
                          ? `${financial?.overpaidAmount?.toLocaleString('vi-VN')} ₫`
                          : `${financial?.receivableDebt.toLocaleString('vi-VN')} ₫`}
                      </div>
                      <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">
                        {(financial?.receivableDebt || 0) > 0
                          ? 'Cần theo dõi thu hồi'
                          : (financial?.overpaidAmount || 0) > 0
                          ? 'Khách hàng có số dư thanh toán trước'
                          : 'Không có công nợ quá hạn'}
                      </div>
                    </div>
                  </div>

                  {/* Projects List */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Danh mục Dự án Liên kết ({data.projects.length})</span>
                    </h3>

                    {data.projects.length === 0 ? (
                      <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Khách hàng này hiện chưa có dự án thi công nội thất nào.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.projects.map((proj) => (
                          <div
                            key={proj.id}
                            className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                  {proj.code}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {proj.name}
                                </h4>
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {proj.status}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>{proj.siteAddress || 'Chưa cập nhật địa chỉ'}</span>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {proj.estimatedBudget.toLocaleString('vi-VN')} ₫
                              </div>
                              <div className="text-[10px] text-slate-400">
                                KTS: {proj.leadArchitectName || 'Chưa chỉ định'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Contacts & Addresses */}
              {activeTab === 'contacts' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contacts */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Danh bạ Người liên hệ ({data.contacts.length})</span>
                    </h3>

                    {data.contacts.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa có người liên hệ phụ nào được thêm.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {contact.name}
                                </span>
                                {contact.isPrimary && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    Chính
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                {contact.role}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                              {contact.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{contact.phone}</span>
                                </div>
                              )}
                              {contact.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{contact.email}</span>
                                </div>
                              )}
                              {contact.position && (
                                <div className="text-[11px] text-slate-400">
                                  Chức vụ: {contact.position}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Addresses */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Sổ Địa chỉ Khách hàng ({data.addresses.length})</span>
                    </h3>

                    {data.addresses.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa có địa chỉ nào trong sổ địa chỉ.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.addresses.map((addr) => (
                          <div
                            key={addr.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                                {addr.addressType}
                              </span>
                              {addr.isDefault && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold">
                                  Mặc định
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-300">
                              {addr.fullAddress}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {addr.district ? `${addr.district}, ` : ''}{addr.city}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Commercial & Contracts */}
              {activeTab === 'commercial' && (
                <div className="space-y-6">
                  {/* Contracts */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Hợp đồng &amp; Phụ lục ({data.commercial.contracts.length})</span>
                    </h3>

                    {data.commercial.contracts.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa có hợp đồng nào được ký kết.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.commercial.contracts.map((c) => {
                          const paid = c.paidAmount ?? 0;
                          const total = c.contractValue || 0;
                          const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                          const debt = c.remainingDebt ?? Math.max(0, total - paid);

                          return (
                            <div
                              key={c.id}
                              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                      {c.contractNumber}
                                    </span>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                      {c.title}
                                    </h4>
                                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                      {c.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    Thuộc dự án: {c.projectName} | Số phụ lục: {c.addendaCount}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                                    {total.toLocaleString('vi-VN')} ₫
                                  </div>
                                  {c.signedDate && (
                                    <div className="text-[10px] text-slate-400">
                                      Ký: {new Date(c.signedDate).toLocaleDateString('vi-VN')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Per-contract Debt & Payment Progress */}
                              <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Đã thu: <strong className="text-emerald-600 dark:text-emerald-400">{paid.toLocaleString('vi-VN')} ₫</strong>
                                  </span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {percent}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[11px] mt-1.5 text-slate-500">
                                  <span>
                                    Công nợ còn lại:{' '}
                                    <strong className={debt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}>
                                      {debt.toLocaleString('vi-VN')} ₫
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quotations */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Báo giá Đề xuất ({data.commercial.quotations.length})</span>
                    </h3>

                    {data.commercial.quotations.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa có báo giá nào được phát hành.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.commercial.quotations.map((q) => (
                          <div
                            key={q.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {q.quotationNumber} (v{q.versionNumber})
                                </span>
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {q.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Dự án: {q.projectName}
                              </div>
                            </div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {q.grandTotal.toLocaleString('vi-VN')} ₫
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Transactions */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Lịch sử Thanh toán ({data.commercial.payments.length})</span>
                    </h3>

                    {data.commercial.payments.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa có giao dịch thanh toán nào được ghi nhận.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {data.commercial.payments.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                +{p.amount.toLocaleString('vi-VN')} ₫
                              </span>
                              <span className="text-slate-500">
                                ({p.paymentMethod})
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                              <span>{new Date(p.transactionDate).toLocaleDateString('vi-VN')}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                {p.referenceCode}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Execution & Handover */}
              {activeTab === 'execution' && (
                <div className="space-y-6">
                  {/* Site Diaries */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Nhật ký Tiến độ Công trường ({data.execution.siteDiaries.length})</span>
                    </h3>

                    {data.execution.siteDiaries.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa có nhật ký công trường nào được ghi nhận.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.execution.siteDiaries.map((diary) => (
                          <div
                            key={diary.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {diary.projectName}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {diary.date}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {diary.progressSummary}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* QC Punch List */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Hạng mục Kiểm soát Chất lượng QC ({data.execution.punchListItems.length})</span>
                    </h3>

                    {data.execution.punchListItems.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Không có tồn đọng QC nào.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {data.execution.punchListItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">
                                {item.itemName}
                              </span>
                              <span className="text-slate-500">
                                [{item.roomZoneName}]
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Handover Dossiers */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Hồ sơ Bàn giao &amp; Nghiệm thu ({data.delivery?.handovers?.length || 0})</span>
                    </h3>

                    {!data.delivery?.handovers || data.delivery.handovers.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa có hồ sơ bàn giao nghiệm thu nào được ghi nhận.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.delivery.handovers.map((h) => (
                          <div
                            key={h.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {h.projectName}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  h.clientAccepted
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                }`}>
                                  {h.clientAccepted ? 'Đã ký nghiệm thu' : 'Chờ nghiệm thu'}
                                </span>
                              </div>
                              <span className="text-slate-400 font-mono text-[11px]">
                                {h.handoverDate ? new Date(h.handoverDate).toLocaleDateString('vi-VN') : 'Chưa có ngày'}
                              </span>
                            </div>
                            {h.clientSignoffName && (
                              <div className="text-[11px] text-slate-500">
                                Người ký đại diện: <strong className="text-slate-700 dark:text-slate-300">{h.clientSignoffName}</strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Warranty Certificates */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Chứng thư Bảo hành ({data.aftercare?.warrantyCertificates?.length || 0})</span>
                    </h3>

                    {!data.aftercare?.warrantyCertificates || data.aftercare.warrantyCertificates.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa phát hành chứng thư bảo hành nào.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.aftercare.warrantyCertificates.map((cert) => (
                          <div
                            key={cert.id}
                            className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                                  {cert.certificateNumber}
                                </span>
                                <span className="text-slate-900 dark:text-white font-semibold">
                                  {cert.projectName}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                {cert.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between">
                              <span>Hiệu lực: {cert.effectiveDate} → {cert.expirationDate}</span>
                              {cert.termsSummary && (
                                <span className="truncate max-w-[260px] text-slate-400">
                                  {cert.termsSummary}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Warranty Tickets */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Phiếu Yêu cầu Bảo hành &amp; Chăm sóc ({data.aftercare.warrantyTickets.length})</span>
                    </h3>

                    {data.aftercare.warrantyTickets.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Chưa phát sinh yêu cầu bảo hành nào.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {data.aftercare.warrantyTickets.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold font-mono text-slate-900 dark:text-white">
                                  {ticket.ticketNumber}
                                </span>
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  {ticket.defectCategory}
                                </span>
                                {ticket.certificateNumber && (
                                  <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                    Chứng thư: {ticket.certificateNumber}
                                  </span>
                                )}
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {ticket.status}
                              </span>
                            </div>
                            {ticket.description && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                {ticket.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span>Dự án: {ticket.projectName}</span>
                              <span>Ngày báo: {new Date(ticket.reportedDate).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Unified Chronological Timeline */}
              {activeTab === 'timeline' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Dòng thời gian tương tác Khách hàng 360 ({data.timeline.length} sự kiện)</span>
                  </h3>

                  {data.timeline.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                      Chưa ghi nhận sự kiện tương tác nào.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {data.timeline.map((evt) => (
                        <div key={evt.id} className="relative group">
                          {/* Dot / Icon */}
                          <div className="absolute -left-[23px] top-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-blue-400 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                  {evt.title}
                                </h4>
                                {(() => {
                                  const badge = getEventBadge(evt.eventType);
                                  return badge ? (
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badge.className}`}>
                                      {badge.label}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(evt.timestamp).toLocaleString('vi-VN')}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              {evt.description}
                            </p>

                            {evt.projectName && (
                              <div className="mt-2 text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                <span>{evt.projectName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
