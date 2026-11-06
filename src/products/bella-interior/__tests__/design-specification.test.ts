/**
 * Tests for Bounded Context 1: Design & Specification
 *
 * Verifies Project & Room Zone creation, Design Revision workflow,
 * and Approved Design Lock.
 *
 * @module src/products/bella-interior/__tests__
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { DesignSpecificationService } from '../services/design-specification.service';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import { TenantIsolationViolationError } from '../domain/errors';

describe('Bounded Context 1: Design & Specification', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let service: DesignSpecificationService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    service = new DesignSpecificationService(repository, outbox);
  });

  it('should enforce Tenant Isolation when creating project', async () => {
    await expect(
      service.createProject({
        tenantId: '',
        code: 'INT-01',
        name: 'Villa Ciputra',
        customerId: 'cust-1',
        customerName: 'Nguyễn Văn A',
        customerPhone: '0901234567',
        siteAddress: 'Biệt thự B14 Ciputra, Tây Hồ, Hà Nội',
        projectType: 'residential_villa',
        estimatedBudget: 1500000000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: 'arch-1',
        leadArchitectName: 'KTS. Hoàng Long',
      })
    ).rejects.toThrow(TenantIsolationViolationError);
  });

  it('should create project and room zones successfully', async () => {
    const project = await service.createProject({
      tenantId,
      code: 'INT-CIPUTRA-01',
      name: 'Villa Ciputra Giai Đoạn 2',
      customerId: 'cust-1',
      customerName: 'Nguyễn Văn A',
      customerPhone: '0901234567',
      siteAddress: 'Biệt thự B14 Ciputra, Tây Hồ, Hà Nội',
      projectType: 'residential_villa',
      estimatedBudget: 2500000000,
      targetCompletionDate: '2026-12-31',
      leadArchitectId: 'arch-1',
      leadArchitectName: 'KTS. Hoàng Long',
    });

    expect(project.id).toBeDefined();
    expect(project.status).toBe('survey');

    const livingRoom = await service.createRoomZone({
      tenantId,
      projectId: project.id,
      code: 'R01_LIVING',
      name: 'Phòng khách & Đại sảnh',
      floor: 1,
      areaSquareMeters: 45,
    });

    const masterBed = await service.createRoomZone({
      tenantId,
      projectId: project.id,
      code: 'R02_MASTER',
      name: 'Phòng ngủ Master',
      floor: 2,
      areaSquareMeters: 38,
    });

    const rooms = await repository.listRoomZones(tenantId, project.id);
    expect(rooms.length).toBe(2);
    expect(rooms.map((r) => r.code)).toEqual(['R01_LIVING', 'R02_MASTER']);
  });

  it('should manage design revisions and enforce Approved Design Lock', async () => {
    const project = await service.createProject({
      tenantId,
      code: 'INT-VILLA-01',
      name: 'Villa Thảo Điền',
      customerId: 'cust-2',
      customerName: 'Trần Thị B',
      customerPhone: '0912345678',
      siteAddress: 'Thảo Điền, Quận 2, TP.HCM',
      projectType: 'residential_villa',
      estimatedBudget: 3000000000,
      targetCompletionDate: '2026-11-30',
      leadArchitectId: 'arch-2',
      leadArchitectName: 'KTS. Minh Đức',
    });

    // Create Revision 1 (Draft / In Review)
    const rev1 = await service.createDesignRevision({
      tenantId,
      projectId: project.id,
      title: 'Phương án 3D Concept sơ bộ',
      changeSummary: 'Phương án thiết kế phòng khách và bếp ban đầu',
      submittedBy: 'KTS. Minh Đức',
      assets: [
        {
          type: 'concept_3d',
          title: 'Phối cảnh 3D phòng khách góc nhìn 1',
          fileUrl: 'https://cdn.bella.vn/designs/thao-dien/3d-living-01.jpg',
        },
      ],
      materialSpecs: [
        {
          itemCategory: 'surface_finish',
          brand: 'An Cường',
          code: 'MFC MS 388 EV',
          name: 'Gỗ công nghiệp lõi xanh phủ Melamine',
          specDescription: 'Melamine vân gỗ sồi tự nhiên chống ẩm',
          approvedForUse: true,
        },
      ],
    });

    expect(rev1.versionNumber).toBe(1);
    expect(rev1.status).toBe('client_review');

    // Customer approves Revision 1
    const approvedRev = await service.approveDesignRevision({
      tenantId,
      revisionId: rev1.id,
      approvedBy: 'KTS. Minh Đức',
      clientSignoffName: 'Trần Thị B (Chủ đầu tư)',
    });

    expect(approvedRev.status).toBe('approved');
    expect(approvedRev.clientSignoffName).toBe('Trần Thị B (Chủ đầu tư)');

    // Verify Project status updated
    const updatedProject = await repository.getProject(tenantId, project.id);
    expect(updatedProject?.activeApprovedRevisionId).toBe(approvedRev.id);
    expect(updatedProject?.status).toBe('technical_design');

    // Verify Domain Event was published (Event-After-Persistence)
    const publishedEvents = outbox.getPublishedEvents();
    expect(publishedEvents.length).toBe(1);
    expect(publishedEvents[0].eventType).toBe('interior.design.revision_approved.v1');
  });
});

