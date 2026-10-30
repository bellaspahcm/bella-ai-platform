'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Pill, Activity, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AllergyRecord {
  id: string;
  allergen_id: string;
  severity: string;
  reaction_notes: string | null;
  status: string;
  created_at: string;
  allergen?: {
    id?: string;
    name: string;
    description?: string | null;
  } | null;
}

interface MedicationRecord {
  id: string;
  medication_name: string;
  authorized_dose: string;
  authorized_at: string;
  valid_from: string;
  valid_until: string;
  status: string;
}

interface IncidentRecord {
  id: string;
  incident_time: string;
  incident_type: string;
  severity: string;
  description: string;
  action_taken: string;
  status: string;
  escalation_required?: boolean;
}

interface StudentHealthProps {
  studentId: string;
  studentName?: string;
}

export default function StudentHealth({ studentId, studentName }: StudentHealthProps) {
  const [allergies, setAllergies] = useState<AllergyRecord[]>([]);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/education/enrollments/${studentId}/health`);
      if (!res.ok) {
        throw new Error('FAILED_TO_LOAD');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'LOAD_ERROR');
      }
      setAllergies(data.allergies ?? []);
      setMedications(data.medications ?? []);
      setIncidents(data.incidents ?? []);
    } catch {
      setError('Không thể tải thông tin sức khỏe của học sinh.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const isEmpty = allergies.length === 0 && medications.length === 0 && incidents.length === 0;

  return (
    <section
      role="tabpanel"
      id="health-tabpanel"
      aria-label={`Hồ sơ sức khỏe & dinh dưỡng của ${studentName || 'học sinh'}`}
      className="space-y-6"
    >
      {loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Đang tải thông tin sức khỏe và dinh dưỡng...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-3" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchHealth}
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
            Chưa có ghi nhận dị ứng, đơn thuốc hay sự cố y tế
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Học sinh hiện không có tiền sử dị ứng thực phẩm, không có yêu cầu dùng thuốc chỉ định và không có sự cố sức khỏe nào trong hệ thống.
          </p>
        </div>
      )}

      {!loading && !error && !isEmpty && (
        <div className="space-y-6">
          {/* 1. Dị ứng */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tiền Sử Dị Ứng ({allergies.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cảnh báo an toàn bữa ăn và chế độ dinh dưỡng bán trú
                </p>
              </div>
            </div>

            {allergies.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Không có dị ứng nào được ghi nhận.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-900/40 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {allergy.allergen?.name || 'Chất gây dị ứng'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        {allergy.severity}
                      </span>
                    </div>
                    {allergy.reaction_notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        {allergy.reaction_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Đơn thuốc */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Ủy Quyền Cho Trẻ Uống Thuốc ({medications.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đơn dặn dò thuốc có xác thực của phụ huynh / người giám hộ
                </p>
              </div>
            </div>

            {medications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Không có chỉ định dùng thuốc nào đang kích hoạt.</p>
            ) : (
              <div className="space-y-3">
                {medications.map((med) => (
                  <div
                    key={med.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {med.medication_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {med.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Liều dùng: <strong className="text-slate-800 dark:text-slate-200">{med.authorized_dose}</strong>
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                      Hiệu lực: {med.valid_from ? new Date(med.valid_from).toLocaleDateString('vi-VN') : '—'} đến{' '}
                      {med.valid_until ? new Date(med.valid_until).toLocaleDateString('vi-VN') : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Sự cố y tế */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Nhật Ký Sức Khỏe & Sự Cố Y Tế ({incidents.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ghi nhận xử lý sơ cấp cứu hoặc theo dõi triệu chứng tại trường
                </p>
              </div>
            </div>

            {incidents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Không có sự cố y tế nào được ghi nhận.</p>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {inc.incident_type}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          Mức độ: {inc.severity}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {inc.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {inc.incident_time ? new Date(inc.incident_time).toLocaleString('vi-VN') : '—'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 mb-1">{inc.description}</p>
                    {inc.action_taken && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <strong className="text-slate-600 dark:text-slate-300">Xử lý:</strong> {inc.action_taken}
                      </p>
                    )}
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
