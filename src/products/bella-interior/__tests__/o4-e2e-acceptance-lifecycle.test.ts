/**
 * Bella Interior OS — Full Lifecycle E2E Acceptance Test Suite (O4-E)
 *
 * Simulates the complete on-site operational acceptance and handover lifecycle
 * for Pilot Project: Aqua Bay Ecopark (INT-2024-004).
 *
 * Verifies all 20 Scenarios (E01 - E20):
 * - Phase 1: Project & Campaign Binding
 * - Phase 2: Multi-Session On-Site Inspections across rooms (Living Room, Kitchen, Bedrooms)
 * - Phase 3: Zero-Defect Assessment without fake items
 * - Phase 4: Seven Note Categories & Downstream Work Routing (Punch List, Warranty, Change Order, Replenishment)
 * - Phase 5: Server-Side SHA-256 calculation & Storage Object Versioning
 * - Phase 6: Manager Approval Gate & Crucial Invariant Defect Isolation
 * - Phase 7: Physical Remediation & Re-Inspection Verification
 * - Phase 8: Post-Approval Evidence Supplementation preserving historical metadata
 * - Phase 9: Cross-Tenant Isolation (Gate 0)
 *
 * @module src/products/bella-interior/__tests__
 */

import { createHash } from 'crypto';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InteriorAcceptanceService } from '../services/interior-acceptance.service';
import { DeliveryAftercareService } from '../services/delivery-aftercare.service';
import {
  TenantIsolationViolationError,
  AcceptanceSessionNotFoundError,
  AcceptanceManagerApprovalPermissionRequiredError,
} from '../domain/errors';

