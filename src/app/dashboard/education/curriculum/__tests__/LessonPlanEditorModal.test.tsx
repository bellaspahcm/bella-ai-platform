/** @jest-environment jsdom */
import React from 'react';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LessonPlanEditorModal from '../LessonPlanEditorModal';
import type { LessonPlanDTO, CurriculumDTO } from '@/products/bella-education/learning-development/curriculum/curriculum.contract';

const originalFetch = global.fetch;

const mockCurriculums: readonly CurriculumDTO[] = [
  {
    id: 'curr-1',
    code: 'MOET_STANDARD',
    name: 'Chương trình Giáo dục Mầm non Chuẩn Bộ GD&ĐT',
    ageGroup: 'ALL',
    academicYear: '2026-2027',
    totalWeeks: 35,
    status: 'ACTIVE',
    subjects: [],
    createdAt: '2026-10-31T00:00:00Z',
    updatedAt: '2026-10-31T00:00:00Z',
  },
];

const mockCourses = [
  { id: 'course-1', name: 'Lớp Chồi 1 — Họa Mi' },
  { id: 'course-2', name: 'Lớp Lá 2 — Sơn Ca' },
];

const mockExistingPlan: LessonPlanDTO = {
  id: 'plan-101',
  curriculumId: 'curr-1',
  courseId: 'course-1',
  courseName: 'Lớp Chồi 1 — Họa Mi',
  academicYear: '2026-2027',
  weekNumber: 44,
  year: 2026,
  ageGroup: 'KINDY_1',
  theme: 'Thế giới Động vật',
  subjectDomain: 'NHAN_THUC',
  title: 'Khám phá các con vật nuôi',
  plannedDate: '2026-10-27',
  status: 'APPROVED',
  objectives: {
    knowledge: 'Trẻ gọi đúng tên con vật',
    skills: 'Rèn kỹ năng quan sát',
    attitude: 'Giáo dục yêu quý động vật',
  },
  materials: 'Bộ thẻ tranh',
  activitySteps: [
    {
      stepNumber: 1,
      stepName: '1. Gây hứng thú',
      durationMinutes: 5,
      teacherAction: 'Hát bài con vật',
      childrenAction: 'Hát cùng cô',
    },
  ],
  teacherNotes: 'Chú ý bé An',
  createdAt: '2026-10-31T00:00:00Z',
  updatedAt: '2026-10-31T00:00:00Z',
};

describe('LessonPlanEditorModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <LessonPlanEditorModal
        isOpen={false}
        onClose={jest.fn()}
        curriculums={mockCurriculums}
        courses={mockCourses}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders create modal and applies sample template on button click', async () => {
    render(
      <LessonPlanEditorModal
        isOpen={true}
        onClose={jest.fn()}
        curriculums={mockCurriculums}
        courses={mockCourses}
      />
    );

    expect(screen.getByText('Soạn Kế Hoạch Giáo Án Mầm Non')).toBeInTheDocument();
    expect(screen.getByText('Nạp giáo án mẫu chuẩn Bộ GD&ĐT')).toBeInTheDocument();

    const sampleBtn = screen.getByText('Nạp giáo án mẫu chuẩn Bộ GD&ĐT');
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Khám phá đặc điểm một số con vật nuôi trong gia đình')
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Thế giới Động vật quanh bé')).toBeInTheDocument();
      expect(screen.getByText(/Đã nạp giáo án mẫu chuẩn Bộ GD&ĐT/)).toBeInTheDocument();
    });
  });

  it('loads existing plan details when initialPlan is provided and submits successfully', async () => {
    const onSaved = jest.fn();
    const onClose = jest.fn();

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: true, lessonPlan: mockExistingPlan }),
      } as Response)
    );

    render(
      <LessonPlanEditorModal
        isOpen={true}
        onClose={onClose}
        onSaved={onSaved}
        initialPlan={mockExistingPlan}
        curriculums={mockCurriculums}
        courses={mockCourses}
      />
    );

    expect(screen.getByText('Cập Nhật Giáo Án Giảng Dạy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Khám phá các con vật nuôi')).toBeInTheDocument();

    const saveBtn = screen.getByText('Lưu Giáo Án');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/education/curriculum',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(onSaved).toHaveBeenCalledWith(mockExistingPlan);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error validation when required title is empty', async () => {
    render(
      <LessonPlanEditorModal
        isOpen={true}
        onClose={jest.fn()}
        curriculums={mockCurriculums}
        courses={mockCourses}
      />
    );

    const saveBtn = screen.getByText('Lưu Giáo Án');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Vui lòng nhập Tên bài dạy / hoạt động.')).toBeInTheDocument();
    });
  });
});
