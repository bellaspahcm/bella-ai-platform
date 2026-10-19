import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EXCLUDED_PARENT_TYPES, QUEUE_PAGE_SIZE, QueueError, type QueueQuery } from '@/products/bella-education/work-queue/work-queue.types';
import type { RequestReviewRepository } from '@/products/bella-education/parent-engagement/repositories/request-review.repository';

export type RequestRow = Database['public']['Tables']['edu_comm_exceptions']['Row'];

/** P6 owns request reads and conditional review persistence; legacy resolvers keep their contract. */
export class RequestReviewPersistence implements RequestReviewRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  private query(tenantId: string, query: QueueQuery, countOnly = false) {
    let builder = this.db.from('edu_comm_exceptions').select('*', { count: 'exact', head: countOnly }).eq('tenant_id', tenantId);
    if (query.view === 'absences') builder = builder.eq('exception_type', 'ABSENCE_REQUEST');
    else for (const type of EXCLUDED_PARENT_TYPES) builder = builder.neq('exception_type', type);
    if (query.status === 'open') builder = builder.eq('status', 'OPEN');
    if (query.status === 'history') builder = builder.in('status', ['RESOLVED', 'BYPASSED']);
    return builder;
  }

  async list(tenantId: string, query: QueueQuery) {
    const counted = await this.query(tenantId, query, true);
    if (counted.error || counted.count === null) throw new QueueError(500, 'Không thể đếm danh sách yêu cầu.');
    const total = counted.count;
    const pages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
    const page = Math.min(query.page, pages);
    const result = await this.query(tenantId, query).order('created_at', { ascending: false }).order('id').range((page - 1) * QUEUE_PAGE_SIZE, page * QUEUE_PAGE_SIZE - 1);
    if (result.error) throw new QueueError(500, 'Không thể tải danh sách yêu cầu.');
    return { rows: result.data ?? [], total, pages, page, pageSize: QUEUE_PAGE_SIZE };
  }

  async get(tenantId: string, id: string): Promise<RequestRow> {
    const { data, error } = await this.db.from('edu_comm_exceptions').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw new QueueError(500, 'Không thể đọc yêu cầu.');
    if (!data) throw new QueueError(404, 'Không tìm thấy yêu cầu trong trường hiện tại.');
    return data;
  }

  async resolveOpen(tenantId: string, row: RequestRow, actorId: string, at: string, receipt: string): Promise<void> {
    const { data, error } = await this.db.from('edu_comm_exceptions').update({ status: 'RESOLVED', resolved_by: actorId,
      resolved_at: at, resolution_notes: receipt, updated_at: at }).eq('tenant_id', tenantId).eq('id', row.id)
      .eq('status', 'OPEN').eq('exception_type', row.exception_type).eq('updated_at', row.updated_at).select('id').maybeSingle();
    if (error) throw new QueueError(500, 'Không thể lưu quyết định. Vui lòng tải lại trước khi thử lại.');
    if (!data) throw new QueueError(409, 'Yêu cầu đã thay đổi hoặc đã được xử lý. Vui lòng tải lại.');
  }

  async financeNoticeIds(tenantId: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const { data, error } = await this.db.from('edu_comm_notices').select('id, source_domain').eq('tenant_id', tenantId).in('id', ids);
    if (error) throw new QueueError(500, 'Không thể xác định nguồn yêu cầu.');
    return new Set((data ?? []).filter(row => row.source_domain === 'P7_FINANCE').map(row => row.id));
  }
}
