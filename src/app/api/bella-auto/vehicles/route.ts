import { autoMoveManagementHttp } from '@/modules/bella-auto/services/AutoMoveManagementHttp';
export const POST = (request: Request) => autoMoveManagementHttp(request, 'register');
