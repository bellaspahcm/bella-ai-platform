'use client';

import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PreschoolSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  wrapperClassName?: string;
  icon?: React.ReactNode;
}

/**
 * PreschoolSelect Component
 * 
 * Styled specifically to match PremiumSelect aesthetic:
 * - Rounded-2xl pill architecture with smooth transition
 * - White/slate-900 background with subtle border and elevation
 * - Custom animated Lucide ChevronDown indicator
 * - Focus rings matching the brand theme
 * - Native semantic <select> for 100% accessibility, mobile UX & Jest test compatibility
 */
export const PreschoolSelect = forwardRef<HTMLSelectElement, PreschoolSelectProps>(
  ({ label, className, wrapperClassName, icon, children, disabled, ...props }, ref) => {
    return (
      <div className={cn('relative inline-flex items-center min-w-0 max-w-full', wrapperClassName)}>
        {icon && (
          <div className="absolute left-3.5 pointer-events-none text-slate-400 flex items-center justify-center">
            {icon}
          </div>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full appearance-none rounded-2xl border text-xs font-semibold transition-all duration-200 outline-none',
            'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700/80',
            'text-slate-800 dark:text-slate-100 shadow-2xs hover:shadow-xs',
            'focus:border-primary/60 focus:ring-3 focus:ring-primary/10',
            icon ? 'pl-9 pr-9 py-2.5' : 'pl-4 pr-9 py-2.5',
            disabled
              ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50'
              : 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'w-4 h-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200',
            disabled ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 group-hover:text-slate-600'
          )}
          aria-hidden="true"
        />
      </div>
    );
  }
);

PreschoolSelect.displayName = 'PreschoolSelect';
export default PreschoolSelect;
