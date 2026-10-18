/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ReportsPage from '../page';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));

const documents = [
  'Báo cáo tổng hợp tháng 09/2026',
  'Tài liệu chuyên cần',
  'Báo cáo học phí',
  'Báo cáo tăng trưởng theo WHO',
];

function mountPage() { render(<ReportsPage />); }

function expectNoFakeOutput() {
  expect(document.querySelector('a[download]')).toBeNull();
  for (const status of screen.getAllByRole('status')) {
    expect(status).toHaveTextContent(/Chưa (xuất|tải)/);
    expect(status).toHaveTextContent(/Không có file được tạo/);
    expect(status).not.toHaveTextContent(/Đang xuất|Đang tải|thành công/);
  }
}

describe('Reports trial truthful unavailable output', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows persistent unavailable feedback when header export is requested twice', () => {
    mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Xuất báo cáo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xuất báo cáo' }));
    act(() => jest.advanceTimersByTime(6000));
    expect(screen.getByRole('status')).toHaveTextContent(/Chưa xuất báo cáo/);
    expectNoFakeOutput();
  });

  it.each(documents)('identifies unavailable quick document: %s', title => {
    mountPage();
    const button = screen.getByRole('button', { name: `Tải báo cáo nhanh: ${title}` });
    fireEvent.click(button);
    act(() => jest.advanceTimersByTime(6000));
    expect(screen.getByRole('status')).toHaveTextContent(title);
    expect(button).toHaveAccessibleDescription(/Chưa tải/);
    expectNoFakeOutput();
  });

  it.each(documents)('identifies unavailable detail document: %s', title => {
    mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo chi tiết' }));
    const button = screen.getByRole('button', { name: `Tải báo cáo chi tiết: ${title}` });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByRole('status')).toHaveTextContent(title);
    expect(button).toHaveAccessibleDescription(/Chưa tải/);
    expectNoFakeOutput();
  });

  it('keeps output feedback across period selection and tab changes without claiming refresh', () => {
    mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Xuất báo cáo' }));
    fireEvent.click(screen.getByRole('button', { name: `Tải báo cáo nhanh: ${documents[0]}` }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Chọn kỳ minh họa' }), { target: { value: 'Tháng 08/2026' } });
    expect(screen.getByText(/Chỉ đổi lựa chọn kỳ/)).toHaveTextContent(/Tháng 08\/2026/);
    expect(screen.getByText(/Chỉ đổi lựa chọn kỳ/)).toHaveTextContent(/không được tải lại/);
    fireEvent.click(screen.getByRole('button', { name: 'Chuyên cần' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tổng quan' }));
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expectNoFakeOutput();
  });

  it('clearly labels every view as sample content and AI as no real analysis', () => {
    mountPage();
    const tabs = ['Tổng quan', 'Chuyên cần', 'Tài chính', 'Tăng trưởng', 'Phụ huynh', 'Báo cáo chi tiết'];
    for (const tab of tabs) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      expect(screen.getByRole('note')).toHaveTextContent(/Dữ liệu minh họa/);
      expect(screen.getByRole('note')).toHaveTextContent(/KPI, biểu đồ, phân tích AI, hoạt động và tài liệu/);
      expect(screen.getByRole('note')).toHaveTextContent(/chưa tải từ dữ liệu thật/);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Tổng quan' }));
    expect(screen.getByText(/Các nhận định mẫu dưới đây/)).toHaveTextContent(/chưa phải kết quả phân tích AI từ hồ sơ thật/);
    expect(screen.getByRole('link', { name: 'Quay lại Dashboard' })).toHaveAttribute('href', '/dashboard/education');
  });
});
