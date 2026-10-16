'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { GitFork } from 'lucide-react';
import { toast } from 'sonner';
import {
  getBeautyRuntimeBranchContext,
  selectBeautyRuntimeBranch,
  type BeautyRuntimeBranch,
} from '@/services/beauty-runtime-branch-actions';
import { cn } from '@/lib/utils';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useUser } from '@/lib/user-context';

const ACTIVE_BRANCH_STORAGE_KEY = 'bella.beauty.active_branch.v1';

type BeautyRuntimeBranchSelectorProps = {
  enabled: boolean;
};

function readStoredBranchId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredBranchId(branchId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
  } catch {
    // Browser storage is only the UI carrier; server actions revalidate access.
  }
}

export function BeautyRuntimeBranchSelector({ enabled }: BeautyRuntimeBranchSelectorProps) {
  const [branches, setBranches] = useState<BeautyRuntimeBranch[]>([]);
  const { user, activeBranchId, setActiveBranchId, isBranchPending, setIsBranchPending } = useUser();
  const [requiresSelection, setRequiresSelection] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectionInFlight = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    requestVersion.current += 1;
    selectionInFlight.current = false;
    setActiveBranchId(null);
    setIsBranchPending(true);
    if (!enabled || !user?.tenant_id) {
      setBranches([]);
      setIsBranchPending(false);
      return;
    }

    let cancelled = false;
    const storedBranchId = readStoredBranchId();

    startTransition(() => {
      void getBeautyRuntimeBranchContext(storedBranchId).then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setBranches([]);
          setActiveBranchId(null);
          setRequiresSelection(false);
          return;
        }

        setBranches(result.data.branches);
        setActiveBranchId(result.data.activeBranchId);
        setRequiresSelection(result.data.requiresSelection);
        if (result.data.activeBranchId) {
          writeStoredBranchId(result.data.activeBranchId);
        }
      }).catch(() => {
        if (cancelled) return;
        setBranches([]);
        setActiveBranchId(null);
        toast.error('Không thể xác minh chi nhánh. Vui lòng thử lại.');
      }).finally(() => {
        if (!cancelled) setIsBranchPending(false);
      });
    });

    return () => {
      cancelled = true;
      requestVersion.current += 1;
    };
  }, [enabled, user?.id, user?.tenant_id, setActiveBranchId, setIsBranchPending]);

  if (!enabled || branches.length === 0) return null;

  function handleChange(branchId: string) {
    if (!branchId || isBranchPending || selectionInFlight.current) return;
    const version = requestVersion.current;
    selectionInFlight.current = true;
    setIsBranchPending(true);

    startTransition(() => {
      void selectBeautyRuntimeBranch(branchId).then((result) => {
        if (version !== requestVersion.current) return;
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setActiveBranchId(result.data.activeBranchId);
        setRequiresSelection(false);
        writeStoredBranchId(result.data.activeBranchId);
        window.dispatchEvent(new CustomEvent('beauty-runtime-branch-change', {
          detail: { branchId: result.data.activeBranchId },
        }));
      }).catch(() => {
        if (version !== requestVersion.current) return;
        toast.error('Không thể xác minh chi nhánh. Vui lòng thử lại.');
      }).finally(() => {
        if (version !== requestVersion.current) return;
        selectionInFlight.current = false;
        setIsBranchPending(false);
      });
    });
  }

  return (
    <div className="px-3 pb-2">
      <label className="beauty-erp-nav-header mb-1.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#E5B861]">
        <GitFork className="h-3 w-3" />
        Chi nhánh
      </label>
      <PremiumSelect
        options={branches.map((branch) => ({
          value: branch.id,
          label: branch.name,
        }))}
        value={activeBranchId ?? ''}
        onChange={handleChange}
        placeholder="Chọn chi nhánh"
        disabled={isPending || isBranchPending}
        ariaLabel="Chọn chi nhánh hoạt động"
        className="space-y-0"
        buttonClassName={cn(
          'h-11 rounded-[18px] border-[#D7E1DD]/80 bg-[#E7EFEC] px-4 py-0 text-left shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:border-[#E5C982]/70 hover:bg-white active:scale-[0.99] [&_span]:!text-[#10231F] dark:border-[#315E53]/70 dark:bg-[#062F29]/95 dark:hover:bg-[#073A33] dark:[&_span]:!text-[#F6F1E7]',
          requiresSelection && 'border-amber-300 ring-2 ring-amber-200/80 dark:ring-amber-300/25',
        )}
        dropdownClassName="mt-2 rounded-[18px] border-[#D7E1DD]/80 bg-[#F7FBF9] shadow-[0_18px_40px_rgba(0,0,0,0.22)] dark:border-[#315E53]/80 dark:bg-[#062F29]"
        itemClassName="text-slate-700 hover:bg-emerald-50/90 dark:text-[#DDEAE5] dark:hover:bg-[#0B4B40]"
        selectedItemClassName="bg-[#0F5C4F]/12 font-extrabold text-[#074E44] dark:bg-[#D6B565]/18 dark:text-[#F1D889]"
      />
    </div>
  );
}
