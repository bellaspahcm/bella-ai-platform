'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function AccountingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const pathname = usePathname();
  const digest = error.digest || 'NO_DIGEST';

  useEffect(() => {
    const context = {
      area: 'accounting-ledger',
      route: pathname,
      digest,
      message: error.message,
    };

    console.error('[accounting-error-boundary]', context, error);
    Sentry.captureException(error, {
      tags: {
        area: 'accounting-ledger',
        route: pathname,
      },
      extra: {
        digest,
      },
    });
  }, [digest, error, pathname]);

  return (
    <section
      data-testid="accounting-error-boundary"
      className="min-h-[420px] rounded-lg border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/60 dark:bg-[#1E1C1A]"
    >
      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-300">
              Accounting render error
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-[#EFE9E1]">
              Trang kế toán chưa render được
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-[#CDBCAB]">
              Route lỗi: <span className="font-mono text-slate-900 dark:text-[#EFE9E1]">{pathname}</span>
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-[#CDBCAB]">
              Digest: <span className="font-mono text-slate-900 dark:text-[#EFE9E1]">{digest}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-[#8A683A]"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
          <Link
            href="/dashboard/accounting/health"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#3E3A35] dark:text-[#EFE9E1] dark:hover:bg-[#11100F]"
          >
            <ShieldCheck className="h-4 w-4" />
            Xem sức khỏe sổ
          </Link>
        </div>
      </div>
    </section>
  );
}
