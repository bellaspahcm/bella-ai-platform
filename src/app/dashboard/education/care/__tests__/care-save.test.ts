import { saveCareRecords, type CareSaveRecord } from '../care-save';

const record: CareSaveRecord = { studentPartyId: 'synthetic-party', meal: { portion: 'HALF', notes: '' }, nap: null, hygiene: null, note: '' };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('Acknowledges only a complete server-confirmed save and sends no held health fields', async () => {
  const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, savedCount: 1, total: 1 }) });
  global.fetch = request;
  await expect(saveCareRecords('course', '2026-10-21', [record])).resolves.toBeUndefined();
  const payload = JSON.parse(request.mock.calls[0][1].body as string);
  expect(payload.data.records).toEqual([record]);
  expect(payload.data.records[0]).not.toHaveProperty('health');
});

test.each([
  { ok: false, body: { success: false, error: 'CARE_HEALTH_POLICY_UNAVAILABLE' } },
  { ok: true, body: { success: false, savedCount: 1, total: 1 } },
  { ok: true, body: { success: true, savedCount: 0, total: 1 } },
  { ok: true, body: { success: true, savedCount: 1, total: 2 } },
  { ok: true, body: null },
])('Rejects a denied, partial or malformed acknowledgement: %j', async ({ ok, body }) => {
  global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body });
  await expect(saveCareRecords('course', '2026-10-21', [record])).rejects.toThrow('Chưa xác nhận lưu đầy đủ');
});

test('Network failure never acknowledges persistence', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network unavailable'));
  await expect(saveCareRecords('course', '2026-10-21', [record])).rejects.toThrow();
});

test('Missing context stops before fetch', async () => {
  const request = jest.fn(); global.fetch = request;
  await expect(saveCareRecords('', '2026-10-21', [record])).rejects.toThrow();
  await expect(saveCareRecords('course', '2026-10-21', [])).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
