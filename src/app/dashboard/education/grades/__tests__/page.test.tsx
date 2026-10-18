/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import GradesPage from '../page';

jest.mock('@/lib/dashboard-client-context', () => ({ getCachedTenantSettings: async () => null }));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

async function mountPage() {
  await act(async () => { render(<GradesPage />); });
}

function enterDraft() {
  fireEvent.click(screen.getByRole('button', { name: 'Nhập quan sát mới' }));
  fireEvent.change(screen.getByLabelText('Chọn trẻ'), { target: { value: 'STU-002' } });
  fireEvent.change(screen.getByLabelText('Lĩnh vực NAEYC'), { target: { value: 'Nhận Thức & Tư Duy' } });
  fireEvent.change(screen.getByLabelText('Mức độ tiến trình'), { target: { value: 'Đang phát triển' } });
  fireEvent.change(screen.getByLabelText('Kỹ năng quan sát cụ thể'), { target: { value: 'Synthetic skill' } });
  fireEvent.change(screen.getByLabelText('Ghi chép hành vi khách quan'), { target: { value: 'Synthetic note' } });
  fireEvent.change(screen.getByLabelText('Số lượng ảnh / video bằng chứng đính kèm'), { target: { value: '4' } });
}

function expectDraft() {
  expect(screen.getByLabelText('Chọn trẻ')).toHaveValue('STU-002');
  expect(screen.getByLabelText('Lĩnh vực NAEYC')).toHaveValue('Nhận Thức & Tư Duy');
  expect(screen.getByLabelText('Mức độ tiến trình')).toHaveValue('Đang phát triển');
  expect(screen.getByLabelText('Kỹ năng quan sát cụ thể')).toHaveValue('Synthetic skill');
  expect(screen.getByLabelText('Ghi chép hành vi khách quan')).toHaveValue('Synthetic note');
  expect(screen.getByLabelText('Số lượng ảnh / video bằng chứng đính kèm')).toHaveValue(4);
}

describe('Grades trial truthful unavailable actions', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('marks roster, metrics, progress and history as sample content', async () => {
    await mountPage();
    expect(screen.getByRole('note')).toHaveTextContent(/Dữ liệu minh họa/);
    expect(screen.getByRole('note')).toHaveTextContent(/danh sách trẻ, chỉ số, tiến độ và lịch sử/);
    expect(screen.getByRole('note')).toHaveTextContent(/chưa được tải từ hồ sơ thật/);
  });

  it('does not close the form or claim success when unavailable save is requested', async () => {
    await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Nhập quan sát mới' }));
    fireEvent.change(screen.getByPlaceholderText(/Ví dụ: Tự cởi/), { target: { value: 'Synthetic skill' } });
    fireEvent.change(screen.getByPlaceholderText(/Ghi lại hành vi/), { target: { value: 'Synthetic note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu quan sát' }));
    act(() => jest.advanceTimersByTime(6000));
    expect(screen.getByRole('heading', { name: 'Nhập quan sát sư phạm mới' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(/Chưa lưu quan sát/);
    expect(screen.getByRole('status')).not.toHaveTextContent(/thành công/);
    expect(screen.getByPlaceholderText(/Ví dụ: Tự cởi/)).toHaveValue('Synthetic skill');
    expect(screen.getByPlaceholderText(/Ghi lại hành vi/)).toHaveValue('Synthetic note');
  });

  it('retains all six draft fields after repeated save and elapsed toast time', async () => {
    await mountPage();
    enterDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu quan sát' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu quan sát' }));
    act(() => jest.advanceTimersByTime(6000));
    const dialog = screen.getByRole('dialog', { name: 'Nhập quan sát sư phạm mới' });
    expect(within(dialog).getByRole('status')).toHaveTextContent(/Chưa lưu quan sát/);
    expect(dialog).toHaveAccessibleDescription(/tải lại hoặc rời trang sẽ mất bản nháp/);
    expectDraft();
  });

  it.each(['Đóng nhập quan sát', 'Đóng và giữ bản nháp'])('retains draft on explicit close with %s then reopen', async (buttonName) => {
    await mountPage();
    enterDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu quan sát' }));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nhập quan sát mới' }));
    expectDraft();
    expect(screen.getByRole('status')).toHaveTextContent(/Chưa lưu quan sát/);
  });

  it('keeps export unavailable feedback without a fake file or progress/success claim', async () => {
    await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Xuất báo cáo' }));
    act(() => jest.advanceTimersByTime(6000));
    expect(screen.getByRole('status')).toHaveTextContent(/Chưa xuất báo cáo/);
    expect(screen.getByRole('status')).toHaveTextContent(/Không có file được tạo/);
    expect(screen.getByRole('status')).not.toHaveTextContent(/Đang xuất|thành công/);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('identifies AI recommendations as sample content and makes no analysis claim', async () => {
    await mountPage();
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý AI sư phạm minh họa/ }));
    const dialog = screen.getByRole('dialog', { name: 'Gợi ý AI sư phạm minh họa' });
    expect(dialog).toHaveTextContent(/Chưa có phân tích AI/);
    expect(dialog).not.toHaveTextContent(/AI đã phân tích 42/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng gợi ý minh họa' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('labels the opened child portfolio and its evidence as illustrative', async () => {
    await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Xem hồ sơ minh họa Nguyễn Minh An' }));
    const dialog = screen.getByRole('dialog', { name: 'Hồ sơ trẻ minh họa' });
    expect(dialog).toHaveTextContent(/thông tin thể chất, nhận xét, bằng chứng và gợi ý bên dưới là nội dung mẫu/);
    expect(dialog).toHaveTextContent(/chưa phân tích hồ sơ thật/);
  });
});
