import { NextResponse } from 'next/server';
import { PreschoolRegistryContractImpl } from '@/platform/education/contracts/preschool-registry.contract.impl';
import { normalizeRegistryQuery, PreschoolRegistryError, type PreschoolRegistryStatus } from '@/platform/education/contracts/preschool-registry.contract';
import { AttendanceAccessError, resolveAttendanceRequestContext } from '../attendance/request-context';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await resolveAttendanceRequestContext(request);
    if (context.productKey !== 'bella_preschool') return NextResponse.json({ success: false, error: 'REGISTRY_UNSUPPORTED_PRODUCT' }, { status: 404, headers });
    const params = new URL(request.url).searchParams;
    const allowed = ['query', 'status', 'courseId', 'branchId', 'offset', 'limit'];
    if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)
      || ['offset', 'limit'].some(key => params.has(key) && !/^\d{1,6}$/.test(params.get(key) ?? ''))) {
      throw new PreschoolRegistryError('REGISTRY_INVALID_REQUEST', 400);
    }
    const query = normalizeRegistryQuery({ query: params.get('query') ?? '', status: (params.get('status') ?? 'all') as PreschoolRegistryStatus,
      courseId: params.get('courseId'), branchId: params.get('branchId'),
      offset: params.has('offset') ? Number(params.get('offset')) : 0,
      limit: params.has('limit') ? Number(params.get('limit')) : 20 });
    const registry = await new PreschoolRegistryContractImpl(context.client).read(context.tenantId, query);
    return NextResponse.json({ success: true, registry }, { headers });
  } catch (error) {
    const known = error instanceof PreschoolRegistryError || error instanceof AttendanceAccessError;
    return NextResponse.json({ success: false, error: known ? error.code : 'REGISTRY_UNAVAILABLE' }, { status: known ? error.status : 503, headers });
  }
}
