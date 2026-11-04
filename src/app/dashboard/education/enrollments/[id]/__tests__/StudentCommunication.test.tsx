/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import StudentCommunication from '../StudentCommunication';

describe('StudentCommunication Component', () => {
  const studentId = '1825098e-52f4-4e9b-ac11-521610c741c7';
  const studentName = 'Nguyễn Đăng Khôi';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<StudentCommunication studentId={studentId} studentName={studentName} />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByText(/Đang tải sổ liên lạc & nhật ký/i)).toBeInTheDocument();
  });

  it('renders error state and retry button', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as unknown as typeof fetch;
    render(<StudentCommunication studentId={studentId} studentName={studentName} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Không thể tải dữ liệu sổ liên lạc/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });

  it('renders empty state when there are no care records or parent requests', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        dailyCareRecords: [],
        exceptions: [],
      }),
    }) as unknown as typeof fetch;

    render(<StudentCommunication studentId={studentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText(/Chưa có ghi nhận nhật ký chăm sóc/i)).toBeInTheDocument();
    });
  });

  it('renders real daily care records and parent communication exceptions', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        dailyCareRecords: [
          {
            id: 'care-1',
            arrival_status: 'PRESENT',
            arrival_time: '2026-10-30T07:45:00Z',
            morning_condition: 'Vui vẻ, hoạt bát',
            meal_records: [
              { meal: 'Bữa sáng', food: 'Cháo sườn bắp non', amount: 'Hết phần' },
            ],
            session: { date: '2026-10-30' },
          },
        ],
        exceptions: [
          {
            id: 'comm-1',
            exception_type: 'MEDICATION_ADMIN_REQUEST',
            severity: 'NORMAL',
            status: 'RESOLVED',
            resolution_notes: 'Đã cho bé uống siro',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<StudentCommunication studentId={studentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText(/Cháo sườn bắp non/i)).toBeInTheDocument();
      expect(screen.getByText(/MEDICATION_ADMIN_REQUEST/i)).toBeInTheDocument();
    });
  });
});
