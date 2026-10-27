import { isPreschoolRegistryPage, type PreschoolRegistryPage, type PreschoolRegistryStudent } from '@/platform/education/contracts/preschool-registry.contract';

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
export class RegistrySessionError extends Error {
  constructor(readonly code: 'REGISTRY_UNAUTHENTICATED' | 'REGISTRY_ACCESS_DENIED') { super(code); }
}
/** Validate every bounded page before showing client-side filters. Pages are separate DB snapshots, not an atomic export. */
export async function readSchoolRegistry(signal: AbortSignal): Promise<{ students: PreschoolRegistryStudent[]; totals: PreschoolRegistryPage['totals'] }> {
  const students: PreschoolRegistryStudent[] = [], ids = new Set<string>(), parties = new Set<string>();
  let first: PreschoolRegistryPage | undefined, offset = 0;
  for (;;) {
    const query = { status: 'all' as const, offset, limit: 50 };
    const response = await fetch(`/api/education/student-registry?status=all&offset=${offset}&limit=50`, { cache: 'no-store', signal });
    const body: unknown = await response.json();
    if (!response.ok && record(body)) {
      const code = response.status === 401 && body.error === 'REGISTRY_UNAUTHENTICATED' ? 'REGISTRY_UNAUTHENTICATED'
        : response.status === 403 && body.error === 'REGISTRY_ACCESS_DENIED' ? 'REGISTRY_ACCESS_DENIED' : null;
      // Only a bounded status/code is logged; no child data, cookies or tokens.
      if (process.env.NODE_ENV === 'development') console.warn('[PreschoolRegistryRead]', response.status, code ?? 'REGISTRY_UNAVAILABLE');
      if (code) throw new RegistrySessionError(code);
    }
    if (!response.ok || !record(body) || body.success !== true || !isPreschoolRegistryPage(body.registry, query, first?.tenantId)) throw Error('REGISTRY_UNAVAILABLE');
    const page = body.registry;
    if (first && (page.filteredTotal !== first.filteredTotal || page.totals.students !== first.totals.students
      || page.totals.active !== first.totals.active || page.totals.pending !== first.totals.pending)) throw Error('REGISTRY_CHANGED_RELOAD');
    first ??= page;
    for (const student of page.students) {
      if (ids.has(student.id) || parties.has(student.partyId)) throw Error('REGISTRY_DUPLICATE_IDENTITY');
      ids.add(student.id); parties.add(student.partyId); students.push(student);
    }
    if (page.nextOffset === null) {
      if (students.length !== first.filteredTotal) throw Error('REGISTRY_INCOMPLETE');
      return { students, totals: first.totals };
    }
    offset = page.nextOffset;
  }
}
