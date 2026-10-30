'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { AlertCircle, Loader2, Save, X } from 'lucide-react';
import type { Student360ProfileData } from '@/app/api/education/enrollments/student-360.service';

interface StudentEditModalProps {
  readonly profile: Student360ProfileData;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaved: (updated: Student360ProfileData) => void;
}

export default function StudentEditModal({
  profile,
  isOpen,
  onClose,
  onSaved,
}: StudentEditModalProps): ReactElement | null {
  const [name, setName] = useState(profile.name);
  const [dob, setDob] = useState(profile.dob ? profile.dob.slice(0, 10) : '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>(
    profile.gender === 'male' || profile.gender === 'female' || profile.gender === 'other'
      ? profile.gender
      : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Họ và tên không được để trống.');
      return;
    }
    if (trimmedName.length > 120) {
      setError('Họ và tên không được vượt quá 120 ký tự.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/education/enrollments/${encodeURIComponent(profile.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          dob: dob || null,
          gender: gender || null,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        profile?: Student360ProfileData;
      } | null;

      if (!response.ok || !body?.success || !body.profile) {
        if (response.status === 403) {
          throw new Error('Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa hồ sơ trẻ.');
        }
        throw new Error(body?.error || 'Không thể cập nhật hồ sơ. Vui lòng thử lại.');
      }

      onSaved(body.profile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 id="student-edit-title" className="text-lg font-black text-slate-900 dark:text-white">
              Chỉnh Sửa Hồ Sơ Trẻ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mã hồ sơ: <strong className="text-emerald-700 dark:text-emerald-400">{profile.id}</strong> (Chỉ Quản trị viên)
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="student-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Họ và tên của bé <span className="text-rose-500">*</span>
            </label>
            <input
              id="student-name"
              type="text"
              required
              disabled={submitting}
              maxLength={120}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Nguyễn Đăng Khôi"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-dob" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ngày sinh
              </label>
              <input
                id="student-dob"
                type="date"
                disabled={submitting}
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="student-gender" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Giới tính
              </label>
              <select
                id="student-gender"
                disabled={submitting}
                value={gender}
                onChange={e => setGender(e.target.value as 'male' | 'female' | 'other' | '')}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Chưa ghi nhận</option>
                <option value="male">Bé trai</option>
                <option value="female">Bé gái</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu…</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

