/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import StudentHealth from '../StudentHealth';

describe('StudentHealth Component', () => {
  const studentId = '1825098e-52f4-4e9b-ac11-521610c741c7';
  const studentName = 'Nguyễn Đăng Khôi';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<StudentHealth studentId={studentId} studentName={studentName} />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByText(/Đang tải thông tin sức khỏe/i)).toBeInTheDocument();
  });

  it('renders error state and handles retry', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as unknown as typeof fetch;
    render(<StudentHealth studentId={studentId} studentName={studentName} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Không thể tải thông tin sức khỏe/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });

  it('renders empty state when there are no health records', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        allergies: [],
        medications: [],
        incidents: [],
      }),
    }) as unknown as typeof fetch;

    render(<StudentHealth studentId={studentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText(/Chưa có ghi nhận dị ứng, đơn thuốc hay sự cố y tế/i)).toBeInTheDocument();
    });
  });

  it('renders real health data when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        allergies: [
          {
            id: 'alg-1',
            severity: 'MODERATE',
            reaction_notes: 'Nổi mẩn đỏ quanh miệng',
            status: 'ACTIVE',
            allergen: { name: 'Hải sản (Tôm, Cua)' },
          },
        ],
        medications: [
          {
            id: 'med-1',
            medication_name: 'Siro Ho Prospan',
            authorized_dose: '5ml sau bữa ăn trưa',
            status: 'ACTIVE',
            valid_from: '2026-10-30T07:00:00Z',
            valid_until: '2026-11-05T17:00:00Z',
          },
        ],
        incidents: [
          {
            id: 'inc-1',
            incident_type: 'TRIP_FALL',
            severity: 'MINOR',
            description: 'Bé trượt chân nhẹ tại sân chơi',
            action_taken: 'Rửa vết thương bằng nước muối sinh lý',
            status: 'RESOLVED',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<StudentHealth studentId={studentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText(/Hải sản \(Tôm, Cua\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Siro Ho Prospan/i)).toBeInTheDocument();
      expect(screen.getByText(/Bé trượt chân nhẹ tại sân chơi/i)).toBeInTheDocument();
    });
  });
});
