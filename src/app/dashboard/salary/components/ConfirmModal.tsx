'use client';

import { motion } from 'framer-motion';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  isDanger = false,
  isLoading = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        data-testid="salary-confirm-modal"
        className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-2xl sm:rounded-[32px]"
      >
        <div className="max-h-[calc(92vh-6.5rem)] overflow-y-auto p-5 sm:p-8">
          <div className="mb-5 flex items-center gap-4 sm:mb-6">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isDanger ? "bg-rose-50 text-rose-600" : "bg-primary/10 text-primary"
            )}>
              {isDanger ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-none">{title}</h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mt-1.5">
                Yêu cầu xác nhận
              </span>
            </div>
          </div>
          <p className="text-slate-600 text-sm font-bold leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:p-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            data-testid="salary-confirm-modal-submit"
            className={cn(
              "flex-1 py-4 font-black rounded-2xl transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2",
              isDanger 
                ? "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-100 dark:shadow-none"
                : "bg-primary text-primary-foreground hover:bg-primary-hover shadow-lg shadow-primary/20 dark:shadow-none"
            )}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
