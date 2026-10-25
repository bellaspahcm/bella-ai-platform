/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Facilities from '../facilities/page';
import Teachers from '../teachers/page';
import TeacherProfile from '../teachers/[id]/page';
import Grades from '../grades/page';
import Finance from '../finance/page';

// Importing an old browser DB/mutation dependency fails this boundary test.
jest.mock('@/lib/user-context', () => ({ useUser: () => ({ user: { id: 'synthetic-admin', tenant_id: 'synthetic-tenant' }, product: { productKey: 'bella_preschool' }, isLoading: false }) }));
jest.mock('@/lib/dashboard-client-context', () => ({ getCachedTenantSettings: () => { throw new Error('HELD_WORKSPACE_MUST_NOT_LOAD_SETTINGS'); } }));
jest.mock('@supabase/supabase-js', () => { throw new Error('HELD_WORKSPACE_MUST_NOT_LOAD_DB'); });
jest.mock('@/lib/supabase-client', () => { throw new Error('HELD_WORKSPACE_MUST_NOT_LOAD_CALLER_DB'); });
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href}>{children}</a> }));

it.each([
  ['Grades', Grades, 'Học tập & Hoạt động'],
  ['Finance', Finance, 'Tài chính'],
  ['Facilities', Facilities, 'Cơ sở vật chất'],
  ['Teachers', Teachers, 'Quản lý giáo viên'],
  ['Teacher direct profile', TeacherProfile, 'Quản lý giáo viên'],
] as const)('%s shows the held state with no data or mutation capability', (_name, Page, heading) => {
  const fetchMock = jest.fn();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  render(<Page />);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Chưa mở trong MVP Preschool');
  expect(screen.getByRole('link', { name: 'Về danh sách lớp' })).toHaveAttribute('href', '/dashboard/education/courses');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
