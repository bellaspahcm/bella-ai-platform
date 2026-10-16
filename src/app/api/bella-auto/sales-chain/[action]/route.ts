import { saleChainHttp, type SaleChainAction } from '@/modules/bella-auto/services/AutoMoveSaleChainHttp';

function isAction(value: string): value is SaleChainAction {
  return value === 'snapshot' || value === 'draft-update' || value === 'approve' || value === 'handover' || value === 'recognize';
}
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!isAction(action)) return Response.json({ error: 'Not found' }, { status: 404 });
  return saleChainHttp(request, action);
}
export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action !== 'state') return Response.json({ error: 'Not found' }, { status: 404 });
  return saleChainHttp(request, 'state');
}
