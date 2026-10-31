/** @jest-environment jsdom */
import React from 'react';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WeeklyMenuEditorModal from '../WeeklyMenuEditorModal';

const originalFetch = global.fetch;

describe('WeeklyMenuEditorModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders modal when isOpen is true', async () => {
    global.fetch = jest.fn<() => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, menu: null }),
    } as Response);

    await act(async () => {
      render(
        <WeeklyMenuEditorModal
          isOpen={true}
          onClose={jest.fn()}
          initialDate="2026-10-26"
        />
      );
    });

    expect(screen.getByText('Quản lý thực đơn tuần & Dinh dưỡng')).toBeInTheDocument();
    expect(screen.getByText('Nạp thực đơn dinh dưỡng mẫu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ban hành thực đơn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu dự thảo' })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <WeeklyMenuEditorModal
        isOpen={false}
        onClose={jest.fn()}
        initialDate="2026-10-26"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('allows clicking sample menu button to fill dishes', async () => {
    global.fetch = jest.fn<() => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, menu: null }),
    } as Response);

    await act(async () => {
      render(
        <WeeklyMenuEditorModal
          isOpen={true}
          onClose={jest.fn()}
          initialDate="2026-10-26"
        />
      );
    });

    const sampleBtn = screen.getByText('Nạp thực đơn dinh dưỡng mẫu');
    await act(async () => {
      fireEvent.click(sampleBtn);
    });

    expect(await screen.findByText('Đã nạp thực đơn mẫu dinh dưỡng chuẩn thành công!')).toBeInTheDocument();
  });

  it('calls save API when clicking Ban hành thực đơn', async () => {
    const mockPost = jest.fn<() => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, menuId: 'new-menu-id', message: 'Success' }),
    } as Response);

    global.fetch = mockPost;
    const onSaved = jest.fn();

    await act(async () => {
      render(
        <WeeklyMenuEditorModal
          isOpen={true}
          onClose={jest.fn()}
          onSaved={onSaved}
          initialDate="2026-10-26"
        />
      );
    });

    const publishBtn = screen.getByRole('button', { name: 'Ban hành thực đơn' });
    await act(async () => {
      fireEvent.click(publishBtn);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });
  });
});
