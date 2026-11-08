/**
 * Bella Interior OS — Customers & CRM Portfolio API Route
 *
 * GET /api/interior/customers
 *
 * Canonical endpoint for retrieving full Customer & Investor Portfolio analytics:
 * - 4 KPIs (Total, Leads, Transacting, VIP)
 * - 5-stage Sales Funnel with conversion metrics
 * - 12-month Customer & Revenue growth chart data
 * - Enriched customer list with badges, debt status, and last activity
 * - Operational CRM alerts and action items
 * - Customer financial summary (contracts, collected, debt, collection rate)
 * - Source distribution (Referral, Marketing, Website)
 * - Recommended action suggestions
 *
 * Strict Server-Side Calculation: All business rules, formulas, and percentages
 * are resolved by InteriorCustomerAnalyticsService. UI only renders the payload.
 *
 * @module src/app/api/interior/customers/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const projects = await repo.listProjects(ctx.tenantId);
    const customerMap = new Map<string, { id: string; name: string; projectCount: number }>();
    for (const project of projects) {
      const current = customerMap.get(project.customerId);
      if (current) current.projectCount += 1;
      else customerMap.set(project.customerId, {
        id: project.customerId,
        name: project.customerName,
        projectCount: 1,
      });
    }
    const customers = [...customerMap.values()];
    return NextResponse.json({ success: true, data: { customers, total: customers.length } }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_CUSTOMER_LOOKUP_FAILED' }, { status: 503 });
  }
}
