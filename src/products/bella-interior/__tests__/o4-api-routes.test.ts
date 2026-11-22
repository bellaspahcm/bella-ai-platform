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
import { createServiceClient } from '@/lib/supabase-service-client';

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(),
  INTERIOR_PERMISSIONS: {
    handoverApprove: 'interior:handover:approve',
    acceptanceApprove: 'interior:acceptance:approve',
  },
}));

jest.mock('../repositories/supabase.repository');
jest.mock('@/lib/supabase-service-client', () => ({
  createServiceClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        download: jest.fn().mockResolvedValue({ data: new Blob(['evidence']), error: null }),
      })),
    },
  })),
}));

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
      createAcceptanceSession: jest.fn().mockResolvedValue(undefined),
      updateAcceptanceInspectionResult: jest.fn().mockResolvedValue(undefined),
      decideAcceptanceSession: jest.fn().mockResolvedValue({
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
        approvalStatus: 'APPROVED',
        documentationStatus: 'PARTIAL',
        approvedByActorId: actorId,
      }),
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
      saveAcceptanceEvidence: jest.fn().mockImplementation(async (_tenantId, evidence) => evidence),
      listAcceptanceEvidence: jest.fn().mockResolvedValue([]),
    };

    (SupabaseRepoMock as unknown as jest.Mock).mockImplementation(() => mockRepoInstance);

    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId,
      actor: { id: actorId, full_name: 'Supervisor', roles: ['project_manager'] },
      supabase: {},
      authorization: { authorize: jest.fn().mockResolvedValue({ status: 'ALLOW' }) },
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
    it('GET: downloads only evidence belonging to the authorized session and project', async () => {
      const evidenceId = '44444444-4444-4444-8444-444444444444';
      mockRepoInstance.listAcceptanceEvidence.mockResolvedValue([{
        id: evidenceId, tenantId, sessionId, bucketId: 'interior-site-evidence',
        storagePath: `${tenantId}/${projectId}/acceptance/${sessionId}/file.pdf`, fileName: 'file.pdf',
      }]);
      const response = await getEvidence(new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/evidence?evidenceId=${evidenceId}`),
        { params: Promise.resolve({ id: sessionId }) });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      const ctx = await resolveContextMock.mock.results[0].value;
      expect(ctx.authorization.authorize).toHaveBeenCalledWith({
        permissionId: 'interior:acceptance_evidence:read', tenantId, projectId,
      });
      expect(createServiceClient).toHaveBeenCalledTimes(1);
    });

    it('GET: never downloads a foreign or improperly scoped storage path', async () => {
      const evidenceId = '44444444-4444-4444-8444-444444444444';
      mockRepoInstance.listAcceptanceEvidence.mockResolvedValue([{
        id: evidenceId, tenantId, sessionId, bucketId: 'interior-site-evidence',
        storagePath: `other-tenant/${projectId}/acceptance/${sessionId}/file.pdf`, fileName: 'file.pdf',
      }]);
      const response = await getEvidence(new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/evidence?evidenceId=${evidenceId}`),
        { params: Promise.resolve({ id: sessionId }) });
      expect(response.status).toBe(404);
      expect(createServiceClient).not.toHaveBeenCalled();
    });

    it('GET: does not download when the actor lacks permission for the session project', async () => {
      const ctx = await resolveContextMock(new Request('http://localhost'));
      if (!ctx.ok) throw new Error('Expected test context');
      jest.mocked(ctx.authorization.authorize).mockResolvedValueOnce({ status: 'DENY', reason: 'NO_GRANT' });
      const response = await getEvidence(new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/evidence?projectId=55555555-5555-4555-8555-555555555555&evidenceId=44444444-4444-4444-8444-444444444444`),
        { params: Promise.resolve({ id: sessionId }) });
      expect(response.status).toBe(403);
      expect(ctx.authorization.authorize).toHaveBeenCalledWith({
        permissionId: 'interior:acceptance_evidence:read', tenantId, projectId,
      });
      expect(createServiceClient).not.toHaveBeenCalled();
    });
    it('POST: denies actors without evidence upload permission before parsing or storing the body', async () => {
      resolveContextMock.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }), { status: 403 }),
      });
      const context = { params: Promise.resolve({ id: sessionId }) };
      const res = await uploadEvidence(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid-json',
        }),
        context,
      );

      expect(res.status).toBe(403);
      expect(SupabaseRepoMock).not.toHaveBeenCalled();
    });

    it('POST: rejects an oversized JSON request from Content-Length before auth or body parsing', async () => {
      const context = { params: Promise.resolve({ id: sessionId }) };
      const res = await uploadEvidence(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/evidence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '14112089',
          },
          body: '{}',
        }),
        context,
      );

      expect(res.status).toBe(413);
      expect(resolveContextMock).not.toHaveBeenCalled();
    });

    it('POST: uploads base64 file and computes server SHA-256 with 201', async () => {
      const context = { params: Promise.resolve({ id: sessionId }) };
      const fileBase64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]).toString('base64');

      const res = await uploadEvidence(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evidenceCategory: 'CUSTOMER_SIGNOFF',
            fileBase64,
            fileName: 'signed_handover.png',
            mimeType: 'application/pdf',
            tenantId: 'attacker-controlled-tenant',
            actorId: 'attacker-controlled-actor',
            storagePath: 'attacker-controlled/path',
            bucketId: 'attacker-controlled-bucket',
          }),
        }),
        context
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.sha256Hash).toBeDefined();
      expect(json.data.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
      expect(json.data.bucketId).toBe('interior-site-evidence');
      expect(json.data.tenantId).toBe(tenantId);
      expect(json.data.uploadedByUserId).toBe(actorId);
      expect(json.data.storagePath).not.toContain('attacker-controlled');
    });
  });

  // ─── Approval Route ─────────────────────────────────────────────────────────

  describe('Approval Route (/api/interior/delivery/acceptance/sessions/[id]/approval)', () => {
    it('POST: approves session through the context-authorized atomic flow', async () => {
      const context = { params: Promise.resolve({ id: sessionId }) };
      const res = await decideApproval(
        new Request(`http://localhost/api/interior/delivery/acceptance/sessions/${sessionId}/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'APPROVED',
            approvalNotes: 'Duyệt bàn giao đợt 1',
            actorId: 'attacker-controlled-actor',
            tenantId: 'attacker-controlled-tenant',
            approvedByActorId: 'attacker-controlled-approver',
          }),
        }),
        context
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.approvalStatus).toBe('APPROVED');
      expect(mockRepoInstance.decideAcceptanceSession).toHaveBeenCalledWith(expect.objectContaining({
        tenantId,
        sessionId,
        actorId,
      }));
    });

    it('POST: returns 403 when actor does not have handoverApprove permission', async () => {
      resolveContextMock.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }), { status: 403 }),
      });

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
      expect(json.error).toContain('INTERIOR_PERMISSION_DENIED');
    });
  });
});
