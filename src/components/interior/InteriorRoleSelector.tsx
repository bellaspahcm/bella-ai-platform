'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, ChevronDown, Check, RotateCcw, Sparkles } from 'lucide-react';
import {
  INTERIOR_ROLES,
  getInteriorRoleDisplayName,
  getSimulatedInteriorRole,
  setSimulatedInteriorRole,
  INTERIOR_ROLE_CHANGE_EVENT,
  type InteriorRoleKey,
} from '@/products/bella-interior/lib/interior-rbac-navigation';

interface InteriorRoleSelectorProps {
  enabled: boolean;
  className?: string;
}

export function InteriorRoleSelector({ enabled, className = '' }: InteriorRoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [simulatedRole, setSimulatedRoleState] = useState<InteriorRoleKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    setSimulatedRoleState(getSimulatedInteriorRole());
    const handleRoleChange = (e: Event) => {
      const customEvt = e as CustomEvent<{ role: InteriorRoleKey | null }>;
      setSimulatedRoleState(customEvt.detail?.role ?? null);
    };
    window.addEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleChange);
    return () => window.removeEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleChange);
  }, [enabled]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!enabled) return null;

  const currentRoleName = simulatedRole
    ? getInteriorRoleDisplayName(simulatedRole)
    : 'Vai trò hiện tại';

  return (
    <div className={`px-3 mb-2 relative z-30 ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
          simulatedRole
            ? 'bg-amber-500/15 border-amber-400/60 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400/30'
            : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900'
        }`}
        title="Bấm để chuyển đổi góc nhìn vai trò trong hệ thống"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Eye className={`w-3.5 h-3.5 shrink-0 ${simulatedRole ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
          <div className="text-left truncate">
            <span className="block text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold leading-none mb-0.5">
              Góc nhìn vai trò
            </span>
            <span className="block text-xs font-bold truncate leading-tight">
              {currentRoleName}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 top-full mt-1.5 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="p-2.5 px-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold text-[11px] text-slate-900 dark:text-white">
                Chọn góc nhìn RBAC
              </span>
            </div>
            {simulatedRole && (
              <button
                type="button"
                onClick={() => {
                  setSimulatedInteriorRole(null);
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Đặt lại
              </button>
            )}
          </div>

          {/* Role list */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
            {INTERIOR_ROLES.map((r) => {
              const isSelected = simulatedRole
                ? simulatedRole === r.roleKey
                : false;

              return (
                <button
                  key={r.roleKey}
                  type="button"
                  onClick={() => {
                    setSimulatedInteriorRole(r.roleKey);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-amber-800 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                        {r.displayName}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {r.badgeLabel}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="p-2 px-3 bg-slate-50/60 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Chỉ xem trước menu; quyền thực tế không đổi</span>
            {simulatedRole && (
              <span className="text-amber-600 dark:text-amber-400 font-bold">Đang mô phỏng</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

