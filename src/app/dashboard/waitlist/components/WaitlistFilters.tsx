'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, Filter } from 'lucide-react';
import type { WaitlistStatus } from '@/types/waitlist';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface WaitlistFiltersProps {
  tenantId: string;
  packageId?: string;
  preferredDate?: string;
  status?: WaitlistStatus;
  search?: string;
}

interface Package {
  id: string;
  name: string;
}

const statusOptions: { value: WaitlistStatus; label: string }[] = [
  { value: 'active', label: 'Đang chờ' },
  { value: 'notified', label: 'Đã thông báo' },
  { value: 'reserved', label: 'Đã giữ chỗ' },
  { value: 'converted', label: 'Đã đặt lịch' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const datePresets = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'tomorrow', label: 'Ngày mai' },
  { value: 'this_week', label: 'Tuần này' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

export function WaitlistFilters({
  tenantId,
  packageId,
  preferredDate,
  status,
  search,
}: WaitlistFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vocab = useModuleVocabulary();

  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [localSearch, setLocalSearch] = useState(search || '');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch packages for dropdown
  useEffect(() => {
    const fetchPackages = async () => {
      if (!tenantId) return;

      setIsLoadingPackages(true);
      try {
        const response = await fetch(`/api/packages?tenant_id=${tenantId}&limit=100`);
        if (response.ok) {
          const data = await response.json();
          setPackages(data.packages || []);
        }
      } catch (err: unknown) {
        console.error('Error fetching packages:', err);
      } finally {
        setIsLoadingPackages(false);
      }
    };

    void fetchPackages();
  }, [tenantId]);

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change
    params.set('page', '1');

    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setLocalSearch('');
    router.push(pathname);
  };

  const hasActiveFilters = packageId || preferredDate || status || search;

  // Convert date preset to actual date
  const getDateFromPreset = (preset: string): string | undefined => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (preset) {
      case 'today':
        return today.toISOString().split('T')[0];
      case 'tomorrow':
        return tomorrow.toISOString().split('T')[0];
      case 'this_week':
        // Return start of week (Monday)
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        return monday.toISOString().split('T')[0];
      default:
        return undefined;
    }
  };

  // Convert calculated date back to preset key for active state binding
  const getActivePreset = (): string => {
    if (!preferredDate) return 'all';
    
    const today = new Date().toISOString().split('T')[0];
    if (preferredDate === today) return 'today';
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    if (preferredDate === tomorrowStr) return 'tomorrow';
    
    const monday = new Date();
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    const mondayStr = monday.toISOString().split('T')[0];
    if (preferredDate === mondayStr) return 'this_week';
    
    return 'custom';
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Mobile filter toggle */}
      <div className="flex items-center gap-3 sm:hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-950 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          <Filter className="h-4 w-4" />
          Bộ lọc
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {[packageId, preferredDate, status, search].filter(Boolean).length}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Filter controls */}
      <div className={`${showFilters ? 'block' : 'hidden'} sm:block`}>
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/50 bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Package filter */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {vocab.package.singular}
              </label>
              <Select
                value={packageId || 'all'}
                onValueChange={(val) => updateFilters({ package_id: val === 'all' ? undefined : (val || undefined) })}
                disabled={isLoadingPackages}
              >
                <SelectTrigger className="w-full h-8 rounded-lg bg-white/80 dark:bg-[#1c1b19]/80 border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-0 focus:ring-offset-0 focus:border-slate-300 dark:focus:border-slate-700">
                  <SelectValue placeholder={`Tất cả ${vocab.package.singular.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white/95 dark:bg-[#1c1b19]/95 backdrop-blur-md border-slate-200/60 dark:border-slate-800/60">
                  <SelectItem value="all" className="text-xs font-medium">Tất cả {vocab.package.singular.toLowerCase()}</SelectItem>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id} className="text-xs font-medium">
                      {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date filter */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Ngày
              </label>
              <Select
                value={getActivePreset()}
                onValueChange={(val) => {
                  if (val === 'custom') return;
                  const date = val === 'all' ? undefined : getDateFromPreset(val || '') || undefined;
                  updateFilters({ preferred_date: date });
                }}
              >
                <SelectTrigger className="w-full h-8 rounded-lg bg-white/80 dark:bg-[#1c1b19]/80 border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-0 focus:ring-offset-0 focus:border-slate-300 dark:focus:border-slate-700">
                  <SelectValue placeholder="Tất cả ngày" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white/95 dark:bg-[#1c1b19]/95 backdrop-blur-md border-slate-200/60 dark:border-slate-800/60">
                  <SelectItem value="all" className="text-xs font-medium">Tất cả ngày</SelectItem>
                  {datePresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value} className="text-xs font-medium">
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Trạng thái
              </label>
              <Select
                value={status || 'all'}
                onValueChange={(val) => updateFilters({ status: val === 'all' ? undefined : (val as WaitlistStatus) })}
              >
                <SelectTrigger className="w-full h-8 rounded-lg bg-white/80 dark:bg-[#1c1b19]/80 border-slate-200 dark:border-slate-800 text-xs font-semibold focus:ring-0 focus:ring-offset-0 focus:border-slate-300 dark:focus:border-slate-700">
                  <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white/95 dark:bg-[#1c1b19]/95 backdrop-blur-md border-slate-200/60 dark:border-slate-800/60">
                  <SelectItem value="all" className="text-xs font-medium">Tất cả trạng thái</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tìm kiếm
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateFilters({ search: localSearch || undefined });
                    }
                  }}
                  placeholder="Tên hoặc SĐT..."
                  className="pl-9 rounded-lg bg-white/80 dark:bg-[#1c1b19]/80 border-slate-200 dark:border-slate-800 text-xs font-medium focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-700"
                />
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                {localSearch && (
                  <button
                    onClick={() => {
                      setLocalSearch('');
                      updateFilters({ search: undefined });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Clear filters button (desktop) */}
          {hasActiveFilters && (
            <div className="mt-4 hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 px-0 hover:bg-transparent"
              >
                Xóa tất cả bộ lọc
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
