/**
 * Bella Interior OS — Acceptance & Business Services Test Suite (O4-C)
 *
 * Architecture Baseline: v2.0 (Approved 18/11/2026)
 * Implementation Batch: O4
 *
 * Verifies:
 * 1. Multi-Session Acceptance Lifecycle (Campaign + Multiple Sessions).
 * 2. Assessment & Zero Defect Recording without fake items.
 * 3. Seven Categories of Acceptance Notes & Specialized Work Routing.
 * 4. Server-Side SHA-256 calculation & Storage Object Versioning.
 * 5. Manager Approval Gate (interior:acceptance:approve) and Invariant:
 *    - Approval allowed with NONE/PARTIAL documentation.
 *    - Approval does NOT auto-close open notes or defects.
 * 6. Post-Approval Evidence Supplementation preserving historical approval metadata.
 *
 * @module src/products/bella-interior/__tests__
 */

import { createHash } from 'crypto';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InteriorAcceptanceService } from '../services/interior-acceptance.service';
import { DeliveryAftercareService } from '../services/delivery-aftercare.service';
import {
  TenantIsolationViolationError,
  AcceptanceCampaignNotFoundError,
  AcceptanceEvidenceSizeExceededError,
  AcceptanceInvalidMimeTypeError,
  AcceptanceManagerApprovalPermissionRequiredError,
} from '../domain/errors';
import type {
  AcceptanceSessionType,
  NoteCategory,
  NoteSeverity,
  AssessmentStatus,
  InspectionResult,
} from '../domain/acceptance-handover.types';

