import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WaitlistPaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

export function WaitlistPagination({
  currentPage,
  totalItems,
  itemsPerPage,
}: WaitlistPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Don't show pagination if only 1 page
  if (totalPages <= 1) {
    return null;
  }

  const updatePage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and pages around current
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 px-4 py-3 sm:px-6 rounded-b-2xl">
      {/* Mobile summary */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => updatePage(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-950 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Trước
        </button>
        <button
          onClick={() => updatePage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-950 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Sau
        </button>
      </div>

      {/* Desktop pagination */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Hiển thị{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">{(currentPage - 1) * itemsPerPage + 1}</span>
            {' '}-{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {Math.min(currentPage * itemsPerPage, totalItems)}
            </span>
            {' '}trong tổng số{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">{totalItems}</span> mục
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-lg shadow-xs" aria-label="Pagination">
            {/* Previous button */}
            <button
              onClick={() => updatePage(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-lg px-2.5 py-1.5 text-slate-400 border border-slate-200/60 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span className="sr-only">Trang trước</span>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* Page numbers */}
            {pageNumbers.map((page, idx) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-y border-r border-slate-200/60 dark:border-slate-800"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              const isActive = pageNum === currentPage;

              return (
                <button
                  key={pageNum}
                  onClick={() => updatePage(pageNum)}
                  className={`relative inline-flex items-center px-3 py-1.5 text-xs font-bold border-y border-r border-slate-200/60 dark:border-slate-800 transition-all ${
                    isActive
                      ? 'z-10 bg-primary text-primary-foreground border-primary dark:border-primary'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next button */}
            <button
              onClick={() => updatePage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-lg px-2.5 py-1.5 text-slate-400 border-y border-r border-slate-200/60 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span className="sr-only">Trang sau</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
