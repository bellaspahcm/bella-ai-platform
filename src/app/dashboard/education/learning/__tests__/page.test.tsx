/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LearningWorkspacePage from '../page';

// Owner-approved presentation invariant: an unavailable command must retain
// entered content and must not claim a persisted or published result.
describe('Learning unavailable commands', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('identifies the displayed records and consent as sample content', () => {
    render(<LearningWorkspacePage />);
    expect(screen.getByRole('note')).toHaveTextContent(/Dữ liệu minh họa/);
    expect(screen.getByRole('note')).toHaveTextContent(/consent/);
    expect(screen.getByRole('note')).toHaveTextContent(/chưa được tải từ hồ sơ thật/);
  });

  it('retains all observation input after save, elapsed time and tab navigation', () => {
    render(<LearningWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: /Ghi Nhận Quan Sát/ }));
    fireEvent.change(screen.getByLabelText(/Nội Dung Quan Sát/), {
      target: { value: 'Synthetic observation awaiting persistence' },
    });
    fireEvent.change(screen.getByLabelText(/Gắn Thẻ Cột Mốc/), {
      target: { value: 'Synthetic milestone' },
    });
    fireEvent.change(screen.getByLabelText(/Chọn Trẻ/), {
      target: { value: '00000000-0000-0000-0000-000000000101' },
    });
    fireEvent.change(screen.getByLabelText(/Visibility Scope/), {
      target: { value: 'INTERNAL_TEACHER' },
    });
    fireEvent.change(screen.getByLabelText(/Consent Scope/), { target: { value: 'OPT_OUT' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Quan Sát & Minh Chứng/ }));
    act(() => jest.advanceTimersByTime(6000));

    expect(screen.getByRole('status')).toHaveTextContent(/Chưa lưu quan sát/);
    expect(screen.getByRole('status')).not.toHaveTextContent(/thành công/);
    fireEvent.click(screen.getByRole('button', { name: /Hồ Sơ Portfolio & Xuất Bản/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ghi Nhận Quan Sát/ }));
    expect(screen.getByLabelText(/Nội Dung Quan Sát/)).toHaveValue('Synthetic observation awaiting persistence');
    expect(screen.getByLabelText(/Gắn Thẻ Cột Mốc/)).toHaveValue('Synthetic milestone');
    expect(screen.getByLabelText(/Chọn Trẻ/)).toHaveValue('00000000-0000-0000-0000-000000000101');
    expect(screen.getByLabelText(/Visibility Scope/)).toHaveValue('INTERNAL_TEACHER');
    expect(screen.getByLabelText(/Consent Scope/)).toHaveValue('OPT_OUT');
  });

  it.each(['CONSENT_VERIFIED', 'OPT_OUT'])('does not publish or fabricate a version/checksum for %s', (consent) => {
    const { container } = render(<LearningWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: /Ghi Nhận Quan Sát/ }));
    fireEvent.change(screen.getByLabelText(/Consent Scope/), { target: { value: consent } });
    fireEvent.click(screen.getByRole('button', { name: /Hồ Sơ Portfolio & Xuất Bản/ }));
    fireEvent.click(screen.getByRole('button', { name: /Xuất Bản Portfolio Cho Phụ Huynh/ }));
    act(() => jest.advanceTimersByTime(6000));

    expect(screen.getByRole('status')).toHaveTextContent(/Chưa xuất bản Portfolio/);
    expect(screen.getByText('Bản minh họa · Chưa xuất bản')).toBeVisible();
    expect(container).not.toHaveTextContent(/PUBLISHED|SHA-256|Version \d+/);
    expect(screen.queryByRole('button', { name: /Chỉnh Sửa Portfolio/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Parent View/ }));
    expect(screen.getByText(/Chưa có hồ sơ được tải hoặc xuất bản từ hệ thống/)).toBeVisible();
    expect(container.querySelector('#parent-visible-evidence')).toBeNull();
    expect(container.querySelector('#checksum-banner')).toBeNull();
  });
});
