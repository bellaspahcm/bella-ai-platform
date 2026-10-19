import { readRequestReview, writeRequestReview } from '../domain/request-review';
import { RequestReviewRepository, type RequestRow } from '../repositories/request-review.repository';
import { matchesRequestView, QueueError, type QueueCommand } from '../../work-queue/work-queue.types';

export class RequestReviewService {
  constructor(private readonly repository: RequestReviewRepository) {}

  async review(tenantId: string, actorId: string, command: QueueCommand): Promise<RequestRow> {
    const row = await this.repository.get(tenantId, command.id);
    if (!matchesRequestView(row.exception_type, command.view)) throw new QueueError(400, 'Yêu cầu không thuộc nhóm đang xử lý.');
    if (row.status !== 'OPEN') throw new QueueError(409, 'Yêu cầu đã được xử lý. Vui lòng tải lại.');
    if (row.updated_at !== command.expectedUpdatedAt) throw new QueueError(409, 'Nội dung yêu cầu đã thay đổi sau khi mở danh sách. Vui lòng tải lại và xem lại hồ sơ.');
    if (command.view === 'absences' && command.action !== 'approve' && command.action !== 'decline'
      || command.view === 'parents' && command.action !== 'resolve') throw new QueueError(400, 'Thao tác không phù hợp với yêu cầu.');
    const financeIds = await this.repository.financeNoticeIds(tenantId, row.notice_id ? [row.notice_id] : []);
    if (row.exception_type === 'OVERDUE_PAYMENT_SLA' || row.notice_id && financeIds.has(row.notice_id)) {
      throw new QueueError(400, 'Yêu cầu tài chính cần được xử lý tại Tài chính → Công nợ.');
    }
    const at = new Date().toISOString();
    const receipt = writeRequestReview({ outcome: command.action === 'approve' ? 'APPROVED' : command.action === 'decline' ? 'DECLINED' : 'HANDLED',
      originalNotes: row.resolution_notes, note: command.note, reviewedBy: actorId, reviewedAt: at });
    await this.repository.resolveOpen(tenantId, row, actorId, at, receipt);
    const saved = await this.repository.get(tenantId, row.id);
    const review = readRequestReview(saved.resolution_notes);
    if (saved.status !== 'RESOLVED' || saved.resolved_by !== actorId || !saved.resolved_at
      || Date.parse(saved.resolved_at) !== Date.parse(at) || !review || saved.resolution_notes !== receipt) {
      throw new QueueError(500, 'Chưa xác minh được kết quả đã lưu. Vui lòng tải lại trước khi thao tác tiếp.');
    }
    return saved;
  }
}
