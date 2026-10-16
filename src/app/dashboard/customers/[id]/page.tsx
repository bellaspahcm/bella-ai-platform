'use client';

import { PaymentReceiptTemplate } from '@/components/common/PaymentReceiptTemplate';
import { ChevronLeft, Share2, MessageCircle, Calendar, Plus } from 'lucide-react';
import nextDynamic from 'next/dynamic';
import { useState } from 'react';
import { ActiveBookingPanel } from './components/ActiveBookingPanel';
import { BookingSelectorPanel } from './components/BookingSelectorPanel';
import { BookingPaymentModal, EditBookingModal, EditCustomerModal } from './components/CustomerDetailModals';
import { CustomerHeaderBanner, CustomerDetailInfoCard } from './components/CustomerProfilePanel';
import { CustomerStatsPanel } from './components/CustomerStatsPanel';
import { PaymentHistoryPanel } from './components/PaymentHistoryPanel';
import { SessionHistoryPanel } from './components/SessionHistoryPanel';
import { useCustomerDetailController } from './useCustomerDetailController';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/user-context';
import { getBabyCareSessionSummary } from './babycare-customer-view';

// Lazy-load BookingModal to keep Customer Detail page fast
const BookingModal = nextDynamic(
  () => import('@/components/features/BookingModal').then((module) => ({ default: module.BookingModal })),
  { ssr: false }
);

export const dynamic = 'force-dynamic';

type CustomerDetailTab = 'overview' | 'services' | 'bookings' | 'sessions' | 'payments' | 'profile' | 'activity' | 'notes';

