/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import PreschoolCommunicationPage from '../page';

let mockSearch = '';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockSearch) }));
const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
const tenantId = '00000000-0000-4000-8000-000000000011';
type DisplayContext = {
  user: { id: string; tenant_id: string } | null;
  product: { productKey: string } | null;
  isLoading: boolean;
  tenantPresentation: { id: string } | null;
  tenantSettings: { id: string } | null;
};
const readyContext = (): DisplayContext => ({ user: { id: 'synthetic-admin', tenant_id: tenantId },
  product: { productKey: 'bella_preschool' }, isLoading: false, tenantPresentation: { id: tenantId }, tenantSettings: null });
let mockContext: DisplayContext = readyContext();
// Synthetic provider snapshot; Auth/RLS is verified separately by the local runtime.
jest.mock('@/lib/user-context', () => ({ useUser: () => mockContext }));

describe('Communication commands and tenant bulletin', () => {
  beforeEach(() => {
    jest.useFakeTimers(); mockSearch = ''; mockContext = readyContext(); mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: 'ANNOUNCEMENT_PUBLISH_UNAVAILABLE' }) });
    globalThis.fetch = mockFetch;
  });
  afterEach(() => { jest.useRealTimers(); globalThis.fetch = originalFetch; });

  async function renderWorkspace() {
    await act(async () => { render(<PreschoolCommunicationPage />); });
  }

  it('labels conversations, metrics and AI suggestions as sample content', async () => {
    await renderWorkspace();
    expect(screen.getByRole('note')).toHaveTextContent(/Dữ liệu minh họa/);
    expect(screen.getByRole('note')).toHaveTextContent(/hội thoại, chỉ số, gợi ý AI/);
    expect(screen.getByRole('note')).toHaveTextContent(/Chưa kết nối gửi tin/);
  });

  it('retains a return control when opening the bulletin from a local tab', async () => {
    await renderWorkspace();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Thông báo/ })); });
    const back = screen.getByRole('button', { name: 'Quay lại tổng quan truyền thông' });
    expect(screen.queryByText(/Dữ liệu minh họa:/)).not.toBeInTheDocument();
    fireEvent.click(back);
    expect(screen.getByText(/Dữ liệu minh họa:/)).toBeInTheDocument();
  });

  it.each(['click', 'Enter'])('retains reply without adding a sent message after %s', async (trigger) => {
    await renderWorkspace();
    const input = screen.getByPlaceholderText('Nhập tin nhắn phản hồi...');
    fireEvent.change(input, { target: { value: 'Synthetic unsent reply' } });
    if (trigger === 'Enter') fireEvent.keyDown(input, { key: 'Enter' });
    else fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
    act(() => jest.advanceTimersByTime(6000));

    expect(input).toHaveValue('Synthetic unsent reply');
    expect(screen.getByRole('status')).toHaveTextContent(/Chưa gửi phản hồi/);
    expect(screen.getByRole('status')).not.toHaveTextContent(/thành công/);
    expect(screen.queryByText('Synthetic unsent reply')).not.toBeInTheDocument();
  });

  it('loads the tenant-wide feed without invented recipients, classes or read counts', async () => {
    mockSearch = 'tab=announcements';
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { tenantId: '00000000-0000-4000-8000-000000000011', announcements: [
      { id: '00000000-0000-4000-8000-000000000022', title: 'Real bulletin', bodyText: 'Canonical feed content', publishedAt: '2026-10-23T01:00:00Z' },
    ] } }) });
    await renderWorkspace();
    expect(await screen.findByText('Real bulletin')).toBeInTheDocument();
    expect(screen.getByText(/phụ huynh có con đang ghi danh/i)).toBeInTheDocument();
    expect(screen.queryByText(/Đã đọc|phụ huynh \(\d+%\)|edu_comm_notices/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Khối Mầm|Khối Chồi|Khối Lá/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bảng tin chung', exact: true })).toBeInTheDocument();
    expect(screen.queryByText('96.8%')).not.toBeInTheDocument();
    expect(screen.queryByText('268 / 280 phụ huynh')).not.toBeInTheDocument();
    expect(screen.queryByText('4.9 / 5.0')).not.toBeInTheDocument();
    expect(screen.queryByText(/Dữ liệu minh họa/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tin nhắn' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Chọn tháng làm việc')).not.toBeInTheDocument();
  });

  it('keeps the shared bulletin free of sample Student context even with a legacy Student query', async () => {
    mockSearch = 'tab=announcements&student=STU-001';
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { tenantId, announcements: [] } }) });
    await renderWorkspace();
    expect(screen.getByRole('heading', { name: 'Thông báo chung của nhà trường', exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/Nguyễn Minh An/)).not.toBeInTheDocument();
    expect(screen.queryByText('96.8%')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nhập tin nhắn phản hồi' })).not.toBeInTheDocument();
  });

  it.each(['loading', 'missing-user', 'missing-product', 'foreign-tenant', 'other-product'])('does not load the Preschool feed for %s context', async mode => {
    mockSearch = 'tab=announcements';
    if (mode === 'loading') mockContext.isLoading = true;
    if (mode === 'missing-user') mockContext.user = null;
    if (mode === 'missing-product') mockContext.product = null;
    if (mode === 'foreign-tenant') mockContext.tenantPresentation = { id: 'another-tenant' };
    if (mode === 'other-product') mockContext.product = { productKey: 'bella_english_center' };
    await renderWorkspace();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Đăng thông báo chung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Mẹ bé Minh An')).not.toBeInTheDocument();
  });

  it('rejects an otherwise valid feed belonging to another tenant', async () => {
    mockSearch = 'tab=announcements';
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: {
      tenantId: '00000000-0000-4000-8000-000000000099', announcements: [{
        id: '00000000-0000-4000-8000-000000000022', title: 'Other tenant bulletin', bodyText: 'Must stay hidden', publishedAt: '2026-10-23T01:00:00Z',
      }],
    } }) });
    await renderWorkspace();
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được thông báo chung');
    expect(screen.queryByText('Other tenant bulletin')).not.toBeInTheDocument();
  });

  it('clears previous tenant feed and drafts when the verified identity changes', async () => {
    mockSearch = 'tab=announcements';
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: {
      tenantId, announcements: [{ id: '00000000-0000-4000-8000-000000000022', title: 'Previous tenant bulletin', bodyText: 'Old content', publishedAt: '2026-10-23T01:00:00Z' }],
    } }) });
    const view = render(<PreschoolCommunicationPage />);
    expect(await screen.findByText('Previous tenant bulletin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Soạn thông báo chung' }));
    fireEvent.change(screen.getByLabelText('Tiêu đề thông báo'), { target: { value: 'Previous tenant draft' } });
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    mockContext = { ...readyContext(), user: { id: 'another-admin', tenant_id: '00000000-0000-4000-8000-000000000099' },
      tenantPresentation: { id: '00000000-0000-4000-8000-000000000099' } };
    view.rerender(<PreschoolCommunicationPage />);
    expect(screen.queryByText('Previous tenant bulletin')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Previous tenant draft')).not.toBeInTheDocument();
  });

  it('keeps one request id across a failed retry and confirms publication after Portal feed readback', async () => {
    await renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng thông báo chung' }));
    const modal = screen.getByRole('dialog', { name: 'Soạn thông báo chung của nhà trường' });
    const form = within(modal);
    fireEvent.change(form.getByLabelText('Tiêu đề thông báo'), { target: { value: 'Synthetic title' } });
    fireEvent.change(form.getByLabelText('Nội dung chi tiết'), { target: { value: 'Synthetic broadcast body' } });
    const publish = form.getByRole('button', { name: 'Đăng thông báo chung' });
    await act(async () => { fireEvent.click(publish); });
    expect(modal).toBeVisible();
    expect(form.getByRole('status')).toHaveTextContent(/mã yêu cầu được giữ/);
    const firstRequest = JSON.parse(String(mockFetch.mock.calls[0][1]?.body)) as { requestId: string };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { id: firstRequest.requestId, title: 'Synthetic title', bodyText: 'Synthetic broadcast body', publishedAt: '2026-10-23T01:00:00Z', duplicate: true } }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { tenantId: '00000000-0000-4000-8000-000000000011', announcements: [
      { id: firstRequest.requestId, title: 'Synthetic title', bodyText: 'Synthetic broadcast body', publishedAt: '2026-10-23T01:00:00Z' },
    ] } }) });
    await act(async () => { fireEvent.click(publish); });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const secondRequest = JSON.parse(String(mockFetch.mock.calls[1][1]?.body)) as { requestId: string; title: string; bodyText: string };
    expect(secondRequest).toEqual({ requestId: firstRequest.requestId, title: 'Synthetic title', bodyText: 'Synthetic broadcast body' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Đã đăng thông báo chung/);
  });

  it.each(['Đóng thông báo', 'Hủy bỏ'])('does not keep a draft-retention notice after %s', async (closeAction) => {
    await renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng thông báo chung' }));
    const form = within(screen.getByRole('dialog'));
    fireEvent.change(form.getByLabelText('Tiêu đề thông báo'), { target: { value: 'Synthetic draft title' } });
    fireEvent.change(form.getByLabelText('Nội dung chi tiết'), { target: { value: 'Synthetic content before explicit close' } });
    await act(async () => { fireEvent.click(form.getByRole('button', { name: 'Đăng thông báo chung' })); });
    expect(form.getByRole('status')).toHaveTextContent(/mã yêu cầu được giữ/);
    fireEvent.click(form.getByRole('button', { name: closeAction }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng thông báo chung' }));
    expect(screen.getByLabelText('Nội dung chi tiết')).toHaveValue('');
    expect(within(screen.getByRole('dialog')).queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    { parent: 'Mẹ bé Minh An', action: /Tạo lưu ý chăm sóc/, notice: /Chưa tạo lưu ý chăm sóc/ },
    { parent: 'Bố bé Bảo Ngọc', action: /Xác nhận đón sớm/, notice: /Chưa xác nhận đón sớm/ },
    { parent: 'Mẹ bé Hoàng Nam', action: /Gửi thông tin biểu phí/, notice: /Chưa thực hiện hành động/ },
  ])('does not claim care, pickup or tuition persistence for $parent', async ({ parent, action, notice }) => {
    await renderWorkspace();
    fireEvent.click(screen.getAllByText(parent)[0]);
    const input = screen.getByPlaceholderText('Nhập tin nhắn phản hồi...');
    fireEvent.change(input, { target: { value: 'Synthetic draft stays here' } });
    fireEvent.click(screen.getByRole('button', { name: action }));
    act(() => jest.advanceTimersByTime(6000));
    expect(input).toHaveValue('Synthetic draft stays here');
    expect(screen.getByRole('status')).toHaveTextContent(notice);
    expect(screen.getByRole('status')).not.toHaveTextContent(/Đã tạo|Đã xác nhận|Đã áp dụng|thành công/);
  });
  it.each(['', 'student=00000000-0000-0000-0000-000000000011', 'student=11111111-1111-4111-8111-111111111111', 'student=CONV-001'])('does not mint or display a Portal link from sample/query identity: %s', async query => {
    mockSearch = query;
    await renderWorkspace();
    const issue = screen.getByRole('button', { name: 'Tạo link Portal Phụ huynh' });
    expect(issue).toBeDisabled();
    expect(issue).toHaveAccessibleDescription(/chưa xác minh học sinh và người giám hộ từ hồ sơ thật/);
    fireEvent.click(issue);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Liên kết Portal Phụ huynh')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mở xem thử' })).not.toBeInTheDocument();
  });

  it('does not offer a medication administration promise in the initial suggested replies', async () => {
    await renderWorkspace();
    expect(screen.queryByText(/lịch uống thuốc|cho bé uống đúng giờ/i)).not.toBeInTheDocument();
  });

  it('does not reintroduce medication administration after a care-note classification', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {
      label: 'Lưu ý chăm sóc', confidence: 0.9, tags: [], primaryActionLabel: 'Tạo lưu ý chăm sóc', primaryActionType: 'care_note',
    } }) });
    await renderWorkspace();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Làm mới AI' })));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/education/ai/copilot', expect.any(Object));
    expect(screen.queryByText(/lịch uống thuốc|cho bé uống đúng giờ/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo link Portal Phụ huynh' })).toBeDisabled();
  });

});