describe('Bella Interior O4-C: Business Services & Domain Workflows', () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const projectId = 'd450fc00-a593-484f-a8ad-ff8aebf756df'; // Aqua Bay Ecopark INT-2024-004
  const supervisorId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';

  let repository: InMemoryInteriorRepository;
  let aftercareService: DeliveryAftercareService;
  let acceptanceService: InteriorAcceptanceService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    aftercareService = new DeliveryAftercareService(repository);
    acceptanceService = new InteriorAcceptanceService(repository, aftercareService);
  });

  // ─── 1. Multi-Session Acceptance Lifecycle ─────────────────────────────────

  describe('1. Acceptance Campaign & Multi-Session Lifecycle', () => {
    it('creates campaign and multiple independent acceptance sessions for Aqua Bay Ecopark', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-2024-004',
        campaignName: 'Nghiệm thu căn hộ Park 1 - Aqua Bay Ecopark',
        description: 'Chiến dịch nghiệm thu hoàn thiện nội thất và bàn giao cư dân',
        createdByUserId: supervisorId,
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.campaignCode).toBe('CP-2024-004');
      expect(campaign.tenantId).toBe(tenantId);

      // Session 1: Phòng khách (Sofa & Living Room)
      const session1 = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-01',
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Phòng khách & Ban công (Sofa, Bàn trà, Kệ tivi)',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Nguyễn Văn A',
        customerContact: '0901234567',
        inspectionResult: 'ACCEPTED_WITH_REMARKS',
      });

      // Session 2: Phòng bếp & Bàn ăn
      const session2 = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-02',
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Bếp & Phòng ăn (Tủ bếp trên/dưới, Bàn ăn 6 ghế)',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Nguyễn Văn A',
      });

      // Both sessions exist independently under the same campaign
      const sessions = await acceptanceService.listSessions(tenantId, campaign.id);
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionCode).sort()).toEqual(['SS-01', 'SS-02']);

      // Each session initializes 3 independent state dimensions
      expect(session1.inspectionResult).toBe('ACCEPTED_WITH_REMARKS');
      expect(session1.approvalStatus).toBe('PENDING');
      expect(session1.documentationStatus).toBe('NONE');

      expect(session2.inspectionResult).toBe('PENDING_REMEDIATION');
      expect(session2.approvalStatus).toBe('PENDING');
      expect(session2.documentationStatus).toBe('NONE');
    });

    it('enforces Tenant Isolation (Gate 0) and rejects non-existent campaign', async () => {
      await expect(
        acceptanceService.createCampaign({
          tenantId: '',
          projectId,
          campaignCode: 'CP-FAIL',
          campaignName: 'Fail Campaign',
        })
      ).rejects.toThrow(TenantIsolationViolationError);

      await expect(
        acceptanceService.createSession({
          tenantId,
          campaignId: '99999999-9999-4999-8999-999999999999',
          projectId,
          sessionCode: 'SS-FAIL',
          sessionType: 'ROOM_BY_ROOM',
          inspectionScope: 'Invalid',
          inspectionDate: '2026-11-21',
          recorderActorId: supervisorId,
          customerRepresentative: 'Test',
        })
      ).rejects.toThrow(AcceptanceCampaignNotFoundError);
    });
  });

  // ─── 2. Assessment & Zero Defect Recording ──────────────────────────────────

  describe('2. Assessment & Zero Defect Recording', () => {
    it('records zero-defect assessment without creating fake defect items', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-2024-004-ZD',
        campaignName: 'Nghiệm thu chuẩn zero defect',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-ZD',
        sessionType: 'ITEM_BASED',
        inspectionScope: 'Hạng mục Bàn ăn gỗ sồi tự nhiên',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Nguyễn Văn A',
      });

      // Update assessment to ACCEPTED_WITHOUT_ISSUES
      const assessedSession = await acceptanceService.recordAcceptanceAssessment({
        tenantId,
        sessionId: session.id,
        inspectionResult: 'ACCEPTED_WITHOUT_ISSUES',
        approvalNotes: 'Hạng mục hoàn hảo, gia công tinh xảo, không phát hiện lỗi.',
      });

      expect(assessedSession.inspectionResult).toBe('ACCEPTED_WITHOUT_ISSUES');

      // Notes list remains clean with ZERO fake defect items
      const notes = await acceptanceService.listNotes(tenantId, session.id);
      expect(notes).toHaveLength(0);
    });
  });

  // ─── 3. Acceptance Notes & Specialized Work Routing ─────────────────────────

  describe('3. Acceptance Notes with 7 Categories & Work Routing', () => {
    it('routes QUALITY_ISSUE and INSTALLATION_ISSUE to Punch List', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-ROUTE-01',
        campaignName: 'Routing Test Campaign',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-DEFECTS',
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Phòng khách - Sofa da Orlinor',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Khách hàng A',
        inspectionResult: 'ACCEPTED_WITHOUT_ISSUES',
      });

      // Note 1: QUALITY_ISSUE (Vết trầy nhẹ chân ghế sofa)
      const note1 = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'QUALITY_ISSUE',
        severity: 'medium',
        assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
        description: 'Vết trầy xước nhẹ 2cm tại chân ghế sofa bên phải do vận chuyển',
        remediationPlan: 'Dặm vá sơn PU lại chân ghế',
        assignedFixer: 'Tổ Sơn hoàn thiện',
        targetDeadline: '2026-11-23',
        createdByUserId: supervisorId,
      });

      expect(note1.category).toBe('QUALITY_ISSUE');
      expect(note1.routedEntityType).toBe('punch_list');
      expect(note1.routedEntityId).toBeDefined();
      expect(note1.remediationStatus).toBe('OPEN');

      // Verify downstream Punch List item was actually created in repository
      const punchItems = await repository.listPunchListItems(tenantId, projectId);
      expect(punchItems.some((p) => p.id === note1.routedEntityId)).toBe(true);

      // Note 2: INSTALLATION_ISSUE (Bản lề cánh tủ bị lỏng)
      const note2 = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'INSTALLATION_ISSUE',
        severity: 'high',
        assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
        description: 'Bản lề giảm chấn cánh tủ tivi bị lệch 3mm, đóng mở có tiếng kêu',
        remediationPlan: 'Cân chỉnh lại ốc vít bản lề Hafele',
        assignedFixer: 'Thợ lắp đặt mộc',
        targetDeadline: '2026-11-22',
        createdByUserId: supervisorId,
      });

      expect(note2.routedEntityType).toBe('punch_list');

      // Invariant check: Adding DEFECT_REMEDIATION_REQUIRED resets inspectionResult to PENDING_REMEDIATION
      const updatedSession = await acceptanceService.getSession(tenantId, session.id);
      expect(updatedSession.inspectionResult).toBe('PENDING_REMEDIATION');
    });

    it('routes DAMAGE to warranty_ticket and CUSTOMER_REQUEST to change_order', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-ROUTE-02',
        campaignName: 'Other Routing Campaign',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-OTHER',
        sessionType: 'ITEM_BASED',
        inspectionScope: 'Phòng ngủ Master',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Khách hàng A',
      });

      // Note: DAMAGE
      const damageNote = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'DAMAGE',
        severity: 'medium',
        assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
        description: 'Mặt đá bàn trang điểm bị mẻ góc 5mm',
        createdByUserId: supervisorId,
      });
      expect(damageNote.routedEntityType).toBe('warranty_ticket');

      // Note: CUSTOMER_REQUEST
      const requestNote = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'CUSTOMER_REQUEST',
        severity: 'low',
        assessmentStatus: 'MINOR_MONITORING',
        description: 'Khách hàng muốn bổ sung thêm 2 ổ cắm điện âm sàn gần sofa',
        createdByUserId: supervisorId,
      });
      expect(requestNote.routedEntityType).toBe('change_order');

      // Note: MISSING_ITEM
      const missingNote = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'MISSING_ITEM',
        severity: 'medium',
        assessmentStatus: 'INCOMPLETE_ITEMS',
        description: 'Thiếu 2 đệm gối tựa lưng màu be theo hợp đồng',
        createdByUserId: supervisorId,
      });
      expect(missingNote.routedEntityType).toBe('replenishment');

      // Note: FOLLOW_UP
      const followUpNote = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'FOLLOW_UP',
        severity: 'low',
        assessmentStatus: 'MINOR_MONITORING',
        description: 'Kiểm tra lại độ khô keo silicone mép kính sau 24h',
        createdByUserId: supervisorId,
      });
      expect(followUpNote.routedEntityType).toBe('re_inspection');

      // Note: GENERAL_NOTE
      const generalNote = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'GENERAL_NOTE',
        severity: 'low',
        assessmentStatus: 'NO_ISSUES',
        description: 'Bàn giao chìa khóa phòng khách cho chủ nhà',
        createdByUserId: supervisorId,
      });
      expect(generalNote.routedEntityType).toBe('crm_note');
    });
  });

  // ─── 4. Server-Side SHA-256 & Storage Object Versioning ─────────────────────

  describe('4. Server-Side SHA-256 & Storage Object Versioning', () => {
    it('computes SHA-256 hash server-side from buffer and handles immutable versions', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-EVIDENCE-01',
        campaignName: 'Evidence Campaign',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-EV-01',
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Toàn bộ Sofa phòng khách',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Khách hàng A',
      });

      const fakeImageBytes = Buffer.from('RAW_PIXEL_IMAGE_DATA_ECOPARK_SOFA_OVERALL_v1');
      const expectedSha256 = createHash('sha256').update(fakeImageBytes).digest('hex');

      // Upload Version 1
      const evidenceV1 = await acceptanceService.registerEvidenceObject({
        tenantId,
        sessionId: session.id,
        evidenceCategory: 'OVERALL',
        storagePath: 'acceptance/SS-EV-01/sofa_overall.jpg',
        fileName: 'sofa_overall.jpg',
        fileBuffer: fakeImageBytes,
        mimeType: 'image/jpeg',
        uploadedByUserId: supervisorId,
      });

      expect(evidenceV1.version).toBe(1);
      expect(evidenceV1.sha256Hash).toBe(expectedSha256);
      expect(evidenceV1.fileSizeBytes).toBe(fakeImageBytes.length);

      // Session documentationStatus is upgraded from NONE to PARTIAL (photos present, but no signoff)
      const sessionAfterV1 = await acceptanceService.getSession(tenantId, session.id);
      expect(sessionAfterV1.documentationStatus).toBe('PARTIAL');

      // Upload Version 2 to the same storagePath (retake photo with better lighting)
      const fakeImageBytesV2 = Buffer.from('RAW_PIXEL_IMAGE_DATA_ECOPARK_SOFA_OVERALL_v2_HD');
      const expectedSha256V2 = createHash('sha256').update(fakeImageBytesV2).digest('hex');

      const evidenceV2 = await acceptanceService.registerEvidenceObject({
        tenantId,
        sessionId: session.id,
        evidenceCategory: 'OVERALL',
        storagePath: 'acceptance/SS-EV-01/sofa_overall.jpg',
        fileName: 'sofa_overall.jpg',
        fileBuffer: fakeImageBytesV2,
        mimeType: 'image/jpeg',
        uploadedByUserId: supervisorId,
      });

      expect(evidenceV2.version).toBe(2);
      expect(evidenceV2.sha256Hash).toBe(expectedSha256V2);
      expect(evidenceV2.sha256Hash).not.toBe(expectedSha256);

      // Both versions are preserved in the audit log
      const allEvidence = await acceptanceService.listEvidence(tenantId, session.id);
      expect(allEvidence).toHaveLength(2);
      expect(allEvidence.map((e) => e.version)).toEqual([1, 2]);
    });

    it('rejects files exceeding 10MB or having unsupported MIME types', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-EVIDENCE-ERR',
        campaignName: 'Error Handling Campaign',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-ERR',
        sessionType: 'ITEM_BASED',
        inspectionScope: 'Scope',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Customer',
      });

      // Oversized buffer: 11MB
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
      await expect(
        acceptanceService.registerEvidenceObject({
          tenantId,
          sessionId: session.id,
          evidenceCategory: 'DETAIL',
          storagePath: 'acceptance/SS-ERR/too_large.jpg',
          fileName: 'too_large.jpg',
          fileBuffer: oversizedBuffer,
          mimeType: 'image/jpeg',
          uploadedByUserId: supervisorId,
        })
      ).rejects.toThrow(AcceptanceEvidenceSizeExceededError);

      // Unsupported MIME type
      const invalidMimeBuffer = Buffer.from('malicious_executable_or_script');
      await expect(
        acceptanceService.registerEvidenceObject({
          tenantId,
          sessionId: session.id,
          evidenceCategory: 'DETAIL',
          storagePath: 'acceptance/SS-ERR/script.exe',
          fileName: 'script.exe',
          fileBuffer: invalidMimeBuffer,
          mimeType: 'application/x-msdownload',
          uploadedByUserId: supervisorId,
        })
      ).rejects.toThrow(AcceptanceInvalidMimeTypeError);
    });
  });

  // ─── 5. Manager Approval Gate & Defect Isolation ────────────────────────────

  describe('5. Manager Approval Gate & Invariant Defect Isolation', () => {
    it('blocks approval without interior:acceptance:approve permission', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-PERM',
        campaignName: 'Perm Check Campaign',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-PERM',
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Scope',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Khách',
      });

      // Supervisor tries to approve without manager permission
      await expect(
        acceptanceService.approveSession({
          tenantId,
          sessionId: session.id,
          actorId: supervisorId,
          actorPermissions: ['interior:installation:update', 'interior:delivery:create'],
          decision: 'APPROVED',
        })
      ).rejects.toThrow(AcceptanceManagerApprovalPermissionRequiredError);
    });

    it('approves session with PARTIAL documentation and strictly preserves OPEN defects', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-APPR',
        campaignName: 'Approval Invariant Campaign',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-APPR',
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Phòng khách & Ban công',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Khách hàng A',
        inspectionResult: 'ACCEPTED_WITH_REMARKS',
      });

      // Add a Punch List defect item (remediationStatus: OPEN)
      const note = await acceptanceService.recordAcceptanceNote({
        tenantId,
        sessionId: session.id,
        category: 'QUALITY_ISSUE',
        severity: 'medium',
        assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
        description: 'Vết ố nhẹ mép đệm ghế sofa cần vệ sinh bằng dung dịch chuyên dụng',
        remediationPlan: 'Giặt hấp tại chỗ',
        assignedFixer: 'Tổ vệ sinh công nghiệp',
        targetDeadline: '2026-11-24',
        createdByUserId: supervisorId,
      });

      expect(note.remediationStatus).toBe('OPEN');

      // Upload visual evidence (makes documentationStatus: PARTIAL)
      await acceptanceService.registerEvidenceObject({
        tenantId,
        sessionId: session.id,
        evidenceCategory: 'DETAIL',
        storagePath: 'acceptance/SS-APPR/photo_detail.jpg',
        fileName: 'photo_detail.jpg',
        fileBuffer: Buffer.from('FAKE_PHOTO_DATA'),
        mimeType: 'image/jpeg',
        uploadedByUserId: supervisorId,
      });

      const sessionBeforeApproval = await acceptanceService.getSession(tenantId, session.id);
      expect(sessionBeforeApproval.documentationStatus).toBe('PARTIAL');

      // MANAGER APPROVAL with interior:acceptance:approve
      const approvedSession = await acceptanceService.approveSession({
        tenantId,
        sessionId: session.id,
        actorId: managerId,
        actorPermissions: ['interior:acceptance:approve'],
        decision: 'APPROVED',
        approvalNotes: 'Đồng ý nghiệm thu bàn giao sử dụng có điều kiện. Tồn đọng giặt hấp hoàn tất trước 24/11.',
      });

      // Invariant 1: Manager approval succeeded even though documentationStatus is PARTIAL!
      expect(approvedSession.approvalStatus).toBe('APPROVED');
      expect(approvedSession.documentationStatus).toBe('PARTIAL');
      expect(approvedSession.approvedByActorId).toBe(managerId);
      expect(approvedSession.approvedAt).toBeDefined();

      // Invariant 2 (CRITICAL): Open defect is NOT automatically marked closed!
      const notesAfterApproval = await acceptanceService.listNotes(tenantId, session.id);
      const targetNote = notesAfterApproval.find((n) => n.id === note.id);
      expect(targetNote?.remediationStatus).toBe('OPEN');
    });
  });

  // ─── 6. Post-Approval Evidence Supplementation ──────────────────────────────

  describe('6. Post-Approval Evidence Supplementation', () => {
    it('upgrades documentation from PARTIAL to COMPLETE post-approval without changing approval history', async () => {
      const campaign = await acceptanceService.createCampaign({
        tenantId,
        projectId,
        campaignCode: 'CP-SUPP',
        campaignName: 'Supplementation Campaign',
      });

      const session = await acceptanceService.createSession({
        tenantId,
        campaignId: campaign.id,
        projectId,
        sessionCode: 'SS-SUPP',
        sessionType: 'FINAL_HANDOVER',
        inspectionScope: 'Bàn giao tổng thể công trình',
        inspectionDate: '2026-11-21',
        recorderActorId: supervisorId,
        customerRepresentative: 'Khách hàng A',
        inspectionResult: 'ACCEPTED_WITHOUT_ISSUES',
      });

      // Initial visual evidence
      await acceptanceService.registerEvidenceObject({
        tenantId,
        sessionId: session.id,
        evidenceCategory: 'COMPLETED_PRODUCT',
        storagePath: 'acceptance/SS-SUPP/overview.jpg',
        fileName: 'overview.jpg',
        fileBuffer: Buffer.from('OVERVIEW_IMAGE'),
        mimeType: 'image/jpeg',
        uploadedByUserId: supervisorId,
      });

      // Manager approved with PARTIAL documentation
      const approved = await acceptanceService.approveSession({
        tenantId,
        sessionId: session.id,
        actorId: managerId,
        actorPermissions: ['interior:acceptance:approve'],
        decision: 'APPROVED',
        approvalNotes: 'Duyệt bàn giao. Biên bản ký giấy của khách hàng sẽ tải lên sau.',
      });

      const originalApprovedAt = approved.approvedAt;
      const originalApprover = approved.approvedByActorId;
      expect(approved.documentationStatus).toBe('PARTIAL');

      // Now customer signs the physical paper protocol; supervisor uploads scanned PDF
      const pdfBytes = Buffer.from('%PDF-1.4 FAKE_SIGNED_CUSTOMER_ACCEPTANCE_PROTOCOL_AQUA_BAY');
      const { evidence, session: sessionAfterSupp } = await acceptanceService.supplementPostApprovalEvidence({
        tenantId,
        sessionId: session.id,
        evidenceCategory: 'CUSTOMER_SIGNOFF',
        storagePath: 'acceptance/SS-SUPP/bien_ban_nghiem_thu_da_ky.pdf',
        fileName: 'bien_ban_nghiem_thu_da_ky.pdf',
        fileBuffer: pdfBytes,
        mimeType: 'application/pdf',
        uploadedByUserId: supervisorId,
      });

      expect(evidence.evidenceCategory).toBe('CUSTOMER_SIGNOFF');
      expect(evidence.mimeType).toBe('application/pdf');

      // Documentation status upgraded to COMPLETE
      expect(sessionAfterSupp.documentationStatus).toBe('COMPLETE');

      // Invariant: Historical approval data is completely preserved
      expect(sessionAfterSupp.approvalStatus).toBe('APPROVED');
      expect(sessionAfterSupp.approvedByActorId).toBe(originalApprover);
      expect(sessionAfterSupp.approvedAt).toBe(originalApprovedAt);
    });
  });
});
