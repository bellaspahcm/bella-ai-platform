/**
 * Tests for Bounded Context 3: Manufacturing & Installation
 *
 * Verifies Production Order issuance with Approved Design Lock,
 * Cabinetry woodworking stage transitions, and Site Installation planning.
 *
 * @module src/products/bella-interior/__tests__
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { DesignSpecificationService } from '../services/design-specification.service';
import { CommercialCostingService } from '../services/commercial-costing.service';
import { ManufacturingInstallationService } from '../services/manufacturing-installation.service';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import { ApprovedDesignLockViolationError } from '../domain/errors';

describe('Bounded Context 3: Manufacturing & Installation', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let designService: DesignSpecificationService;
  let commercialService: CommercialCostingService;
  let mfgService: ManufacturingInstallationService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    designService = new DesignSpecificationService(repository, outbox);
    commercialService = new CommercialCostingService(repository, outbox);
    mfgService = new ManufacturingInstallationService(repository, outbox);
  });

  it('should enforce Approved Design Lock when issuing Production Order', async () => {
    const project = await designService.createProject({
      tenantId,
      code: 'INT-MFG-01',
      name: 'Chung cư Vinhomes GreenBay',
      customerId: 'cust-mfg-1',
      customerName: 'Hoàng Hải Yến',
      customerPhone: '0977889900',
      siteAddress: 'Tòa G3 Vinhomes GreenBay, Nam Từ Liêm, Hà Nội',
      projectType: 'residential_apartment',
      estimatedBudget: 400000000,
      targetCompletionDate: '2026-12-20',
      leadArchitectId: 'arch-mfg-1',
      leadArchitectName: 'KTS. Lê Quang',
    });

    const unapprovedRev = await designService.createDesignRevision({
      tenantId,
      projectId: project.id,
      title: 'Bản vẽ đợt 1',
      submittedBy: 'KTS. Lê Quang',
    });

    // Issuing production order with unapproved design revision MUST throw error
    await expect(
      mfgService.issueProductionOrder({
        tenantId,
        projectId: project.id,
        designRevisionId: unapprovedRev.id,
        boqId: 'boq-dummy',
        orderNumber: 'LSX-2026-001',
        mode: 'in_house',
        workshopManagerName: 'Trưởng xưởng Trần Văn Ba',
        scheduledStartDate: '2026-11-10',
        scheduledCompletionDate: '2026-11-25',
      })
    ).rejects.toThrow(ApprovedDesignLockViolationError);
  });

  it('should track Cabinetry woodworking stages through to packaging and dispatch', async () => {
    const project = await designService.createProject({
      tenantId,
      code: 'INT-MFG-02',
      name: 'Nhà phố Starlake',
      customerId: 'cust-mfg-2',
      customerName: 'Ngô Quốc Bảo',
      customerPhone: '0911223344',
      siteAddress: 'Khu đô thị Tây Hồ Tây Starlake, Hà Nội',
      projectType: 'residential_townhouse',
      estimatedBudget: 900000000,
      targetCompletionDate: '2026-12-05',
      leadArchitectId: 'arch-mfg-2',
      leadArchitectName: 'KTS. Hà Anh',
    });

    const rev = await designService.createDesignRevision({
      tenantId,
      projectId: project.id,
      title: 'Hồ sơ bản vẽ sản xuất kỹ thuật 2D',
      submittedBy: 'KTS. Hà Anh',
    });
    const approvedRev = await designService.approveDesignRevision({
      tenantId,
      revisionId: rev.id,
      approvedBy: 'KTS. Hà Anh',
      clientSignoffName: 'Ngô Quốc Bảo',
    });

    const boq = await commercialService.createBOQFromApprovedDesign({
      tenantId,
      projectId: project.id,
      designRevisionId: approvedRev.id,
      boqNumber: 'BOQ-STARLAKE-01',
      preparedBy: 'QS. Thu Hà',
      rawItems: [
        {
          roomZoneId: 'room-liv',
          roomZoneName: 'Phòng Khách',
          itemCode: 'LIV-TV-WALL',
          itemName: 'Hệ tủ kệ Tivi kết hợp vách lam sóng',
          category: 'cabinetry',
          dimensions: { width: 3200, depth: 400, height: 2600, unit: 'mm' },
          specifications: {
            carcassMaterial: 'MDF lõi xanh phủ Melamine',
            doorFrontMaterial: 'Cánh kính khung nhôm xám khói',
            surfaceFinish: 'Lam sóng than tre',
            hardwareSpec: 'Bản lề Blum Clip Top giảm chấn',
          },
          unit: 'bộ',
          quantity: 1,
          internalUnitCost: 28000000,
          clientUnitPrice: 46000000,
        },
      ],
    });

    // Issue Production Order
    const order = await mfgService.issueProductionOrder({
      tenantId,
      projectId: project.id,
      designRevisionId: approvedRev.id,
      boqId: boq.id,
      orderNumber: 'LSX-STARLAKE-01',
      mode: 'in_house',
      workshopManagerName: 'Quản đốc Nguyễn Văn Dũng',
      scheduledStartDate: '2026-11-12',
      scheduledCompletionDate: '2026-11-28',
    });

    expect(order.status).toBe('in_production');
    expect(order.items.length).toBe(1);
    expect(order.items[0].currentStage).toBe('cutting_cnc');

    const item = order.items[0];

    // Stage 1 -> Stage 2: Edge Banding
    const orderStage2 = await mfgService.advanceWorkshopStage({
      tenantId,
      orderId: order.id,
      itemId: item.id,
      newStage: 'edge_banding',
    });
    expect(orderStage2.items[0].currentStage).toBe('edge_banding');

    // Stage 2 -> Stage 3: Assembly
    const orderStage3 = await mfgService.advanceWorkshopStage({
      tenantId,
      orderId: order.id,
      itemId: item.id,
      newStage: 'pre_assembly',
    });
    expect(orderStage3.items[0].currentStage).toBe('pre_assembly');

    // Stage 3 -> Stage 4: Workshop QC Passed
    const orderStage4 = await mfgService.advanceWorkshopStage({
      tenantId,
      orderId: order.id,
      itemId: item.id,
      newStage: 'workshop_qc',
      qcPassed: true,
      qcNotes: 'Kiểm tra đường ghép mòi và dán cạnh không hở keo, bản lề êm',
    });
    expect(orderStage4.items[0].qcPassed).toBe(true);

    // Stage 4 -> Stage 5: Packed
    const orderStage5 = await mfgService.advanceWorkshopStage({
      tenantId,
      orderId: order.id,
      itemId: item.id,
      newStage: 'packed',
    });
    expect(orderStage5.status).toBe('ready_for_dispatch');

    // Stage 5 -> Stage 6: Dispatched to Site
    const orderStage6 = await mfgService.advanceWorkshopStage({
      tenantId,
      orderId: order.id,
      itemId: item.id,
      newStage: 'dispatched',
    });
    expect(orderStage6.status).toBe('dispatched');
    expect(orderStage6.actualDispatchedDate).toBeDefined();
  });
});

