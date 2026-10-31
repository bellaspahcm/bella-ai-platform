/** @jest-environment jsdom */
import React from 'react';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CurriculumManagementPage from '../page';
import type { CurriculumDTO, LessonPlanDTO } from '@/products/bella-education/learning-development/curriculum/curriculum.contract';

const originalFetch = global.fetch;

const mockCurriculums: CurriculumDTO[] = [
  {
    id: 'curr-1',
    code: 'MOET_STANDARD',
    name: 'Chương trình Giáo dục Mầm non Chuẩn Bộ GD&ĐT',
    ageGroup: 'ALL',
    academicYear: '2026-2027',
    totalWeeks: 35,
    status: 'ACTIVE',
    subjects: [
      {
        code: 'THE_CHAT',
        name: 'Giáo dục Thể chất',
        domain: 'THE_CHAT',
        weeklyPeriods: 4,
        color: 'emerald',
      },
    ],
    createdAt: '2026-10-31T00:00:00Z',
    updatedAt: '2026-10-31T00:00:00Z',
  },
];

const mockLessonPlans: LessonPlanDTO[] = [
  {
    id: 'plan-1',
    curriculumId: 'curr-1',
    courseId: 'course-1',
    courseName: 'Lớp Chồi 1 — Họa Mi',
    academicYear: '2026-2027',
    weekNumber: 44,
    year: 2026,
    ageGroup: 'KINDY_1',
    theme: 'Thế giới Động vật',
    subjectDomain: 'NHAN_THUC',
    title: 'Khám phá các con vật nuôi trong gia đình',
    plannedDate: '2026-10-27',
    status: 'APPROVED',
    objectives: {
      knowledge: 'Trẻ gọi đúng tên các con vật',
      skills: 'Rèn kỹ năng quan sát',
      attitude: 'Yêu quý động vật nuôi',
    },
    materials: 'Mô hình trang trại mini',
    activitySteps: [
      {
        stepNumber: 1,
        stepName: '1. Gây hứng thú',
        durationMinutes: 5,
        teacherAction: 'Hát bài con gà',
        childrenAction: 'Hát theo',
      },
      {
        stepNumber: 2,
        stepName: '2. Hoạt động trọng tâm',
        durationMinutes: 20,
        teacherAction: 'Giới thiệu con chó, mèo',
        childrenAction: 'Quan sát và trả lời',
      },
    ],
    teacherNotes: 'Chú ý nhắc nhở các bạn',
    createdAt: '2026-10-31T00:00:00Z',
    updatedAt: '2026-10-31T00:00:00Z',
  },
];

describe('CurriculumManagementPage Component (/dashboard/education/curriculum)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders header, metrics and fetches lesson plans and curriculums', async () => {
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/education/courses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            courses: [{ id: 'course-1', title: 'Lớp Chồi 1 — Họa Mi' }],
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          curriculums: mockCurriculums,
          lessonPlans: mockLessonPlans,
        }),
      } as Response);
    });

    render(<CurriculumManagementPage />);

    expect(screen.getByText('Quản Lý Giáo Trình & Giáo Án')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('Khám phá các con vật nuôi trong gia đình')
      ).toBeInTheDocument();
      expect(screen.getByText('Chủ đề: Thế giới Động vật')).toBeInTheDocument();
      expect(screen.getByText('ĐÃ PHÊ DUYỆT')).toBeInTheDocument();
    });
  });

  it('toggles detail accordion to show activity steps', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          curriculums: mockCurriculums,
          lessonPlans: mockLessonPlans,
        }),
      } as Response)
    );

    render(<CurriculumManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Khám phá các con vật nuôi trong gia đình')
      ).toBeInTheDocument();
    });

    const expandBtn = screen.getByText('Chi tiết tiến trình');
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText('Tiến trình tổ chức hoạt động (2 bước)')).toBeInTheDocument();
      expect(screen.getByText('Mô hình trang trại mini')).toBeInTheDocument();
      expect(screen.getByText('1. Gây hứng thú')).toBeInTheDocument();
    });
  });

  it('navigates between Curriculums tab and Subjects tab', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          curriculums: mockCurriculums,
          lessonPlans: mockLessonPlans,
        }),
      } as Response)
    );

    render(<CurriculumManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Khung Giáo Trình Viện Mầm Non')).toBeInTheDocument();
    });

    // Click Curriculums tab
    const curriculumsTab = screen.getByText('Khung Giáo Trình Viện Mầm Non');
    fireEvent.click(curriculumsTab);

    await waitFor(() => {
      expect(
        screen.getByText('Chương trình Giáo dục Mầm non Chuẩn Bộ GD&ĐT')
      ).toBeInTheDocument();
      expect(screen.getByText(/35 tuần học \/ năm/)).toBeInTheDocument();
    });

    // Click Subjects tab
    const subjectsTab = screen.getByText(/Môn Học & Lĩnh Vực Phát Triển/);
    fireEvent.click(subjectsTab);

    await waitFor(() => {
      expect(
        screen.getByText(/Chuẩn 5 Lĩnh Vực Phát Triển Toàn Diện Theo Thông Tư Bộ GD&ĐT/)
      ).toBeInTheDocument();
      expect(screen.getByText('TC_VAN_DONG')).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no lesson plans for the week', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          curriculums: mockCurriculums,
          lessonPlans: [],
        }),
      } as Response)
    );

    render(<CurriculumManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Chưa có giáo án nào trong tuần/)).toBeInTheDocument();
      expect(screen.getByText('+ Soạn Giáo Án Ngay')).toBeInTheDocument();
    });
  });
});
