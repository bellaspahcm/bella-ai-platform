import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { EducationSecurityGuardService } from '@/products/bella-education/security/education-security-guard.service';
import { IncidentSafetyService } from '@/products/bella-education/care-wellbeing/incidents/incident-safety.service';
import { PreschoolWorkQueueService } from '@/products/bella-education/work-queue/work-queue.service';
import { QueueError, type QueueCommand, type QueueQuery, type QueueView } from '@/products/bella-education/work-queue/work-queue.types';
import { RequestReviewPersistence } from './request-review.persistence';
import { IncidentQueuePersistence } from './incident-queue.persistence';
import { QueueIdentityPersistence } from './identity.persistence';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function view(value: unknown): QueueView {
  if (value === 'absences' || value === 'health' || value === 'parents') return value;
  throw new QueueError(400, 'Nhóm xử lý không hợp lệ.');
}
function parseQuery(request: Request): QueueQuery {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => !['view', 'status', 'page'].includes(key))) throw new QueueError(400, 'Tham số danh sách không hợp lệ.');
  const status = params.get('status') ?? 'open';
  const page = params.get('page') ?? '1';
  if (status !== 'open' && status !== 'history' && status !== 'all' || !/^[1-9]\d{0,8}$/.test(page)) throw new QueueError(400, 'Bộ lọc hoặc trang không hợp lệ.');
  return { view: view(params.get('view') ?? 'absences'), status, page: Number(page) };
}
function parseCommand(body: unknown): QueueCommand {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new QueueError(400, 'Nội dung xử lý không hợp lệ.');
  if (Object.keys(body).some(key => !['view', 'id', 'action', 'note', 'expectedUpdatedAt'].includes(key))) throw new QueueError(400, 'Chỉ gửi nội dung xử lý; danh tính được xác định từ phiên đăng nhập.');
  if (!('id' in body) || typeof body.id !== 'string' || !uuid.test(body.id)
    || !('view' in body) || !('action' in body) || !('note' in body) || typeof body.note !== 'string'
    || body.note.length > 4000) throw new QueueError(400, 'Mã hồ sơ hoặc ghi chú không hợp lệ (tối đa 4.000 ký tự).');
  if (!('expectedUpdatedAt' in body) || typeof body.expectedUpdatedAt !== 'string' || body.expectedUpdatedAt.length > 40
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.expectedUpdatedAt)
    || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) throw new QueueError(400, 'Thiếu phiên bản hồ sơ đã xem. Vui lòng tải lại danh sách.');
  const group = view(body.view);
  const action = body.action;
  if (group === 'absences' && action !== 'approve' && action !== 'decline'
    || group === 'health' && action !== 'close' || group === 'parents' && action !== 'resolve') throw new QueueError(400, 'Thao tác không phù hợp với nhóm xử lý.');
  if (action !== 'approve' && action !== 'decline' && action !== 'close' && action !== 'resolve') throw new QueueError(400, 'Thao tác không hợp lệ.');
  const note = body.note.trim();
  if (!note) throw new QueueError(400, 'Vui lòng nhập ghi chú xử lý.');
  return { view: group, id: body.id, action, note, expectedUpdatedAt: body.expectedUpdatedAt };
}

async function actor() {
  const user = await getCurrentUser();
  // getCurrentUser validates Auth identity, live active user and active tenant before returning its public profile.
  if (!user?.id || !user.tenant_id) throw new QueueError(401, 'Cần đăng nhập bằng tài khoản đang hoạt động.');
  if (user.role.toLowerCase() !== 'admin') throw new QueueError(403, 'Chỉ quản trị viên trường được xử lý hàng đợi này.');
  new EducationSecurityGuardService().assertCanResolveStaffWorkQueue({ userId: user.id, tenantId: user.tenant_id, role: 'PRINCIPAL' });
  return { tenantId: user.tenant_id, actorId: user.id };
}
async function service(tenantId: string) {
  const sessionClient = await createClient();
  const { data: tenant, error } = await sessionClient.from('tenants').select('id, status, product_key').eq('id', tenantId).maybeSingle();
  if (error) throw new QueueError(500, 'Không thể xác minh sản phẩm của trường.');
  if (!tenant || tenant.status !== 'active' || tenant.product_key !== 'bella_preschool') throw new QueueError(403, 'Workspace này chỉ dành cho Preschool đang hoạt động.');
  let db: SupabaseClient<Database> = sessionClient;
  if (process.env.NODE_ENV !== 'test') {
    const url = getSupabaseAdminUrl();
    const key = getSupabaseAdminKey();
    if (!url || !key) throw new QueueError(503, 'Hàng đợi chưa được cấu hình kết nối máy chủ. Vui lòng liên hệ quản trị hệ thống.');
    db = createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return new PreschoolWorkQueueService(new RequestReviewPersistence(db), new IncidentQueuePersistence(db), new QueueIdentityPersistence(db), new IncidentSafetyService(db));
}
function failure(error: unknown) {
  return NextResponse.json({ success: false, error: error instanceof QueueError ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử tải lại.' },
    { status: error instanceof QueueError ? error.status : 500, headers: noStore });
}
export async function GET(request: Request) {
  try {
    const context = await actor();
    const query = parseQuery(request);
    const queue = await service(context.tenantId);
    return NextResponse.json({ success: true, ...await queue.list(context.tenantId, query) }, { headers: noStore });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await actor();
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new QueueError(403, 'Nguồn gửi yêu cầu không hợp lệ.');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new QueueError(415, 'Yêu cầu phải gửi dưới dạng JSON.');
    let body: unknown;
    try { body = await request.json(); } catch { throw new QueueError(400, 'Nội dung JSON không hợp lệ.'); }
    const command = parseCommand(body);
    const queue = await service(context.tenantId);
    return NextResponse.json({ success: true, item: await queue.execute(context.tenantId, context.actorId, command) }, { headers: noStore });
  } catch (error) { return failure(error); }
}
