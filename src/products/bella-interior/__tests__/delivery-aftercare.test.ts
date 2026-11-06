/**
 * Tests for Bounded Context 4: Project Delivery & Aftercare
 *
 * Verifies Site Diary, QC Punch List defects, Handover gating on critical defects,
 * and Warranty Service Lifecycle.
 *
 * @module src/products/bella-interior/__tests__
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { DesignSpecificationService } from '../services/design-specification.service';
import { DeliveryAftercareService } from '../services/delivery-aftercare.service';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import { OpenCriticalPunchListError } from '../domain/errors';

describe('Bounded Context 4: Project Delivery & Aftercare', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let designService: DesignSpecificationService;
  let deliveryService: DeliveryAftercareService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    designService = new DesignSpecificationService(repository, outbox);
    deliveryService = new DeliveryAftercareService(repository, outbox);
  });

  it('should record Site Diary entries with labor headcount and activities', async () => {
    const project = await designService.createProject({
      tenantId,
      code: 'INT-DELIV-01',
      name: 'Biệt thự Gamuda',
      customerId: 'cust-deliv-1',
      customerName: 'Đặng Thùy Dương',
      customerPhone: '0988776655',
      siteAddress: 'Gamuda Gardens, Hoàng Mai, Hà Nội',
      projectType: 'residential_villa',
      estimatedBudget: 1800000000,
      targetCompletionDate: '2026-12-10',
      leadArchitectId: 'arch-deliv-1',
      leadArchitectName: 'KTS. Tuấn Tú',
    });

    const diary = await deliveryService.recordSiteDiary({
      tenantId,
      projectId: project.id,
      date: '2026-11-15',
      weather: 'Nắng ráo, 26 độ C',
      laborHeadcount: 6,
      activitiesCompleted: [
        'Lắp đặt hệ tủ bếp dưới phòng bếp',
        'Cân chỉnh ray trượt và hộc kéo tủ áo phòng master',
        'Vệ sinh công nghiệp sơ bộ tầng 1',
      ],
      materialDelivered: [
        'Hàng từ xưởng xe tải 2.5 tấn: 12 kiện ván thùng tủ bếp',
        'Mặt đá Vicostone BQ8628 bàn đảo bếp',
      ],
      issuesNoted: 'Cốt tường phòng ăn hơi nghiêng 3mm, đã chêm đệm cân chỉnh bằng tia laser',
      supervisorName: 'Chỉ huy trưởng Hoàng Văn Lợi',
      photoUrls: ['https://cdn.bella.vn/site-diaries/gamuda/diary-15-11-01.jpg'],
    });

    expect(diary.id).toBeDefined();
    expect(diary.laborHeadcount).toBe(6);
    expect(diary.activitiesCompleted.length).toBe(3);

    const diaries = await repository.listSiteDiaries(tenantId, project.id);
    expect(diaries.length).toBe(1);
    expect(diaries[0].supervisorName).toBe('Chỉ huy trưởng Hoàng Văn Lợi');
  });

  it('should block Handover if critical Punch List defects are open', async () => {
    const project = await designService.createProject({
      tenantId,
      code: 'INT-DELIV-02',
      name: 'Penthouse Metropolis',
      customerId: 'cust-deliv-2',
      customerName: 'Trịnh Thăng Bình',
      customerPhone: '0901112222',
      siteAddress: 'Metropolis Liễu Giai, Ba Đình, Hà Nội',
      projectType: 'residential_apartment',
      estimatedBudget: 2200000000,
      targetCompletionDate: '2026-11-18',
      leadArchitectId: 'arch-deliv-2',
      leadArchitectName: 'KTS. Phan Hải',
    });

    // Record a critical defect (e.g. Scratched Acrylic door)
    const defect = await deliveryService.recordPunchListItem({
      tenantId,
      projectId: project.id,
      roomZoneName: 'Phòng Bếp',
      itemName: 'Cánh tủ bếp Acrylic',
      defectCategory: 'scratched_surface',
      description: 'Mặt cánh Acrylic tủ kho bị trầy xước sâu 10cm do va quẹt khi vận chuyển',
      severity: 'critical',
      assignedFixer: 'Đội lắp đặt xưởng - Anh Lực',
      deadline: '2026-11-17',
    });

    expect(defect.status).toBe('open');

    // Attempting to complete handover while defect is open MUST throw OpenCriticalPunchListError
    await expect(
      deliveryService.completeHandover({
        tenantId,
        projectId: project.id,
        contractId: 'contract-deliv-02',
        clientSignoffName: 'Trịnh Thăng Bình (Chủ nhà)',
        finalSettlementValue: 2200000000,
      })
    ).rejects.toThrow(OpenCriticalPunchListError);

    // Fix and rectify the defect
    await deliveryService.rectifyPunchListItem({
      tenantId,
      itemId: defect.id,
      projectId: project.id,
      rectificationNote: 'Đã thay mới cánh Acrylic mới từ xưởng An Cường, đã bóc màng nilon kiểm tra',
    });

    // Verify defect
    await deliveryService.verifyPunchListItem({
      tenantId,
      itemId: defect.id,
      projectId: project.id,
      verifiedBy: 'KTS. Phan Hải (Giám sát thiết kế)',
    });

    // Now handover should complete cleanly!
    const { dossier, certificate } = await deliveryService.completeHandover({
      tenantId,
      projectId: project.id,
      contractId: 'contract-deliv-02',
      clientSignoffName: 'Trịnh Thăng Bình (Chủ nhà)',
      finalSettlementValue: 2200000000,
      woodworkWarrantyMonths: 24,
      hardwareWarrantyMonths: 60,
      stoneWarrantyMonths: 120,
    });

    expect(dossier.status).toBe('completed');
    expect(dossier.clientAccepted).toBe(true);

    expect(certificate.certificateNumber).toContain('INT-DELIV-02');
    expect(certificate.woodworkWarrantyMonths).toBe(24);
    expect(certificate.hardwareWarrantyMonths).toBe(60);
    expect(certificate.stoneWarrantyMonths).toBe(120);

    // Create a warranty service ticket 3 months later
    const ticket = await deliveryService.createWarrantyTicket({
      tenantId,
      certificateId: certificate.id,
      projectId: project.id,
      roomZoneName: 'Phòng Bếp',
      itemName: 'Bản lề cánh tủ dưới',
      defectCategory: 'hardware_defect',
      customerReport: 'Bản lề cánh tủ dưới bồn rửa chén kêu cót két và đóng không êm',
    });

    expect(ticket.status).toBe('submitted');

    // Resolve warranty ticket
    const resolvedTicket = await deliveryService.resolveWarrantyTicket({
      tenantId,
      ticketId: ticket.id,
      assignedTechnician: 'KTV. Trần Minh Tuấn',
      resolutionDetails: 'Đã bảo dưỡng căn chỉnh vít và tra dầu giảm chấn Blum, hoạt động êm ái',
    });

    expect(resolvedTicket.status).toBe('resolved');
    expect(resolvedTicket.assignedTechnician).toBe('KTV. Trần Minh Tuấn');
  });
});
