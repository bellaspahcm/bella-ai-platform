import { salePaymentHttp } from '@/modules/bella-auto/services/AutoMoveSalePaymentHttp';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return salePaymentHttp(request, (await params).id);
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return salePaymentHttp(request, (await params).id);
}
