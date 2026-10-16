import { settlementHttp } from '@/modules/bella-auto/services/AutoMoveSettlementHttp';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return settlementHttp(request, (await context.params).id); }
export async function POST(request: Request, context: Context) { return settlementHttp(request, (await context.params).id); }
