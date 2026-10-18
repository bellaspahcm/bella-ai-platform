"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function LandPreviewNotice() {
  return <aside role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
    Dữ liệu minh họa — màn hình này chưa kết nối dữ liệu nghiệp vụ. Các thao tác lưu, gửi, phê duyệt và thu tiền chưa khả dụng.
  </aside>;
}

export function unavailableLandAction(action: string) {
  toast.info(`${action} chưa khả dụng. Chưa có thay đổi nào được lưu hoặc gửi.`);
}

export function useLandPagination<T>(rows: T[], size: number) {
  const [requestedPage, setPage] = useState(1);
  const pageSize = Number.isSafeInteger(size) && size > 0 ? size : 8;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pages);
  useEffect(() => { setPage(1); }, [rows, pageSize]);
  return { page, pages, setPage, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize) };
}

export function LandPagination({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (page: number) => void }) {
  return <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
    <span>{total} kết quả · Trang {page}/{pages}</span>
    <div className="flex gap-2">
      <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trước</button>
      <button type="button" aria-label="Trang sau" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Sau</button>
    </div>
  </nav>;
}

export function inDateRange(text: string, range: string, now = new Date()) {
  if (range === "all") return true;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (!match) return false;
  const day = Number(match[1]), month = Number(match[2]) - 1, year = Number(match[3]);
  if (range === "today") return year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
  if (range === "month" || range === "this_month") return year === now.getFullYear() && month === now.getMonth();
  if (range === "quarter") return year === now.getFullYear() && Math.floor(month / 3) === Math.floor(now.getMonth() / 3);
  return /^\d{4}$/.test(range) && year === Number(range);
}

export function matchesBudgetRange(label: string, range: string) {
  if (range === "all") return true;
  const values = label.match(/\d+(?:\.\d+)?/g)?.map(Number);
  const bounds = range.split("-").map(Number);
  if (!values?.length || bounds.length !== 2 || bounds.some(value => !Number.isFinite(value))) return false;
  return values[0] < bounds[1] && (values[1] ?? values[0]) >= bounds[0];
}

export function downloadLandCsv(filename: string, rows: Record<string, unknown>[]) {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const csv = [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); URL.revokeObjectURL(url); }
}
