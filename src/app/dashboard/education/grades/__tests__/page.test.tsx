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

  it('renders exact canonical truth KPI metrics and class progress', async () => {
    await mountPage();

    // 4 KPI Cards
    expect(screen.getAllByText('46').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tổng số trẻ')).toBeInTheDocument();
    expect(screen.getByText('(2 lớp)')).toBeInTheDocument();

    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('Đã đánh giá')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();

    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Chưa đánh giá')).toBeInTheDocument();
    expect(screen.getByText('17%')).toBeInTheDocument();

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Ghi nhận mới')).toBeInTheDocument();

    // Class Progress
    expect(screen.getAllByText('Lớp Mầm A1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('18 / 24 trẻ')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();

    expect(screen.getAllByText('Lớp Chồi B1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('20 / 22 trẻ')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('switches between all 5 tabs and renders dedicated workspace views', async () => {
    await mountPage();

    // Tab 2: Nhật ký & Bằng chứng
    fireEvent.click(screen.getByRole('button', { name: 'Nhật ký & Bằng chứng' }));
    expect(screen.getByText('Nhật Ký Quan Sát & Bằng Chứng Sư Phạm')).toBeInTheDocument();
    expect(screen.getByText('Cô Nguyễn Thị Mai • GV Chủ Nhiệm • 10:15 hôm nay')).toBeInTheDocument();
    expect(screen.getByText('NAEYC-PHY-02')).toBeInTheDocument();

    // Tab 3: Tiến trình NAEYC
    fireEvent.click(screen.getByRole('button', { name: 'Tiến trình NAEYC' }));
    expect(screen.getByText('Khung Đánh Giá Chuẩn Phát Triển NAEYC Mầm Non')).toBeInTheDocument();
    expect(screen.getByText('So Sánh Tiến Độ Giữa Các Khối Lớp')).toBeInTheDocument();
    expect(screen.getByText('Lớp Mầm A1 (3-4 tuổi)')).toBeInTheDocument();
    expect(screen.getByText('Lớp Chồi B1 (4-5 tuổi)')).toBeInTheDocument();

    // Tab 4: Hồ sơ 360°
    fireEvent.click(screen.getByRole('button', { name: 'Hồ sơ 360°' }));
    expect(screen.getByText('Trung Tâm Hồ Sơ Phát Triển Toàn Diện 360°')).toBeInTheDocument();
    expect(screen.getByText('Hồ Sơ Quản Lý Trẻ')).toBeInTheDocument();
    expect(screen.getByText('Xem Điểm Danh')).toBeInTheDocument();
    expect(screen.getByText('Chăm Sóc & Dinh Dưỡng')).toBeInTheDocument();

    // Tab 5: Khen thưởng
    fireEvent.click(screen.getByRole('button', { name: 'Khen thưởng' }));
    expect(screen.getByText('Góc Khen Thưởng & Tuyên Dương Mầm Non')).toBeInTheDocument();
    expect(screen.getByText('Ngôi Sao Tự Lập Giờ Ăn Trưa')).toBeInTheDocument();
    expect(screen.getByText('Họa Sĩ Nhí Xuất Sắc Tháng 9')).toBeInTheDocument();

    // Tab 1: Tổng quan
    fireEvent.click(screen.getByRole('button', { name: 'Tổng quan' }));
    expect(screen.getByText('Danh sách trẻ')).toBeInTheDocument();
  });

  it('filters students by class, attention status, and resets filters', async () => {
    await mountPage();

    // Filter by Attention
    fireEvent.click(screen.getByText('8 trẻ cần chú ý'));
    expect(screen.getByText(/Hiển thị 8 \/ 8 trẻ/)).toBeInTheDocument();
    expect(screen.getAllByText('Lê Gia Huy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Trần Bảo Ngọc').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vũ Gia Hân').length).toBeGreaterThanOrEqual(1);

    // Reset filters
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getByText(/Hiển thị 8 \/ 46 trẻ/)).toBeInTheDocument();

    // Filter by Mầm A1
    fireEvent.change(screen.getByLabelText('Lọc theo lớp học'), { target: { value: 'MAM_A1' } });
    expect(screen.getByText(/Hiển thị 8 \/ 24 trẻ/)).toBeInTheDocument();

    // Filter by Chồi B1
    fireEvent.change(screen.getByLabelText('Lọc theo lớp học'), { target: { value: 'CHOI_B1' } });
    expect(screen.getByText(/Hiển thị 8 \/ 22 trẻ/)).toBeInTheDocument();
  });

  it('navigates pagination across the 46 children', async () => {
    await mountPage();
    expect(screen.getByText('Nguyễn Minh An')).toBeInTheDocument();

    // Click Page 2
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Dương Minh Khôi')).toBeInTheDocument();

    // Click Previous
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    expect(screen.getByText('Nguyễn Minh An')).toBeInTheDocument();
  });

  it('opens and confirms award issuance in Khen thưởng tab', async () => {
    await mountPage();

    // Go to Khen thưởng tab
    fireEvent.click(screen.getByRole('button', { name: 'Khen thưởng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trao khen thưởng mới' }));

    const dialog = screen.getByRole('dialog', { name: 'Trao khen thưởng mầm non mới' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận trao thưởng' }));
    expect(screen.queryByRole('dialog', { name: 'Trao khen thưởng mầm non mới' })).not.toBeInTheDocument();
  });

  it('navigates from bottom widgets to respective tabs and filtered states', async () => {
    await mountPage();

    // Bottom widget Xem thêm -> jumps to observations tab
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm →' }));
    expect(screen.getByText('Nhật Ký Quan Sát & Bằng Chứng Sư Phạm')).toBeInTheDocument();

    // Go back to overview
    fireEvent.click(screen.getByRole('button', { name: 'Tổng quan' }));

    // Tiến độ đánh giá theo lớp "Xem chi tiết →" -> jumps to progression tab
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết →' }));
    expect(screen.getByText('Khung Đánh Giá Chuẩn Phát Triển NAEYC Mầm Non')).toBeInTheDocument();
  });
});
