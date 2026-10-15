'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { Button } from '@/components/ui/button';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { WaitlistTable } from './WaitlistTable';
import { WaitlistFilters } from './WaitlistFilters';
import { WaitlistStatsPanel } from './WaitlistStatsPanel';
import { AddToWaitlistModal } from './AddToWaitlistModal';
import { useWaitlistData } from '../hooks/useWaitlistData';
import type { WaitlistStatus } from '@/types/waitlist';

export function WaitlistContent() {
  const searchParams = useSearchParams();
  const { user, isLoading: isUserLoading } = useUser();
  const tenantId = user?.tenant_id || '';
  const vocab = useModuleVocabulary();

  // URL params
  const packageId = searchParams.get('package_id') || undefined;
  const preferredDate = searchParams.get('preferred_date') || undefined;
  const status = (searchParams.get('status') as WaitlistStatus) || undefined;
  const search = searchParams.get('search') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // State
  const [showAddModal, setShowAddModal] = useState(false);

  // Data fetching
  const {
    entries,
    total,
    isLoading,
    isSyncing,
    error,
    fetchWaitlist,
  } = useWaitlistData({
    tenantId,
    packageId,
    preferredDate,
    status,
    search,
    page,
    limit,
  });

  // Refresh handler
  const handleSoftRefresh = useCallback(async () => {
    await fetchWaitlist();
  }, [fetchWaitlist]);

  usePageRefresh(handleSoftRefresh);

  // Loading state
  if (isUserLoading || (isLoading && entries.length === 0)) {
    return (
      <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
        <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1c1b19] p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Đang tải danh sách chờ...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
        <div className="rounded-[2rem] border border-red-100 dark:border-red-950/30 bg-white dark:bg-[#1c1b19] p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="mb-2 text-lg font-bold text-red-950 dark:text-red-400">Không thể tải danh sách chờ</p>
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchWaitlist()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10 relative">
      {/* Loading bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-rose-400 to-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight font-heading">
          Danh sách chờ
        </h1>
        <Button
          onClick={() => setShowAddModal(true)}
          size="sm"
          className="rounded-lg shadow-sm font-semibold h-9 px-4 active:scale-95 transition-all animate-in fade-in zoom-in duration-300"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm {vocab.customer.singular.toLowerCase()}
        </Button>
      </div>

      {/* Stats Panel */}
      <WaitlistStatsPanel tenantId={tenantId} />

      {/* Filters */}
      <WaitlistFilters
        tenantId={tenantId}
        packageId={packageId}
        preferredDate={preferredDate}
        status={status}
        search={search}
      />

      {/* Table */}
      <WaitlistTable
        entries={entries}
        total={total}
        page={page}
        limit={limit}
        isLoading={isSyncing}
        onRefresh={fetchWaitlist}
      />

      {/* Add Modal */}
      <AddToWaitlistModal
        isOpen={showAddModal}
        tenantId={tenantId}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          toast.success('Đã thêm vào danh sách chờ');
          void fetchWaitlist();
        }}
      />
    </div>
  );
}
