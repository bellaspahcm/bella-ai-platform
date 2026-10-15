import { autoMoveManagementHttp } from '@/modules/bella-auto/services/AutoMoveManagementHttp';
export const GET = (request: Request) => autoMoveManagementHttp(request, 'customers');
