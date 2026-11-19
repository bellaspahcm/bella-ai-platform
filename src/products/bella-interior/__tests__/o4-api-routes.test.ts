/**
 * Bella Interior OS — Acceptance API Routes Test Suite (O4-C)
 *
 * Verifies HTTP boundary contracts, query/body validations,
 * server context resolution, status codes, and authorization gates.
 *
 * @module src/products/bella-interior/__tests__
 */

import { GET as getCampaigns, POST as createCampaign } from '@/app/api/interior/delivery/acceptance/campaigns/route';
import { GET as getSessions, POST as createSession } from '@/app/api/interior/delivery/acceptance/sessions/route';
import { GET as getNotes, POST as createNote } from '@/app/api/interior/delivery/acceptance/sessions/[id]/notes/route';
import { GET as getEvidence, POST as uploadEvidence } from '@/app/api/interior/delivery/acceptance/sessions/[id]/evidence/route';
import { POST as decideApproval } from '@/app/api/interior/delivery/acceptance/sessions/[id]/approval/route';
import { resolveInteriorContext } from '../lib/server-context';
import { SupabaseInteriorRepository } from '../repositories/supabase.repository';

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(),
  INTERIOR_PERMISSIONS: {
    handoverApprove: 'interior:handover:approve',
  },
}));

jest.mock('../repositories/supabase.repository');

const resolveContextMock = jest.mocked(resolveInteriorContext);
const SupabaseRepoMock = jest.mocked(SupabaseInteriorRepository);

