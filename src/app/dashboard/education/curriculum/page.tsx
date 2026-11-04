'use client';

/**
 * BELLA PRESCHOOL OS — CURRICULUM, LESSON PLANS & SUBJECTS MANAGEMENT CENTER
 *
 * Comprehensive educational management center for preschool administrators and educators.
 * Provides granular tracking of curriculum frameworks, 5 developmental subject domains,
 * and weekly lesson plans conforming to MOET GDMN standards.
 *
 * Canonical Source of Truth: PostgreSQL tables `edu_curriculums` & `edu_lesson_plans`.
 *
 * @module src/app/dashboard/education/curriculum/page
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  Layers,
  ChevronRight,
  ChevronDown,
  Edit,
  Trash2,
  Award,
  BookMarked,
  GraduationCap,
  Heart,
  Activity,
  Compass,
  Palette,
  Users,
  Search,
} from 'lucide-react';
import { PreschoolSelect } from '@/components/ui/PreschoolSelect';
import LessonPlanEditorModal from './LessonPlanEditorModal';
import type {
  LessonPlanDTO,
  CurriculumDTO,
  SubjectItemDTO,
  CurriculumAgeGroup,
  LessonPlanStatus,
} from '@/products/bella-education/learning-development/curriculum/curriculum.contract';

type ActiveTab = 'plans' | 'curriculums' | 'subjects';

const DOMAIN_COLOR_MAP: Readonly<Record<string, { bg: string; text: string; border: string; label: string }>> = {
  NHAN_THUC: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    label: 'Nhận Thức & Toán',
  },
  THE_CHAT: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    label: 'Phát Triển Thể Chất',
  },
  NGON_NGU: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    label: 'Ngôn Ngữ & Văn Học',
  },
  THAM_MY: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    label: 'Thẩm Mỹ & Nghệ Thuật',
  },
  TINH_CAM_XH: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    label: 'Tình Cảm & KN Xã Hội',
  },
  TIENG_ANH: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    label: 'Tiếng Anh Mầm Non',
  },
  STEAM: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    label: 'STEAM Sáng Tạo',
  },
};

const STANDARD_DEVELOPMENTAL_DOMAINS: ReadonlyArray<{
  code: string;
  name: string;
  domain: string;
  weeklyPeriods: number;
  description: string;
  color: string;
  focusAge: string;
}> = [
  {
    code: 'TC_VAN_DONG',
    name: 'Phát triển Thể chất (Vận động cơ bản & Sức khỏe)',
    domain: 'THE_CHAT',
    weeklyPeriods: 4,
    description: 'Rèn luyện các nhóm cơ lớn nhỏ qua bài tập phát triển chung, kỹ năng bò, trườn, bật xa, tung bóng và hình thành thói quen vệ sinh tự lập.',
    color: 'emerald',
    focusAge: 'Toàn trường (18 tháng - 6 tuổi)',
  },
  {
    code: 'NT_KHOA_HOC',
    name: 'Phát triển Nhận thức (Khám phá Khoa học - Xã hội & Toán)',
    domain: 'NHAN_THUC',
    weeklyPeriods: 5,
    description: 'Hình thành biểu tượng ban đầu về toán học (số đếm, hình khối, không gian) và khám phá quy luật tự nhiên, thế giới động - thực vật.',
    color: 'purple',
    focusAge: 'Toàn trường (3 - 6 tuổi)',
  },
  {
    code: 'NN_VAN_HOC',
    name: 'Phát triển Ngôn ngữ (Kể chuyện, Thơ ca & Tiền đọc viết)',
    domain: 'NGON_NGU',
    weeklyPeriods: 4,
    description: 'Phát triển vốn từ vựng phong phú, khả năng biểu đạt cảm xúc, ghi nhớ truyện thơ và nhận diện 29 chữ cái tiếng Việt.',
    color: 'blue',
    focusAge: 'Toàn trường (18 tháng - 6 tuổi)',
  },
  {
    code: 'TM_AM_NHAC',
    name: 'Phát triển Thẩm mỹ (Âm nhạc, Vận động & Tạo hình nghệ thuật)',
    domain: 'THAM_MY',
    weeklyPeriods: 4,
    description: 'Cảm thụ giai điệu, ca hát, múa nhịp nhàng và phát triển óc sáng tạo qua hội họa (vẽ tranh, tô màu, nặn đất sét, xé dán).',
    color: 'rose',
    focusAge: 'Toàn trường (2 - 6 tuổi)',
  },
  {
    code: 'XH_KY_NANG',
    name: 'Phát triển Tình cảm & Kỹ năng Xã hội (Giáo dục cảm xúc SEL)',
    domain: 'TINH_CAM_XH',
    weeklyPeriods: 3,
    description: 'Hình thành nhân cách yêu thương, biết nói lời cảm ơn - xin lỗi, chia sẻ đồ chơi cùng bạn bè và kiểm soát cảm xúc tích cực.',
    color: 'amber',
    focusAge: 'Toàn trường (18 tháng - 6 tuổi)',
  },
  {
    code: 'TA_PHONICS',
    name: 'Tiếng Anh Hội Nhập (Preschool Phonics & Nursery Rhymes)',
    domain: 'TIENG_ANH',
    weeklyPeriods: 3,
    description: 'Tắm ngôn ngữ tự nhiên thông qua bài hát, truyện tranh tương tác và giao tiếp chuẩn phản xạ cùng giáo viên bản ngữ.',
    color: 'indigo',
    focusAge: 'Khối Mầm, Chồi, Lá (3 - 6 tuổi)',
  },
  {
    code: 'STEAM_PROJECT',
    name: 'Dự án STEAM & Trải Nghiệm Khám Phá Khoa Học',
    domain: 'STEAM',
    weeklyPeriods: 2,
    description: 'Thực hành các thí nghiệm vui (sự biến đổi màu sắc, núi lửa phun trào) và chế tạo mô hình sáng tạo từ vật liệu tái chế an toàn.',
    color: 'teal',
    focusAge: 'Khối Chồi, Lá (4 - 6 tuổi)',
  },
];

function CurriculumManagementContent() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>('plans');

  // Filters
  const [selectedWeek, setSelectedWeek] = useState<number>(44);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<CurriculumAgeGroup>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Data states
  const [curriculums, setCurriculums] = useState<CurriculumDTO[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlanDTO[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Expand States
  const [isEditorModalOpen, setIsEditorModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<LessonPlanDTO | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Fetch Courses Catalog for Dropdown
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/education/courses?view=catalog', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.courses)) {
          setCourses(
            data.courses.map((c: { id: string; title: string }) => ({
              id: c.id,
              name: c.title,
            }))
          );
        }
      }
    } catch {
      // Non-fatal fallback
    }
  }, []);

  // Fetch Curriculum Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (selectedWeek) queryParams.set('weekNumber', selectedWeek.toString());
      if (selectedYear) queryParams.set('year', selectedYear.toString());
      if (selectedDomain !== 'ALL') queryParams.set('subjectDomain', selectedDomain);
      if (selectedAgeGroup !== 'ALL') queryParams.set('ageGroup', selectedAgeGroup);
      if (selectedCourseId) queryParams.set('courseId', selectedCourseId);

      const res = await fetch(`/api/education/curriculum?${queryParams.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('FETCH_FAILED');

      const data = await res.json();
      if (data.success) {
        setCurriculums(data.curriculums || []);
        setLessonPlans(data.lessonPlans || []);
      } else {
        throw new Error(data.error || 'LOAD_ERROR');
      }
    } catch {
      setError('Không thể tải dữ liệu giáo trình và giáo án. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedWeek, selectedYear, selectedDomain, selectedAgeGroup, selectedCourseId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Modal for Create
  const handleOpenCreateModal = useCallback(() => {
    setEditingPlan(null);
    setIsEditorModalOpen(true);
  }, []);

  // Open Modal for Edit
  const handleOpenEditModal = useCallback((plan: LessonPlanDTO) => {
    setEditingPlan(plan);
    setIsEditorModalOpen(true);
  }, []);

  // Callback after Save
  const handleSavedPlan = useCallback((savedPlan: LessonPlanDTO) => {
    setFeedbackToast(`Đã lưu thành công giáo án: "${savedPlan.title}"`);
    fetchData();
    setTimeout(() => setFeedbackToast(null), 4000);
  }, [fetchData]);

  // Delete Plan Handler
  const handleDeletePlan = useCallback(
    async (id: string, title: string) => {
      if (!window.confirm(`Bạn có chắc chắn muốn xóa giáo án "${title}"?`)) return;
      try {
        const res = await fetch(`/api/education/curriculum?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          setFeedbackToast(`Đã xóa giáo án "${title}"`);
          fetchData();
          setTimeout(() => setFeedbackToast(null), 3000);
        } else {
          alert('Không thể xóa giáo án: ' + (data.error || 'Lỗi không xác định'));
        }
      } catch {
        alert('Lỗi kết nối khi xóa giáo án.');
      }
    },
    [fetchData]
  );

  // Computed metrics
  const totalPlans = lessonPlans.length;
  const approvedPlansCount = useMemo(
    () => lessonPlans.filter((p) => p.status === 'APPROVED').length,
    [lessonPlans]
  );
  const approvalRate = totalPlans > 0 ? Math.round((approvedPlansCount / totalPlans) * 100) : 100;
  const uniqueDomainsCount = useMemo(
    () => new Set(lessonPlans.map((p) => p.subjectDomain)).size,
    [lessonPlans]
  );

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/education"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
            title="Quay lại Tổng quan"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                BELLA EDUCATION OS
              </span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-semibold text-slate-600">Học Tập {'&'} Giảng Dạy</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
              <BookOpen className="w-7 h-7 text-emerald-600" />
              Quản Lý Giáo Trình {'&'} Giáo Án
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 shadow-emerald-200"
          >
            <Plus className="w-4 h-4" />
            + Soạn Giáo Án Mới
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-md animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Giáo Án Trong Tuần</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {isLoading ? '...' : `${totalPlans} bài`}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">
              Tuần {selectedWeek} / {selectedYear}
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Tỷ Lệ Phê Duyệt</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {isLoading ? '...' : `${approvalRate}%`}
            </div>
            <span className="text-[11px] text-blue-600 font-semibold">
              {approvedPlansCount}/{totalPlans} bài đã duyệt
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Lĩnh Vực Giảng Dạy</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {isLoading ? '...' : `${uniqueDomainsCount || 5} lĩnh vực`}
            </div>
            <span className="text-[11px] text-purple-600 font-semibold">
              Đồng bộ 5 nhánh chuẩn GDMN
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Khung Giáo Trình</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {isLoading ? '...' : `${curriculums.length || 3} chương trình`}
            </div>
            <span className="text-[11px] text-amber-700 font-semibold">
              Bộ GD{'&'}ĐT, Montessori, STEAM
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'plans'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Kế Hoạch Giáo Án Tuần
          <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded-full font-semibold">
            {lessonPlans.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('curriculums')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'curriculums'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Khung Giáo Trình Viện Mầm Non
          <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded-full font-semibold">
            {curriculums.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'subjects'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Môn Học {'&'} Lĩnh Vực Phát Triển (5 Nhánh Chuẩn)
        </button>
      </div>

      {/* Filter Section (Active for Plans Tab) */}
      {activeTab === 'plans' && (
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              Bộ lọc tìm kiếm giáo án
            </span>
            <button
              onClick={() => {
                setSelectedWeek(44);
                setSelectedYear(2026);
                setSelectedDomain('ALL');
                setSelectedAgeGroup('ALL');
                setSelectedCourseId('');
              }}
              className="text-xs text-emerald-600 hover:underline font-semibold"
            >
              Đặt lại mặc định
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Tuần Học
              </label>
              <PreschoolSelect
                value={selectedWeek.toString()}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedWeek(parseInt(e.target.value, 10) || 44)
                }
              >
                {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w.toString()}>
                    Tuần {w}
                  </option>
                ))}
              </PreschoolSelect>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Năm Học
              </label>
              <PreschoolSelect
                value={selectedYear.toString()}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedYear(parseInt(e.target.value, 10) || 2026)
                }
              >
                <option value="2025">2025 - 2026</option>
                <option value="2026">2026 - 2027</option>
                <option value="2027">2027 - 2028</option>
              </PreschoolSelect>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Lĩnh Vực Phát Triển
              </label>
              <PreschoolSelect
                value={selectedDomain}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedDomain(e.target.value)}
              >
                <option value="ALL">Tất cả các lĩnh vực</option>
                <option value="NHAN_THUC">Nhận Thức {'&'} Toán</option>
                <option value="THE_CHAT">Phát Triển Thể Chất</option>
                <option value="NGON_NGU">Ngôn Ngữ {'&'} Văn Học</option>
                <option value="THAM_MY">Thẩm Mỹ {'&'} Nghệ Thuật</option>
                <option value="TINH_CAM_XH">Tình Cảm {'&'} KN Xã Hội</option>
                <option value="TIENG_ANH">Tiếng Anh Mầm Non</option>
                <option value="STEAM">STEAM Trải Nghiệm</option>
              </PreschoolSelect>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Khối Tuổi Trẻ
              </label>
              <PreschoolSelect
                value={selectedAgeGroup}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedAgeGroup(e.target.value as CurriculumAgeGroup)
                }
              >
                <option value="ALL">Tất cả các khối</option>
                <option value="NURSERY">Nhà trẻ (18 - 36 tháng)</option>
                <option value="TODDLER">Mầm (3 - 4 tuổi)</option>
                <option value="KINDY_1">Chồi (4 - 5 tuổi)</option>
                <option value="KINDY_2">Lá (5 - 6 tuổi)</option>
              </PreschoolSelect>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Lớp Học Áp Dụng
              </label>
              <PreschoolSelect
                value={selectedCourseId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCourseId(e.target.value)}
              >
                <option value="">Tất cả các lớp</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </PreschoolSelect>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm font-semibold">Đang tải dữ liệu giáo trình {'&'} giáo án...</span>
        </div>
      ) : error ? (
        <div className="p-8 flex flex-col items-center justify-center bg-white border border-rose-200 rounded-2xl shadow-sm text-rose-600 space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            Thử Lại
          </button>
        </div>
      ) : (
        <>
          {/* TAB 1: LESSON PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-4">
              {lessonPlans.length === 0 ? (
                <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl shadow-sm space-y-3">
                  <div className="w-12 h-12 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Chưa có giáo án nào trong tuần {selectedWeek}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Kế hoạch bài giảng cho tuần học này chưa được khởi tạo. Hãy bấm nút dưới đây để
                    soạn giáo án mới hoặc nạp giáo án mẫu chuẩn Bộ GD{'&'}ĐT.
                  </p>
                  <button
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    + Soạn Giáo Án Ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {lessonPlans.map((plan) => {
                    const domainCfg = DOMAIN_COLOR_MAP[plan.subjectDomain] || {
                      bg: 'bg-slate-50',
                      text: 'text-slate-700',
                      border: 'border-slate-200',
                      label: plan.subjectDomain,
                    };
                    const isExpanded = expandedPlanId === plan.id;

                    return (
                      <div
                        key={plan.id}
                        className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl shadow-sm transition-all overflow-hidden"
                      >
                        {/* Header bar */}
                        <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100">
                          <div className="flex items-start gap-3.5 flex-1">
                            {/* Date box */}
                            <div className="flex flex-col items-center justify-center w-14 h-14 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 shrink-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {new Date(plan.plannedDate).toLocaleDateString('vi-VN', {
                                  weekday: 'short',
                                })}
                              </span>
                              <span className="text-lg font-black leading-none mt-0.5">
                                {new Date(plan.plannedDate).getDate()}
                              </span>
                              <span className="text-[9px] text-emerald-600">
                                Thg {new Date(plan.plannedDate).getMonth() + 1}
                              </span>
                            </div>

                            {/* Plan Titles & Domain Badges */}
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${domainCfg.bg} ${domainCfg.text} ${domainCfg.border}`}
                                >
                                  {domainCfg.label}
                                </span>

                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-md">
                                  Chủ đề: {plan.theme}
                                </span>

                                {plan.courseName ? (
                                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                                    {plan.courseName}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-500 rounded-md">
                                    Toàn khối
                                  </span>
                                )}

                                <span
                                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                                    plan.status === 'APPROVED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {plan.status === 'APPROVED' ? 'ĐÃ PHÊ DUYỆT' : 'DỰ THẢO'}
                                </span>
                              </div>

                              <h3 className="text-base font-bold text-slate-900">{plan.title}</h3>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                            <button
                              onClick={() =>
                                setExpandedPlanId(isExpanded ? null : plan.id)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              {isExpanded ? 'Thu gọn' : 'Chi tiết tiến trình'}
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(plan)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Chỉnh sửa giáo án"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeletePlan(plan.id, plan.title)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Xóa giáo án"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Objectives Summary Preview */}
                        <div className="p-4 bg-slate-50/60 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="space-y-1">
                            <span className="font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Kiến Thức
                            </span>
                            <p className="text-slate-600 line-clamp-2">
                              {plan.objectives.knowledge || 'Chưa thiết lập'}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <span className="font-bold text-blue-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              Kỹ Năng
                            </span>
                            <p className="text-slate-600 line-clamp-2">
                              {plan.objectives.skills || 'Chưa thiết lập'}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <span className="font-bold text-amber-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                              Thái Độ
                            </span>
                            <p className="text-slate-600 line-clamp-2">
                              {plan.objectives.attitude || 'Chưa thiết lập'}
                            </p>
                          </div>
                        </div>

                        {/* Expanded Details: Activity Steps & Materials */}
                        {isExpanded && (
                          <div className="p-5 border-t border-slate-200 space-y-4 bg-white">
                            {plan.materials && (
                              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1">
                                <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                                  Học cụ {'&'} Đồ dùng chuẩn bị:
                                </span>
                                <p className="text-xs text-amber-900/90 whitespace-pre-line">
                                  {plan.materials}
                                </p>
                              </div>
                            )}

                            <div>
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-emerald-600" />
                                Tiến trình tổ chức hoạt động ({plan.activitySteps.length} bước)
                              </h4>

                              {plan.activitySteps.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">
                                  Chưa ghi nhận các bước chi tiết.
                                </p>
                              ) : (
                                <div className="space-y-2.5">
                                  {plan.activitySteps.map((step) => (
                                    <div
                                      key={step.stepNumber}
                                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between font-bold text-slate-800">
                                        <div className="flex items-center gap-2">
                                          <span className="w-5 h-5 flex items-center justify-center bg-emerald-600 text-white rounded-full text-[10px]">
                                            {step.stepNumber}
                                          </span>
                                          <span>{step.stepName}</span>
                                        </div>
                                        <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                                          {step.durationMinutes} phút
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                        <div>
                                          <span className="font-semibold text-slate-700 block mb-0.5">
                                            Hoạt động của Cô:
                                          </span>
                                          <p className="text-slate-600">{step.teacherAction}</p>
                                        </div>
                                        <div>
                                          <span className="font-semibold text-slate-700 block mb-0.5">
                                            Hoạt động của Trẻ:
                                          </span>
                                          <p className="text-slate-600">{step.childrenAction}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {plan.teacherNotes && (
                              <div className="text-xs text-slate-500 pt-1">
                                <span className="font-semibold text-slate-700">Lưu ý giáo viên:</span>{' '}
                                {plan.teacherNotes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CURRICULUMS */}
          {activeTab === 'curriculums' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {curriculums.map((curr) => (
                <div
                  key={curr.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-100 text-emerald-800">
                        {curr.code}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{curr.academicYear}</span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 leading-snug">{curr.name}</h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {curr.description || 'Khung giáo dục mầm non tích hợp toàn diện.'}
                    </p>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Khối áp dụng:</span>
                        <span className="font-semibold text-slate-800">{curr.ageGroup}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Thời lượng chuẩn:</span>
                        <span className="font-semibold text-emerald-700">
                          {curr.totalWeeks} tuần học / năm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số môn {'&'} Lĩnh vực:</span>
                        <span className="font-semibold text-slate-800">
                          {curr.subjects.length} bộ môn
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Các môn học chính:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {curr.subjects.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded font-medium"
                          >
                            {s.name} ({s.weeklyPeriods}t)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Đang áp dụng chính thức
                    </span>
                    <button
                      onClick={() => {
                        setSelectedDomain('ALL');
                        setActiveTab('plans');
                      }}
                      className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                    >
                      Xem giáo án <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: SUBJECTS & DEVELOPMENTAL DOMAINS */}
          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl">
                <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-emerald-700" />
                  Chuẩn 5 Lĩnh Vực Phát Triển Toàn Diện Theo Thông Tư Bộ GD{'&'}ĐT
                </h3>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Chương trình Giáo dục Mầm non mới hướng tới sự phát triển toàn diện của trẻ về thể
                  chất, nhận thức, ngôn ngữ, thẩm mỹ và tình cảm - kỹ năng xã hội, kết hợp trải
                  nghiệm STEAM và tiếng Anh hội nhập.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {STANDARD_DEVELOPMENTAL_DOMAINS.map((domain) => (
                  <div
                    key={domain.code}
                    className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700">
                          {domain.code}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {domain.weeklyPeriods} tiết / tuần
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {domain.name}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {domain.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Độ tuổi:</span>
                      <span className="font-semibold text-slate-800">{domain.focusAge}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lesson Plan Editor Modal */}
      <LessonPlanEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        onSaved={handleSavedPlan}
        initialPlan={editingPlan}
        curriculums={curriculums}
        courses={courses}
        defaultWeek={selectedWeek}
        defaultYear={selectedYear}
      />
    </div>
  );
}

export default function CurriculumManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <CurriculumManagementContent />
    </Suspense>
  );
}

