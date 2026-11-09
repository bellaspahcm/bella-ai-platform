import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({
    success: false,
    error: 'INTERIOR_PRODUCTION_READ_MODEL_UNAVAILABLE',
  }, { status: 503 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({
    success: false,
    error: 'INTERIOR_PRODUCTION_COMMAND_PERSISTENCE_UNAVAILABLE',
  }, { status: 503 });
}
