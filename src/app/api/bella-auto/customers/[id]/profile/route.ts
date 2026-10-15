import { autoMoveManagementHttp } from '@/modules/bella-auto/services/AutoMoveManagementHttp';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return autoMoveManagementHttp(request, 'profile', (await context.params).id);
}
export async function PUT(request: Request, context: Context) {
  return autoMoveManagementHttp(request, 'preferences', (await context.params).id);
}
