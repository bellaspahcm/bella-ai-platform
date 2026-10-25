/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import Wrapper from '@/components/providers/TenantContextWrapper';
import { UserProvider, useUser } from '@/lib/user-context';

let mockPathname = '/dashboard/education/courses';
const mockCachedUser = jest.fn();
const mockCachedSettings = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('@/core/providers/TenantContextProvider', () => ({ TenantContextProvider: ({ children }: { children: React.ReactNode }) => <section data-testid="full-context">{children}</section> }));
jest.mock('@/lib/dashboard-client-context', () => ({ getCachedCurrentUser: () => mockCachedUser(), getCachedTenantSettings: () => mockCachedSettings() }));
const user = { id: 'user', tenant_id: 'tenant', email: 'synthetic@example.invalid', role: 'admin' };
const tenant = { id: 'tenant', name: 'Synthetic tenant', status: 'active', product_key: 'bella_preschool',
  enabled_modules: { bella_education: true }, brand_theme: {}, logo_url: null };
function Inspect() { const state = useUser(); return <div>{state.isLoading ? 'pending' : state.product?.productKey ?? 'denied'}<span>{state.tenantSettings ? 'full-settings' : 'no-full-settings'}</span></div>; }

describe('catalog bootstrap dependency boundary', () => {
  beforeEach(() => { jest.clearAllMocks(); mockCachedUser.mockResolvedValue(user); mockCachedSettings.mockResolvedValue(null); });
  afterEach(cleanup);

  it.each(['/dashboard/education/grades', '/dashboard/education/finance', '/dashboard/education/facilities', '/dashboard/education/teachers', '/dashboard/education/teachers/profile-id', '/dashboard/education', '/dashboard/education/reports', '/dashboard/education/courses', '/dashboard/education/courses/course-id', '/dashboard/education/attendance', '/dashboard/education/care', '/dashboard/education/enrollments', '/dashboard/education/communication', '/dashboard/education/enrollments/11111111-1111-4111-8111-111111111111'])('does not request unused operational tenant context: %s', pathname => {
    mockPathname = pathname;
    render(<Wrapper><div>Catalog</div></Wrapper>);
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.queryByTestId('full-context')).not.toBeInTheDocument();
  });
  it.each(['/dashboard/education/grades/history', '/dashboard/education/finance/history', '/dashboard/education/facilities/history', '/dashboard/education/teachers/profile/history', '/dashboard/education/teachers/', '/dashboard/education/reports/history', '/dashboard/education/reports/', '/dashboard/education/care/history', '/dashboard/education/courses/course-id/teachers', '/dashboard/education/communication/history', '/dashboard/education/communication/', '/dashboard/education/enrollments/student-id', '/dashboard/education/enrollments/', '/dashboard/education/enrollments/11111111-1111-4111-8111-111111111111/history', '/dashboard/education/enrollments/11111111-1111-4111-8111-111111111111/', '/dashboard/education/enrollments/11111111-1111-4111-8111-111111111111x'])('retains the operational context dependency: %s', pathname => {
    mockPathname = pathname;
    render(<Wrapper><div>Operational</div></Wrapper>);
    expect(screen.getByTestId('full-context')).toBeInTheDocument();
  });
  it('uses fresh authenticated presentation without pretending it is full settings', async () => {
    render(<UserProvider presentationContext={{ user, tenant }}><Inspect /></UserProvider>);
    await waitFor(() => expect(screen.getByText('bella_preschool')).toBeInTheDocument());
    expect(screen.getByText('no-full-settings')).toBeInTheDocument();
    expect(mockCachedUser).not.toHaveBeenCalled();
    expect(mockCachedSettings).not.toHaveBeenCalled();
  });
  it('does not resolve a foreign tenant presentation', async () => {
    render(<UserProvider presentationContext={{ user, tenant: { ...tenant, id: 'foreign' } }}><Inspect /></UserProvider>);
    await waitFor(() => expect(screen.getByText('denied')).toBeInTheDocument());
  });
});
