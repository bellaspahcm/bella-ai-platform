/**
 * Tests for Bounded Context 2: Commercial & Costing
 *
 * Verifies Furniture BOQ/BOM itemization, Tripartite Costing,
 * Approved Design Lock enforcement, and Milestone Payment rules.
 *
 * @module src/products/bella-interior/__tests__
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { DesignSpecificationService } from '../services/design-specification.service';
import { CommercialCostingService } from '../services/commercial-costing.service';
import { InteriorCustomerApprovalService } from '../services/interior-customer-approval.service';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import {
  ApprovedDesignLockViolationError,
  MilestonePercentageSumError,
} from '../domain/errors';

describe('Bounded Context 2: Commercial & Costing', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let designService: DesignSpecificationService;
  let commercialService: CommercialCostingService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    designService = new DesignSpecificationService(repository, outbox);
    commercialService = new CommercialCostingService(repository, outbox);
  });

  it('should reject BOQ creation if Design Revision is NOT approved (Approved Design Lock)', async () => {
    const project = await designService.createProject({
      tenantId,
      code: 'INT-TEST-01',
      name: 'Penthouse Sunshine',
      customerId: 'cust-1',
      customerName: 'Lê Hoàng Nam',
      customerPhone: '0987654321',
      siteAddress: 'Tòa S2 Sunshine City, Hà Nội',
      projectType: 'residential_apartment',
      estimatedBudget: 1200000000,
      targetCompletionDate: '2026-12-15',
      leadArchitectId: 'arch-1',
      leadArchitectName: 'KTS. Tuấn Anh',
    });

    const unapprovedRev = await designService.createDesignRevision({
      tenantId,
      projectId: project.id,
      title: 'Bản vẽ 2D sơ bộ - chưa duyệt',
      submittedBy: 'KTS. Tuấn Anh',
    });

    // Attempting to create BOQ from unapproved design must throw ApprovedDesignLockViolationError
    await expect(
      commercialService.createBOQFromApprovedDesign({
        tenantId,
        projectId: project.id,
        designRevisionId: unapprovedRev.id,
        boqNumber: 'BOQ-SUNSHINE-01',
        preparedBy: 'QS. Nguyễn Thu Hà',
        rawItems: [
          {
            roomZoneId: 'room-1',
            roomZoneName: 'Phòng Bếp',
            itemCode: 'CAB-KIT-01',
            itemName: 'Tủ bếp Acrylic chữ L',
            category: 'cabinetry',
            dimensions: { width: 3600, depth: 600, height: 860, unit: 'mm' },
            specifications: {
              carcassMaterial: 'MDF lõi xanh chống ẩm An Cường',
              doorFrontMaterial: 'Cánh Acrylic bóng gương noline',
              surfaceFinish: 'Phủ Melamine trắng',
              hardwareSpec: 'Bản lề Blum Clip Top giảm chấn',
            },
            unit: 'md',
            quantity: 3.6,
            internalUnitCost: 4500000,
            clientUnitPrice: 7500000,
          },
        ],
      })
    ).rejects.toThrow(ApprovedDesignLockViolationError);
  });

  it('should calculate Tripartite Costing accurately for Approved Design Revision', async () => {
    const project = await designService.createProject({
      tenantId,
      code: 'INT-TEST-02',
      name: 'Duplex Ecopark',
      customerId: 'cust-2',
      customerName: 'Phạm Hồng Nhung',
      customerPhone: '0909090909',
      siteAddress: 'Aqua Bay, Ecopark, Hưng Yên',
      projectType: 'residential_apartment',
      estimatedBudget: 800000000,
      targetCompletionDate: '2026-11-20',
      leadArchitectId: 'arch-2',
      leadArchitectName: 'KTS. Minh Châu',
    });

    const rev = await designService.createDesignRevision({
      tenantId,
      projectId: project.id,
      title: 'Hồ sơ bản vẽ kỹ thuật thi công',
      submittedBy: 'KTS. Minh Châu',
    });

    const approvedRev = await designService.approveDesignRevision({
      tenantId,
      revisionId: rev.id,
      approvedBy: 'KTS. Minh Châu',
      clientSignoffName: 'Phạm Hồng Nhung',
    });

    const boq = await commercialService.createBOQFromApprovedDesign({
      tenantId,
      projectId: project.id,
      designRevisionId: approvedRev.id,
      boqNumber: 'BOQ-ECOPARK-01',
      preparedBy: 'QS. Đặng Văn Nam',
      rawItems: [
        {
          roomZoneId: 'room-kit',
          roomZoneName: 'Bếp',
          itemCode: 'KIT-01',
          itemName: 'Hệ tủ bếp trên dưới',
          category: 'cabinetry',
          dimensions: { width: 4000, depth: 600, height: 850, unit: 'mm' },
          specifications: {
            carcassMaterial: 'MDF chống ẩm lõi xanh',
            doorFrontMaterial: 'Acrylic An Cường noline',
            surfaceFinish: 'Trắng sứ',
            hardwareSpec: 'Ray hộp Blum Tandembox',
          },
          unit: 'bộ',
          quantity: 1,
          internalUnitCost: 45000000, // Giá vốn nội bộ
          clientUnitPrice: 75000000,  // Giá chào khách
        },
        {
          roomZoneId: 'room-bed',
          roomZoneName: 'Phòng ngủ Master',
          itemCode: 'BED-01',
          itemName: 'Tủ áo cánh kính khung nhôm',
          category: 'cabinetry',
          dimensions: { width: 2800, depth: 600, height: 2600, unit: 'mm' },
          specifications: {
            carcassMaterial: 'MDF phủ Melamine vân óc chó',
            doorFrontMaterial: 'Cánh kính xám khói khung nhôm slim',
            surfaceFinish: 'Veneer óc chó',
            hardwareSpec: 'Đèn LED cảm ứng đóng mở cánh',
          },
          unit: 'bộ',
          quantity: 1,
          internalUnitCost: 35000000,
          clientUnitPrice: 55000000,
        },
      ],
    });

    expect(boq.totalInternalCost).toBe(80000000); // 45tr + 35tr
    expect(boq.totalClientPrice).toBe(130000000); // 75tr + 55tr
    expect(boq.totalGrossMargin).toBe(50000000);  // 130tr - 80tr
    expect(boq.grossMarginPercent).toBeCloseTo(38.46, 1); // 50 / 130 * 100 = 38.46%
  });

  it('should enforce Contract payment milestones to sum to 100% and enqueue to Finance Outbox', async () => {
    const project = await designService.createProject({
      tenantId,
      code: 'INT-TEST-03',
      name: 'Shophouse Vinhomes',
      customerId: 'cust-3',
      customerName: 'Vũ Mạnh Cường',
      customerPhone: '0933333333',
      siteAddress: 'Vinhomes Ocean Park, Gia Lâm, Hà Nội',
      projectType: 'commercial_office',
      estimatedBudget: 500000000,
      targetCompletionDate: '2026-10-31',
      leadArchitectId: 'arch-3',
      leadArchitectName: 'KTS. Việt Dũng',
    });

    const rev = await designService.createDesignRevision({
      tenantId,
      projectId: project.id,
      title: 'Bản vẽ duyệt thi công',
      submittedBy: 'KTS. Việt Dũng',
    });
    const approvedRev = await designService.approveDesignRevision({
      tenantId,
      revisionId: rev.id,
      approvedBy: 'KTS. Việt Dũng',
      clientSignoffName: 'Vũ Mạnh Cường',
    });

    const boq = await commercialService.createBOQFromApprovedDesign({
      tenantId,
      projectId: project.id,
      designRevisionId: approvedRev.id,
      boqNumber: 'BOQ-VIN-01',
      preparedBy: 'QS. Thu Hà',
      rawItems: [
        {
          roomZoneId: 'room-off',
          roomZoneName: 'Văn phòng',
          itemCode: 'OFF-DESK-01',
          itemName: 'Cụm bàn làm việc 6 người',
          category: 'loose_furniture',
          dimensions: { width: 3600, depth: 1200, height: 750, unit: 'mm' },
          specifications: {
            carcassMaterial: 'Khung thép sơn tĩnh điện',
            doorFrontMaterial: 'Mặt bàn MFC chống ẩm An Cường',
            surfaceFinish: 'Melamine vân sồi',
            hardwareSpec: 'Nắp nhôm luồn dây điện âm bàn',
          },
          unit: 'bộ',
          quantity: 1,
          internalUnitCost: 15000000,
          clientUnitPrice: 25000000,
        },
      ],
    });

    const quotation = await commercialService.createQuotation({
      tenantId,
      projectId: project.id,
      boqId: boq.id,
      quotationNumber: 'QUO-VIN-01',
      actorId: 'sales-actor',
      actorName: 'Sales',
      vatPercent: 8,
    });

    expect(quotation.grandTotal).toBe(27000000); // 25tr + 8% VAT = 27tr

    const approvalService = new InteriorCustomerApprovalService(repository, outbox);
    const approvalRequest = await approvalService.sendApprovalRequest({
      tenantId, projectId: project.id, subjectType: 'quotation', subjectId: quotation.id,
      subjectVersionNumber: quotation.versionNumber, clientRepresentative: 'Vũ Mạnh Cường',
      clientContact: 'customer@example.com', actorId: 'sales-actor', actorName: 'Sales', userRole: 'pm',
    });
    const quoteApproval = await approvalService.recordApproval({
      tenantId, approvalId: approvalRequest.id, approvalToken: approvalRequest.approvalToken,
      actorId: 'customer-actor', actorName: 'Vũ Mạnh Cường', userRole: 'admin',
    });

    // Invalid milestones totaling 90% (Must fail!)
    await expect(
      commercialService.finalizeContract({
        tenantId,
        projectId: project.id,
        quotationId: quotation.id,
        quotationCustomerApprovalId: quoteApproval.id,
        contractNumber: 'HD-VIN-2026-01',
        title: 'Hợp đồng thi công nội thất văn phòng',
        clientRepresentative: 'Vũ Mạnh Cường (Giám đốc)',
        contractorRepresentative: 'Nguyễn Văn Giám Đốc',
        milestones: [
          { milestoneOrder: 1, name: 'Đợt 1: Tạm ứng ký hợp đồng', percentage: 30, triggerCondition: 'Ký hợp đồng' },
          { milestoneOrder: 2, name: 'Đợt 2: Duyệt bản vẽ sản xuất', percentage: 20, triggerCondition: 'Duyệt bản vẽ' },
          { milestoneOrder: 3, name: 'Đợt 3: Bàn giao nghiệm thu', percentage: 40, triggerCondition: 'Bàn giao' },
        ], // 30 + 20 + 40 = 90% != 100%
      })
    ).rejects.toThrow(MilestonePercentageSumError);

    // Valid milestones totaling 100% (30 + 20 + 30 + 15 + 5 = 100%)
    const contract = await commercialService.finalizeContract({
      tenantId,
      projectId: project.id,
      quotationId: quotation.id,
      quotationCustomerApprovalId: quoteApproval.id,
      contractNumber: 'HD-VIN-2026-01',
      title: 'Hợp đồng thi công nội thất văn phòng',
      clientRepresentative: 'Vũ Mạnh Cường (Giám đốc)',
      contractorRepresentative: 'Nguyễn Văn Giám Đốc',
      milestones: [
        { milestoneOrder: 1, name: 'Đợt 1: Ký hợp đồng & Tạm ứng', percentage: 30, triggerCondition: 'Ký hợp đồng' },
        { milestoneOrder: 2, name: 'Đợt 2: Duyệt bản vẽ sản xuất kỹ thuật', percentage: 20, triggerCondition: 'Duyệt bản vẽ' },
        { milestoneOrder: 3, name: 'Đợt 3: Hoàn thành sản xuất tại xưởng', percentage: 30, triggerCondition: 'Xuất xưởng' },
        { milestoneOrder: 4, name: 'Đợt 4: Lắp đặt hoàn thiện tại công trình', percentage: 15, triggerCondition: 'Lắp đặt xong' },
        { milestoneOrder: 5, name: 'Đợt 5: Nghiệm thu quyết toán & Bàn giao', percentage: 5, triggerCondition: 'Ký biên bản bàn giao' },
      ],
    });

    expect(contract.status).toBe('draft');
    expect(contract.signedDate).toBeNull();
    expect(contract.baselineContractValue).toBe(27000000);
    expect(contract.milestones.length).toBe(5);

    // Finance is not notified until a real customer signature on this contract.
    const queuedFinance = outbox.getQueuedFinanceRecords();
    expect(queuedFinance).toHaveLength(0);
  });
});

