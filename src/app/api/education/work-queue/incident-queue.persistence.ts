import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { QUEUE_PAGE_SIZE, QueueError, type QueueQuery } from '@/products/bella-education/work-queue/work-queue.types';
import type { IncidentQueueRepository } from '@/products/bella-education/care-wellbeing/incidents/incident-queue.repository';

export type IncidentRow = Database['public']['Tables']['edu_health_incidents']['Row'];
export class IncidentQueuePersistence implements IncidentQueueRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}
  private query(tenantId: string, query: QueueQuery, countOnly = false) {
    let builder = this.db.from('edu_health_incidents').select('*', { count: 'exact', head: countOnly }).eq('tenant_id', tenantId);
    if (query.status === 'open') builder = builder.eq('status', 'OPEN');
    if (query.status === 'history') builder = builder.in('status', ['RESOLVED', 'CLOSED']);
    return builder;
  }
  async list(tenantId: string, query: QueueQuery) {
    const counted = await this.query(tenantId, query, true);
    if (counted.error || counted.count === null) throw new QueueError(500, 'Không thể đếm danh sách sự cố.');
    const total = counted.count;
    const pages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
    const page = Math.min(query.page, pages);
    const { data, error } = await this.query(tenantId, query).order('incident_time', { ascending: false }).order('id').range((page - 1) * QUEUE_PAGE_SIZE, page * QUEUE_PAGE_SIZE - 1);
    if (error) throw new QueueError(500, 'Không thể tải danh sách sự cố.');
    return { rows: data ?? [], total, page, pages, pageSize: QUEUE_PAGE_SIZE };
  }
  async get(tenantId: string, id: string): Promise<IncidentRow> {
    const { data, error } = await this.db.from('edu_health_incidents').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw new QueueError(500, 'Không thể đọc sự cố.');
    if (!data) throw new QueueError(404, 'Không tìm thấy sự cố trong trường hiện tại.');
    return data;
  }
}
