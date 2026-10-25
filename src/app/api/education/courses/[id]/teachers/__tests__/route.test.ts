/** @jest-environment node */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreateClient = jest.fn(() => { throw new Error('Forbidden SDK client creation'); });
const mockContract = jest.fn(() => { throw new Error('Forbidden contract construction'); });

jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));
jest.mock('@/platform/education/contracts/teacher-assignment.contract.impl', () => ({
  TeacherAssignmentContractImpl: function () { return mockContract(); },
}));

import { DELETE, POST } from '../route';

const methods = [{ method: 'POST', handler: POST }, { method: 'DELETE', handler: DELETE }] as const;
const originalFetch = globalThis.fetch;
const mockNetwork = jest.fn<typeof fetch>(() => { throw new Error('Forbidden outbound fetch'); });

async function expectHold(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    success: false, code: 'TEACHER_ASSIGNMENT_NOT_READY',
    error: 'Phân công và chấm dứt phân công giáo viên hiện chưa khả dụng.',
  });
  expect(mockCreateClient).not.toHaveBeenCalled();
  expect(mockContract).not.toHaveBeenCalled();
  expect(mockNetwork).not.toHaveBeenCalled();
}

describe('R1a teacher assignment write hold', () => {
  beforeEach(() => { jest.clearAllMocks(); globalThis.fetch = mockNetwork; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  describe.each(methods)('$method', ({ method, handler }) => {
    it.each(['anonymous', 'student', 'teacher', 'admin'])('holds the %s caller without granting write authority', async role => {
      const request = new Request('http://localhost/api/education/courses/synthetic-class/teachers?tenantId=forged&assignmentId=forged', {
        method, headers: { 'Content-Type': 'application/json', 'x-user-role': role, 'x-tenant-id': 'forged' },
        body: JSON.stringify({ tenantId: 'forged', teacherPartyId: 'forged', role: 'lead_teacher', academicYear: '2026-2027' }),
      });
      await expectHold(await handler(request, { params: Promise.resolve({ id: 'synthetic-class' }) }));
    });

    it.each(['', '{malformed', 'null', '[]'])('holds malformed or empty payload %p before parsing it', async body => {
      const request = new Request('http://localhost/api/education/courses/synthetic-class/teachers', { method, body });
      const parse = jest.spyOn(request, 'json').mockImplementation(async () => { throw new Error('Forbidden body parse'); });
      await expectHold(await handler(request, { params: Promise.resolve({ id: 'synthetic-class' }) }));
      expect(parse).not.toHaveBeenCalled();
    });

    it('never reads request getters or destructures/awaits route params', async () => {
      const touches: string[] = [];
      const trap = (name: string): never => { touches.push(name); throw new Error(`Forbidden ${name}`); };
      const request = new Request('http://localhost/api/education/courses/synthetic-class/teachers', { method });
      for (const property of ['json', 'text', 'formData', 'arrayBuffer', 'url', 'headers', 'body', 'method']) {
        Object.defineProperty(request, property, { get: () => trap(`request.${property}`) });
      }
      const context = { get params(): Promise<{ id: string }> { return trap('context.params'); } };
      await expectHold(await handler(request, context));
      expect(touches).toEqual([]);
    });

    it('returns the hold even when resolving params could never finish', async () => {
      const params = new Promise<{ id: string }>(() => {});
      await expectHold(await handler(new Request('http://localhost/', { method }), { params }));
    });
  });
});
