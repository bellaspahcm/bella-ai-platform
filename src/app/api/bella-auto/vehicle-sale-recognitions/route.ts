import { saleChainHttp } from '@/modules/bella-auto/services/AutoMoveSaleChainHttp';

export async function POST(request: Request) {
  return saleChainHttp(request, 'recognize');
}
