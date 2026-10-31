'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useId,
  Children,
  isValidElement,
  type ChangeEvent,
} from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/** Extract {value, label} from <option> children or from props.options array */
interface OptionEntry {
  value: string;
  label: string;
  disabled?: boolean;
}

function parseChildren(children: React.ReactNode): OptionEntry[] {
  const entries: OptionEntry[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as React.ReactElement<{
      value?: string;
      children?: React.ReactNode;
      disabled?: boolean;
    }>;
    if (el.type === 'option') {
      const val = String(el.props.value ?? '');
      const label =
        typeof el.props.children === 'string'
          ? el.props.children
          : String(el.props.children ?? val);
      entries.push({ value: val, label, disabled: el.props.disabled ?? false });
    }
  });
  return entries;
}

export interface PreschoolSelectProps {
  /** Current selected value */
  value: string | number;
  /** Called with a synthetic ChangeEvent so existing code works unchanged */
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  /** <option> children — parsed into the custom dropdown */
  children?: React.ReactNode;
  /** Accessible label for getByRole/getByLabelText in tests */
  'aria-label'?: string;
  /** HTML id for <label htmlFor=…> */
  id?: string;
  disabled?: boolean;
  /** CSS class applied to the trigger button */
  className?: string;
  /** CSS class applied to the outer wrapper div */
  wrapperClassName?: string;
  /** Optional leading icon inside the button */
  icon?: React.ReactNode;
}

/**
 * PreschoolSelect — Custom Premium Popover Dropdown
 *
 * ✅ Renders a beautiful Framer Motion popover (no native OS dropdown)
 * ✅ Keeps a visually hidden <select> for:
 *    – getByRole('combobox') in Jest/RTL
 *    – getByLabelText in Jest/RTL
 *    – fireEvent.change() compatibility
 *    – Accessibility / form semantics
 */
export const PreschoolSelect = React.forwardRef<
  HTMLSelectElement,
  PreschoolSelectProps
>(
  (
    {
      value,
      onChange,
      children,
      'aria-label': ariaLabel,
      id,
      disabled = false,
      className,
      wrapperClassName,
      icon,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenSelectRef = useRef<HTMLSelectElement>(null);
    const listboxId = useId();

    const options = parseChildren(children);
    const stringValue = String(value ?? '');
    const selected = options.find((o) => o.value === stringValue);

    // Combine external ref with internal ref
    const mergeRef = (node: HTMLSelectElement | null) => {
      hiddenSelectRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    // Close on outside click
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close on Escape
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
      if (!onChange) return;
      // Build a synthetic ChangeEvent targeting the hidden select
      const nativeSelect = hiddenSelectRef.current;
      if (nativeSelect) {
        // Update the native select's value, then fire a real change event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value',
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(nativeSelect, optionValue);
        } else {
          nativeSelect.value = optionValue;
        }
        const event = new Event('change', { bubbles: true });
        nativeSelect.dispatchEvent(event);
      } else {
        // Fallback: construct synthetic event manually
        const syntheticEvent = {
          target: { value: optionValue },
          currentTarget: { value: optionValue },
          nativeEvent: new Event('change'),
          bubbles: true,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 0,
          isTrusted: false,
          preventDefault: () => {},
          stopPropagation: () => {},
          stopImmediatePropagation: () => {},
          persist: () => {},
          isDefaultPrevented: () => false,
          isPropagationStopped: () => false,
          type: 'change',
          timeStamp: Date.now(),
        } as unknown as ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
      setIsOpen(false);
    };

    return (
      <div
        className={cn('relative inline-flex flex-col min-w-0 max-w-full', wrapperClassName)}
        ref={containerRef}
      >
        {/* ── Hidden native <select> for Jest / Accessibility ── */}
        <select
          ref={mergeRef}
          id={id}
          aria-label={ariaLabel}
          value={stringValue}
          disabled={disabled}
          onChange={(e) => onChange?.(e)}
          tabIndex={-1}
          aria-hidden={false}
          className="sr-only pointer-events-none absolute opacity-0 w-px h-px overflow-hidden"
          style={{ clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
        >
          {children}
        </select>

        {/* ── Custom Premium Trigger Button ── */}
        <button
          type="button"
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-label={ariaLabel ? `Mở dropdown ${ariaLabel}` : undefined}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={cn(
            'w-full min-w-0 max-w-full flex items-center justify-between gap-2',
            'px-4 rounded-2xl border transition-all duration-300 overflow-hidden',
            'bg-white dark:bg-slate-900',
            'border-slate-200/90 dark:border-slate-700/80',
            'shadow-sm hover:shadow-md active:scale-[0.98]',
            isOpen
              ? 'border-primary/35 ring-4 ring-primary/10 shadow-primary/5 dark:shadow-none'
              : 'hover:border-primary/20',
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50 grayscale-[0.5]'
              : 'cursor-pointer',
            // Size from className prop (py-*, text-*)
            className ?? 'py-2.5',
          )}
        >
          {icon && (
            <span className="text-slate-400 shrink-0">{icon}</span>
          )}
          <span
            className={cn(
              'flex-1 text-left text-sm font-semibold truncate',
              selected && selected.value !== ''
                ? 'text-slate-800 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {selected && selected.value !== '' ? selected.label : (options[0]?.label ?? '—')}
          </span>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0',
              isOpen && 'rotate-180 text-primary/70',
            )}
            aria-hidden="true"
          />
        </button>

        {/* ── Custom Framer Motion Popover Listbox ── */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={cn(
                'absolute z-50 mt-1 left-0 min-w-full',
                'rounded-2xl border border-slate-100 dark:border-slate-800',
                'bg-white dark:bg-slate-900',
                'shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-none',
                'py-1.5 overflow-hidden',
              )}
              style={{ top: '100%' }}
            >
              <div className="max-h-60 overflow-y-auto overscroll-contain">
                {options.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center italic">
                    Không có tùy chọn
                  </div>
                ) : (
                  options.map((opt) => {
                    const isSelected = opt.value === stringValue;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors',
                          isSelected
                            ? 'bg-primary/8 font-bold text-primary'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800',
                          opt.disabled &&
                            'opacity-40 cursor-not-allowed hover:bg-transparent',
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && (
                          <Check
                            className="w-4 h-4 text-primary shrink-0 ml-2"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

PreschoolSelect.displayName = 'PreschoolSelect';
export default PreschoolSelect;
