/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortalPage from '../page';

let mockToken = 'synthetic-token';
jest.mock('react', () => ({ ...jest.requireActual('react'), use: () => ({ token: mockToken }) }));
const originalFetch = globalThis.fetch;
const daily = { scope: 'daily_read_v1', tenantId: '00000000-0000-4000-8000-000000000001', courseId: '00000000-0000-4000-8000-000000000002', studentPartyId: '00000000-0000-4000-8000-000000000003', guardianPartyId: '00000000-0000-4000-8000-000000000004', schoolName: 'Synthetic School', guardianName: 'Synthetic Guardian', childName: 'Synthetic Child', courseTitle: 'Synthetic Class', courseCode: 'SYN', schoolDay: '2026-10-23', attendanceStatus: 'unmarked', attendanceUpdatedAt: null, totalClassSize: 2, presentTodayCount: 1, announcements: [{ id: '00000000-0000-4000-8000-000000000005', title: 'Synthetic school notice', bodyText: 'Read-only common notice', publishedAt: '2026-10-23T01:00:00Z' }], serverTime: '2026-10-23T01:00:00Z' };
const legacy = { tenantId: '00000000-0000-4000-8000-000000000001', schoolName: 'Synthetic School', guardianName: 'Synthetic Guardian', child: { studentPartyId: '00000000-0000-4000-8000-000000000003', studentCode: 'SYN', childName: 'Synthetic Child' }, classroom: { courseId: '00000000-0000-4000-8000-000000000002', courseCode: 'SYN', courseTitle: 'Synthetic Class', totalClassSize: 1, presentTodayCount: 1, attendanceRatePercent: 100 }, todayAttendance: { status: 'present' }, dailyCare: null, handover: { handedOver: false, handedOverAt: null, handedOverBy: null, guardianPartyId: null }, weeklyMenu: null, dailyTimetable: [], tuition: null, chatMessages: [], serverTime: '2026-10-23T01:00:00Z', announcements: daily.announcements };
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data } as Response);
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; mockToken = 'synthetic-token'; });

it('renders real daily fields and the tenant-wide bulletin without chat/Copilot/payment actions', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply({ success: true, data: daily }));
  render(<PortalPage params={Promise.resolve({ token: 'synthetic-token' })} />);
  expect(await screen.findByRole('heading', { name: 'Synthetic Child' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Thông báo chung của nhà trường' })).toBeInTheDocument();
  expect(screen.getByText('Synthetic school notice')).toBeInTheDocument();
  expect(screen.getByText('Chưa điểm danh')).toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent('chưa khả dụng');
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
it('renders the tenant-wide bulletin for a valid legacy Portal link too', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply({ success: true, data: legacy }));
  render(<PortalPage params={Promise.resolve({ token: 'synthetic-token' })} />);
  expect(await screen.findByRole('heading', { name: 'Synthetic Child' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Thông báo chung của nhà trường' })).toBeInTheDocument();
  expect(screen.getByText('Synthetic school notice')).toBeInTheDocument();
});
it('clears daily data when reload is denied instead of retaining a successful child view', async () => {
  globalThis.fetch = jest.fn().mockResolvedValueOnce(reply({ success: true, data: daily })).mockResolvedValueOnce(reply({ success: false }, false));
  render(<PortalPage params={Promise.resolve({ token: 'synthetic-token' })} />);
  await screen.findByRole('heading', { name: 'Synthetic Child' });
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại thông tin' }));
  await screen.findByRole('heading', { name: 'Liên kết không hợp lệ hoặc đã hết hạn' });
  expect(screen.queryByRole('heading', { name: 'Synthetic Child' })).not.toBeInTheDocument();
});
it('rejects malformed scoped payload rather than falling through to legacy UI', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply({ success: true, data: { ...daily, presentTodayCount: 999 } }));
  render(<PortalPage params={Promise.resolve({ token: 'synthetic-token' })} />);
  await screen.findByRole('heading', { name: 'Liên kết không hợp lệ hoặc đã hết hạn' });
  expect(screen.queryByRole('heading', { name: 'Synthetic Child' })).not.toBeInTheDocument();
});

it('reloads child attendance and the bulletin from the current no-store response', async () => {
  let rootReads = 0;
  const updated = { ...daily, attendanceStatus: 'absent', announcements: [
    { ...daily.announcements[0], title: 'Updated school notice' },
  ] };
  const fetchMock = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
    expect(options?.cache).toBe('no-store');
    return Promise.resolve(reply(url.endsWith('/synthetic-token')
      ? { success: true, data: ++rootReads === 1 ? daily : updated }
      : { success: false }, url.endsWith('/synthetic-token')));
  });
  globalThis.fetch = fetchMock;
  render(<PortalPage params={Promise.resolve({ token: mockToken })} />);
  await screen.findByRole('heading', { name: 'Synthetic Child' });
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại thông tin' }));
  await screen.findByText('Updated school notice');
  expect(screen.queryByText('Synthetic school notice')).not.toBeInTheDocument();
  expect(screen.queryByText('Chưa điểm danh')).not.toBeInTheDocument();
  expect(rootReads).toBe(2);
});

it('does not replace the current child or bulletin with a late response for a previous token', async () => {
  let releaseOld: (response: Response) => void = () => { throw new Error('Old request not started'); };
  const oldResponse = new Promise<Response>(resolve => { releaseOld = resolve; });
  const newDaily = { ...daily, childName: 'Current Child', announcements: [] };
  const fetchMock = jest.fn().mockImplementation((url: string) => url.endsWith('/synthetic-token')
    ? oldResponse
    : Promise.resolve(reply(url.endsWith('/current-token')
      ? { success: true, data: newDaily } : { success: false }, url.endsWith('/current-token'))));
  globalThis.fetch = fetchMock;
  const view = render(<PortalPage params={Promise.resolve({ token: mockToken })} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/education/portal/synthetic-token', { cache: 'no-store' }));
  mockToken = 'current-token';
  view.rerender(<PortalPage params={Promise.resolve({ token: mockToken })} />);
  await screen.findByRole('heading', { name: 'Current Child' });
  await act(async () => { releaseOld(reply({ success: true, data: daily })); });
  expect(screen.getByRole('heading', { name: 'Current Child' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Synthetic Child' })).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic school notice')).not.toBeInTheDocument();
});

it('renders handover supplied by the existing legacy payload without inventing pickup authority', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply({ success: true, data: {
    ...legacy, handover: { handedOver: true, handedOverAt: '15:30', handedOverBy: 'Synthetic Pickup', guardianPartyId: daily.guardianPartyId },
  } }));
  render(<PortalPage params={Promise.resolve({ token: mockToken })} />);
  expect(await screen.findByText('Người đón: Synthetic Pickup')).toBeInTheDocument();
  expect(screen.getByText(/Đã đón.*15:30/)).toBeInTheDocument();
});
