'use client';

/**
 * BELLA PRESCHOOL OS — WEEKLY NUTRITION MENU EDITOR MODAL
 *
 * Full-featured weekly nutrition menu management modal for preschool administrators & chefs.
 * Allows managing daily meal breakdowns (Breakfast, Morning Snack, Lunch, Afternoon Snack),
 * calculating Kcal, saving drafts, and publishing live to Executive Dashboard & Parent Portal.
 *
 * Canonical Source of Truth: `edu_weekly_menus` & `edu_weekly_menu_days`.
 *
 * @module src/app/dashboard/education/care/WeeklyMenuEditorModal
 */

import React, { useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react';
import {
  Utensils,
  Calendar,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Loader2,
  Save,
  Coffee,
  Apple,
  Cookie,
  Flame,
  FileCheck2,
} from 'lucide-react';
import { PreschoolSelect } from '@/components/ui/PreschoolSelect';
import type {
  PreschoolWeeklyMenuDTO,
  WeeklyMenuDayCode,
  WeeklyMenuAgeGroup,
  WeeklyMenuStatus,
  SaveWeeklyMenuInput,
  SaveWeeklyMenuDayInput,
} from '@/products/bella-education/care-wellbeing/nutrition/weekly-menu.contract';

interface WeeklyMenuEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaved?: (menu: PreschoolWeeklyMenuDTO) => void;
  readonly initialDate?: string; // YYYY-MM-DD
}

interface DayFormState {
  readonly dayOfWeek: WeeklyMenuDayCode;
  readonly dayLabel: string;
  readonly dayKey: 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';
  readonly menuDate: string; // YYYY-MM-DD
  breakfastDishes: string;
  morningSnackDishes: string;
  lunchDishes: string;
  afternoonSnackDishes: string;
  caloriesKcal: number;
}

const DEFAULT_WEEKDAY_CONFIG: ReadonlyArray<{ code: WeeklyMenuDayCode; label: string; key: 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7'; offset: number }> = [
  { code: 'MON', label: 'Thứ Hai', key: 'T2', offset: 0 },
  { code: 'TUE', label: 'Thứ Ba', key: 'T3', offset: 1 },
  { code: 'WED', label: 'Thứ Tư', key: 'T4', offset: 2 },
  { code: 'THU', label: 'Thứ Năm', key: 'T5', offset: 3 },
  { code: 'FRI', label: 'Thứ Sáu', key: 'T6', offset: 4 },
  { code: 'SAT', label: 'Thứ Bảy', key: 'T7', offset: 5 },
];

/** Standard preschool sample menu recommendations from National Institute of Nutrition */
const STANDARD_SAMPLE_MENUS: Readonly<Record<WeeklyMenuDayCode, { breakfast: string; morningSnack: string; lunch: string; afternoonSnack: string; kcal: number }>> = {
  MON: {
    breakfast: 'Phở bò Hà Nội, Hành hoa',
    morningSnack: 'Sữa tươi thanh trùng 150ml',
    lunch: 'Cơm dẻo, Thịt heo rim nước dừa, Canh bí đao nấu tôm',
    afternoonSnack: 'Chuối tiêu chín, Bánh bông lan',
    kcal: 680,
  },
  TUE: {
    breakfast: 'Cháo gà hạt sen bí đỏ',
    morningSnack: 'Sữa đậu nành hữu cơ',
    lunch: 'Cơm gà xé phay, Canh củ dền sườn heo, Đậu cove xào',
    afternoonSnack: 'Sữa chua dâu tây hoa quả dầm',
    kcal: 710,
  },
  WED: {
    breakfast: 'Bún cá rô đồng thì là',
    morningSnack: 'Nước ép táo nguyên chất',
    lunch: 'Cơm trắng, Cá hồi áp chảo sốt bơ tỏi, Canh rau ngót nấu thịt, Rau củ luộc',
    afternoonSnack: 'Dưa hấu tươi mát, Sữa hạt sen',
    kcal: 670,
  },
  THU: {
    breakfast: 'Hủ tiếu Nam Vang thịt bằm',
    morningSnack: 'Sữa tươi Vinamilk ít đường',
    lunch: 'Cơm thơm, Thịt ba chỉ kho trứng cút, Canh bí đỏ đậu phộng',
    afternoonSnack: 'Bánh flan caramen mềm, Thanh long ruột đỏ',
    kcal: 720,
  },
  FRI: {
    breakfast: 'Mì trứng xào thịt bò rau cải',
    morningSnack: 'Sữa bắp non ngọt dịu',
    lunch: 'Cơm tấm mềm, Trứng hấp thịt bằm mộc nhĩ, Canh chua cá lóc',
    afternoonSnack: 'Thanh long trắng, Bánh quy dinh dưỡng',
    kcal: 690,
  },
  SAT: {
    breakfast: 'Bánh cuốn nóng thịt mộc nhĩ',
    morningSnack: 'Sữa tươi tiệt trùng',
    lunch: 'Cơm hạt sen, Bò hầm tiêu xanh khoai tây, Canh mướp mồng tơi',
    afternoonSnack: 'Chè hạt sen long nhãn',
    kcal: 660,
  },
  SUN: {
    breakfast: 'Cháo sườn non',
    morningSnack: 'Sữa chua',
    lunch: 'Cơm gia đình',
    afternoonSnack: 'Trái cây',
    kcal: 650,
  },
};

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

