/**
 * End-to-End Workflow Test: Bella Interior OS
 *
 * Verifies the complete business value chain:
 * Lead/Project → Design Revision → Approved Lock → BOQ Tripartite Costing
 * → Quotation → Contract Milestones → Production Order → Site Installation
 * → QC Punch List Rectification → Handover & Warranty Care → Project P&L Summary.
 *
 * @module src/products/bella-interior/__tests__
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InteriorOSService } from '../services/interior-os.service';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';

describe('Bella Interior OS — End-to-End Core Value Chain', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let interiorOS: InteriorOSService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    interiorOS = new InteriorOSService(repository, outbox);
  });

  it('should execute the full interior project lifecycle flawlessly', async () => {
    // -------------------------------------------------------------
    // STAGE 1: PROJECT & ROOM CREATION
    // -------------------------------------------------------------
    const project = await interiorOS.design.createProject({
      tenantId,
      code: 'INT-DUBAI-001',
      name: 'Dubai Luxury Villa Fitout',
      customerId: 'cust-vip-1',
      customerName: 'Sheikh Mansoor',
      customerPhone: '+971501234567',
      siteAddress: 'Palm Jumeirah Villa Frond K-12, Dubai',
      projectType: 'residential_villa',
      estimatedBudget: 5000000000,
      targetCompletionDate: '2026-12-30',
      leadArchitectId: 'arch-lead-1',
      leadArchitectName: 'KTS. Lê Hoàng Sơn',
    });

    const livingRoom = await interiorOS.design.createRoomZone({
      tenantId,
      projectId: project.id,
      code: 'R01_LIVING',
      name: 'Phòng Khách Luxury',
      floor: 1,
      areaSquareMeters: 65,
    });

    const masterKitchen = await interiorOS.design.createRoomZone({
      tenantId,
      projectId: project.id,
      code: 'R02_KITCHEN',
      name: 'Bếp Đảo Master',
      floor: 1,
      areaSquareMeters: 45,
    });

    // -------------------------------------------------------------
    // STAGE 2: DESIGN REVISION & APPROVED VERSION LOCK
    // -------------------------------------------------------------
    const rev1 = await interiorOS.design.createDesignRevision({
      tenantId,
      projectId: project.id,
      title: 'Phương án thiết kế 3D & Bản vẽ kỹ thuật 2D V1',
      changeSummary: 'Chốt phối cảnh 3D phòng khách và bếp đảo, phụ kiện Blum',
      submittedBy: 'KTS. Lê Hoàng Sơn',
      assets: [
        {
          type: 'concept_3d',
          title: '3D Render Phòng Khách và Bếp',
          fileUrl: 'https://cdn.bella.vn/interior/dubai/render3d_v1.jpg',
        },
      ],
      materialSpecs: [
        {
          itemCategory: 'surface_finish',
          brand: 'An Cường',
          code: 'Veneer Óc Chó Bắc Mỹ',
          name: 'Veneer Walnut Flitch',
          specDescription: 'Gỗ óc chó tự nhiên sơn bóng mờ 50%',
          approvedForUse: true,
        },
      ],
    });

    // Client confirms & signs off
    const approvedRev = await interiorOS.design.approveDesignRevision({
      tenantId,
      revisionId: rev1.id,
      approvedBy: 'KTS. Lê Hoàng Sơn',
      clientSignoffName: 'Sheikh Mansoor (Chủ đầu tư)',
    });

    expect(approvedRev.status).toBe('approved');

    // -------------------------------------------------------------
    // STAGE 3: BOQ & TRIPARTITE COSTING
    // -------------------------------------------------------------
    const boq = await interiorOS.commercial.createBOQFromApprovedDesign({
      tenantId,
      projectId: project.id,
      designRevisionId: approvedRev.id,
      boqNumber: 'BOQ-DUBAI-001',
      preparedBy: 'QS. Nguyễn Văn Tài',
      rawItems: [
        {
          roomZoneId: livingRoom.id,
          roomZoneName: livingRoom.name,
          itemCode: 'LIV-PANEL-01',
          itemName: 'Hệ vách ốp nan gỗ óc chó kết hợp đá Marble',
          category: 'wall_paneling',
          dimensions: { width: 6000, depth: 150, height: 3200, unit: 'mm' },
          specifications: {
            carcassMaterial: 'Khung xương sắt hộp kết hợp Plywood',
            doorFrontMaterial: 'Nan gỗ óc chó tự nhiên',
            surfaceFinish: 'Sơn PU Inchem mờ 50%',
            hardwareSpec: 'LED thanh nhôm âm vách 3000K',
          },
          unit: 'bộ',
          quantity: 1,
          internalUnitCost: 120000000, // Giá vốn nội bộ
          clientUnitPrice: 195000000,  // Giá chào khách
        },
        {
          roomZoneId: masterKitchen.id,
          roomZoneName: masterKitchen.name,
          itemCode: 'KIT-ISLAND-01',
          itemName: 'Bàn đảo bếp mặt đá Vicostone và tủ rượu',
          category: 'cabinetry',
          dimensions: { width: 3200, depth: 1100, height: 880, unit: 'mm' },
          specifications: {
            carcassMaterial: 'MDF chống ẩm lõi xanh An Cường',
            doorFrontMaterial: 'Cánh kính khung nhôm vàng champagne',
            surfaceFinish: 'Mặt đá thạch anh nhân tạo Vicostone',
            hardwareSpec: 'Ray hộp âm giảm chấn Blum Legrabox',
          },
          unit: 'bộ',
          quantity: 1,
          internalUnitCost: 95000000,
          clientUnitPrice: 165000000,
        },
      ],
    });

    expect(boq.totalInternalCost).toBe(215000000); // 120tr + 95tr
    expect(boq.totalClientPrice).toBe(360000000);  // 195tr + 165tr
    expect(boq.totalGrossMargin).toBe(145000000);  // 360tr - 215tr
    expect(boq.grossMarginPercent).toBeCloseTo(40.28, 1);

    // -------------------------------------------------------------
    // STAGE 4: QUOTATION & 5-MILESTONE CONTRACT
    // -------------------------------------------------------------
    const quotation = await interiorOS.commercial.createQuotation({
      tenantId,
      projectId: project.id,
      boqId: boq.id,
      quotationNumber: 'QUO-DUBAI-001',
      discountAmount: 10000000, // Chiết khấu tri ân 10 triệu
      vatPercent: 8,
    });

    expect(quotation.subtotal).toBe(360000000);
    expect(quotation.discountAmount).toBe(10000000);
    expect(quotation.grandTotal).toBe(378000000); // (360tr - 10tr) * 1.08 = 378tr

    const contract = await interiorOS.commercial.finalizeContract({
      tenantId,
      projectId: project.id,
      quotationId: quotation.id,
      contractNumber: 'HD-DUBAI-2026',
      title: 'Hợp đồng trọn gói thiết kế và sản xuất thi công nội thất',
      clientRepresentative: 'Sheikh Mansoor',
      contractorRepresentative: 'TGĐ. Bella Interior',
      milestones: [
        { milestoneOrder: 1, name: 'Đợt 1: Ký hợp đồng & Tạm ứng', percentage: 30, triggerCondition: 'Ký hợp đồng' },
        { milestoneOrder: 2, name: 'Đợt 2: Duyệt bản vẽ sản xuất kỹ thuật', percentage: 20, triggerCondition: 'Duyệt bản vẽ' },
        { milestoneOrder: 3, name: 'Đợt 3: Hoàn thành sản xuất tại xưởng', percentage: 30, triggerCondition: 'Xuất xưởng' },
        { milestoneOrder: 4, name: 'Đợt 4: Lắp đặt hoàn thiện tại công trình', percentage: 15, triggerCondition: 'Lắp đặt xong' },
        { milestoneOrder: 5, name: 'Đợt 5: Nghiệm thu quyết toán & Bàn giao', percentage: 5, triggerCondition: 'Bàn giao chìa khóa' },
      ],
    });

    expect(contract.status).toBe('signed');
    expect(contract.baselineContractValue).toBe(378000000);

    // Milestone 1 auto-enqueued to Finance Outbox
    const queuedFinance = outbox.getQueuedFinanceRecords();
    expect(queuedFinance.length).toBe(1);
    expect(queuedFinance[0].amount).toBe(113400000); // 30% * 378tr = 113.4tr

    // -------------------------------------------------------------
    // STAGE 5: PRODUCTION ORDER (STRICT LOCK) & WOODWORKING STAGES
    // -------------------------------------------------------------
    const prodOrder = await interiorOS.manufacturing.issueProductionOrder({
      tenantId,
      projectId: project.id,
      designRevisionId: approvedRev.id,
      boqId: boq.id,
      orderNumber: 'LSX-DUBAI-001',
      mode: 'in_house',
      workshopManagerName: 'Quản đốc Phạm Văn Hùng',
      scheduledStartDate: '2026-11-15',
      scheduledCompletionDate: '2026-12-05',
    });

    expect(prodOrder.status).toBe('in_production');
    expect(prodOrder.items.length).toBe(2);

    // Progress items through cutting -> edge banding -> assembly -> qc -> dispatch
    for (const item of prodOrder.items) {
      await interiorOS.manufacturing.advanceWorkshopStage({
        tenantId,
        orderId: prodOrder.id,
        itemId: item.id,
        newStage: 'workshop_qc',
        qcPassed: true,
      });
      await interiorOS.manufacturing.advanceWorkshopStage({
        tenantId,
        orderId: prodOrder.id,
        itemId: item.id,
        newStage: 'packed',
      });
      await interiorOS.manufacturing.advanceWorkshopStage({
        tenantId,
        orderId: prodOrder.id,
        itemId: item.id,
        newStage: 'dispatched',
      });
    }

    const dispatchedOrder = await repository.getProductionOrder(tenantId, prodOrder.id);
    expect(dispatchedOrder?.status).toBe('dispatched');

    // -------------------------------------------------------------
    // STAGE 6: SITE INSTALLATION & SITE DIARY
    // -------------------------------------------------------------
    const installPlan = await interiorOS.manufacturing.createInstallationPlan({
      tenantId,
      projectId: project.id,
      planNumber: 'PLAN-DUBAI-01',
      siteSupervisorId: 'sup-1',
      siteSupervisorName: 'Chỉ huy trưởng Nguyễn Tuấn Anh',
      scheduledStartDate: '2026-12-06',
      scheduledEndDate: '2026-12-20',
    });

    expect(installPlan.rooms.length).toBe(2);

    // Record Site Diary
    const diary = await interiorOS.delivery.recordSiteDiary({
      tenantId,
      projectId: project.id,
      date: '2026-12-08',
      weather: '24 độ C, khô ráo',
      laborHeadcount: 8,
      activitiesCompleted: ['Lắp đặt xong vách nan gỗ phòng khách', 'Căn chỉnh ray trượt bàn đảo bếp'],
      materialDelivered: ['Xe hàng số 1: vách gỗ và mặt đá'],
      supervisorName: 'Nguyễn Tuấn Anh',
    });
    expect(diary.id).toBeDefined();

    // Mark room installations 100%
    for (const room of installPlan.rooms) {
      await interiorOS.manufacturing.updateRoomInstallProgress({
        tenantId,
        planId: installPlan.id,
        roomId: room.id,
        progressPercent: 100,
        status: 'installed_pending_qc',
      });
    }

    const updatedPlan = await repository.getInstallationPlan(tenantId, installPlan.id);
    expect(updatedPlan?.overallProgressPercent).toBe(100);

    // -------------------------------------------------------------
    // STAGE 7: QC PUNCH LIST, HANDOVER & WARRANTY CERTIFICATE
    // -------------------------------------------------------------
    const defect = await interiorOS.delivery.recordPunchListItem({
      tenantId,
      projectId: project.id,
      roomZoneName: 'Bếp Đảo Master',
      itemName: 'Mặt đá bàn đảo Vicostone',
      defectCategory: 'stone_seam_flaw',
      description: 'Mạch ghép đá cạnh góc vát bị kênh 0.5mm',
      severity: 'minor',
      assignedFixer: 'Đội lắp đặt đá - Anh Toàn',
      deadline: '2026-12-18',
    });

    // Rectify and verify
    await interiorOS.delivery.rectifyPunchListItem({
      tenantId,
      itemId: defect.id,
      projectId: project.id,
      rectificationNote: 'Đã mài đánh bóng lại bằng máy chà chuyên dụng, mạch liền mạch 100%',
    });
    await interiorOS.delivery.verifyPunchListItem({
      tenantId,
      itemId: defect.id,
      projectId: project.id,
      verifiedBy: 'KTS. Lê Hoàng Sơn',
    });

    // Complete Handover
    const { dossier, certificate } = await interiorOS.delivery.completeHandover({
      tenantId,
      projectId: project.id,
      contractId: contract.id,
      clientSignoffName: 'Sheikh Mansoor (Khách hàng nghiệm thu)',
      finalSettlementValue: contract.currentContractValue,
      woodworkWarrantyMonths: 24,
      hardwareWarrantyMonths: 60,
      stoneWarrantyMonths: 120,
    });

    expect(dossier.status).toBe('completed');
    expect(dossier.clientAccepted).toBe(true);
    expect(certificate.woodworkWarrantyMonths).toBe(24);
    expect(certificate.hardwareWarrantyMonths).toBe(60);

    // -------------------------------------------------------------
    // STAGE 8: REAL-TIME PROJECT P&L PROFITABILITY SUMMARY
    // -------------------------------------------------------------
    const pnl = await interiorOS.calculateProjectProfitability(tenantId, project.id);
    expect(pnl.contractValue).toBe(378000000);
    expect(pnl.internalCostEstimate).toBe(215000000);
    expect(pnl.expectedGrossProfit).toBe(163000000); // 378tr - 215tr = 163tr
    expect(pnl.grossMarginPercent).toBeCloseTo(43.12, 1);
    expect(pnl.activeStatus).toBe('warranty');
  });
});

