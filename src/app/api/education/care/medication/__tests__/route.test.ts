import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreateDatabaseClient = jest.fn();
const mockCreateSessionClient = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockAdministerDose = jest.fn();
const mockMedicationService = jest.fn(() => ({ administerDose: mockAdministerDose }));

jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateDatabaseClient }));
jest.mock('@/lib/supabase-server', () => ({ createClient: mockCreateSessionClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));
jest.mock('@/products/bella-education/care-wellbeing/medication/medication-safety.service', () => ({
  MedicationSafetyService: mockMedicationService,
}));

const { POST } = require('../route') as typeof import('../route');
const payload = {
  tenantId: '00000000-0000-4000-8000-000000000011',
  studentId: '00000000-0000-4000-8000-000000000022',
  doseOccurrenceId: '00000000-0000-4000-8000-000000000033',
  actorId: '00000000-0000-4000-8000-000000000044',
  doseGiven: 'synthetic test input',
};

beforeEach(() => { jest.clearAllMocks(); });

describe('Retired Preschool medication endpoint', () => {
  it.each([
    { name: 'anonymous empty request', body: '', headers: {} },
    { name: 'valid-looking signed-in payload', body: JSON.stringify(payload), headers: { Authorization: 'Bearer synthetic-session' } },
    { name: 'forged privileged actor and tenant', body: JSON.stringify(payload), headers: {
      'x-mock-role': 'SUPER_ADMIN', 'x-mock-user-email': 'synthetic@example.invalid',
      Cookie: 'mock_user_email=synthetic@example.invalid',
    } },
    { name: 'malformed JSON', body: '{invalid-json', headers: {} },
    { name: 'JSON null', body: 'null', headers: {} },
  ])('returns the same410 for $name before reading any identity or body', async ({ body, headers }) => {
    const request = new Request(`http://localhost/api/education/care/medication?tenantId=${payload.tenantId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
    });
    const jsonRead = jest.spyOn(request, 'json');
    const textRead = jest.spyOn(request, 'text');
    const formRead = jest.spyOn(request, 'formData');
    const response = await POST(request);

    expect(response.status).toBe(410);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      success: false,
      error: 'PRESCHOOL_MEDICATION_DISABLED',
      message: 'Chức năng ghi nhận dùng thuốc đã được tắt và không thuộc phạm vi hoạt động của Bella Preschool.',
    });
    expect(jsonRead).not.toHaveBeenCalled();
    expect(textRead).not.toHaveBeenCalled();
    expect(formRead).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
    expect(mockCreateDatabaseClient).not.toHaveBeenCalled();
    expect(mockCreateSessionClient).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockMedicationService).not.toHaveBeenCalled();
    expect(mockAdministerDose).not.toHaveBeenCalled();
  });
});