describe('Bella Interior O4-C: API Route Handlers', () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const projectId = 'd450fc00-a593-484f-a8ad-ff8aebf756df';
  const campaignId = '11111111-1111-4111-8111-111111111111';
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const actorId = '33333333-3333-4333-8333-333333333333';

  let mockRepoInstance: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepoInstance = {
      saveAcceptanceCampaign: jest.fn().mockResolvedValue(undefined),
      getAcceptanceCampaign: jest.fn().mockResolvedValue({
        id: campaignId,
        tenantId,
        projectId,
        campaignCode: 'CP-01',
        campaignName: 'Test Campaign',
      }),
      listAcceptanceCampaigns: jest.fn().mockResolvedValue([
        { id: campaignId, tenantId, projectId, campaignCode: 'CP-01', campaignName: 'Test Campaign' },
      ]),
      saveAcceptanceSession: jest.fn().mockResolvedValue(undefined),
      getAcceptanceSession: jest.fn().mockResolvedValue({
        id: sessionId,
        tenantId,
        campaignId,
        projectId,
        sessionCode: 'SS-01',
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Living Room',
        inspectionDate: '2026-11-21',
        recorderActorId: actorId,
        customerRepresentative: 'Nguyen Van A',
        relatedBoqItemIds: [],
        inspectionResult: 'ACCEPTED_WITH_REMARKS',
        approvalStatus: 'PENDING',
        documentationStatus: 'PARTIAL',
      }),
      listAcceptanceSessions: jest.fn().mockResolvedValue([]),
      listAcceptanceSessionsByProject: jest.fn().mockResolvedValue([]),
      saveAcceptanceNote: jest.fn().mockResolvedValue(undefined),
      listAcceptanceNotes: jest.fn().mockResolvedValue([]),
      saveAcceptanceEvidence: jest.fn().mockResolvedValue(undefined),
      listAcceptanceEvidence: jest.fn().mockResolvedValue([]),
    };

    (SupabaseRepoMock as unknown as jest.Mock).mockImplementation(() => mockRepoInstance);

    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId,
      actor: { id: actorId, full_name: 'Supervisor', roles: ['project_manager'] },
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  // ─── Campaigns Route ────────────────────────────────────────────────────────

  describe('Campaigns Route (/api/interior/delivery/acceptance/campaigns)', () => {
    it('GET: rejects missing or invalid projectId with 400', async () => {
      const res = await getCampaigns(new Request('http://localhost/api/interior/delivery/acceptance/campaigns'));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('projectId');
    });

    it('GET: returns campaign list for valid projectId with 200', async () => {
      const res = await getCampaigns(
        new Request(`http://localhost/api/interior/delivery/acceptance/campaigns?projectId=${projectId}`)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });

    it('POST: creates campaign and returns 201', async () => {
      const res = await createCampaign(
        new Request('http://localhost/api/interior/delivery/acceptance/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            campaignCode: 'CP-NEW',
            campaignName: 'New Campaign',
            description: 'New Description',
          }),
        })
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.campaignCode).toBe('CP-NEW');
    });
  });

  // ─── Sessions Route ─────────────────────────────────────────────────────────

  describe('Sessions Route (/api/interior/delivery/acceptance/sessions)', () => {
    it('GET: returns 400 if neither campaignId nor projectId provided', async () => {
      const res = await getSessions(new Request('http://localhost/api/interior/delivery/acceptance/sessions'));
      expect(res.status).toBe(400);
    });

    it('POST: creates session and returns 201', async () => {
      const res = await createSession(
        new Request('http://localhost/api/interior/delivery/acceptance/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            projectId,
            sessionCode: 'SS-01',
            sessionType: 'ROOM_BY_ROOM',
            inspectionScope: 'Phòng khách',
            inspectionDate: '2026-11-21',
            customerRepresentative: 'Khách hàng B',
          }),
        })
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.sessionCode).toBe('SS-01');
    });
  });

  // ─── Notes Route ────────────────────────────────────────────────────────────

  describe('Notes Route (/api/interior/delivery/acceptance/sessions/[id]/notes)', () => {
    it('POST: validates 7 categories and creates note with 201', async () => {
      const context = { params: Promise.resolve({ id: sessionId }) };
      const res = await createNote(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'QUALITY_ISSUE',
            severity: 'medium',
            assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
            description: 'Trầy xước tay vịn sofa',
          }),
        }),
        context
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.category).toBe('QUALITY_ISSUE');
    });

    it('POST: rejects invalid note category with 400', async () => {
      const context = { params: Promise.resolve({ id: sessionId }) };
      const res = await createNote(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'UNKNOWN_CATEGORY',
            severity: 'low',
            assessmentStatus: 'NO_ISSUES',
            description: 'Invalid',
          }),
        }),
        context
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid category');
    });
  });

  // ─── Evidence Route ─────────────────────────────────────────────────────────

  describe('Evidence Route (/api/interior/delivery/acceptance/sessions/[id]/evidence)', () => {
    it('POST: uploads base64 file and computes server SHA-256 with 201', async () => {
      const context = { params: Promise.resolve({ id: sessionId }) };
      const rawPayload = 'BASE64_SIMULATED_IMAGE_PAYLOAD';
      const fileBase64 = Buffer.from(rawPayload).toString('base64');

      const res = await uploadEvidence(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evidenceCategory: 'CUSTOMER_SIGNOFF',
            fileBase64,
            fileName: 'signed_handover.pdf',
            mimeType: 'application/pdf',
          }),
        }),
        context
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.sha256Hash).toBeDefined();
      expect(json.data.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ─── Approval Route ─────────────────────────────────────────────────────────

  describe('Approval Route (/api/interior/delivery/acceptance/sessions/[id]/approval)', () => {
    it('POST: approves session when actor has manager role (interior:handover:approve)', async () => {
      const context = { params: Promise.resolve({ id: sessionId }) };
      const res = await decideApproval(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'APPROVED',
            approvalNotes: 'Duyệt bàn giao đợt 1',
          }),
        }),
        context
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.approvalStatus).toBe('APPROVED');
    });

    it('POST: returns 403 when actor does not have handoverApprove permission', async () => {
      resolveContextMock.mockResolvedValueOnce({
        ok: true,
        tenantId,
        actor: { id: actorId, full_name: 'Guest / Technician', roles: ['technician'] },
        supabase: {},
      } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);

      const context = { params: Promise.resolve({ id: sessionId }) };
      const res = await decideApproval(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'APPROVED',
          }),
        }),
        context
      );

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('interior:handover:approve');
    });
  });
});
