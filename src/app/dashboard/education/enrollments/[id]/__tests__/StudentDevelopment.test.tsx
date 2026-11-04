/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import StudentDevelopment from '../StudentDevelopment';

describe('StudentDevelopment Component', () => {
  const studentId = '1825098e-52f4-4e9b-ac11-521610c741c7';
  const enrollmentId = '1149a7ae-31d5-46b5-b429-4d66b36b3379';
  const studentName = 'Nguyễn Đăng Khôi';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<StudentDevelopment studentId={studentId} enrollmentId={enrollmentId} studentName={studentName} />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByText(/Đang tải dữ liệu đánh giá/i)).toBeInTheDocument();
  });

  it('renders error state and retry button', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as unknown as typeof fetch;
    render(<StudentDevelopment studentId={studentId} enrollmentId={enrollmentId} studentName={studentName} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Không thể tải dữ liệu đánh giá/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });

  it('renders empty state when there are no assessments or milestone records', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        assessments: [],
        milestoneProgress: [],
      }),
    }) as unknown as typeof fetch;

    render(<StudentDevelopment studentId={studentId} enrollmentId={enrollmentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText(/Chưa có ghi nhận đánh giá định kỳ hay mốc phát triển/i)).toBeInTheDocument();
    });
  });

  it('renders real development data when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        assessments: [
          {
            id: 'asm-1',
            score_type: 'midterm',
            grade: 9.5,
            weight: 1.0,
            occurred_at: '2026-10-25T08:00:00Z',
          },
        ],
        milestoneProgress: [
          {
            id: 'prg-1',
            status: 'ACQUIRED',
            rationale: 'Bé Khôi nhảy lò cò rất tốt',
            milestone: {
              code: 'PHYS-4Y-01',
              title: 'Vận động thô: Nhảy lò cò và giữ thăng bằng',
              indicator_statement: 'Đạt kỹ năng vận động tiêu chuẩn',
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<StudentDevelopment studentId={studentId} enrollmentId={enrollmentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText(/Vận động thô: Nhảy lò cò và giữ thăng bằng/i)).toBeInTheDocument();
      expect(screen.getByText(/9.5/i)).toBeInTheDocument();
      expect(screen.getByText(/Bé Khôi nhảy lò cò rất tốt/i)).toBeInTheDocument();
    });
  });
});