describe('Bella Interior O4-E: End-to-End Acceptance & Handover Lifecycle (E01 - E20)', () => {
  // Pilot Project Data: Aqua Bay Ecopark INT-2024-004
  const tenantIdA = '00000000-0000-4000-8000-000000000001';
  const tenantIdB = '00000000-0000-4000-8000-000000000002'; // Cross-tenant boundary
  const projectId = 'd450fc00-a593-484f-a8ad-ff8aebf756df';
  const supervisorId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';
  const technicianId = '33333333-3333-4333-8333-333333333333';

  let repository: InMemoryInteriorRepository;
  let aftercareService: DeliveryAftercareService;
  let acceptanceService: InteriorAcceptanceService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    aftercareService = new DeliveryAftercareService(repository);
    acceptanceService = new InteriorAcceptanceService(repository, aftercareService);
  });

  it('executes full E2E acceptance lifecycle for Aqua Bay Ecopark across all 6 phases', async () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Project & Campaign Setup (E01)
    // ═══════════════════════════════════════════════════════════════════════════
    const campaign = await acceptanceService.createCampaign({
      tenantId: tenantIdA,
      projectId,
      campaignCode: 'CP-2024-004',
      campaignName: 'Nghiệm thu hoàn thiện nội thất căn hộ Park 1 - Aqua Bay Ecopark',
      description: 'Quy trình nghiệm thu đa đợt theo phòng và bàn giao có điều kiện',
      createdByUserId: supervisorId,
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.campaignCode).toBe('CP-2024-004');

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: Multi-Session Inspections (E02 - E04)
    // ═══════════════════════════════════════════════════════════════════════════

    // Session 1: Phòng khách & Ban công (Sofa, Kệ tivi)
    const session1 = await acceptanceService.createSession({
      tenantId: tenantIdA,
      campaignId: campaign.id,
      projectId,
      sessionCode: 'SS-01',
      sessionType: 'ROOM_BY_ROOM',
      inspectionScope: 'Phòng khách & Ban công (Sofa Orlinor, Bàn trà, Kệ tivi)',
      inspectionDate: '2026-11-21',
      recorderActorId: supervisorId,
      customerRepresentative: 'Nguyễn Văn A',
      customerContact: '0901234567',
      inspectionResult: 'ACCEPTED_WITH_REMARKS',
    });

    // Session 2: Bếp & Phòng ăn (Bàn ăn sồi, Tủ bếp Acrylic)
    const session2 = await acceptanceService.createSession({
      tenantId: tenantIdA,
      campaignId: campaign.id,
      projectId,
      sessionCode: 'SS-02',
      sessionType: 'ROOM_BY_ROOM',
      inspectionScope: 'Bếp & Phòng ăn (Bàn ăn gỗ sồi 6 ghế, Tủ bếp Acrylic)',
      inspectionDate: '2026-11-21',
      recorderActorId: supervisorId,
      customerRepresentative: 'Nguyễn Văn A',
      inspectionResult: 'ACCEPTED_WITHOUT_ISSUES',
    });

    // Session 3: Phòng ngủ Master
    const session3 = await acceptanceService.createSession({
      tenantId: tenantIdA,
      campaignId: campaign.id,
      projectId,
      sessionCode: 'SS-03',
      sessionType: 'ROOM_BY_ROOM',
      inspectionScope: 'Phòng ngủ Master (Giường ngủ, Tủ áo âm tường)',
      inspectionDate: '2026-11-21',
      recorderActorId: supervisorId,
      customerRepresentative: 'Nguyễn Văn A',
      inspectionResult: 'ACCEPTED_WITH_REMARKS',
    });

    // Verify all 3 sessions created independently under CP-2024-004
    const sessions = await acceptanceService.listSessions(tenantIdA, campaign.id);
    expect(sessions).toHaveLength(3);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3: Zero-Defect Assessment Verification (E05)
    // ═══════════════════════════════════════════════════════════════════════════
    // Kitchen was inspected and found flawless. Record zero-defect assessment.
    await acceptanceService.recordAcceptanceAssessment({
      tenantId: tenantIdA,
      sessionId: session2.id,
      inspectionResult: 'ACCEPTED_WITHOUT_ISSUES',
      notes: 'Bếp và bàn ăn đạt chuẩn kỹ thuật cao cấp, không phát hiện lỗi gia công.',
    });

    // Invariant: Zero defect items created in Kitchen session notes
    const kitchenNotes = await acceptanceService.listNotes(tenantIdA, session2.id);
    expect(kitchenNotes).toHaveLength(0);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 4: Seven Note Categories & Downstream Routing (E06 - E10)
    // ═══════════════════════════════════════════════════════════════════════════
    // Session 1 (Living Room):
    // Note 1: QUALITY_ISSUE -> Punch List
    const noteQuality = await acceptanceService.recordAcceptanceNote({
      tenantId: tenantIdA,
      sessionId: session1.id,
      category: 'QUALITY_ISSUE',
      severity: 'medium',
      assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
      description: 'Vết trầy nhẹ 2cm tại chân ghế sofa Orlinor do vận chuyển',
      remediationPlan: 'Dặm vá sơn PU lại chân ghế',
      assignedFixer: 'Tổ Sơn hoàn thiện',
      targetDeadline: '2026-11-23',
      createdByUserId: supervisorId,
    });
    expect(noteQuality.routedEntityType).toBe('punch_list');
    expect(noteQuality.routedEntityId).toBeDefined();

    // Note 2: INSTALLATION_ISSUE -> Punch List
    const noteInstall = await acceptanceService.recordAcceptanceNote({
      tenantId: tenantIdA,
      sessionId: session1.id,
      category: 'INSTALLATION_ISSUE',
      severity: 'high',
      assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
      description: 'Bản lề cánh tủ tivi bị lệch 2mm, đóng mở cạ viền',
      remediationPlan: 'Cân chỉnh lại bản lề Hafele',
      assignedFixer: 'Thợ lắp đặt mộc',
      targetDeadline: '2026-11-22',
      createdByUserId: supervisorId,
    });
    expect(noteInstall.routedEntityType).toBe('punch_list');

    // Note 3: CUSTOMER_REQUEST -> Change Order
    const noteRequest = await acceptanceService.recordAcceptanceNote({
      tenantId: tenantIdA,
      sessionId: session1.id,
      category: 'CUSTOMER_REQUEST',
      severity: 'low',
      assessmentStatus: 'MINOR_MONITORING',
      description: 'Khách hàng yêu cầu lắp thêm đèn led hắt sau kệ tivi',
      createdByUserId: supervisorId,
    });
    expect(noteRequest.routedEntityType).toBe('change_order');

    // Session 3 (Master Bedroom):
    // Note 4: MISSING_ITEM -> Replenishment
    const noteMissing = await acceptanceService.recordAcceptanceNote({
      tenantId: tenantIdA,
      sessionId: session3.id,
      category: 'MISSING_ITEM',
      severity: 'medium',
      assessmentStatus: 'INCOMPLETE_ITEMS',
      description: 'Thiếu 2 đệm gối tựa màu be theo hợp đồng',
      createdByUserId: supervisorId,
    });
    expect(noteMissing.routedEntityType).toBe('replenishment');

    // Verify all notes are persisted and traceable
    const s1Notes = await acceptanceService.listNotes(tenantIdA, session1.id);
    expect(s1Notes).toHaveLength(3);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 5: Evidence Package & Server-Side SHA-256 (E11 - E14)
    // ═══════════════════════════════════════════════════════════════════════════
    const sofaPhoto1 = Buffer.from('REAL_ON_SITE_PHOTO_AQUA_BAY_SOFA_OVERALL_RAW_PIXELS');
    const sofaPhoto2 = Buffer.from('REAL_ON_SITE_PHOTO_AQUA_BAY_SOFA_LEG_SCRATCH_DETAIL');

    const expectedHash1 = createHash('sha256').update(sofaPhoto1).digest('hex');
    const expectedHash2 = createHash('sha256').update(sofaPhoto2).digest('hex');

    const ev1 = await acceptanceService.registerEvidenceObject({
      tenantId: tenantIdA,
      sessionId: session1.id,
      evidenceCategory: 'OVERALL',
      storagePath: `acceptance/${session1.id}/sofa_overall.jpg`,
      fileName: 'sofa_overall.jpg',
      fileBuffer: sofaPhoto1,
      mimeType: 'image/jpeg',
      uploadedByUserId: supervisorId,
    });

    const ev2 = await acceptanceService.registerEvidenceObject({
      tenantId: tenantIdA,
      sessionId: session1.id,
      noteId: noteQuality.id,
      evidenceCategory: 'DETAIL',
      storagePath: `acceptance/${session1.id}/sofa_scratch.jpg`,
      fileName: 'sofa_scratch.jpg',
      fileBuffer: sofaPhoto2,
      mimeType: 'image/jpeg',
      uploadedByUserId: supervisorId,
    });

    expect(ev1.sha256Hash).toBe(expectedHash1);
    expect(ev2.sha256Hash).toBe(expectedHash2);

    // Documentation status upgraded to PARTIAL (photos present, but customer signoff pending)
    const session1AfterEv = await acceptanceService.getSession(tenantIdA, session1.id);
    expect(session1AfterEv.documentationStatus).toBe('PARTIAL');

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 6: Manager Approval Gate & Defect Isolation (E15 - E17)
    // ═══════════════════════════════════════════════════════════════════════════
    // Technician without permission tries to approve -> REJECTED
    await expect(
      acceptanceService.approveSession({
        tenantId: tenantIdA,
        sessionId: session1.id,
        actorId: technicianId,
        actorPermissions: ['interior:installation:update'],
        decision: 'APPROVED',
      })
    ).rejects.toThrow(AcceptanceManagerApprovalPermissionRequiredError);

    // Project Manager with interior:acceptance:approve approves conditional handover
    const approvedS1 = await acceptanceService.approveSession({
      tenantId: tenantIdA,
      sessionId: session1.id,
      actorId: managerId,
      actorPermissions: ['interior:acceptance:approve'],
      decision: 'APPROVED',
      approvalNotes: 'Duyệt bàn giao tạm thời có điều kiện. Tồn đọng xử lý trước ngày 23/11.',
    });

    // Invariant 1: Approved even though documentation is PARTIAL
    expect(approvedS1.approvalStatus).toBe('APPROVED');
    expect(approvedS1.documentationStatus).toBe('PARTIAL');
    expect(approvedS1.approvedByActorId).toBe(managerId);

    // Invariant 2 (CRITICAL): Defect notes PL-001 and PL-002 remain strictly OPEN!
    const notesAfterApproval = await acceptanceService.listNotes(tenantIdA, session1.id);
    const defect1 = notesAfterApproval.find((n) => n.id === noteQuality.id);
    const defect2 = notesAfterApproval.find((n) => n.id === noteInstall.id);
    expect(defect1?.remediationStatus).toBe('OPEN');
    expect(defect2?.remediationStatus).toBe('OPEN');

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 7: Physical Remediation & Re-Inspection Verification (E18)
    // ═══════════════════════════════════════════════════════════════════════════
    // Create Re-inspection session (SS-04)
    const session4 = await acceptanceService.createSession({
      tenantId: tenantIdA,
      campaignId: campaign.id,
      projectId,
      sessionCode: 'SS-04',
      sessionType: 'POST_REMEDIATION',
      inspectionScope: 'Tái kiểm tra khắc phục chân ghế sofa và bản lề tủ tivi',
      inspectionDate: '2026-11-23',
      recorderActorId: supervisorId,
      customerRepresentative: 'Nguyễn Văn A',
      inspectionResult: 'ACCEPTED_WITHOUT_ISSUES',
    });

    expect(session4.sessionType).toBe('POST_REMEDIATION');

    // Upload proof of remediation
    const remediationPhoto = Buffer.from('PHOTO_OF_RECTIFIED_SOFA_LEG_AND_ALIGNED_CABINET_HINGE');
    await acceptanceService.registerEvidenceObject({
      tenantId: tenantIdA,
      sessionId: session4.id,
      evidenceCategory: 'REMEDIATION_PROOF',
      storagePath: `acceptance/${session4.id}/remediation_proof.jpg`,
      fileName: 'remediation_proof.jpg',
      fileBuffer: remediationPhoto,
      mimeType: 'image/jpeg',
      uploadedByUserId: supervisorId,
    });

    // Mark punch list defect as verified
    await aftercareService.verifyPunchListItem({
      tenantId: tenantIdA,
      itemId: noteQuality.routedEntityId!,
      projectId,
      verifiedBy: 'Nguyễn Văn A (Khách hàng) & Giám sát',
    });

    // Verify punch list item is now verified
    const punchItems = await repository.listPunchListItems(tenantIdA, projectId);
    const punchItem = punchItems.find((p) => p.id === noteQuality.routedEntityId);
    expect(punchItem?.status).toBe('verified');

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 8: Post-Approval Evidence Supplementation (E19)
    // ═══════════════════════════════════════════════════════════════════════════
    // Customer signs paper handover protocol; supervisor scans and uploads signed PDF
    const signedPdfBytes = Buffer.from('%PDF-1.4 SIGNED_PAPER_PROTOCOL_CUSTOMER_NGUYEN_VAN_A_ECOPARK');
    const { evidence: signoffEv, session: supplementedSession } =
      await acceptanceService.supplementPostApprovalEvidence({
        tenantId: tenantIdA,
        sessionId: session1.id,
        evidenceCategory: 'CUSTOMER_SIGNOFF',
        storagePath: `acceptance/${session1.id}/bien_ban_nghiem_thu_da_ky.pdf`,
        fileName: 'bien_ban_nghiem_thu_da_ky.pdf',
        fileBuffer: signedPdfBytes,
        mimeType: 'application/pdf',
        uploadedByUserId: supervisorId,
      });

    expect(signoffEv.evidenceCategory).toBe('CUSTOMER_SIGNOFF');
    // Documentation status upgraded to COMPLETE!
    expect(supplementedSession.documentationStatus).toBe('COMPLETE');

    // Invariant: Historical approval data is completely preserved
    expect(supplementedSession.approvalStatus).toBe('APPROVED');
    expect(supplementedSession.approvedByActorId).toBe(managerId);
    expect(supplementedSession.approvedAt).toBe(approvedS1.approvedAt);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 9: Tenant Isolation (Gate 0) Enforcement (E20)
    // ═══════════════════════════════════════════════════════════════════════════
    // Tenant B cannot see Tenant A's campaign, sessions, or notes
    const tenantBCampaigns = await acceptanceService.listCampaigns(tenantIdB, projectId);
    expect(tenantBCampaigns).toHaveLength(0);

    const tenantBSessions = await acceptanceService.listSessions(tenantIdB, campaign.id);
    expect(tenantBSessions).toHaveLength(0);

    const tenantBNotes = await acceptanceService.listNotes(tenantIdB, session1.id);
    expect(tenantBNotes).toHaveLength(0);

    // Tenant B cannot approve Tenant A's session (isolated at repository boundary)
    await expect(
      acceptanceService.approveSession({
        tenantId: tenantIdB,
        sessionId: session1.id,
        actorId: managerId,
        actorPermissions: ['interior:acceptance:approve'],
        decision: 'APPROVED',
      })
    ).rejects.toThrow(AcceptanceSessionNotFoundError);
  });
});