export default function CustomerDetailPage() {
  const [activeTab, setActiveTab] = useState<CustomerDetailTab>('overview');
  const { product, isLoading: isProductLoading } = useUser();
  const isBabyCare = product?.productKey === 'bella_babycare';

  const {
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
    setActiveBooking,
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
  } = useCustomerDetailController();

  if (loading || isProductLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-[500px] p-6">
        <h2 className="text-lg font-black text-slate-800 mb-3">Không tìm thấy thông tin khách hàng</h2>
        <button onClick={handleBack} className="text-xs font-bold text-primary hover:underline">
          &larr; Quay lại danh sách
        </button>
      </div>
    );
  }

  const allBookings = customer.allBookings || [];
  const totalSessions = allBookings.reduce((sum, booking) => sum + (booking.session_logs?.length || 0), 0);
  const totalPayments = allBookings.reduce((sum, booking) => sum + (booking.revenue?.length || 0), 0);
  const notesCount = customer.notes?.trim() ? 1 : 0;
  const completedCareSessions = isBabyCare ? getBabyCareSessionSummary(activeBooking).completed.length : sortedSessions.length;
  const tabs: Array<{ id: CustomerDetailTab; label: string }> = isBabyCare ? [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'services', label: `Gói chăm sóc (${allBookings.length})` },
    { id: 'sessions', label: `Lịch sử chăm sóc (${completedCareSessions})` },
    ...(userRole === 'admin' ? [{ id: 'payments' as const, label: `Thanh toán gói (${activeBooking?.revenue?.length ?? 0})` }] : []),
    { id: 'profile', label: 'Hồ sơ mẹ và bé' },
    { id: 'notes', label: `Ghi chú (${notesCount})` },
  ] : [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'services', label: `Dịch vụ (${allBookings.length})` },
    { id: 'bookings', label: `Lịch hẹn (${totalSessions})` },
    { id: 'sessions', label: `Lịch sử chăm sóc (${sortedSessions.length})` },
    { id: 'payments', label: `Thanh toán (${totalPayments})` },
    { id: 'profile', label: 'Hồ sơ' },
    { id: 'activity', label: 'Hoạt động' },
    { id: 'notes', label: `Ghi chú (${notesCount})` },
  ];
  const showPackages = !isBabyCare || activeTab === 'overview' || activeTab === 'services';
  const showSessions = !isBabyCare || activeTab === 'overview' || activeTab === 'sessions';
  const showProfile = !isBabyCare || activeTab === 'overview' || activeTab === 'profile';
  const showPayments = !isBabyCare || activeTab === 'overview' || activeTab === 'payments';
  const showNotes = !isBabyCare || activeTab === 'overview' || activeTab === 'notes';

  return (
    <div className="flex-1 overflow-auto bg-slate-100/70 p-4 sm:p-6 md:p-8">
      {/* ── Top Header Navigation Bar matching Image 2 ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 font-black text-slate-800 text-base hover:text-primary transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </div>
          Chi tiết khách hàng
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSharePortal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            Chia sẻ
          </button>

          <button
            onClick={handleOpenZalo}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-100" />
            Nhắn Zalo
          </button>

          <button
            onClick={() => setIsBookingModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:bg-primary-hover transition-all shadow-md shadow-primary/20 active:scale-95"
          >
            <Calendar className="w-3.5 h-3.5" />
            Đặt lịch nhanh
          </button>
        </div>
      </div>

      {/* ── Top Customer Summary Header Banner ── */}
      <CustomerHeaderBanner
        isBabyCare={isBabyCare}
        customer={customer}
        tenantModuleKey={tenantModuleKey}
        userRole={userRole}
        onEditCustomer={handleOpenEditCustomer}
        onOpenBooking={() => setIsBookingModalOpen(true)}
        onOpenZalo={handleOpenZalo}
        onSharePortal={handleSharePortal}
      />

      {/* ── 5-KPI Stats Row ── */}
      <CustomerStatsPanel
        isBabyCare={isBabyCare}
        activeBooking={activeBooking}
        activeDepositAmount={activeDepositAmount}
        activeNetPrice={activeNetPrice}
        userRole={userRole}
        loyaltyPoints={customer.loyalty_points}
        allBookings={customer.allBookings || []}
      />

      {/* ── Tab Bar Navigation Pills matching Image 2 ── */}
      <div role={isBabyCare ? 'tablist' : undefined} aria-label={isBabyCare ? 'Thông tin chăm sóc' : undefined} className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role={isBabyCare ? 'tab' : undefined}
            aria-selected={isBabyCare ? activeTab === tab.id : undefined}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all border shrink-0",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10"
                : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {isBabyCare && activeBooking && !showPackages && <p className="mb-4 text-sm text-slate-500">Gói đang xem: <span className="font-bold text-slate-800">{activeBooking.package_name || activeBooking.packages?.name || 'Gói chăm sóc'}</span></p>}

      {/* ── Service Package Selector ("Chọn đơn dịch vụ đang xem") ── */}
      {showPackages && <BookingSelectorPanel
        isBabyCare={isBabyCare}
        bookings={customer.allBookings || []}
        activeBooking={activeBooking}
        onSelectBooking={setActiveBooking}
        onDeleteBooking={handleDeleteBooking}
        tenantModuleKey={tenantModuleKey}
        userRole={userRole}
        selectedBookingIds={selectedBookingIds}
        onToggleBookingSelection={handleToggleBookingSelection}
        isCombineMode={isCombineMode}
        onToggleCombineMode={handleToggleCombineMode}
      />}

      {/* ── Active Package Dark Card + AI KTV Suggestion ── */}
      {showPackages && <ActiveBookingPanel
        isBabyCare={isBabyCare}
        activeBooking={activeBooking}
        ktvs={ktvs}
        tenantModuleKey={tenantModuleKey}
        userRole={userRole}
        isDepositOnly={isDepositOnly}
        activeDepositAmount={activeDepositAmount}
        activeNetPrice={activeNetPrice}
        isExportingQuotation={isExportingQuotation}
        isExportingCombinedQuotation={isExportingCombinedQuotation}
        isUpdatingKtv={isUpdatingKTV}
        isCombineMode={isCombineMode}
        selectedBookingIds={selectedBookingIds}
        onOpenBooking={() => setIsBookingModalOpen(true)}
        onPayRemaining={handlePayRemaining}
        onOpenZalo={handleOpenZalo}
        onSharePortal={handleSharePortal}
        onExportQuotation={handleExportQuotation}
        onExportContract={handleExportContract}
        onEditBooking={handleOpenEditBooking}
        onUpdateKtv={handleUpdateKTV}
        onOpenBookingSessions={handleOpenBookingSessions}
        onExportCombinedQuotation={handleExportCombinedQuotation}
        onShareCombinedPortal={handleShareCombinedPortal}
      />}

      {/* ── 2-Column Main Workspace Grid matching Image 2 ── */}
      <div className={cn("grid grid-cols-1 gap-6", (!isBabyCare || activeTab === 'overview') && 'lg:grid-cols-2')}>
        {/* Left Column: Next Session + Care History + Before/After photos */}
        {showSessions && <div>
          <SessionHistoryPanel
            isBabyCare={isBabyCare}
            customerAddress={customer.address}
            activeBooking={activeBooking}
            sortedSessions={sortedSessions}
            nextSession={nextSession}
            isCompleted={isCompleted}
            isReusing={isReusing}
            onOpenSessions={handleOpenSessions}
            onOpenBookingSessions={handleOpenBookingSessions}
            onReusePackage={handleReuseActivePackage}
            tenantModuleKey={tenantModuleKey}
            tenantPhone={tenantPhone}
          />
        </div>}

        {/* Right Column: Customer Detailed Info + Payment History + Recent Notes */}
        {(showProfile || showPayments || showNotes) && <div className="space-y-6">
          {showProfile && <CustomerDetailInfoCard
            isBabyCare={isBabyCare}
            customer={customer}
            tenantModuleKey={tenantModuleKey}
            onEditCustomer={handleOpenEditCustomer}
          />}

          {showPayments && <PaymentHistoryPanel activeBooking={activeBooking} userRole={userRole} />}
          {isBabyCare && showPayments && !activeBooking && <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">Chưa có gói chăm sóc để xem thanh toán.</p>}

          {/* Ghi chú & hoạt động gần đây Card matching Image 2 */}
          {showNotes && <div className="rounded-[2.5rem] bg-white p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>{isBabyCare ? 'Ghi chú chăm sóc' : 'Ghi chú & hoạt động gần đây'}</span>
              </h3>
              <button onClick={isBabyCare ? handleOpenEditCustomer : undefined} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors">
                <Plus className="w-3.5 h-3.5" /> {isBabyCare && customer.notes ? 'Sửa ghi chú' : 'Thêm ghi chú'}
              </button>
            </div>

            {isBabyCare ? <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{customer.notes || 'Chưa có ghi chú chăm sóc.'}</p> : <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">Khách thanh toán nốt gói dịch vụ.</p>
                  <p className="text-[10px] text-slate-400">24/07/2026 10:15 • Admin Spa</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">Khách đặt cọc gói Gội Đầu Dưỡng Sinh Demo.</p>
                  <p className="text-[10px] text-slate-400">24/07/2026 09:32 • Admin Spa</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">Tạo hồ sơ khách hàng mới.</p>
                  <p className="text-[10px] text-slate-400">24/07/2026 09:20 • Admin Spa</p>
                </div>
              </div>
            </div>}
          </div>}
        </div>}
      </div>

      {/* ── Modals & Hidden Receipt Templates ── */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={handleBookingSuccess}
        preselectedCustomer={customer}
      />

      <EditCustomerModal
        isBabyCare={isBabyCare}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onConfirm={handleUpdateCustomer}
        isSubmitting={isUpdatingCustomer}
        data={editData}
        setData={setEditData}
        tenantModuleKey={tenantModuleKey}
        customerCreatedAt={customer.created_at}
        loyaltyPoints={customer.loyalty_points}
      />

      <BookingPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handleRecordPayment}
        isSubmitting={isRecordingPayment}
        data={paymentData}
        setData={setPaymentData}
        file={paymentFile}
        setFile={setPaymentFile}
        customerName={customer.name_mother}
      />

      <EditBookingModal
        isOpen={isEditBookingModalOpen}
        onClose={() => setIsEditBookingModalOpen(false)}
        onConfirm={handleSaveBooking}
        isSubmitting={isSavingBooking}
        data={editBookingData}
        setData={setEditBookingData}
        bookingId={activeBooking?.id}
        currentKtvId={activeBooking?.assigned_ktv_id || undefined}
        currentKtvName={activeBooking?.assigned_ktv?.full_name || 'KTV'}
      />

      {activeBooking && receiptData && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <PaymentReceiptTemplate ref={quotationRef} data={receiptData} />
        </div>
      )}

      {combinedReceiptData && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <PaymentReceiptTemplate ref={combinedQuotationRef} data={combinedReceiptData} />
        </div>
      )}
    </div>
  );
}
