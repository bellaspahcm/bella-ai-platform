import { recognitionAdjustmentHttp } from '@/modules/bella-auto/services/AutoMoveRecognitionAdjustmentHttp';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return recognitionAdjustmentHttp(request, (await context.params).id); }
export async function POST(request: Request, context: Context) { return recognitionAdjustmentHttp(request, (await context.params).id); }
