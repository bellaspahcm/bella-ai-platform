import { beforeEach, expect, it, jest } from '@jest/globals';
import { normalizeRegistryQuery } from '@/platform/education/contracts/preschool-registry.contract';
import { readSchoolRegistry, RegistrySessionError } from '../registry-reader';
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function page(offset = 0, total = 51) {
  return { tenantId: id(1), request: normalizeRegistryQuery({ offset, limit: 50 }), totals: { students: total, active: total, pending: 0 }, filteredTotal: total,
    nextOffset: offset + 50 < total ? offset + 50 : null,
    students: Array.from({ length: Math.min(50, Math.max(0, total - offset)) }, (_, n) => ({ id: id(offset + n + 10), partyId: id(offset + n + 1000), tenantId: id(1), studentCode: `SYN-${offset + n}`, name: 'Synthetic child', gender: null, dob: null,
      enrollments: [{ id: id(offset + n + 2000), courseId: id(2), courseCode: 'SYN-C', courseTitle: 'Synthetic class', branchId: id(3), branchName: 'Synthetic branch', status: 'active' }] })) };
}
const fetcher = jest.fn<typeof fetch>();
const reply = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
beforeEach(() => { fetcher.mockReset(); global.fetch = fetcher; });
it('completes every authorized page before publishing records for existing UI filters', async () => {
  fetcher.mockImplementation(async input => { const p = new URL(String(input), 'http://test'); return reply({ success: true, registry: page(Number(p.searchParams.get('offset'))) }); });
  const signal = new AbortController().signal, result = await readSchoolRegistry(signal);
  expect(result.students).toHaveLength(51); expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('offset=50'), { cache: 'no-store', signal });
});
it('rejects denial on a later page instead of retaining a partial child list', async () => {
  fetcher.mockImplementationOnce(() => reply({ success: true, registry: page() })).mockImplementationOnce(() => reply({ success: false }, 403));
  await expect(readSchoolRegistry(new AbortController().signal)).rejects.toThrow('REGISTRY_UNAVAILABLE');
});
it.each(['tenant', 'duplicate', 'changed', 'truncated'])('rejects inconsistent multi-page data: %s', async fault => {
  const last = page(50);
  if (fault === 'tenant') last.tenantId = id(999);
  if (fault === 'duplicate') last.students[0].id = id(10);
  if (fault === 'changed') last.totals.active = 50;
  if (fault === 'truncated') last.students = [];
  fetcher.mockImplementationOnce(() => reply({ success: true, registry: page() })).mockImplementationOnce(() => reply({ success: true, registry: last }));
  await expect(readSchoolRegistry(new AbortController().signal)).rejects.toThrow();
});
it('accepts a validated empty result and propagates transport failures', async () => {
  fetcher.mockImplementationOnce(() => reply({ success: true, registry: page(0, 0) })).mockRejectedValueOnce(Error('network'));
  expect((await readSchoolRegistry(new AbortController().signal)).students).toEqual([]);
  await expect(readSchoolRegistry(new AbortController().signal)).rejects.toThrow('network');
});
it.each([['REGISTRY_UNAUTHENTICATED', 401], ['REGISTRY_ACCESS_DENIED', 403]] as const)('preserves the actual session failure %s without publishing data', async (code, status) => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  fetcher.mockImplementationOnce(() => reply({ success: false, error: code }, status));
  await expect(readSchoolRegistry(new AbortController().signal)).rejects.toEqual(new RegistrySessionError(code));
  expect(fetcher).toHaveBeenCalledTimes(1);
  warning.mockRestore();
});
