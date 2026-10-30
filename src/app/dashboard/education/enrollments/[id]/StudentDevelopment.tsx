'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Award, Compass, RefreshCw, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

interface AssessmentRecord {
  id: string;
  enrollment_id: string;
  score_type: string;
  grade: number;
  weight: number;
  occurred_at: string;
}

interface MilestoneRecord {
  id: string;
  milestone_id: string;
  status: string;
  rationale: string | null;
  is_confirmed: boolean;
  interpreted_at: string | null;
  milestone?: {
    id?: string;
    code: string;
    title: string;
    description?: string | null;
    indicator_statement: string;
    min_age_months?: number | null;
    max_age_months?: number | null;
  } | null;
}

interface StudentDevelopmentProps {
  studentId: string;
  enrollmentId?: string;
  studentName?: string;
}

export default function StudentDevelopment({
  studentId,
  enrollmentId,
  studentName,
}: StudentDevelopmentProps) {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevelopment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = enrollmentId
        ? `/api/education/enrollments/${studentId}/development?enrollment_id=${enrollmentId}`
        : `/api/education/enrollments/${studentId}/development`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('FAILED_TO_LOAD');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'LOAD_ERROR');
      }
      setAssessments(data.assessments ?? []);
      setMilestones(data.milestoneProgress ?? []);
    } catch {
      setError('Không thể tải dữ liệu đánh giá phát triển của học sinh.');
    } finally {
      setLoading(false);
    }
  }, [studentId, enrollmentId]);

  useEffect(() => {
    fetchDevelopment();
  }, [fetchDevelopment]);

  const isEmpty = assessments.length === 0 && milestones.length === 0;

  return (
    <section
      role="tabpanel"
      id="grades-tabpanel"
      aria-label={`Đánh giá phát triển của ${studentName || 'học sinh'}`}
      className="space-y-6"
    >
      {loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Đang tải dữ liệu đánh giá phát triển...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-3" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchDevelopment}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && isEmpty && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
          <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
            Chưa có ghi nhận đánh giá định kỳ hay mốc phát triển
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Học sinh chưa có bài đánh giá định kỳ nào hoặc đang trong thời gian hoàn thiện quan sát mốc phát triển đầu kỳ.
          </p>
        </div>
      )}

      {!loading && !error && !isEmpty && (
        <div className="space-y-6">
          {/* 1. Mốc phát triển lứa tuổi */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600 dark:text-purple-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Mốc Phát Triển Theo Lứa Tuổi ({milestones.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chuẩn phát triển năng lực mầm non: Thể chất, nhận thức, ngôn ngữ {'&'} cảm xúc xã hội
                </p>
              </div>
            </div>

            {milestones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có mốc phát triển nào được ghi nhận.</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                          {item.milestone?.code || 'MILESTONE'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {item.milestone?.title || 'Chỉ số mốc phát triển'}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {item.milestone?.indicator_statement}
                      </p>
                      {item.rationale && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 mt-2">
                          Nhận xét giáo viên: &ldquo;{item.rationale}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {item.status}
                      </span>
                      {item.interpreted_at && (
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.interpreted_at).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Đánh giá học tập & định kỳ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Đánh Giá Hoạt Động {'&'} Điểm Số ({assessments.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bảng tổng hợp kết quả học tập, hoạt động trải nghiệm định kỳ
                </p>
              </div>
            </div>

            {assessments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có bài đánh giá định kỳ nào.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {assessments.map((asm) => (
                  <div
                    key={asm.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          {asm.score_type}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {asm.occurred_at ? new Date(asm.occurred_at).toLocaleDateString('vi-VN') : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {asm.grade}
                      </div>
                      <span className="text-[10px] text-slate-400">Hệ số: {asm.weight}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
