'use client';

/**
 * BELLA PRESCHOOL OS — WEEKLY NUTRITION & MENU MANAGEMENT CENTER
 *
 * Dedicated institutional nutrition planner for preschool administrators, head chefs, and teachers.
 * Displays daily meal breakdowns, caloric measurements, and status propagation across
 * Executive Dashboard and Parent Portal.
 *
 * Canonical Source of Truth: `edu_weekly_menus` & `edu_weekly_menu_days`.
 *
 * @module src/app/dashboard/education/nutrition/page
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Utensils,
  Calendar,
  Flame,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Sparkles,
  Loader2,
  Coffee,
  Apple,
  Cookie,
  AlertCircle,
  FileText,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { PreschoolSelect } from '@/components/ui/PreschoolSelect';
import WeeklyMenuEditorModal from '../care/WeeklyMenuEditorModal';
import type {
  PreschoolWeeklyMenuDTO,
  WeeklyMenuAgeGroup,
  WeeklyMenuSummaryDTO,
} from '@/products/bella-education/care-wellbeing/nutrition/weekly-menu.contract';

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function NutritionPageContent() {
  const currentMonday = useMemo(() => getMondayOfCurrentWeek(), []);
  const currentWeekNumber = useMemo(() => getWeekNumber(currentMonday), [currentMonday]);

  // Filters
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeekNumber);
  const [selectedYear, setSelectedYear] = useState<number>(currentMonday.getFullYear());
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<WeeklyMenuAgeGroup>('ALL');

  // Data states
  const [menu, setMenu] = useState<PreschoolWeeklyMenuDTO | null>(null);
  const [menuList, setMenuList] = useState<WeeklyMenuSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isEditorModalOpen, setIsEditorModalOpen] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Fetch current menu
  const fetchMenu = useCallback(async (week: number, year: number, ageGroup: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/education/nutrition/weekly-menu?weekNumber=${week}&year=${year}&ageGroup=${ageGroup}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('FETCH_FAILED');
      const data = await res.json();
      if (data.success) {
        setMenu(data.menu ?? null);
      } else {
        throw new Error(data.error || 'LOAD_ERROR');
      }
    } catch {
      setError('Không thể tải thực đơn dinh dưỡng. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch menu list (history / upcoming)
  const fetchMenuList = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/education/nutrition/weekly-menu?list=true&year=${year}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.menus)) {
          setMenuList(data.menus);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchMenu(selectedWeek, selectedYear, selectedAgeGroup);
  }, [selectedWeek, selectedYear, selectedAgeGroup, fetchMenu]);

  useEffect(() => {
    fetchMenuList(selectedYear);
  }, [selectedYear, fetchMenuList]);

  // Derived metrics
  const avgCalories = useMemo(() => {
    if (!menu?.days || menu.days.length === 0) return 0;
    const total = menu.days.reduce((acc, d) => acc + (d.caloriesKcal || 680), 0);
    return Math.round(total / menu.days.length);
  }, [menu]);

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 pb-40 sm:pb-56 bg-[#f8fafc]/50 dark:bg-slate-900/50">
      {/* ── 1. HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/education"
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shrink-0"
            title="Quay lại Tổng quan"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-11 h-11 rounded-2xl bg-[#0e5c43] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-900/20">
            <Utensils className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              Thực đơn &amp; Dinh dưỡng
              {menu && (
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    menu.status === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}
                >
                  {menu.status === 'PUBLISHED' ? 'Đã ban hành' : 'Dự thảo'}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Lập kế hoạch khẩu phần ăn, định lượng calo học đường và đồng bộ tự động lên Cổng phụ huynh
            </p>
          </div>
        </div>

        {/* Top Right Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditorModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-[#0e5c43] hover:bg-[#0a4633] active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-900/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{menu ? 'Chỉnh sửa thực đơn tuần' : 'Tạo thực đơn tuần mới'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. METRIC STATS ROW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Tuần học */}
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-[#0e5c43] flex items-center justify-center mb-3">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Tuần đang xem</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            Tuần {selectedWeek} <span className="text-xs font-bold text-slate-400">/{selectedYear}</span>
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            {menu ? `${menu.startDate} → ${menu.endDate}` : 'Chưa có ngày'}
          </div>
        </div>

        {/* Card 2: Năng lượng Kcal */}
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center mb-3">
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Năng lượng trung bình</div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {avgCalories > 0 ? `${avgCalories} Kcal` : '—'}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">Chuẩn khuyến nghị 650 - 720</div>
        </div>

        {/* Card 3: Số ngày phục vụ */}
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Ngày phục vụ</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {menu?.days ? `${menu.days.length} ngày` : '0 ngày'}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">Thứ Hai → Thứ Bảy</div>
        </div>

        {/* Card 4: Đối tượng */}
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center mb-3">
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Độ tuổi áp dụng</div>
          <div className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-300 mt-1 truncate">
            {selectedAgeGroup === 'ALL'
              ? 'Toàn trường'
              : selectedAgeGroup === 'NURSERY'
              ? 'Nhà trẻ'
              : selectedAgeGroup === 'TODDLER'
              ? 'Lớp Mầm'
              : selectedAgeGroup === 'KINDY_1'
              ? 'Lớp Chồi'
              : 'Lớp Lá'}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">Đồng bộ Cổng phụ huynh</div>
        </div>
      </div>

      {/* ── 3. FILTER TOOLBAR ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Week select */}
          <div className="w-40 sm:w-44">
            <PreschoolSelect
              aria-label="Chọn tuần học"
              value={String(selectedWeek)}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedWeek(parseInt(e.target.value, 10))}
              className="py-1.5 text-xs font-bold"
            >
              {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Tuần {w} ({selectedYear})
                </option>
              ))}
            </PreschoolSelect>
          </div>

          {/* Year select */}
          <div className="w-28">
            <PreschoolSelect
              aria-label="Chọn năm"
              value={String(selectedYear)}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedYear(parseInt(e.target.value, 10))}
              className="py-1.5 text-xs font-bold"
            >
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </PreschoolSelect>
          </div>

          {/* Age group select */}
          <div className="w-44">
            <PreschoolSelect
              aria-label="Chọn độ tuổi"
              value={selectedAgeGroup}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedAgeGroup(e.target.value as WeeklyMenuAgeGroup)}
              className="py-1.5 text-xs font-bold"
            >
              <option value="ALL">Toàn trường (ALL)</option>
              <option value="NURSERY">Nhà Trẻ (6-24 tháng)</option>
              <option value="TODDLER">Lớp Mầm (2-3 tuổi)</option>
              <option value="KINDY_1">Lớp Chồi (3-4 tuổi)</option>
              <option value="KINDY_2">Lớp Lá (4-5 tuổi)</option>
            </PreschoolSelect>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchMenu(selectedWeek, selectedYear, selectedAgeGroup)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── 4. MAIN MENU DISPLAY ── */}
      {isLoading ? (
        <div className="py-24 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0e5c43]" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Đang tải thực đơn Tuần {selectedWeek}...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-xs font-bold text-rose-800 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => fetchMenu(selectedWeek, selectedYear, selectedAgeGroup)}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
          >
            Thử lại
          </button>
        </div>
      ) : !menu || !menu.days || menu.days.length === 0 ? (
        /* Empty State */
        <div className="py-20 px-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-[#0e5c43] flex items-center justify-center mx-auto shadow-xs">
            <Utensils className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Chưa có thực đơn cho Tuần {selectedWeek} ({selectedYear})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Thực đơn cho tuần học này chưa được lập hoặc đang trong quá trình soạn thảo. Bấm nút dưới đây để tạo thực đơn ngay với các món ăn dinh dưỡng mẫu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditorModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-black text-xs shadow-md shadow-emerald-900/20 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo thực đơn Tuần {selectedWeek} ngay</span>
          </button>
        </div>
      ) : (
        /* Daily Cards Grid */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {menu.title}
              </h2>
              {menu.notes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{menu.notes}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsEditorModalOpen(true)}
              className="text-xs font-bold text-[#0e5c43] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Chỉnh sửa món ăn</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menu.days.map((day) => (
              <div
                key={day.dayKey}
                className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-2xs space-y-4 hover:shadow-md transition-shadow"
              >
                {/* Day Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shadow-xs ${day.badgeColor}`}>
                      {day.dayKey}
                    </span>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white">
                        {day.dayLabel}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">{day.dateStr}</p>
                    </div>
                  </div>
                  {day.caloriesKcal && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      <span>{day.caloriesKcal} Kcal</span>
                    </span>
                  )}
                </div>

                {/* 4 Meal Rows */}
                <div className="space-y-3 text-xs">
                  {/* Bữa sáng */}
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/20">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                      <Coffee className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                        Bữa sáng
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                        {day.meals?.find((m) => m.mealType === 'BREAKFAST')?.dishes.join(', ') || 'Chưa ghi món'}
                      </div>
                    </div>
                  </div>

                  {/* Bữa phụ sáng */}
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-100/60 dark:border-sky-900/20">
                    <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Apple className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-sky-800 dark:text-sky-400 uppercase tracking-wider">
                        Bữa phụ sáng
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                        {day.meals?.find((m) => m.mealType === 'MORNING_SNACK')?.dishes.join(', ') || 'Chưa ghi món'}
                      </div>
                    </div>
                  </div>

                  {/* Bữa trưa chính */}
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-900/20">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Utensils className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                        Bữa trưa chính
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                        {day.meals?.find((m) => m.mealType === 'LUNCH')?.dishes.join(', ') || 'Chưa ghi món'}
                      </div>
                    </div>
                  </div>

                  {/* Bữa xế */}
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100/60 dark:border-purple-900/20">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Cookie className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-purple-800 dark:text-purple-400 uppercase tracking-wider">
                        Bữa xế chiều
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                        {day.meals?.find((m) => m.mealType === 'AFTERNOON_SNACK')?.dishes.join(', ') || 'Chưa ghi món'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. OTHER WEEKS INVENTORY / HISTORY ── */}
      {menuList.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0e5c43]" />
              <span>Danh sách thực đơn các tuần khác ({selectedYear})</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {menuList.map((item) => {
              const isCurrent = item.weekNumber === selectedWeek;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedWeek(item.weekNumber)}
                  className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                    isCurrent
                      ? 'border-[#0e5c43] bg-emerald-50/60 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-slate-800 dark:text-slate-100">
                      Tuần {item.weekNumber} ({item.startDate} → {item.endDate})
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium truncate max-w-xs mt-0.5">
                      {item.title}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      item.status === 'PUBLISHED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {item.status === 'PUBLISHED' ? 'Ban hành' : 'Dự thảo'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 6. EDITOR MODAL ── */}
      <WeeklyMenuEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        initialDate={menu?.startDate || `${selectedYear}-10-26`}
        onSaved={(savedMenu) => {
          setMenu(savedMenu);
          setFeedbackToast('Thực đơn dinh dưỡng tuần đã được lưu và cập nhật thành công!');
          fetchMenuList(selectedYear);
          setTimeout(() => setFeedbackToast(null), 4000);
        }}
      />

      {/* ── 7. FEEDBACK TOAST ── */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0e5c43] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-4 duration-200 text-xs font-bold border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#0e5c43]" />
        </div>
      }
    >
      <NutritionPageContent />
    </Suspense>
  );
}

