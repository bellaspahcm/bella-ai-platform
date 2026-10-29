import { NextResponse } from 'next/server';
import { createHealthDatabaseProbe, HealthDatabaseProbeError } from './database-probe';
import { getHealthRuntimeEnvironment } from './runtime-environment';

/**
 * Application Health Check
 *
 * Used by:
 * - Load balancers / Monitoring systems / Internal dashboards
 *
 * GET /api/health
 *
 * Returns:
 * - 200 OK if healthy
 * - 503 Service Unavailable if unhealthy
 *
 * Server-Timing instrumentation (Bước 2.5 — K6-2 → K6-3 transition):
 * Breaks down TTFB into segments so we can see inside the 129ms black-box:
 *   next_handler    → time from function entry to first await
 *   db_client_init  → time to validate the Supabase health probe configuration
 *   db_query        → bounded Supabase Data API round trip executing a constant DB probe
 *   serialization   → time to build and serialize the JSON response
 *
 * Visible in:
 *   - Browser DevTools → Network → Timing
 *   - k6: response.headers["Server-Timing"]
 *   - curl -I https://.../api/health | grep Server-Timing
 */
export async function GET() {
  // ── Segment: next_handler ─────────────────────────────────────────────────
  const t_handler_start = performance.now();
  let t_client_ms = 0;
  let t_query_ms = 0;
  let t_client_start = t_handler_start;
  let t_query_start: number | undefined;

  try {
    // ── Segment: db_client_init ───────────────────────────────────────────
    t_client_start = performance.now();
    const checkDatabase = createHealthDatabaseProbe();
    t_client_ms = performance.now() - t_client_start;

    // ── Segment: db_query ─────────────────────────────────────────────────
    t_query_start = performance.now();
    await checkDatabase();
    t_query_ms = performance.now() - t_query_start;

    const t_handler_ms = performance.now() - t_handler_start;

    // ── Segment: serialization ────────────────────────────────────────────
    const t_serial_start = performance.now();
    const body = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: getHealthRuntimeEnvironment(),
      checks: { database: 'ok' },
      // Timing breakdown exposed in response body for K6 / curl inspection
      _timing: {
        next_handler_ms: parseFloat(t_handler_ms.toFixed(1)),
        db_client_init_ms: parseFloat(t_client_ms.toFixed(1)),
        db_query_ms: parseFloat(t_query_ms.toFixed(1)),
      },
    };
    const t_serial_ms = performance.now() - t_serial_start;

    const serverTiming = [
      `next_handler;dur=${t_handler_ms.toFixed(1)}`,
      `db_client_init;dur=${t_client_ms.toFixed(1)}`,
      `db_query;dur=${t_query_ms.toFixed(1)}`,
      `serialization;dur=${t_serial_ms.toFixed(1)}`,
    ].join(', ');

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Server-Timing': serverTiming,
      },
    });
  } catch (error) {
    if (error instanceof HealthDatabaseProbeError) {
      if (t_query_start === undefined) t_client_ms = performance.now() - t_client_start;
      else t_query_ms = performance.now() - t_query_start;
      const t_handler_ms = performance.now() - t_handler_start;
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: { database: 'failed' },
          errors: [`Database: ${error.message}`],
          _timing: {
            next_handler_ms: parseFloat(t_handler_ms.toFixed(1)),
            db_client_init_ms: parseFloat(t_client_ms.toFixed(1)),
            db_query_ms: parseFloat(t_query_ms.toFixed(1)),
          },
        },
        { status: 503, headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Server-Timing': [`next_handler;dur=${t_handler_ms.toFixed(1)}`,
            `db_client_init;dur=${t_client_ms.toFixed(1)}`, `db_query;dur=${t_query_ms.toFixed(1)}`].join(', '),
        } }
      );
    }
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, must-revalidate' } }
    );
  }
}
