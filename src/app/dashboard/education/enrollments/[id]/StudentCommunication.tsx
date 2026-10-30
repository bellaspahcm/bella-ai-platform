'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BookOpen, Utensils, Moon, MessageSquare, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MealItem {
  meal: string;
  food: string;
  amount: string;
  notes?: string;
}

interface DailyCareRecord {
  id: string;
  session_id: string;
  arrival_status: string;
  arrival_time: string | null;
  morning_condition: string | null;
  meal_records: MealItem[] | null;
  hygiene_records: Array<Record<string, unknown>> | null;
  nap_records: { start_time?: string; end_time?: string; quality?: string } | null;
  health_checks: { temperature?: number; mood?: string } | null;
  created_at: string;
  session?: {
    id?: string;
    date: string;
    status: string;
  } | null;
}

interface CommException {
  id: string;
  exception_type: string;
  severity: string;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface StudentCommunicationProps {
  studentId: string;
  studentName?: string;
}

export default function StudentCommunication({ studentId, studentName }: StudentCommunicationProps) {
  const [dailyCareRecords, setDailyCareRecords] = useState<DailyCareRecord[]>([]);
  const [exceptions, setExceptions] = useState<CommException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/education/enrollments/${studentId}/communications`);
      if (!res.ok) {
        throw new Error('FAILED_TO_LOAD');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'LOAD_ERROR');
      }
      setDailyCareRecords(data.dailyCareRecords ?? []);
      setExceptions(data.exceptions ?? []);
    } catch {
      setError('Không thể tải dữ liệu sổ liên lạc & nhật ký sinh hoạt.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  const isEmpty = dailyCareRecords.length === 0 && exceptions.length === 0;

  return (
    <section
      role="tabpanel"
      id="communication-tabpanel"
      aria-label={`Sổ liên lạc & nhật ký của ${studentName || 'học sinh'}`}
      className="space-y-6"
    >
      {loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Đang tải sổ liên lạc & nhật ký sinh hoạt...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-3" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchCommunications}
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
            Chưa có ghi nhận nhật ký chăm sóc
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Học sinh chưa có nhật ký sinh hoạt (ăn uống, ngủ trưa, vệ sinh) hoặc yêu cầu dặn dò gửi từ phụ huynh.
          </p>
        </div>
      )}

      {!loading && !error && !isEmpty && (
        <div className="space-y-6">
          {/* 1. Nhật ký sinh hoạt gần nhất */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Nhật Ký Chăm Sóc Hàng Ngày ({dailyCareRecords.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chi tiết bữa ăn, giấc ngủ, vệ sinh và tình trạng đón trẻ buổi sáng
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {dailyCareRecords.map((care) => (
                <div
                  key={care.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Ngày {care.session?.date ? new Date(care.session.date).toLocaleDateString('vi-VN') : 'Hôm nay'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {care.arrival_status}
                      </span>
                    </div>
                    {care.arrival_time && (
                      <span className="text-[11px] text-slate-400">
                        Giờ đón: {new Date(care.arrival_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {care.morning_condition && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong>Tình trạng đầu ngày:</strong> {care.morning_condition}
                    </p>
                  )}

                  {care.meal_records && care.meal_records.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                        <Utensils className="w-3.5 h-3.5 text-amber-500" />
                        <span>Bữa ăn trong ngày</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {care.meal_records.map((meal, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">{meal.meal}</span>
                            <span className="text-slate-600 dark:text-slate-400 block">{meal.food}</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{meal.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {care.nap_records && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        Giấc ngủ trưa: {care.nap_records.start_time} - {care.nap_records.end_time} ({care.nap_records.quality})
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Dặn dò từ phụ huynh */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Dặn Dò & Yêu Cầu Từ Phụ Huynh ({exceptions.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Yêu cầu uống thuốc, xin nghỉ học, thay đổi người đưa đón trẻ
                </p>
              </div>
            </div>

            {exceptions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Không có yêu cầu dặn dò nào từ phụ huynh.</p>
            ) : (
              <div className="space-y-3">
                {exceptions.map((exc) => (
                  <div
                    key={exc.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {exc.exception_type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          {exc.status}
                        </span>
                      </div>
                      {exc.resolution_notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Ghi chú: {exc.resolution_notes}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {exc.created_at ? new Date(exc.created_at).toLocaleDateString('vi-VN') : '—'}
                    </span>
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
