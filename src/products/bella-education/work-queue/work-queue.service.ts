import type { RequestReviewRepository, RequestRow } from '../parent-engagement/repositories/request-review.repository';
import { RequestReviewService } from '../parent-engagement/services/request-review.service';
import { readRequestReview, writeRequestReview } from '../parent-engagement/domain/request-review';
import type { IncidentQueueRepository, IncidentRow } from '../care-wellbeing/incidents/incident-queue.repository';
import type { IIncidentSafetyContract } from '../care-wellbeing/incidents/incident-safety.contract';
import { QueueError, type QueueCommand, type QueueItem, type QueuePage, type QueueQuery } from './work-queue.types';

/** Product orchestration only. P6 owns review persistence; P4 owns safe incident closure. */
export interface QueueIdentity { studentName: string | null; studentCode: string | null; guardianName: string | null }
export interface QueueIdentityReader {
  identities(tenantId: string, studentIds: string[], guardianIds: string[]): Promise<(studentId: string, guardianId: string | null) => QueueIdentity>;
}
export class PreschoolWorkQueueService {
  constructor(private readonly requests: RequestReviewRepository, private readonly incidents: IncidentQueueRepository,
    private readonly identityReader: QueueIdentityReader, private readonly safety: IIncidentSafetyContract) {}

  private async requestItems(tenantId: string, rows: RequestRow[], view: 'absences' | 'parents'): Promise<QueueItem[]> {
    const [identity, financeIds] = await Promise.all([
      this.identityReader.identities(tenantId, rows.map(row => row.student_id), rows.flatMap(row => row.guardian_party_id ? [row.guardian_party_id] : [])),
      this.requests.financeNoticeIds(tenantId, rows.flatMap(row => row.notice_id ? [row.notice_id] : [])),
    ]);
    return rows.map(row => {
      const review = row.status === 'RESOLVED' ? readRequestReview(row.resolution_notes) : null;
      return { id: row.id, view, type: row.exception_type, status: row.status, severity: row.severity, studentId: row.student_id,
        ...identity(row.student_id, row.guardian_party_id), createdAt: row.created_at, updatedAt: row.updated_at,
        description: review ? review.originalNotes : row.resolution_notes, actionTaken: null, contextNotes: null, review,
        resolvedBy: row.resolved_by, resolvedAt: row.resolved_at, escalationRequired: false, acknowledgedAt: null, parentNotifiedAt: null,
        financeOnly: row.exception_type === 'OVERDUE_PAYMENT_SLA' || Boolean(row.notice_id && financeIds.has(row.notice_id)) };
    });
  }

  private async incidentItems(tenantId: string, rows: IncidentRow[]): Promise<QueueItem[]> {
    const identity = await this.identityReader.identities(tenantId, rows.map(row => row.student_id), []);
    return rows.map(row => {
      const review = row.status === 'CLOSED' ? readRequestReview(row.escalation_notes) : null;
      return { id: row.id, view: 'health', type: row.incident_type, status: row.status, severity: row.severity, studentId: row.student_id,
        ...identity(row.student_id, null), createdAt: row.incident_time, updatedAt: row.updated_at, description: row.description, actionTaken: row.action_taken,
        contextNotes: review ? review.originalNotes : row.escalation_notes,
        review, resolvedBy: review?.reviewedBy ?? null, resolvedAt: review?.reviewedAt ?? null,
        escalationRequired: row.escalation_required, acknowledgedAt: row.escalation_acknowledged_at,
        parentNotifiedAt: row.parent_notified_at, financeOnly: false };
    });
  }

  async list(tenantId: string, query: QueueQuery): Promise<QueuePage> {
    if (query.view === 'health') {
      const { rows, ...page } = await this.incidents.list(tenantId, query);
      return { ...page, items: await this.incidentItems(tenantId, rows) };
    }
    const { rows, ...page } = await this.requests.list(tenantId, query);
    return { ...page, items: await this.requestItems(tenantId, rows, query.view) };
  }

  async execute(tenantId: string, actorId: string, command: QueueCommand): Promise<QueueItem> {
    if (command.view !== 'health') {
      const saved = await new RequestReviewService(this.requests).review(tenantId, actorId, command);
      return (await this.requestItems(tenantId, [saved], command.view))[0];
    }
    if (command.action !== 'close') throw new QueueError(400, 'Thao tác không phù hợp với sự cố.');
    const row = await this.incidents.get(tenantId, command.id);
    if (row.status !== 'OPEN') throw new QueueError(409, 'Sự cố đã được xử lý. Vui lòng tải lại.');
    if (row.updated_at !== command.expectedUpdatedAt) throw new QueueError(409, 'Nội dung sự cố đã thay đổi sau khi mở danh sách. Vui lòng tải lại và xem lại hồ sơ.');
    if (row.escalation_required && !row.escalation_acknowledged_at) {
      throw new QueueError(409, 'Chưa có xác nhận của phụ huynh trong hồ sơ. Chưa thể đóng sự cố cần chuyển cấp.');
    }
    const receipt = writeRequestReview({ outcome: 'CLOSED', originalNotes: row.escalation_notes,
      note: command.note, reviewedBy: actorId, reviewedAt: new Date().toISOString() });
    try {
      await this.safety.closeIncident({ tenantId, incidentId: row.id, escalationNotes: receipt, expectedOpenUpdatedAt: row.updated_at });
    } catch (error) {
      if (error instanceof Error && /INCIDENT_REVIEW_CONFLICT|INCIDENT_CLOSURE_VIOLATION/.test(error.message)) {
        throw new QueueError(409, 'Sự cố đã thay đổi hoặc chưa đủ xác nhận phụ huynh. Vui lòng tải lại.');
      }
      throw new QueueError(500, 'Không thể lưu kết quả sự cố. Vui lòng tải lại trước khi thử lại.');
    }
    const saved = await this.incidents.get(tenantId, row.id);
    if (saved.status !== 'CLOSED' || saved.escalation_notes !== receipt) throw new QueueError(500, 'Chưa xác minh được kết quả đóng sự cố. Vui lòng tải lại.');
    return (await this.incidentItems(tenantId, [saved]))[0];
  }
}
