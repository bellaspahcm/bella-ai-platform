import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const context = await resolveInteriorContext(request);
  if (!context.ok) return context.response;

  const { data, error } = await interiorRbacRpcClient(context.supabase).rpc('interior_list_users');
  if (error) {
    return NextResponse.json({ success: false, error: 'INTERIOR_USERS_UNAVAILABLE' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.json({ success: true, users: data }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
