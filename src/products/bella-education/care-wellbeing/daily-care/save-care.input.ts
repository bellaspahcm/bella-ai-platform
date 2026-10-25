/** Product-local full Care form; no derived health or identity mutation. */
export interface SaveCareRecord {
  studentPartyId: string;
  meal: { portion: 'ALL' | 'HALF' | 'FEW' | 'NONE'; notes: string } | null;
  nap: { quality: 'DEEP' | 'RESTLESS' | 'REFUSED'; notes: string } | null;
  hygiene: { type: 'TOILET' | 'DIAPER' | 'BOWEL_MOVEMENT'; notes: string } | null;
  note: string;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function optionalNotes(v: Record<string, unknown>): string {
  if (v.notes !== undefined && typeof v.notes !== 'string') throw new Error('CARE_INVALID_RECORD');
  return v.notes as string | undefined ?? '';
}
function part<T extends string>(v: unknown, key: string, allowed: readonly T[]): { value: T; notes: string } | null {
  if (v === null || v === undefined) return null;
  if (!record(v) || Object.keys(v).some(k => k !== key && k !== 'notes')
    || !allowed.includes(v[key] as T)) throw new Error('CARE_INVALID_RECORD');
  return { value: v[key] as T, notes: optionalNotes(v) };
}
export function parseSaveCareRecords(value: unknown): SaveCareRecord[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('CARE_INVALID_RECORD');
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (!record(entry) || Object.keys(entry).some(k => !['studentPartyId','meal','nap','hygiene','note'].includes(k))
      || typeof entry.studentPartyId !== 'string' || !entry.studentPartyId.trim()
      || (entry.note !== undefined && typeof entry.note !== 'string') || seen.has(entry.studentPartyId)) throw new Error('CARE_INVALID_RECORD');
    seen.add(entry.studentPartyId);
    const meal = part(entry.meal, 'portion', ['ALL','HALF','FEW','NONE'] as const);
    const nap = part(entry.nap, 'quality', ['DEEP','RESTLESS','REFUSED'] as const);
    const hygiene = part(entry.hygiene, 'type', ['TOILET','DIAPER','BOWEL_MOVEMENT'] as const);
    return { studentPartyId: entry.studentPartyId, meal: meal ? { portion: meal.value, notes: meal.notes } : null,
      nap: nap ? { quality: nap.value, notes: nap.notes } : null,
      hygiene: hygiene ? { type: hygiene.value, notes: hygiene.notes } : null, note: entry.note as string | undefined ?? '' };
  });
}
