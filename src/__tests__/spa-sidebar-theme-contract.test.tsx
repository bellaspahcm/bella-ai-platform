/** @jest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import postcss from 'postcss';
import { TimelineKtvView } from '@/app/dashboard/sessions/components/TimelineKtvView';
import { MonthCalendarView } from '@/app/dashboard/sessions/components/MonthCalendarView';
import { BookingsTimelineDateRibbon } from '@/app/dashboard/bookings/components/BookingsTimelineDateRibbon';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TimelineSession } from '@/app/dashboard/bookings/components/BookingsTimelineGrid';

jest.mock('@/lib/user-context', () => ({ useUser: () => ({ product: mockProduct }) }));
jest.mock('@/hooks/useModuleVocabulary', () => ({ useModuleVocabulary: () => getModuleVocabulary('beauty_spa') }));
let mockProduct: { productKey: string } | null = null;
const date = new Date();
const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const scheduled: TimelineSession = {
  id: 'scheduled', booking_id: 'booking-1', assigned_date: dateStr, assigned_time: '08:00', status: 'scheduled',
  bookings: { assigned_ktv_id: 'ktv-1', assigned_ktv: { full_name: 'KTV An' }, customers: { name_mother: 'Khách đang hẹn' }, package_name: 'Gói liệu trình', completed_sessions: 1, total_sessions: 5 },
};
const completed: TimelineSession = { ...scheduled, id: 'completed', assigned_time: '09:00', status: 'completed' };

describe('spa calendar product copy and theme isolation', () => {
  it.each([
    ['bella_babycare', 'ĐIỀU PHỐI BABYCARE'],
    ['bella_spa', 'BEAUTY SPA COORDINATOR'],
  ])('selects coordinator text for %s without changing calendar actions', (productKey, label) => {
    mockProduct = { productKey };
    const onSelect = jest.fn();
    const { container } = render(<TimelineKtvView sessions={[scheduled, completed]} onSelectBooking={onSelect} />);
    expect(screen.getByText(label)).toHaveClass('text-primary');
    const card = container.querySelector('[data-session-id="scheduled"]');
    expect(card).toHaveClass('bg-primary', 'text-primary-foreground', 'hover:bg-primary-hover');
    if (!(card instanceof HTMLElement)) throw new Error('Scheduled card missing');
    expect(within(card).getByText('Khách đang hẹn')).toHaveClass('!text-primary-foreground');
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(scheduled);
    expect(container.querySelector('[data-session-id="completed"]')).toHaveClass('bg-emerald-600');
  });

  it('does not infer BabyCare from an unresolved product', () => {
    mockProduct = null;
    render(<TimelineKtvView sessions={[]} onSelectBooking={() => {}} />);
    expect(screen.queryByText('ĐIỀU PHỐI BABYCARE')).not.toBeInTheDocument();
  });

  it('uses BabyCare copy in the alternate ribbon and preserves Beauty copy', () => {
    mockProduct = { productKey: 'bella_babycare' };
    const props = { selectedDate: date, today: date, moduleKey: 'babycare' as const, onSelectedDateChange: jest.fn() };
    const { rerender } = render(<BookingsTimelineDateRibbon {...props} />);
    expect(screen.getByText('Điều phối BabyCare')).toHaveClass('text-primary');
    mockProduct = { productKey: 'bella_spa' };
    rerender(<BookingsTimelineDateRibbon {...props} moduleKey="beauty_spa" />);
    expect(screen.getByText('Beauty Spa Coordinator')).toBeInTheDocument();
  });

  it('theme-colors the selected month date and confirmation filter', () => {
    const { container } = render(<MonthCalendarView sessions={[scheduled]} onSelectBooking={() => {}} />);
    expect(container.querySelector('.bg-primary.text-primary-foreground')).not.toBeNull();
    const button = screen.getByRole('button', { name: /Đã xác nhận/ });
    fireEvent.click(button);
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground', 'border-primary');
  });

  it('uses treatment session terminology in spa and retains non-spa vocabulary', () => {
    expect(getModuleVocabulary('babycare').workUnit.singular).toBe('Buổi liệu trình');
    expect(getModuleVocabulary('beauty_spa').workUnit.singular).toBe('Buổi liệu trình');
    expect(getModuleVocabulary('industrial_cleaning').workUnit.singular).toBe('Ca làm việc');
  });
});

describe('sidebar theme consumer guards', () => {
  it('keeps preset primary-button CSS token-based, including dark contrast', () => {
    const css = postcss.parse(fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8'));
    const violations: string[] = [];
    css.walkRules(rule => {
      if (!/data-tenant-(?:module="(?:beauty_spa|babycare|baby_care|pending)"|brand-preset="(?:bella_rose|slate_minimal)")/.test(rule.selector)) return;
      if (!/\[class~="(?:bg-primary|text-primary-foreground)"\]/.test(rule.selector)) return;
      rule.walkDecls(decl => {
        if (['color', 'background', 'background-color'].includes(decl.prop) && !decl.value.includes('var(--primary')) {
          violations.push(`${decl.source?.start?.line}:${decl.prop}`);
        }
      });
    });
    expect(violations).toEqual([]);
  });

  it('allows BabyCare defaults only when no preset is configured', () => {
    const css = postcss.parse(fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8'));
    css.walkRules(rule => {
      if (!rule.selector.includes('data-tenant-module="baby')) return;
      rule.nodes?.forEach(node => {
        if (node.type === 'decl' && node.prop === '--primary') {
          expect(rule.selector).toContain(':not([data-tenant-brand-preset])');
          expect(node.important).toBeFalsy();
        }
      });
    });
  });

  it('audits primary controls on every sidebar route for fixed foreground/hover colors', () => {
    const roots = ['src/app/dashboard/page.tsx', ...['ai-copilot', 'customers', 'bookings', 'sessions', 'waitlist', 'inventory', 'product-sales', 'salary', 'beauty-spa-v2/chain', 'accounting', 'finance', 'executive', 'analytics', 'guides', 'services', 'settings', 'hr', 'operations', 'marketing', 'customer-intelligence'].map(dir => `src/app/dashboard/${dir}`), 'src/components/product-sales'];
    const violations: string[] = [];
    const scan = (file: string) => {
      if (fs.statSync(file).isDirectory()) { fs.readdirSync(file).forEach(name => scan(path.join(file, name))); return; }
      if (!file.endsWith('.tsx') || /(__tests__|Haircut|HqBilling)/.test(file)) return;
      const source = fs.readFileSync(file, 'utf8');
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
          const text = node.getText(tree);
          if (/\bbg-primary(?:\s|[/'"])/.test(text) && /\btext-white\b|hover:bg-(rose|pink|emerald|blue)-\d/.test(text)) violations.push(`${file}:${tree.getLineAndCharacterOfPosition(node.pos).line + 1}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    };
    roots.forEach(scan);
    expect(violations).toEqual([]);
  });

  it('removes exercise-session copy from the spa appointment flow', () => {
    const files = ['src/app/dashboard/page.tsx', 'src/app/dashboard/bookings/components/BookingDayDetailModal.tsx', 'src/app/dashboard/sessions/components/SessionCard.tsx', 'src/app/dashboard/sessions/components/SessionLogsDetailsModal.tsx'];
    files.forEach(file => expect(fs.readFileSync(file, 'utf8')).not.toMatch(/buổi tập/i));
  });
});
