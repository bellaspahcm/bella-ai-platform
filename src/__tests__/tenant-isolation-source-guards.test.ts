import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('dashboard tenant isolation source guards', () => {
  it('keeps inventory dashboard reads behind tenant-scoped server actions', () => {
    const source = readSource('src/app/dashboard/inventory/hooks/useInventoryPageState.ts');

    expect(source).toContain('getCachedInventoryItemsForPage');
    expect(source).toContain('getCachedInventoryLogsForPage');
    expect(source).not.toMatch(/\.from\('inventory_(items|logs)'\)/);
  });

  it('keeps booking assignment updates behind the tenant-scoped booking action', () => {
    const source = readSource('src/app/dashboard/bookings/hooks/useBookingsPageActions.ts');

    expect(source).toContain('updateBooking(modalData.bookingId');
    expect(source).not.toMatch(/\.from\('bookings'\)\s*\.update/);
  });

  it('scopes audit reference maps to the current tenant', () => {
    const source = readSource('src/app/dashboard/audit/page.tsx');

    expect(source).toMatch(
      /\.from\('users'\)[\s\S]{0,160}\.select\('id, full_name'\)[\s\S]{0,160}\.eq\('tenant_id', tenantId\)/,
    );
    expect(source).toMatch(
      /\.from\('packages'\)[\s\S]{0,160}\.select\('id, name'\)[\s\S]{0,160}\.eq\('tenant_id', tenantId\)/,
    );
    expect(source).toMatch(
      /\.from\('customers'\)[\s\S]{0,180}\.select\('id, name_mother, name_baby'\)[\s\S]{0,180}\.eq\('tenant_id', tenantId\)/,
    );
  });

  it('keeps BookingModal customer and KTV pickers behind tenant-scoped server actions', () => {
    const source = readSource('src/components/features/BookingModal.tsx');

    expect(source).toContain('getScopedCustomers()');
    expect(source).toContain('getUsers()');
    expect(source).not.toMatch(/\.from\('users'\)/);
    expect(source).not.toMatch(/\.from\('customers'\)/);
  });

  it('does not read tenant identity from browser-side user queries on the services page', () => {
    const source = readSource('src/app/dashboard/services/hooks/useServicesPageState.ts');

    expect(source).not.toContain('createBrowserClient');
    expect(source).not.toContain('getTenantId');
    expect(source).not.toMatch(/\.from\('users'\)/);
    expect(source).not.toContain('tenant_id: tenantId');
  });

  it('scopes staff list reads to the current tenant', () => {
    const source = readSource('src/services/user-actions.ts');

    expect(source).toMatch(
      /export async function getUsers\(\)[\s\S]{0,500}\.from\('users'\)[\s\S]{0,260}\.eq\('tenant_id', tenantId\)/,
    );
  });

  it('keeps public online booking off first-tenant fallback and tenant-scopes rollbacks', () => {
    const source = readSource('src/core/services/order/online-booking-action.ts');

    expect(source).toContain('resolvePublicBabycareTenantId');
    expect(source).not.toMatch(/\.from\('tenants'\)[\s\S]{0,120}\.limit\(1\)[\s\S]{0,80}\.single\(/);
    expect(source).toMatch(/\.from\('customers'\)[\s\S]{0,140}\.delete\(\)[\s\S]{0,140}\.eq\('tenant_id', tenantId\)/);
    expect(source).toMatch(/\.from\('bookings'\)[\s\S]{0,140}\.delete\(\)[\s\S]{0,140}\.eq\('tenant_id', tenantId\)/);
  });

  it('does not fallback logged-in dashboard and booking views to babycare while tenant module is loading', () => {
    const dashboardSource = readSource('src/app/dashboard/page.tsx');
    const bookingsSource = readSource('src/app/dashboard/bookings/page.tsx');
    const customersSource = readSource('src/app/dashboard/customers/page.tsx');

    expect(dashboardSource).not.toContain("tenantModuleKey ?? 'babycare'");
    expect(bookingsSource).not.toContain("tenantModuleKey ?? 'babycare'");
    expect(customersSource).not.toContain("tenantModuleKey ?? 'babycare'");
    expect(dashboardSource).toContain('getTenantModulePresentationOrNeutral');
    expect(bookingsSource).toContain('Đang tải phân hệ dịch vụ');
    expect(customersSource).toContain('getTenantModulePresentationOrNeutral(tenantModuleKey)');
  });

  it('passes tenant module context into session cards and details modal', () => {
    const sessionsSource = readSource('src/app/dashboard/sessions/page.tsx');
    const sessionCardSource = readSource('src/app/dashboard/sessions/components/SessionCard.tsx');
    const sessionDetailsSource = readSource('src/app/dashboard/sessions/components/SessionLogsDetailsModal.tsx');

    expect(sessionsSource).toContain('useTenantModuleKey');
    expect(sessionsSource).toContain('tenantModuleKey={tenantModuleKey}');
    expect(sessionCardSource).toContain('getTenantModulePresentationOrNeutral');
    expect(sessionDetailsSource).toContain('getTenantModulePresentationOrNeutral');
    expect(sessionDetailsSource).not.toContain('Thẻ liệu trình: Khách');
  });

  it('keeps sidebar startup branding neutral until the current tenant brand is loaded', () => {
    const sidebarSource = readSource('src/components/layout/sidebar.tsx');

    expect(sidebarSource).not.toContain("displayName: 'Spa ERP'");
    expect(sidebarSource).toContain("moduleKey: 'pending'");
    expect(sidebarSource).toContain('useState<TenantBrandDisplay>(NEUTRAL_SIDEBAR_BRAND)');
    expect(sidebarSource).not.toContain('readRuntimeTenantBrand');
    expect(sidebarSource).not.toMatch(
      /const DEFAULT_SIDEBAR_BRAND[\s\S]{0,180}enabledModules:\s*\{\s*babycare:\s*true,\s*beauty_spa:\s*false\s*\}/,
    );
  });

  it('does not apply stale tenant brand cache during root first paint', () => {
    const rootLayoutSource = readSource('src/app/layout.tsx');
    const bootstrapSource = readSource('public/theme-bootstrap.js');
    const dashboardLayoutSource = readSource('src/app/dashboard/layout.tsx');

    expect(rootLayoutSource).toContain('/theme-bootstrap.js');
    expect(bootstrapSource).toContain('root.dataset.tenantModule = "pending"');
    expect(bootstrapSource).toContain('"#334155"');
    expect(rootLayoutSource).not.toContain('sessionStorage.getItem("bella.runtime.brand.v1")');
    expect(dashboardLayoutSource).toContain('await applyDashboardTenantBrandRuntime(tenant');
    expect(dashboardLayoutSource.indexOf('await applyDashboardTenantBrandRuntime(tenant')).toBeLessThan(
      dashboardLayoutSource.indexOf('setIsAuthorized(true)'),
    );
  });

  it('redirects HQ tenant accounts away from dashboard product shell', () => {
    const dashboardLayoutSource = readSource('src/app/dashboard/layout.tsx');

    expect(dashboardLayoutSource).toContain("from '@/lib/business-rules/hq-tenant'");
    expect(dashboardLayoutSource).toContain('if (isHqTenant(tenant))');
    expect(dashboardLayoutSource).toContain("router.replace('/hq')");
    expect(dashboardLayoutSource.indexOf('if (isHqTenant(tenant))')).toBeLessThan(
      dashboardLayoutSource.indexOf('await applyDashboardTenantBrandRuntime(tenant'),
    );
    expect(dashboardLayoutSource.indexOf("router.replace('/hq')")).toBeLessThan(
      dashboardLayoutSource.indexOf('setIsAuthorized(true)'),
    );
  });

  it('shares dashboard bootstrap reads through the client context cache', () => {
    const contextSource = readSource('src/lib/dashboard-client-context.ts');
    const dashboardLayoutSource = readSource('src/app/dashboard/layout.tsx');
    const sidebarSource = readSource('src/components/layout/sidebar.tsx');
    const settingsSource = readSource('src/app/dashboard/settings/page.tsx');

    expect(contextSource).toContain('currentUserPromise');
    expect(contextSource).toContain('tenantSettingsPromise');
    expect(contextSource).toContain('currentUserRequestVersion');
    expect(contextSource).toContain('tenantSettingsRequestVersion');
    expect(contextSource).toContain('requestVersion === currentUserRequestVersion');
    expect(contextSource).toContain('requestVersion === tenantSettingsRequestVersion');
    expect(dashboardLayoutSource).toContain('getCachedCurrentUser()');
    expect(dashboardLayoutSource).toContain('getCachedTenantSettings()');
    expect(sidebarSource).toContain('tenantSettings } = useUser()');
    expect(sidebarSource).toContain('resolveProductBrandPresentation(tenantSettings, product)');
    expect(sidebarSource).not.toContain('getCachedCurrentUser()');
    expect(sidebarSource).not.toContain('getCachedTenantSettings()');
    expect(settingsSource).toContain('getCachedTenantSettings(options)');
    expect(settingsSource).toContain('usePageRefresh(() => loadSettings({ force: true }))');
    expect(settingsSource).toContain('nextPath !== currentPath');
    expect(dashboardLayoutSource).not.toContain("from '@/services/user-actions'");
    expect(sidebarSource).not.toContain("from '@/services/user-actions'");
    expect(settingsSource).not.toContain('getTenantSettings()');
  });

  it('keeps student training portal isolated at the proxy and sidebar layers', () => {
    const proxySource = readSource('src/proxy.ts');
    const sidebarSource = readSource('src/components/layout/sidebar.tsx');
    const permissionsSource = readSource('src/lib/business-rules/permissions.ts');
    const trainingPageSource = readSource('src/app/dashboard/training/page.tsx');
    const studentDashboardSource = readSource('src/app/student/dashboard/page.tsx');
    const studentCompleteButtonSource = readSource('src/app/student/dashboard/StudentLessonCompleteButton.tsx');

    expect(proxySource).toContain("const isStudentRoute = pathname.startsWith('/student')");
    expect(proxySource).toContain("role === 'student'");
    expect(proxySource).toContain("new URL('/student/dashboard', request.url)");
    expect(proxySource).toContain("'/dashboard/:path*'");
    expect(proxySource).toContain("'/ktv/:path*'");
    expect(proxySource).toContain("'/student/:path*'");
    expect(proxySource).toContain("'/login'");
    expect(permissionsSource).toContain("'Đào tạo': 'student_training'");
    expect(trainingPageSource).not.toMatch(/\.from\('(courses|students|student_lesson_progress|student_tuition_payments|training_classes|student_class_attendance)'/);
    expect(trainingPageSource).not.toContain('createClient');
    expect(studentDashboardSource).toContain('getStudentTrainingPortalOverview');
    expect(studentDashboardSource).not.toMatch(/\.from\('(courses|students|users|course_modules|lessons|student_lesson_progress)'/);
    expect(studentDashboardSource).not.toContain('createClient');
    expect(studentCompleteButtonSource).toContain('markStudentLessonComplete');
    expect(studentCompleteButtonSource).not.toMatch(/\.from\('(courses|students|users|course_modules|lessons|student_lesson_progress)'/);
    expect(studentCompleteButtonSource).not.toContain('createClient');
  });

  it('keeps training course admin reads and writes behind server actions', () => {
    const coursesPageSource = readSource('src/app/dashboard/training/courses/page.tsx');
    const coursesClientSource = readSource('src/app/dashboard/training/courses/TrainingCoursesClient.tsx');
    const actionsSource = readSource('src/services/training-actions.ts');

    expect(coursesPageSource).toContain('getTrainingAdminOverview');
    expect(coursesClientSource).toContain('createTrainingCourse');
    expect(coursesClientSource).toContain('createCourseModule');
    expect(coursesClientSource).toContain('createTrainingLesson');
    expect(coursesPageSource).not.toMatch(/\.from\('(courses|course_modules|lessons|students)'/);
    expect(coursesClientSource).not.toMatch(/\.from\('(courses|course_modules|lessons|students)'/);
    expect(coursesClientSource).not.toContain('createClient');
    expect(actionsSource).toContain("allowedRoles: TRAINING_MANAGE_ROLES");
    expect(actionsSource).toContain(".eq('tenant_id', tenantId)");
  });

  it('keeps training enrollment admin reads and writes behind server actions', () => {
    const enrollmentsPageSource = readSource('src/app/dashboard/training/enrollments/page.tsx');
    const enrollmentsClientSource = readSource('src/app/dashboard/training/enrollments/TrainingEnrollmentsClient.tsx');
    const actionsSource = readSource('src/services/training-actions.ts');

    expect(enrollmentsPageSource).toContain('getTrainingEnrollmentAdminOverview');
    expect(enrollmentsClientSource).toContain('createTrainingEnrollment');
    expect(enrollmentsClientSource).toContain('updateTrainingEnrollment');
    expect(enrollmentsPageSource).not.toMatch(/\.from\('(courses|students|users|student_lesson_progress|student_tuition_payments)'/);
    expect(enrollmentsClientSource).not.toMatch(/\.from\('(courses|students|users|student_lesson_progress|student_tuition_payments)'/);
    expect(enrollmentsClientSource).not.toContain('createClient');
    expect(actionsSource).toContain("const STUDENT_USER_NOT_FOUND");
    expect(actionsSource).toContain(".eq('role', 'student')");
  });

  it('keeps training class admin reads and writes behind server actions', () => {
    const classesPageSource = readSource('src/app/dashboard/training/classes/page.tsx');
    const classesClientSource = readSource('src/app/dashboard/training/classes/TrainingClassesClient.tsx');
    const actionsSource = readSource('src/services/training-actions.ts');

    expect(classesPageSource).toContain('getTrainingClassAdminOverview');
    expect(classesClientSource).toContain('createTrainingClass');
    expect(classesClientSource).toContain('updateTrainingClass');
    expect(classesPageSource).not.toMatch(/\.from\('(courses|users|training_classes|student_class_attendance)'/);
    expect(classesClientSource).not.toMatch(/\.from\('(courses|users|training_classes|student_class_attendance)'/);
    expect(classesClientSource).not.toContain('createClient');
    expect(actionsSource).toContain("from('training_classes')");
    expect(actionsSource).toContain(".eq('tenant_id', auth.tenantId)");
  });

  it('keeps training student account creation behind server actions', () => {
    const studentsPageSource = readSource('src/app/dashboard/training/students/page.tsx');
    const studentsClientSource = readSource('src/app/dashboard/training/students/TrainingStudentsClient.tsx');
    const actionsSource = readSource('src/services/training-actions.ts');

    expect(studentsPageSource).toContain('getTrainingStudentAccountOverview');
    expect(studentsClientSource).toContain('createTrainingStudentAccount');
    expect(studentsPageSource).not.toMatch(/\.from\('(users|students|courses)'/);
    expect(studentsClientSource).not.toMatch(/\.from\('(users|students|courses)'/);
    expect(studentsClientSource).not.toContain('createClient');
    expect(actionsSource).toContain('role: \'student\'');
    expect(actionsSource).toContain('createUser');
  });

  it('keeps GPS empty-state copy encoded correctly', () => {
    const sessionDetailsSource = readSource('src/app/dashboard/sessions/components/SessionLogsDetailsModal.tsx');

    expect(sessionDetailsSource).toContain('Không có GPS');
    expect(sessionDetailsSource).not.toContain('KhÃ´ng cÃ³ GPS');
  });

  it('keeps Beauty Spa visual theme scoped behind the tenant module marker', () => {
    const sidebarSource = readSource('src/components/layout/sidebar.tsx');
    const themeToggleSource = readSource('src/components/common/ThemeToggle.tsx');
    const dashboardSource = readSource('src/app/dashboard/page.tsx');
    const ktvTableSource = readSource('src/components/features/dashboard/KtvPerformanceTable.tsx');
    const globalStyles = readSource('src/app/globals.css');

    expect(sidebarSource).toContain('isBeautySpaShell && "beauty-erp-sidebar"');
    expect(themeToggleSource).toContain('beauty-theme-toggle');
    expect(themeToggleSource).toContain('beauty-theme-toggle-button-active');
    expect(dashboardSource).toContain('beauty-alert-item');
    expect(dashboardSource).toContain('data-alert-tone={alert.type}');
    expect(ktvTableSource).toContain('beauty-top-ktv-table');
    expect(ktvTableSource).toContain('w-full min-w-[760px]');
    expect(globalStyles).toContain('html:not([data-tenant-brand-preset])[data-tenant-module="beauty_spa"] .beauty-erp-sidebar');
    expect(globalStyles).not.toContain(
      'html[data-tenant-module="pending"] .beauty-erp-nav-item-active:hover',
    );
    expect(globalStyles).toContain(
      'html:not([data-tenant-brand-preset])[data-tenant-module="beauty_spa"] .beauty-erp-nav-item-active:hover',
    );
    expect(globalStyles).toContain('html.dark[data-tenant-module="beauty_spa"]');
    expect(globalStyles).toContain('html.dark[data-tenant-module="pending"]');
    expect(globalStyles).toContain('--beauty-night: #0B1F3A');
    expect(globalStyles).toContain('--beauty-deep: #143A51');
    expect(globalStyles).toContain('--beauty-gold: #C49A68');
    expect(globalStyles).toContain('--beauty-gold-2: #FFD66D');
    expect(globalStyles).toContain(
      'html.dark[data-tenant-module="beauty_spa"] [class*="bg-background"]',
    );
    expect(globalStyles).toContain(
      'html.dark[data-tenant-module="beauty_spa"] .beauty-theme-toggle',
    );
    expect(globalStyles).toContain(
      'html.dark[data-tenant-module="beauty_spa"] button[class*="hover:bg-primary/"]',
    );
    expect(globalStyles).toContain(
      'html.dark[data-tenant-module="beauty_spa"] .beauty-top-ktv-table-wrap',
    );
    expect(globalStyles).toContain(
      'html.dark[data-tenant-module="beauty_spa"] .custom-scrollbar:has(.bella-data-table)',
    );
    expect(globalStyles).toContain(
      'html.dark[data-tenant-module="beauty_spa"] .custom-scrollbar:has(.bella-data-table) .bella-data-table',
    );
    expect(globalStyles).toContain('scrollbar-color: rgba(255, 214, 109, 0.72) rgba(11, 31, 58, 0.76)');
    expect(globalStyles).toContain(
      'html.dark[data-tenant-module="beauty_spa"] .beauty-alert-item',
    );
    expect(globalStyles).toContain('html[data-tenant-brand-radius="soft"]');
    expect(globalStyles).toContain(
      'html[data-tenant-brand-button][data-tenant-module="beauty_spa"]',
    );
    expect(globalStyles).toContain(
      'html[data-tenant-brand-menu="compact"][data-tenant-module="beauty_spa"] .beauty-erp-nav-item',
    );
    expect(globalStyles).not.toMatch(/(^|\n)\s*\.beauty-erp-/);
  });

  it('wires Beauty brand appearance controls into runtime preview and scoped CSS', () => {
    const appearanceSource = readSource('src/app/dashboard/settings/components/AppearanceTab.tsx');
    const globalStyles = readSource('src/app/globals.css');

    expect(appearanceSource).toContain('applyBrandThemePreview');
    expect(appearanceSource).toContain('activeLightModeStyle');
    expect(appearanceSource).toContain('root.dataset.tenantBrandButton = brand.buttonStyle');
    expect(appearanceSource).toContain('root.dataset.tenantBrandMenu = brand.menuStyle');
    expect(appearanceSource).toContain('root.dataset.tenantBrandRadius = brand.radiusStyle');
    expect(appearanceSource).not.toContain('from-pink-500 to-rose-600');
    expect(globalStyles).toContain('--brand-card-radius');
    expect(globalStyles).toContain('--brand-button-radius');
    expect(globalStyles).toContain('--brand-menu-radius');
    expect(globalStyles).toContain('html[data-tenant-brand-button="minimal"][data-tenant-module="beauty_spa"]');
  });

  it('keeps first-run onboarding copy tenant-brand aware', () => {
    const dashboardSource = readSource('src/app/dashboard/page.tsx');
    const onboardingSource = readSource('src/components/features/dashboard/OnboardingTour.tsx');

    expect(dashboardSource).toContain('<OnboardingTour brandName={businessLabel} tenantModuleKey={tenantModuleKey} />');
    expect(onboardingSource).toContain('Bắt đầu cùng {brandName}');
    expect(onboardingSource).not.toContain('Bắt đầu cùng Bella Spa');
    expect(onboardingSource).not.toContain('Bella Spa tự động');
    expect(onboardingSource).not.toContain('BELLA1024');
  });
});