function getMondayOfCurrentWeek(dateInput?: string): Date {
  const now = dateInput ? new Date(dateInput) : new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function WeeklyMenuEditorModal({
  isOpen,
  onClose,
  onSaved,
  initialDate,
}: WeeklyMenuEditorModalProps) {
  // Current Monday calculation
  const defaultMonday = useMemo(() => getMondayOfCurrentWeek(initialDate), [initialDate]);
  const defaultWeekNum = useMemo(() => getWeekNumber(defaultMonday), [defaultMonday]);

  // Form states
  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeekNum);
  const [selectedYear, setSelectedYear] = useState<number>(defaultMonday.getFullYear());
  const [ageGroup, setAgeGroup] = useState<WeeklyMenuAgeGroup>('ALL');
  const [title, setTitle] = useState<string>(`Thực đơn tuần ${defaultWeekNum} — Đảm bảo dinh dưỡng học đường`);
  const [menuStatus, setMenuStatus] = useState<WeeklyMenuStatus>('PUBLISHED');
  const [notes, setNotes] = useState<string>('Thực đơn đạt chuẩn 650 - 720 Kcal cho trẻ mầm non.');
  const [menuId, setMenuId] = useState<string | undefined>(undefined);

  // Active day tab
  const [activeDayCode, setActiveDayCode] = useState<WeeklyMenuDayCode>('MON');

  // Days state
  const [days, setDays] = useState<DayFormState[]>(() => {
    return DEFAULT_WEEKDAY_CONFIG.map((cfg) => {
      const d = new Date(defaultMonday);
      d.setDate(d.getDate() + cfg.offset);
      const sample = STANDARD_SAMPLE_MENUS[cfg.code] || STANDARD_SAMPLE_MENUS.MON;
      return {
        dayOfWeek: cfg.code,
        dayLabel: cfg.label,
        dayKey: cfg.key,
        menuDate: formatDateIso(d),
        breakfastDishes: sample.breakfast,
        morningSnackDishes: sample.morningSnack,
        lunchDishes: sample.lunch,
        afternoonSnackDishes: sample.afternoonSnack,
        caloriesKcal: sample.kcal,
      };
    });
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate Monday & Friday dates based on selectedWeek and selectedYear
  const { startDate, endDate } = useMemo(() => {
    // Simple 4th Jan ISO week calculation
    const jan4 = new Date(selectedYear, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const mondayWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
    const targetMonday = new Date(mondayWeek1.getTime() + (selectedWeek - 1) * 7 * 86400000);
    const targetFriday = new Date(targetMonday.getTime() + 4 * 86400000);
    return {
      startDate: formatDateIso(targetMonday),
      endDate: formatDateIso(targetFriday),
    };
  }, [selectedWeek, selectedYear]);

  // Update dates of days whenever week/year changes
  const updateDaysDates = useCallback((startMondayIso: string) => {
    const monday = new Date(startMondayIso);
    setDays((prev) =>
      prev.map((item, index) => {
        const itemDate = new Date(monday);
        itemDate.setDate(itemDate.getDate() + index);
        return {
          ...item,
          menuDate: formatDateIso(itemDate),
        };
      })
    );
  }, []);

  // Load existing menu from API when week or year changes
  const loadMenuForWeek = useCallback(async (week: number, yr: number, group: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/education/nutrition/weekly-menu?weekNumber=${week}&year=${yr}&ageGroup=${group}`);
      if (!res.ok) throw new Error('FETCH_FAILED');
      const data = await res.json();

      if (data.success && data.menu) {
        const existing: PreschoolWeeklyMenuDTO = data.menu;
        setMenuId(existing.menuId);
        if (existing.title) setTitle(existing.title);
        setMenuStatus(existing.status);
        if (existing.notes) setNotes(existing.notes);

        if (Array.isArray(existing.days) && existing.days.length > 0) {
          setDays((prev) =>
            prev.map((dayItem) => {
              const matched = existing.days.find((d) => d.dayKey === dayItem.dayKey);
              if (matched) {
                const breakfast = matched.meals?.find((m) => m.mealType === 'BREAKFAST')?.dishes.join(', ') || '';
                const morningSnack = matched.meals?.find((m) => m.mealType === 'MORNING_SNACK')?.dishes.join(', ') || '';
                const lunch = matched.meals?.find((m) => m.mealType === 'LUNCH')?.dishes.join(', ') || '';
                const afternoonSnack = matched.meals?.find((m) => m.mealType === 'AFTERNOON_SNACK')?.dishes.join(', ') || '';

                return {
                  ...dayItem,
                  breakfastDishes: breakfast || dayItem.breakfastDishes,
                  morningSnackDishes: morningSnack || dayItem.morningSnackDishes,
                  lunchDishes: lunch || dayItem.lunchDishes,
                  afternoonSnackDishes: afternoonSnack || dayItem.afternoonSnackDishes,
                  caloriesKcal: matched.caloriesKcal || dayItem.caloriesKcal,
                };
              }
              return dayItem;
            })
          );
        }
      } else {
        // No menu yet, reset id and update default title
        setMenuId(undefined);
        setTitle(`Thực đơn tuần ${week} — Đảm bảo dinh dưỡng học đường`);
      }
    } catch {
      setErrorMessage('Không thể kiểm tra dữ liệu thực đơn từ máy chủ.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger load when modal opens or week/year/ageGroup changes
  useEffect(() => {
    if (isOpen) {
      updateDaysDates(startDate);
      loadMenuForWeek(selectedWeek, selectedYear, ageGroup);
    }
  }, [isOpen, selectedWeek, selectedYear, ageGroup, startDate, updateDaysDates, loadMenuForWeek]);

  // Apply Sample Standard Menu
  const handleApplySampleMenu = () => {
    setDays((prev) =>
      prev.map((dayItem) => {
        const sample = STANDARD_SAMPLE_MENUS[dayItem.dayOfWeek] || STANDARD_SAMPLE_MENUS.MON;
        return {
          ...dayItem,
          breakfastDishes: sample.breakfast,
          morningSnackDishes: sample.morningSnack,
          lunchDishes: sample.lunch,
          afternoonSnackDishes: sample.afternoonSnack,
          caloriesKcal: sample.kcal,
        };
      })
    );
    setNotes('Thực đơn cân đối 4 nhóm dinh dưỡng theo khuyến nghị Viện Dinh Dưỡng Quốc Gia.');
    setSuccessMessage('Đã nạp thực đơn mẫu dinh dưỡng chuẩn thành công!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Active day updater helper
  const updateCurrentDay = (field: keyof DayFormState, value: string | number) => {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === activeDayCode ? { ...d, [field]: value } : d))
    );
  };

  const currentDayState = useMemo(() => {
    return days.find((d) => d.dayOfWeek === activeDayCode) || days[0];
  }, [days, activeDayCode]);

  // Save handler
  const handleSave = async (statusToSave: WeeklyMenuStatus) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const daysPayload: SaveWeeklyMenuDayInput[] = days.map((d) => {
        const breakfastDishes = d.breakfastDishes.split(',').map((s) => s.trim()).filter(Boolean);
        const morningSnackDishes = d.morningSnackDishes.split(',').map((s) => s.trim()).filter(Boolean);
        const lunchDishes = d.lunchDishes.split(',').map((s) => s.trim()).filter(Boolean);
        const afternoonSnackDishes = d.afternoonSnackDishes.split(',').map((s) => s.trim()).filter(Boolean);

        const allDishes = [...breakfastDishes, ...morningSnackDishes, ...lunchDishes, ...afternoonSnackDishes];
        const summary = allDishes.slice(0, 3).join(', ') || 'Thực đơn dinh dưỡng';

        return {
          dayOfWeek: d.dayOfWeek,
          menuDate: d.menuDate,
          summaryDishes: summary,
          caloriesKcal: d.caloriesKcal,
          mealsPayload: [
            {
              mealType: 'BREAKFAST',
              mealTypeLabel: 'Bữa sáng',
              dishes: breakfastDishes.length > 0 ? breakfastDishes : ['Phở gà'],
            },
            {
              mealType: 'MORNING_SNACK',
              mealTypeLabel: 'Bữa phụ sáng',
              dishes: morningSnackDishes.length > 0 ? morningSnackDishes : ['Sữa tươi'],
            },
            {
              mealType: 'LUNCH',
              mealTypeLabel: 'Bữa trưa chính',
              dishes: lunchDishes.length > 0 ? lunchDishes : ['Cơm trắng', 'Thịt kho trứng'],
            },
            {
              mealType: 'AFTERNOON_SNACK',
              mealTypeLabel: 'Bữa xế',
              dishes: afternoonSnackDishes.length > 0 ? afternoonSnackDishes : ['Sữa chua'],
            },
          ],
        };
      });

      const payload: SaveWeeklyMenuInput = {
        menuId,
        academicYear: '2026-2027',
        weekNumber: selectedWeek,
        year: selectedYear,
        startDate,
        endDate,
        ageGroup,
        title: title.trim(),
        status: statusToSave,
        notes: notes.trim(),
        days: daysPayload,
      };

      const res = await fetch('/api/education/nutrition/weekly-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.error || 'SAVE_FAILED');
      }

      setMenuId(resJson.menuId);
      setMenuStatus(statusToSave);
      setSuccessMessage(
        statusToSave === 'PUBLISHED'
          ? '🎉 Thực đơn tuần đã được ban hành và cập nhật ngay lập tức đến phụ huynh & báo cáo tổng quan!'
          : 'Đã lưu dự thảo thực đơn tuần thành công.'
      );

      // Reload fresh data to fire callback
      const reloadRes = await fetch(`/api/education/nutrition/weekly-menu?weekNumber=${selectedWeek}&year=${selectedYear}&ageGroup=${ageGroup}`);
      if (reloadRes.ok) {
        const reloadData = await reloadRes.json();
        if (reloadData.success && reloadData.menu) {
          onSaved?.(reloadData.menu);
        }
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi không xác định khi lưu thực đơn');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-transparent dark:from-emerald-950/30 dark:via-slate-900 dark:to-transparent flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#0e5c43] text-white flex items-center justify-center shadow-md shadow-emerald-900/20 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Quản lý thực đơn tuần &amp; Dinh dưỡng
                </h2>
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    menuStatus === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}
                >
                  {menuStatus === 'PUBLISHED' ? 'Đã ban hành' : 'Dự thảo'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Thiết lập định lượng món ăn, calo học đường và công khai lên Cổng phụ huynh &amp; Bảng điều hành
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-bold">{successMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Top Config Row: Week, Year, Age Group, Dates */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Week Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Tuần học
              </label>
              <PreschoolSelect
                aria-label="Chọn tuần"
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

            {/* Year */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Năm học
              </label>
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

            {/* Age Group */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Độ tuổi áp dụng
              </label>
              <PreschoolSelect
                aria-label="Độ tuổi áp dụng"
                value={ageGroup}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setAgeGroup(e.target.value as WeeklyMenuAgeGroup)}
                className="py-1.5 text-xs font-bold"
              >
                <option value="ALL">Toàn trường (ALL)</option>
                <option value="NURSERY">Nhóm Trẻ (6-24 tháng)</option>
                <option value="TODDLER">Lớp Mầm (2-3 tuổi)</option>
                <option value="KINDY_1">Lớp Chồi (3-4 tuổi)</option>
                <option value="KINDY_2">Lớp Lá (4-5 tuổi)</option>
              </PreschoolSelect>
            </div>

            {/* Date range display */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Khoảng ngày áp dụng
              </label>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>{startDate} → {endDate}</span>
              </div>
            </div>
          </div>

          {/* Title & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Tiêu đề thực đơn tuần
              </label>
              <input
                type="text"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Ví dụ: Thực đơn tuần 44 — Đảm bảo dinh dưỡng học đường"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
              />
            </div>

            <div className="flex items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleApplySampleMenu}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-[#0e5c43] dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nạp thực đơn dinh dưỡng mẫu</span>
              </button>
            </div>
          </div>

          {/* Weekday Selector Tabs (T2 - T7) */}
          <div className="border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {days.map((d) => {
                const isActive = d.dayOfWeek === activeDayCode;
                return (
                  <button
                    key={d.dayOfWeek}
                    type="button"
                    onClick={() => setActiveDayCode(d.dayOfWeek)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                      isActive
                        ? 'bg-[#0e5c43] text-white border-[#0e5c43] shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[10px]">
                      {d.dayKey}
                    </span>
                    <span>{d.dayLabel}</span>
                    <span className="text-[10px] opacity-75 font-normal">({d.menuDate.slice(5)})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Meal Editor Panel */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Đang tải dữ liệu thực đơn...</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    Chi tiết món ăn {currentDayState.dayLabel} ({currentDayState.menuDate})
                  </span>
                </div>
                {/* Calories Input */}
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 rounded-xl px-3 py-1.5">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300">Định lượng:</span>
                  <input
                    type="number"
                    min={400}
                    max={1200}
                    value={currentDayState.caloriesKcal}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateCurrentDay('caloriesKcal', parseInt(e.target.value, 10) || 680)
                    }
                    className="w-16 px-1.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-xs font-black text-amber-700 dark:text-amber-400 text-center outline-none"
                  />
                  <span className="text-xs text-amber-800 dark:text-amber-400 font-bold">Kcal</span>
                </div>
              </div>

              {/* 4 Meal Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Bữa Sáng */}
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <Coffee className="w-4 h-4 text-emerald-600" />
                    <span>1. Bữa sáng (Breakfast)</span>
                  </div>
                  <input
                    type="text"
                    value={currentDayState.breakfastDishes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentDay('breakfastDishes', e.target.value)}
                    placeholder="Ví dụ: Phở bò Hà Nội, Hành hoa"
                    className="w-full px-3 py-2 rounded-xl border border-emerald-200/80 dark:border-emerald-800 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400">Các món cách nhau bởi dấu phẩy (,)</p>
                </div>

                {/* 2. Bữa Phụ Sáng */}
                <div className="p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 space-y-2">
                  <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-bold text-xs">
                    <Apple className="w-4 h-4 text-sky-600" />
                    <span>2. Bữa phụ sáng (Morning Snack)</span>
                  </div>
                  <input
                    type="text"
                    value={currentDayState.morningSnackDishes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentDay('morningSnackDishes', e.target.value)}
                    placeholder="Ví dụ: Sữa tươi thanh trùng 150ml, Sữa hạt sen"
                    className="w-full px-3 py-2 rounded-xl border border-sky-200/80 dark:border-sky-800 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-[10px] text-slate-400">Sữa hạt, nước hoa quả hoặc ngũ cốc nhẹ</p>
                </div>

                {/* 3. Bữa Trưa Chính */}
                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <Utensils className="w-4 h-4 text-amber-600" />
                    <span>3. Bữa trưa chính (Lunch)</span>
                  </div>
                  <input
                    type="text"
                    value={currentDayState.lunchDishes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentDay('lunchDishes', e.target.value)}
                    placeholder="Ví dụ: Cơm dẻo, Thịt heo rim nước dừa, Canh bí đao nấu tôm"
                    className="w-full px-3 py-2 rounded-xl border border-amber-200/80 dark:border-amber-800 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-400">Gồm cơm, món mặn giàu đạm và canh rau mát</p>
                </div>

                {/* 4. Bữa Xế */}
                <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 space-y-2">
                  <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-bold text-xs">
                    <Cookie className="w-4 h-4 text-purple-600" />
                    <span>4. Bữa xế chiều (Afternoon Snack)</span>
                  </div>
                  <input
                    type="text"
                    value={currentDayState.afternoonSnackDishes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentDay('afternoonSnackDishes', e.target.value)}
                    placeholder="Ví dụ: Sữa chua hoa quả dầm, Bánh bông lan"
                    className="w-full px-3 py-2 rounded-xl border border-purple-200/80 dark:border-purple-800 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[10px] text-slate-400">Sữa chua, bánh nhẹ hoặc trái cây tươi chín</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Ghi chú dinh dưỡng &amp; Dị ứng cho tuần này
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Ví dụ: Tuần này sử dụng hoàn toàn thực phẩm hữu cơ. Lớp Nhà trẻ dùng cá hồi xay nhuyễn."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2.5">
            {/* Draft button */}
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={() => handleSave('DRAFT')}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu dự thảo</span>
            </button>

            {/* Publish button */}
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={() => handleSave('PUBLISHED')}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  <span>Ban hành thực đơn</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

