/** @jest-environment jsdom */
import React from 'react';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import NutritionPage from '../page';

const originalFetch = global.fetch;

const mockWeeklyMenu = {
  menuId: 'menu-44',
  weekNumber: 44,
  year: 2026,
  startDate: '2026-10-26',
  endDate: '2026-10-31',
  ageGroup: 'ALL',
  title: 'Thực đơn tuần 44 — Đảm bảo chuẩn Kcal học đường',
  status: 'PUBLISHED',
  notes: 'Đầy đủ 4 nhóm chất',
  days: [
    {
      dayKey: 'T2',
      dayLabel: 'Thứ Hai',
      dateStr: '26/10/2026',
      badgeColor: 'bg-sky-400 text-white',
      summaryDishes: 'Phở bò Hà Nội, Sữa tươi',
      caloriesKcal: 680,
      meals: [
        { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Phở bò Hà Nội'] },
        { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa tươi'] },
        { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm dẻo', 'Thịt kho'] },
        { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Chuối'] },
      ],
    },
  ],
};

describe('NutritionPage Component (/dashboard/education/nutrition)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders page header and loads menu data successfully', async () => {
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('list=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, menus: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, menu: mockWeeklyMenu }),
      } as Response);
    });

    render(<NutritionPage />);

    expect(screen.getByText('Thực đơn & Dinh dưỡng')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Thực đơn tuần 44 — Đảm bảo chuẩn Kcal học đường')).toBeInTheDocument();
      expect(screen.getByText('Phở bò Hà Nội')).toBeInTheDocument();
      expect(screen.getAllByText(/680 Kcal/).length).toBeGreaterThan(0);
    });
  });

  it('renders empty state when no menu exists for the week', async () => {
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('list=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, menus: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, menu: null }),
      } as Response);
    });

    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByText(/Chưa có thực đơn cho Tuần/)).toBeInTheDocument();
      expect(screen.getAllByText(/Tạo thực đơn/).length).toBeGreaterThan(0);
    });
  });
});
