export interface CareSaveRecord {
  readonly studentPartyId: string;
  readonly meal: { readonly portion: 'ALL' | 'HALF' | 'FEW' | 'NONE'; readonly notes: string } | null;
  readonly nap: { readonly quality: 'DEEP' | 'RESTLESS' | 'REFUSED'; readonly notes: string } | null;
  readonly hygiene: { readonly type: 'TOILET' | 'DIAPER' | 'BOWEL_MOVEMENT'; readonly notes: string } | null;
  readonly note: string;
}

/** UI acknowledgement only. The server owns authorization and persistence. */
export async function saveCareRecords(courseId: string, date: string, records: readonly CareSaveRecord[]): Promise<void> {
  if (!courseId || !date || records.length === 0) throw new Error('Chọn lớp và trẻ trước khi lưu.');
  const response = await fetch('/api/education/care/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save_care', courseId, date, data: { records } }),
  });
  const payload: unknown = await response.json();
  if (!response.ok || !payload || typeof payload !== 'object'
    || !('success' in payload) || payload.success !== true
    || !('savedCount' in payload) || payload.savedCount !== records.length
    || !('total' in payload) || payload.total !== records.length) {
    throw new Error('Chưa xác nhận lưu đầy đủ. Tải lại dữ liệu trước khi thử lại.');
  }
}
