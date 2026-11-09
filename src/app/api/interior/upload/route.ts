import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

/**
 * Uploads remain disabled until Interior assets use a private bucket and
 * authenticated, short-lived download URLs. The former implementation wrote
 * design documents to a public R2 URL, which does not provide tenant access
 * control after the key is disclosed.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  return NextResponse.json(
    { success: false, error: 'INTERIOR_PRIVATE_STORAGE_NOT_CONFIGURED' },
    { status: 503 },
  );
}
