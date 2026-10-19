/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { QueueItem, QueuePage, QueueView } from '@/products/bella-education/work-queue/work-queue.types';
import Page from '../page';

let selectedView = 'absences';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(`view=${selectedView}`) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
// Use semantic native buttons in JSDOM; shared Button styling is separately maintained.
jest.mock('@/components/ui/button', () => ({ Button: ({ children, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => <button {...props}>{children}</button> }));

type Reply = Pick<Response, 'ok' | 'json'>;
const response = (payload: unknown, ok = true): Reply => ({ ok, json: async () => payload });
const fetchMock = jest.fn<Promise<Reply>, [RequestInfo | URL, RequestInit?]>();
const item = (view: QueueView = 'absences', overrides: Partial<QueueItem> = {}): QueueItem => ({ id: 'synthetic-request', view,
  type: view === 'absences' ? 'ABSENCE_REQUEST' : view === 'health' ? 'Synthetic incident' : 'CHANGE_PICKUP_PERSON',
  studentId: 'synthetic-student', studentName: 'Synthetic Child', studentCode: 'SYN-1', guardianName: 'Synthetic Guardian',
  status: 'OPEN', severity: 'LOW', createdAt: '2026-10-19T01:00:00Z', updatedAt: '2026-10-19T01:00:00+00:00', description: 'Original synthetic details', actionTaken: null,
  contextNotes: null, review: null, resolvedBy: null, resolvedAt: null, escalationRequired: false, acknowledgedAt: null, parentNotifiedAt: null, financeOnly: false, ...overrides });
const state = (items: QueueItem[] = [item()], overrides: Partial<QueuePage> = {}) => ({ success: true, items, total: items.length, page: 1, pages: 1, pageSize: 20, ...overrides });
const savedItem = (outcome: 'APPROVED' | 'DECLINED' | 'HANDLED' | 'CLOSED' = 'APPROVED') => item(outcome === 'CLOSED' ? 'health' : outcome === 'HANDLED' ? 'parents' : 'absences', {
  status: outcome === 'CLOSED' ? 'CLOSED' : 'RESOLVED', resolvedBy: 'synthetic-admin', resolvedAt: '2026-10-19T03:00:00+00:00',
  review: { format: 'preschool-work-queue-review', version: 1, outcome, originalNotes: 'Original synthetic details', note: 'Reviewed note', reviewedBy: 'synthetic-admin', reviewedAt: '2026-10-19T03:00:00Z' },
});
beforeEach(() => {
  selectedView = 'absences'; fetchMock.mockReset();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
});

it.each(['absences', 'health', 'parents'] as const)('opens exact %s deep-linked records and their original details', async view => {
  selectedView = view;
  fetchMock.mockResolvedValue(response(state([item(view)])));
  render(<Page />);
  expect(await screen.findByRole('heading', { name: 'Synthetic Child · SYN-1' })).toBeInTheDocument();
  expect(screen.getByText('Original synthetic details')).toBeInTheDocument();
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/education/work-queue?view=${view}&status=open&page=1`);
  expect(screen.getByRole('link', { name: view === 'absences' ? 'Duyệt nghỉ học' : view === 'health' ? 'Sự cố sức khỏe' : 'Yêu cầu phụ huynh' })).toHaveAttribute('aria-current', 'page');
  if (view === 'absences') expect(screen.getByText(/không thay đổi điểm danh/)).toBeInTheDocument();
  if (view === 'parents') expect(screen.getByText(/không tự thực hiện cấp thuốc/)).toBeInTheDocument();
});
it('shows loading and genuine empty without fixture rows or actions', async () => {
  let complete: ((value: Reply) => void) | undefined;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  render(<Page />);
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải hồ sơ');
  expect(screen.queryByRole('button', { name: 'Xem và duyệt đơn' })).not.toBeInTheDocument();
  await act(async () => { complete?.(response(state([]))); });
  expect(screen.getByText('Không có hồ sơ trong nhóm và trạng thái này.')).toBeInTheDocument();
});
it('distinguishes load failure, allows retry, and shows unknown identity explicitly', async () => {
  fetchMock.mockResolvedValueOnce(response({ success: false, error: 'Synthetic read failure' }, false));
  fetchMock.mockResolvedValueOnce(response(state([item('absences', { studentName: null, studentCode: null, guardianName: null })])));
  render(<Page />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic read failure');
  expect(screen.queryByText('Không có hồ sơ trong nhóm và trạng thái này.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
  expect(await screen.findByRole('heading', { name: 'Chưa đối chiếu được tên trẻ' })).toBeInTheDocument();
  expect(screen.getByText('Chưa đối chiếu được danh tính')).toBeInTheDocument();
});
it('retains note on failed persistence and retries with the same exact decision-only payload', async () => {
  fetchMock.mockResolvedValueOnce(response(state()));
  fetchMock.mockResolvedValueOnce(response({ success: false, error: 'Synthetic stale record' }, false));
  fetchMock.mockResolvedValueOnce(response(state()));
  fetchMock.mockResolvedValueOnce(response({ success: true, item: savedItem() }));
  fetchMock.mockResolvedValueOnce(response(state([])));
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem và duyệt đơn' }));
  fireEvent.change(screen.getByRole('textbox', { name: /Ghi chú xử lý/ }), { target: { value: 'Reviewed note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt nghỉ học' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic stale record');
  expect(screen.getByRole('textbox')).toHaveValue('Reviewed note');
  expect(screen.queryByText(/Đã lưu kết quả/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Duyệt nghỉ học' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('tải lại hồ sơ để kiểm tra kết quả');
  expect(screen.getByRole('alert')).not.toHaveTextContent('chưa lưu');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Duyệt nghỉ học' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt nghỉ học' }));
  expect(await screen.findByText(/Đã lưu kết quả xử lý/)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(posts.map(([, init]) => JSON.parse(String(init?.body)))).toEqual(Array(2).fill({ view: 'absences', id: 'synthetic-request', action: 'approve', note: 'Reviewed note', expectedUpdatedAt: '2026-10-19T01:00:00+00:00' }));
  expect(fetchMock).toHaveBeenCalledTimes(5);
});
it('reads the declined outcome from persisted history after a reload, preserving original request', async () => {
  fetchMock.mockResolvedValueOnce(response(state([])));
  fetchMock.mockResolvedValueOnce(response(state([savedItem('DECLINED')])));
  render(<Page />);
  await screen.findByText('Không có hồ sơ trong nhóm và trạng thái này.');
  fireEvent.change(screen.getByLabelText('Trạng thái xử lý'), { target: { value: 'history' } });
  expect(await screen.findByText('Original synthetic details')).toBeInTheDocument();
  expect(screen.getAllByText('Đã từ chối nghỉ học')).toHaveLength(2);
  expect(screen.getByText('Reviewed note')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Xem và duyệt đơn' })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls[1][0]).toBe('/api/education/work-queue?view=absences&status=history&page=1');
});
it('does not report success for a failed readback or erase drafts', async () => {
  fetchMock.mockResolvedValueOnce(response(state()));
  fetchMock.mockResolvedValueOnce(response({ success: true, item: item() }));
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem và duyệt đơn' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Từ chối đơn' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa xác minh');
  expect(screen.getByRole('textbox')).toHaveValue('Keep draft');
});
it('handles a lost POST response as uncertain, gates retries, and lets refreshed history establish the result', async () => {
  fetchMock.mockResolvedValueOnce(response(state()));
  fetchMock.mockRejectedValueOnce(new Error('Synthetic connection lost after request'));
  fetchMock.mockResolvedValueOnce(response(state([])));
  fetchMock.mockResolvedValueOnce(response(state([savedItem()])));
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem và duyệt đơn' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Reviewed note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt nghỉ học' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('tải lại hồ sơ để kiểm tra kết quả');
  expect(screen.getByRole('alert')).not.toHaveTextContent('chưa lưu');
  expect(screen.getByRole('textbox')).toHaveValue('Reviewed note');
  expect(screen.getByRole('button', { name: 'Duyệt nghỉ học' })).toBeDisabled();
  expect(screen.queryByText(/Đã lưu kết quả xử lý/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByText('Không có hồ sơ trong nhóm và trạng thái này.');
  fireEvent.change(screen.getByLabelText('Trạng thái xử lý'), { target: { value: 'history' } });
  expect(await screen.findByText('Reviewed note')).toBeInTheDocument();
  expect(screen.getAllByText('Đã duyệt nghỉ học')).toHaveLength(2);
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});
it('requires a note and prevents repeated actions while saving', async () => {
  let complete: ((value: Reply) => void) | undefined;
  fetchMock.mockResolvedValueOnce(response(state()));
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  fetchMock.mockResolvedValueOnce(response(state([])));
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem và duyệt đơn' }));
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt nghỉ học' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Reviewed note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Từ chối đơn' }));
  expect(screen.getByRole('button', { name: 'Từ chối đơn' })).toBeDisabled();
  expect(screen.getByLabelText('Trạng thái xử lý')).toBeDisabled();
  expect(screen.getByRole('textbox')).toBeDisabled();
  await act(async () => { complete?.(response({ success: true, item: savedItem('DECLINED') })); });
  expect(await screen.findByText(/Đã lưu kết quả xử lý/)).toBeInTheDocument();
});
it('blocks health close without recorded guardian acknowledgement and exposes details', async () => {
  selectedView = 'health';
  fetchMock.mockResolvedValue(response(state([item('health', { escalationRequired: true, actionTaken: 'Synthetic care' })])));
  render(<Page />);
  expect(await screen.findByText(/Cần xác nhận phụ huynh/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ghi nhận xử lý' })).toBeDisabled();
  expect(screen.getByText('Đã thực hiện: Synthetic care')).toBeInTheDocument();
});
it('keeps finance parent exceptions navigable to debt tab without a queue resolve action', async () => {
  selectedView = 'parents';
  fetchMock.mockResolvedValue(response(state([item('parents', { financeOnly: true })])));
  render(<Page />);
  expect(await screen.findByRole('link', { name: 'Xử lý tại Tài chính → Công nợ' })).toHaveAttribute('href', '/dashboard/education/finance?tab=debts');
  expect(screen.queryByRole('button', { name: 'Ghi nhận xử lý' })).not.toBeInTheDocument();
});
it('uses server pagination and does not imply the first page is the complete list', async () => {
  fetchMock.mockResolvedValueOnce(response(state([item()], { total: 21, pages: 2 })));
  fetchMock.mockResolvedValueOnce(response(state([item()], { total: 21, pages: 2, page: 2 })));
  render(<Page />);
  expect(await screen.findByText('21 hồ sơ · Trang 1/2')).toBeInTheDocument();
  expect(screen.getByText('Hiển thị 1/21 hồ sơ phù hợp')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(await screen.findByText('21 hồ sơ · Trang 2/2')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  expect(fetchMock.mock.calls[1][0]).toBe('/api/education/work-queue?view=absences&status=open&page=2');
});
it('ignores a late response from the previous group', async () => {
  let complete: ((value: Reply) => void) | undefined;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  fetchMock.mockResolvedValueOnce(response(state([item('health', { studentName: 'Synthetic Health Child' })])));
  const rendered = render(<Page />);
  selectedView = 'health'; rendered.rerender(<Page />);
  expect(await screen.findByRole('heading', { name: 'Synthetic Health Child · SYN-1' })).toBeInTheDocument();
  await act(async () => { complete?.(response(state([item()]))); });
  expect(screen.queryByRole('heading', { name: 'Synthetic Child · SYN-1' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('navigation', { name: 'Nhóm cần xử lý' })).getByRole('link', { name: 'Sự cố sức khỏe' })).toHaveAttribute('aria-current', 'page');
});
