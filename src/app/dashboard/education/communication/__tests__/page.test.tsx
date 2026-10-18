/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import PreschoolCommunicationPage from '../page';

// Synthetic presentation context only; this does not verify tenant authority.
jest.mock('@/lib/dashboard-client-context', () => ({
  getCachedTenantSettings: jest.fn().mockResolvedValue(null),
}));

describe('Communication unavailable commands', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function renderWorkspace() {
    await act(async () => { render(<PreschoolCommunicationPage />); });
  }

  it('labels conversations, metrics and AI suggestions as sample content', async () => {
    await renderWorkspace();
    expect(screen.getByRole('note')).toHaveTextContent(/Dữ liệu minh họa/);
    expect(screen.getByRole('note')).toHaveTextContent(/hội thoại, chỉ số, gợi ý AI/);
    expect(screen.getByRole('note')).toHaveTextContent(/Chưa kết nối gửi tin/);
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

  it('retains broadcast modal, content and chosen scope after unavailable publish', async () => {
    await renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông báo' }));
    const modal = screen.getByRole('dialog', { name: 'Soạn thông báo điều hành mới' });
    const form = within(modal);
    fireEvent.change(form.getByLabelText('Tiêu đề thông báo'), { target: { value: 'Synthetic title' } });
    fireEvent.change(form.getByLabelText('Nội dung chi tiết'), { target: { value: 'Synthetic broadcast body' } });
    fireEvent.change(form.getAllByRole('combobox')[0], { target: { value: 'Khối Mầm (Mầm A1, Mầm A2)' } });
    fireEvent.change(form.getAllByRole('combobox')[1], { target: { value: 'Hoạt động dã ngoại' } });
    fireEvent.click(form.getByRole('button', { name: 'Phát hành thông báo' }));
    act(() => jest.advanceTimersByTime(6000));

    expect(modal).toBeVisible();
    expect(form.getByLabelText('Tiêu đề thông báo')).toHaveValue('Synthetic title');
    expect(form.getByLabelText('Nội dung chi tiết')).toHaveValue('Synthetic broadcast body');
    expect(form.getAllByRole('combobox')[0]).toHaveValue('Khối Mầm (Mầm A1, Mầm A2)');
    expect(form.getAllByRole('combobox')[1]).toHaveValue('Hoạt động dã ngoại');
    expect(form.getByRole('status')).toHaveTextContent(/Chưa phát hành thông báo/);
    expect(form.getByRole('status')).not.toHaveTextContent(/thành công|280/);
  });

  it.each(['Đóng thông báo', 'Hủy bỏ'])('does not keep a draft-retention notice after %s', async (closeAction) => {
    await renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông báo' }));
    const form = within(screen.getByRole('dialog'));
    fireEvent.change(form.getByLabelText('Nội dung chi tiết'), { target: { value: 'Synthetic content before explicit close' } });
    fireEvent.click(form.getByRole('button', { name: 'Phát hành thông báo' }));
    expect(form.getByRole('status')).toHaveTextContent(/Nội dung vẫn được giữ/);
    fireEvent.click(form.getByRole('button', { name: closeAction }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông báo' }));
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
});
