'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  getTenantSpecialtyOptions,
  type TenantSpecialtyKey,
} from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { cn } from '@/lib/utils';

export type KtvSpecialty = TenantSpecialtyKey;

type SpecialtyOption = {
  id: KtvSpecialty;
  label: string;
  icon: ReactNode;
};

type BookingsSpecialtyFilterProps = {
  value: KtvSpecialty;
  isOpen: boolean;
  moduleKey: TenantModuleKey;
  onOpenChange: (isOpen: boolean) => void;
  onValueChange: (value: KtvSpecialty) => void;
};

const specialtyIconClass: Record<KtvSpecialty, string> = {
  all: '',
  combo: 'text-rose-400',
  baby: 'text-purple-400',
  pregnancy: 'text-indigo-400',
  lactation: 'text-emerald-400',
  facial: 'text-rose-400',
  body: 'text-purple-400',
  laser: 'text-indigo-400',
  relaxation: 'text-emerald-400',
};

const softFilterButtonClass =
  'border-transparent bg-white/90 shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[inset_0_1px_4px_rgba(15,23,42,0.1),0_3px_10px_rgba(15,23,42,0.05)] focus-visible:ring-2 focus-visible:ring-primary/15';

function buildSpecialties(moduleKey: TenantModuleKey): SpecialtyOption[] {
  return getTenantSpecialtyOptions(moduleKey).map((specialty) => ({
    ...specialty,
    icon: specialty.id === 'all'
      ? <Users className="w-4 h-4" />
      : <Briefcase className={cn('w-4 h-4', specialtyIconClass[specialty.id])} />,
  }));
}

function scrollTimelineBody(left: number) {
  const body = document.getElementById('timeline-body');
  if (body) body.scrollBy({ left, behavior: 'smooth' });
}

export function BookingsSpecialtyFilter({
  value,
  isOpen,
  moduleKey,
  onOpenChange,
  onValueChange,
}: BookingsSpecialtyFilterProps) {
  const specialties = buildSpecialties(moduleKey);
  const currentSpec = specialties.find((specialty) => specialty.id === value) || specialties[0];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none">
      <div className="block sm:hidden w-full relative">
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all duration-300 text-slate-800 active:scale-[0.98] outline-none",
            softFilterButtonClass,
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {currentSpec.icon}
            <span className="text-xs font-black uppercase tracking-wider truncate">
              {currentSpec.label}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0',
              isOpen && 'rotate-180 text-primary',
            )}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden py-2"
              >
                {specialties.map((specialty) => {
                  const isActive = value === specialty.id;

                  return (
                    <button
                      key={specialty.id}
                      type="button"
                      onClick={() => {
                        onValueChange(specialty.id);
                        onOpenChange(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-5 py-3 text-left transition-colors',
                        isActive
                          ? 'bg-rose-50/50 text-primary font-black'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      {specialty.icon}
                      <span className="text-xs font-bold uppercase tracking-wider truncate">
                        {specialty.label}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="hidden sm:flex items-center gap-2 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 w-full sm:w-auto overflow-x-auto no-scrollbar flex-nowrap py-1">
        {specialties.map((specialty) => {
          const isActive = value === specialty.id;

          return (
            <button
              key={specialty.id}
              type="button"
              onClick={() => onValueChange(specialty.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {specialty.icon}
              <span>{specialty.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollTimelineBody(-240)}
          className="p-2.5 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollTimelineBody(240)}
          className="p-2.5 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-slate-500 hover:text-slate-800"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
