import { existsSync, readFileSync } from 'fs';
import { calculatePortalPaymentSummary } from '@/app/portal/[token]/payment-utils';
import {
  calculateBookingPaymentState,
  calculateConfirmedPaidAmount,
  calculatePaymentRequest,
  type PaymentRevenueLike,
} from '@/lib/business-rules/payment';
import { validateRemainingPaymentAmount } from '@/core/services/order/payment-helpers';
import {
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus,
} from '@/core/services/accounting/template-rules';

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

describe('payment business rule audit', () => {
  it('keeps a confirmed bank-transfer deposit from reopening the deposit QR', () => {
    const revenues: PaymentRevenueLike[] = [
      { amount: 200000, status: 'confirmed', revenue_type: 'deposit' },
    ];
    const booking = {
      id: 'booking-me-tien',
      deposit_amount: 200000,
      full_price: 6000000,
      discount_percent: 25,
      status: 'deposit_pending',
      tenant_id: 'tenant-1',
      revenue: revenues,
    } satisfies Parameters<typeof validateRemainingPaymentAmount>[0];

    const engineState = calculateBookingPaymentState({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
    });
    const portalSummary = calculatePortalPaymentSummary({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });
    const bookingQrRequest = calculatePaymentRequest({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });

    expect(calculateConfirmedPaidAmount(revenues)).toBe(200000);
    expect(engineState.priceAfterDiscount).toBe(4500000);
    expect(engineState.totalPaid).toBe(200000);
    expect(engineState.depositDue).toBe(0);
    expect(engineState.remainingDebt).toBe(4300000);
    expect(engineState.showDepositRequest).toBe(false);

    expect(portalSummary.showDepositTab).toBe(false);
    expect(portalSummary.effectiveTab).toBe('full');
    expect(portalSummary.amountToPay).toBe(4300000);
    expect(bookingQrRequest.effectiveTab).toBe('full');
    expect(bookingQrRequest.amountToPay).toBe(4300000);

    expect(validateRemainingPaymentAmount(booking, 4300000)).toEqual({ success: true });
    expect(validateRemainingPaymentAmount(booking, 4300001).error).toContain('4.300.000');

    const depositLedgerEvent = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType: 'deposit',
    });
    const depositLedgerMetadata = buildRevenueAccountingMetadata({
      revenueType: 'deposit',
      amount: 200000,
      paymentMethod: 'bank_transfer',
      bookingId: booking.id,
      reason: 'Coc goi Me Tien',
    });

    expect(depositLedgerEvent).toBe('CUSTOMER_DEPOSIT');
    expect(resolveAccountingReviewStatus(depositLedgerEvent, depositLedgerMetadata)).toBe('UNREVIEWED');
  });

  it('marks every payment surface as closed when confirmed revenue covers the package price', () => {
    const revenues: PaymentRevenueLike[] = [
      { amount: 4500000, status: 'confirmed', revenue_type: 'package_payment' },
    ];
    const booking = {
      id: 'booking-paid-in-full',
      deposit_amount: 200000,
      full_price: 6000000,
      discount_percent: 25,
      status: 'booked',
      tenant_id: 'tenant-1',
      revenue: revenues,
    } satisfies Parameters<typeof validateRemainingPaymentAmount>[0];

    const portalSummary = calculatePortalPaymentSummary({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });
    const bookingQrRequest = calculatePaymentRequest({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });

    expect(portalSummary.hasOutstandingDebt).toBe(false);
    expect(portalSummary.amountToPay).toBe(0);
    expect(bookingQrRequest.amountToPay).toBe(0);
    expect(validateRemainingPaymentAmount(booking, 1).error).toBeTruthy();
  });

  it('keeps production discount pricing routed through the shared payment engine', () => {
    const bookingModalSource = readSource('src/components/features/BookingModal.tsx');
    const activeBookingPanelSource = readSource('src/app/dashboard/customers/[id]/components/ActiveBookingPanel.tsx');
    const servicePerformanceSource = readSource('src/core/services/finance/service-performance-report.ts');
    const auditedProductionSources = [
      bookingModalSource,
      activeBookingPanelSource,
      servicePerformanceSource,
    ].join('\n');

    expect(bookingModalSource).toContain('calculateBookingPaymentState');
    expect(activeBookingPanelSource).toContain('paymentState');
    expect(servicePerformanceSource).toContain('calculatePriceAfterDiscount');
    expect(auditedProductionSources).not.toMatch(/discount_percent[^\n]*(?:\/\s*100|\*)/);
    expect(auditedProductionSources).not.toMatch(/discountPercent[^\n]*(?:\/\s*100|\*)/);
  });

  it('keeps high-risk payment inputs routed through shared money input helpers', () => {
    const auditedMoneyInputSources = [
      'src/components/features/BookingModal.tsx',
      'src/components/features/TransactionModal.tsx',
      'src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx',
      'src/app/dashboard/finance/reconciliation/page.tsx',
      'src/app/dashboard/finance/reconciliation/components/DebtPaymentModal.tsx',
    ].map(readSource).join('\n');

    expect(auditedMoneyInputSources).toContain('parseMoneyInput');
    expect(auditedMoneyInputSources).toContain('formatMoneyInput');
    expect(auditedMoneyInputSources).not.toMatch(/replace\(\s*\/\\D/);
    expect(auditedMoneyInputSources).not.toMatch(/replace\(\s*\/\[\^\\d\]/);
    expect(auditedMoneyInputSources).not.toMatch(/Number\([^\n]*replace/);
  });

  it('keeps the operational customer payment path on the canonical remaining-payment contract', () => {
    const activeBookingPanelSource = readSource('src/app/dashboard/customers/[id]/components/ActiveBookingPanel.tsx');
    const customerControllerSource = readSource('src/app/dashboard/customers/[id]/useCustomerDetailController.ts');
    const paymentActionSource = readSource('src/core/services/order/payment-actions.ts');
    const paymentHelperSource = readSource('src/core/services/order/payment-helpers.ts');

    expect(activeBookingPanelSource).toContain('calculateBookingPaymentState');
    expect(activeBookingPanelSource).toContain('onPayRemaining');
    expect(customerControllerSource).toContain('recordRemainingPayment({');
    expect(customerControllerSource).toContain('booking_id: activeBooking.id');
    expect(paymentActionSource).toContain('validateRemainingPaymentAmount');
    expect(paymentActionSource).toContain('assertPaymentAccountingPeriod');
    expect(paymentHelperSource).toContain('record_remaining_payment_atomic');
    expect(paymentHelperSource).toContain(".eq('tenant_id', tenantId)");
  });

  it('keeps the active package paid amount on confirmed revenue without demo-money fallback', () => {
    const activeBookingPanelSource = readSource('src/app/dashboard/customers/[id]/components/ActiveBookingPanel.tsx');
    const stateWithNoConfirmedRevenue = calculateBookingPaymentState({
      fullPrice: 6000000,
      discountPercent: 25,
      depositAmount: 500000,
      bookingStatus: 'in_progress',
      revenues: [],
    });

    expect(stateWithNoConfirmedRevenue.totalPaid).toBe(0);
    expect(stateWithNoConfirmedRevenue.remainingDebt).toBe(4500000);
    expect(activeBookingPanelSource).toContain('const displayedPaidAmount = paymentState?.totalPaid ?? 0;');
    expect(activeBookingPanelSource).not.toContain('paymentState?.totalPaid || 4290000');
  });

  it('clarifies edit-package deposit target and shows the realtime discount amount preview', () => {
    const editBookingModalSource = readSource('src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx');

    expect(calculateBookingPaymentState({
      fullPrice: 6000000,
      discountPercent: 25,
      depositAmount: 500000,
      bookingStatus: 'in_progress',
      revenues: [{ amount: 4290000, status: 'confirmed', revenue_type: 'package_payment' }],
    })).toMatchObject({
      priceAfterDiscount: 4500000,
      totalPaid: 4290000,
      remainingDebt: 210000,
      depositTarget: 500000,
    });

    expect(editBookingModalSource).toContain('calculatePriceAfterDiscount');
    expect(editBookingModalSource).toContain('Mục tiêu cọc / cọc cần thu');
    expect(editBookingModalSource).toContain('Số đã thanh toán được tính từ các khoản thu đã xác nhận.');
    expect(editBookingModalSource).toContain('Chiết khấu {discountPreview.discountPercent}%:');
    expect(editBookingModalSource).toContain('Giá sau chiết khấu:');
    expect(editBookingModalSource).not.toContain('Đã thanh toán / Cọc');
  });

  it('keeps Haircut debt collection on the F3 receivable contract', () => {
    const haircutReconciliationSource = readSource(
      'src/app/dashboard/finance/reconciliation/components/HaircutReconciliationView.tsx'
    );
    const haircutF3ActionSource = readSource('src/services/haircut-f3-reconciliation-actions.ts');

    expect(haircutReconciliationSource).toContain('getHaircutF3OpenReceivables');
    expect(haircutReconciliationSource).toContain('collectHaircutF3ReceivablePayment');
    expect(haircutReconciliationSource).not.toContain('MOCK_CUSTOMER_DEBTS');
    expect(haircutReconciliationSource).not.toContain('HAIRCUT_DEBT_COLLECTION_GAP_MESSAGE');
    expect(haircutF3ActionSource).toContain('finance_receivable_positions');
    expect(haircutF3ActionSource).toContain('outstanding_amount_minor');
    expect(haircutF3ActionSource).toContain('allocateConfirmedPaymentToInvoiceReceivable');
    expect(haircutF3ActionSource).not.toContain('collectDebtPayment(');
    expect(haircutF3ActionSource).not.toContain('recordRemainingPayment(');
    expect(haircutReconciliationSource).not.toContain('value="mpos"');
  });

  it('keeps Haircut salary routed through the canonical Payroll read-write contract', () => {
    const haircutSalarySource = readSource('src/app/dashboard/salary/HaircutSalaryView.tsx');
    const salaryPageSource = readSource('src/app/dashboard/salary/page.tsx');
    const adminSalaryActionsSource = readSource('src/modules/hr-salary/actions/admin-salary-actions.ts');
    const salaryWorkflowHelpersSource = readSource('src/modules/hr-salary/actions/admin-salary-workflow-helpers.ts');

    expect(existsSync('src/app/dashboard/salary/HaircutSalaryView.tsx')).toBe(true);
    expect(haircutSalarySource).not.toContain('SALARY_LIST');
    expect(haircutSalarySource).not.toContain('HAIRCUT_SALARY_WRITE_GAP_MESSAGE');
    expect(haircutSalarySource).not.toContain('export function HaircutSalaryView');
    expect(haircutSalarySource).toContain('shared canonical salary/payroll page');
    expect(salaryPageSource).not.toContain('HaircutSalaryView');
    expect(salaryPageSource).not.toContain("product?.productKey === 'bella_haircut'");
    expect(salaryPageSource).toContain('getSalaryData');
    expect(salaryPageSource).toContain('publishAllSalaryRecords');
    expect(salaryPageSource).toContain('finalizeAllSalaryRecords');
    expect(salaryPageSource).toContain('SalaryTable');
    expect(salaryPageSource).toContain('handlePublishAll');
    expect(salaryPageSource).toContain('handleFinalizeAll');
    expect(salaryPageSource).toContain('SessionMatrixTable');
    expect(salaryPageSource).toContain('AttendanceSummaryTable');
    expect(adminSalaryActionsSource).toContain('export async function publishAllSalaryRecords');
    expect(adminSalaryActionsSource).toContain('export async function finalizeAllSalaryRecords');
    expect(adminSalaryActionsSource).toContain('createSalaryExpense({');
    expect(adminSalaryActionsSource).toContain('revalidateApprovedSalaryViews');
    expect(salaryWorkflowHelpersSource).toContain("sourceTable: 'expenses'");
    expect(salaryWorkflowHelpersSource).toContain("category: 'salary'");
  });

  it('keeps Haircut booking routed through the canonical booking read-write contract', () => {
    const haircutBookingsSource = readSource('src/app/dashboard/bookings/HaircutBookingsView.tsx');
    const bookingsPageSource = readSource('src/app/dashboard/bookings/page.tsx');
    const bookingsDataSource = readSource('src/app/dashboard/bookings/hooks/useBookingsPageData.ts');
    const bookingsActionsSource = readSource('src/app/dashboard/bookings/hooks/useBookingsPageActions.ts');

    expect(existsSync('src/app/dashboard/bookings/HaircutBookingsView.tsx')).toBe(true);
    expect(haircutBookingsSource).not.toContain('timelineGridData');
    expect(haircutBookingsSource).not.toContain('HAIRCUT_BOOKING_WRITE_GAP_MESSAGE');
    expect(haircutBookingsSource).not.toContain('export function HaircutBookingsView');
    expect(haircutBookingsSource).toContain('shared canonical bookings page');
    expect(bookingsPageSource).not.toContain('HaircutBookingsView');
    expect(bookingsPageSource).not.toContain("product?.productKey === 'bella_haircut'");
    expect(bookingsPageSource).toContain('TimelineKtvView');
    expect(bookingsPageSource).toContain('BookingDayDetailModal');
    expect(bookingsPageSource).toContain('BookingCreateScheduleModal');
    expect(bookingsPageSource).toContain('handleUpdatePlan');
    expect(bookingsPageSource).toContain('handleCreateScheduleSubmit');
    expect(bookingsPageSource).toContain('openSessionDetail');
    expect(bookingsPageSource).toContain('onOpenBookingModal');
    expect(bookingsDataSource).toContain('getCalendarSessions');
    expect(bookingsActionsSource).toContain('checkBookingConflicts({');
    expect(bookingsActionsSource).toContain('createSessionLog({');
    expect(bookingsActionsSource).toContain('updateSessionLog(modalData.id');
    expect(bookingsActionsSource).toContain('updateBooking(modalData.bookingId');
    expect(bookingsActionsSource).not.toContain('HAIRCUT_BOOKING_WRITE_GAP_MESSAGE');
  });

  it('keeps Haircut package static rows from driving canonical package writes', () => {
    const haircutPackagesSource = readSource('src/app/dashboard/sessions/HaircutPackagesView.tsx');
    const sessionsPageSource = readSource('src/app/dashboard/sessions/page.tsx');
    const staleDetailsCast = ['onViewDetails?.(pkg as', 'any)'].join(' ');

    expect(haircutPackagesSource).toContain('PACKAGES_LIST');
    expect(haircutPackagesSource).toContain('HAIRCUT_PACKAGES_WRITE_GAP_MESSAGE');
    expect(haircutPackagesSource).toContain('booking_id canonical');
    expect(haircutPackagesSource).not.toContain('onUseSession?.(pkg.id)');
    expect(haircutPackagesSource).not.toContain('onReorderPackage?.(pkg.id)');
    expect(haircutPackagesSource).not.toContain(staleDetailsCast);
    expect(sessionsPageSource).not.toContain('HaircutPackagesView');
    expect(sessionsPageSource).not.toContain("product?.productKey === 'bella_haircut'");
    expect(sessionsPageSource).toContain('getSessionsWithDetails');
    expect(sessionsPageSource).toContain('completeSession');
    expect(sessionsPageSource).toContain('reusePackage');
    expect(sessionsPageSource).toContain('SessionCard');
    expect(sessionsPageSource).not.toContain("toast.info('Đã chọn sử dụng 1 lượt gói dịch vụ')");
    expect(sessionsPageSource).not.toContain("handleReusePackage(id, 'Khách hàng')");
  });

  it('keeps Haircut customer metrics from using synthetic business claims', () => {
    const haircutCustomerSource = readSource('src/app/dashboard/customers/HaircutCustomerView.tsx');

    expect(haircutCustomerSource).toContain('customers.reduce');
    expect(haircutCustomerSource).toContain('getCustomerBookingCount');
    expect(haircutCustomerSource).toContain('getCustomerSpendAmount');
    expect(haircutCustomerSource).not.toContain('const totalCount = 1284');
    expect(haircutCustomerSource).not.toContain('const newCount = 324');
    expect(haircutCustomerSource).not.toContain('const loyalCount = 428');
    expect(haircutCustomerSource).not.toContain('const vipCount = 156');
    expect(haircutCustomerSource).not.toContain('const careCount = 86');
    expect(haircutCustomerSource).not.toContain('2.416');
    expect(haircutCustomerSource).not.toContain('idx % 2 === 0');
    expect(haircutCustomerSource).not.toContain('idx % 3 === 0');
    expect(haircutCustomerSource).not.toContain('idx % 4 === 0');
    expect(haircutCustomerSource).not.toContain('5400000');
    expect(haircutCustomerSource).not.toContain('0900 002 6801');
    expect(haircutCustomerSource).not.toContain('Nguyễn Hoàng Anh');
    expect(haircutCustomerSource).not.toContain('18/09/2026');
    expect(haircutCustomerSource).not.toContain('Tỷ lệ quay lại 72%');
    expect(haircutCustomerSource).not.toContain('+138 khách so với tháng trước');
  });

  it('keeps high-risk percent and integer inputs routed through shared numeric helpers', () => {
    const auditedNumericInputSources = [
      'src/components/features/BookingModal.tsx',
      'src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx',
      'src/app/dashboard/customers/[id]/useCustomerDetailController.ts',
      'src/app/dashboard/settings/components/SalaryConfigTab.tsx',
      'src/app/dashboard/crm/components/CrmVoucherModal.tsx',
      'src/app/dashboard/crm/hooks/useCrmVoucherCampaigns.ts',
      'src/app/dashboard/settings/components/promotions/PromotionForm.tsx',
      'src/app/dashboard/settings/components/promotions/usePromotionsSettings.ts',
    ].map(readSource).join('\n');

    expect(auditedNumericInputSources).toContain('parsePercentInput');
    expect(auditedNumericInputSources).toContain('parseIntegerInput');
    expect(auditedNumericInputSources).not.toMatch(/parseInt\(/);
    expect(auditedNumericInputSources).not.toMatch(/Number\([^\n]*\)\s*\|\|\s*0/);
  });

  it('keeps service package and HQ template numeric inputs routed through shared helpers', () => {
    const servicesPageSource = readSource('src/app/dashboard/services/page.tsx');
    const servicesHookSource = readSource('src/app/dashboard/services/hooks/useServicesPageState.ts');
    const hqDashboardSource = readSource('src/app/hq/hq-dashboard-client.tsx');
    const hqTemplateModalSource = readSource('src/app/hq/components/HqServiceTemplateModal.tsx');
    const auditedServiceSources = [
      servicesPageSource,
      servicesHookSource,
      hqDashboardSource,
      hqTemplateModalSource,
    ].join('\n');

    expect(auditedServiceSources).toContain('parseMoneyInput');
    expect(auditedServiceSources).toContain('formatMoneyInput');
    expect(auditedServiceSources).toContain('parseIntegerInput');
    expect(auditedServiceSources).toContain('parseDecimalInput');
    expect(servicesPageSource).not.toContain('formatNumberWithSeparator(e.target.value)');
    expect(servicesPageSource).not.toMatch(/replace\(\s*\/\[\^\\d\]/);
    expect(servicesHookSource).not.toMatch(/Number\(row\.quantity_per_session\)/);
    expect(hqDashboardSource).not.toMatch(/parseFloat\(template/);
    expect(hqDashboardSource).not.toMatch(/parseInt\(template/);
  });

  it('keeps service package server actions routed through the package rule engine', () => {
    const packageActionsSource = readSource('src/services/package-actions.ts');
    const brandServiceActionsSource = readSource('src/services/brand-service-actions.ts');
    const servicePackageEngineSource = readSource('src/lib/business-rules/service-package.ts');
    const auditedServerSources = [
      packageActionsSource,
      brandServiceActionsSource,
    ].join('\n');

    expect(packageActionsSource).toContain('buildServicePackagePayload');
    expect(packageActionsSource).toContain('buildServicePackageUpdatePayload');
    expect(brandServiceActionsSource).toContain('buildHqPackageTemplatePayload');
    expect(brandServiceActionsSource).toContain('resolveDistributedPackagePrice');
    expect(servicePackageEngineSource).toContain('validateTenantPackagePriceOverride');
    expect(auditedServerSources).not.toContain('parseNumericValue');
    expect(auditedServerSources).not.toMatch(/Number\(templateData/);
    expect(auditedServerSources).not.toMatch(/newPrice\s*[<>]/);
  });

  it('keeps salary display and optimistic totals routed through the shared salary contract', () => {
    const salaryPageSource = readSource('src/app/dashboard/salary/page.tsx');
    const querySalarySource = readSource('src/modules/hr-salary/actions/query-salary-actions.ts');
    const recalculationSource = readSource('src/modules/hr-salary/actions/salary-recalculation-engine.ts');

    expect(salaryPageSource).toContain('calculateSalaryTotal');
    expect(querySalarySource).toContain('buildSalaryDisplayComponents');
    expect(recalculationSource).toContain('isDraftSalaryRecord');
    expect(recalculationSource).toContain('assertSalaryRecalculationLifecycle');
    expect(salaryPageSource).not.toMatch(/totalSalary:\s*editingSalary\.baseSalary\s*\+/);
    expect(querySalarySource).not.toContain("const isDraft = !record || record.status === 'draft'");
  });
});
