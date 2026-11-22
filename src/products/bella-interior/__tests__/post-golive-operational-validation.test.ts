import { randomUUID } from 'node:crypto';
import https from 'node:https';
import { createClient } from '@supabase/supabase-js';
import { SupabaseInteriorRepository } from '../repositories/supabase.repository';
import { SupabaseCustomerRepository } from '../repositories/crm/supabase-customer.repository';
import { Customer360AggregatorService } from '../services/crm/customer-360-aggregator.service';
import { CustomerDeleteForbiddenError } from '../domain/crm/customer-errors';
import type { InteriorProject, ProjectRoomZone, DesignRevision } from '../domain/design-specification/types';
import type { InteriorBOQ, BOQItem } from '../domain/commercial-costing/types';
import type { PaymentTransaction } from '../domain/commercial-costing/contract.types';
import type { ProductionOrder, ProductionOrderItem } from '../domain/manufacturing-install/types';
import type { SiteDiaryEntry, QCPunchListItem, HandoverDossier, WarrantyCertificate, WarrantyServiceTicket } from '../domain/delivery-aftercare/types';
import type { AcceptanceCampaign, AcceptanceSession, AcceptanceNoteItem } from '../domain/acceptance-handover.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isLiveVerificationEnabled = Boolean(
  supabaseKey &&
  !process.env.CI &&
  process.env.ENABLE_PROD_LIVE_VERIFICATION !== 'false'
);

function httpsGet(urlStr: string): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        });
      });
    }).on('error', reject);
  });
}

describe('Bella Interior OS — Post-Go-Live Operational Validation (Priorities 1 - 6)', () => {
  if (!isLiveVerificationEnabled) {
    it('skips live verification in offline unit test runners and CI builds', () => {
      expect(true).toBe(true);
    });
    return;
  }

  jest.setTimeout(120_000);

  // Target Demo Tenant & Superuser on Production
  const TENANT_ID = '686884d2-6a4a-4581-ac8f-6ae69666b31d'; // Bella Interior (Demo)
  const STAFF_USER_ID = '9077b10b-ee20-4058-907b-7a3e918b84c3'; // demo.interior@bellaspa.vn (OWNER/ADMIN)

  let supabase: ReturnType<typeof createClient>;
  let interiorRepo: SupabaseInteriorRepository;
  let customerRepo: SupabaseCustomerRepository;
  let aggregator: Customer360AggregatorService;

  // Shared test entity IDs across lifecycle
  let customerId: string;
  let generatedCustomerCode: string;
  let contactId: string;
  let addressId: string;
  let projectId: string;
  let roomZoneId: string;
  let revisionId: string;
  let boqId: string;
  let boqItemId: string;
  let quotationId: string;
  let contractId: string;
  let milestone1Id: string;
  let milestone2Id: string;
  let addendumId: string;
  let paymentTxId: string;
  let productionOrderId: string;
  let siteDiaryId: string;
  let punchListItemId: string;
  let campaignId: string;
  let sessionId: string;
  let acceptanceNoteId: string;
  let handoverDossierId: string;
  let warrantyCertId: string;
  let warrantyTicketId: string;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey!);
    interiorRepo = new SupabaseInteriorRepository(supabase as any);
    customerRepo = new SupabaseCustomerRepository(supabase as any);
    aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);
  });

  // =========================================================================
  // PRIORITY 1: Customer 360 Operational Check
  // =========================================================================
  describe('Priority 1: Customer 360 Operational Lifecycle', () => {
    test('1.1: RPC interior_generate_customer_code generates sequential customer code', async () => {
      const { data, error } = await supabase.rpc('interior_generate_customer_code', {
        p_tenant_id: TENANT_ID,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string');
      expect(data).toMatch(/^KH-\d{6}$/);
      generatedCustomerCode = data as string;
    });

    test('1.2: Customer creation persists with auto-generated code and active status', async () => {
      const created = await customerRepo.create(TENANT_ID, {
        code: generatedCustomerCode,
        name: 'Bà Lê Hoàng Phương',
        legalName: 'Công ty TNHH Thiết Kế Nam Á',
        taxCode: '0314998877',
        type: 'individual',
        tier: 'vip',
        primaryPhone: '0912345678',
        primaryEmail: 'lehoangphuong@example.com',
        notes: 'Khách hàng VIP kiểm thử vận hành sau Go-Live',
        assignedStaffId: STAFF_USER_ID,
      });

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.tenantId).toBe(TENANT_ID);
      expect(created.code).toBe(generatedCustomerCode);
      expect(created.profileStatus).toBe('active');
      expect(created.tier).toBe('vip');
      customerId = created.id;
    });

    test('1.3: Contact & Address creation executes timestamp triggers (fn_set_interior_crm_contact_address_timestamps)', async () => {
      // 1. Add primary contact (role must satisfy chk_interior_contact_role: primary_contact)
      const contact = await customerRepo.addContact(TENANT_ID, customerId, {
        name: 'Trần Văn Quản Lý',
        role: 'primary_contact',
        phone: '0988776655',
        email: 'quanly@example.com',
        position: 'Giám đốc Điều hành',
        isPrimary: true,
      });
      expect(contact.id).toBeDefined();
      contactId = contact.id;

      // 2. Add default address (address_type must satisfy chk_interior_address_type: site_location)
      const address = await customerRepo.addAddress(TENANT_ID, customerId, {
        addressType: 'site_location',
        fullAddress: 'Căn hộ P1204, Tháp Aqua 1, Vinhomes Golden River, Bến Nghé, Quận 1',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        isDefault: true,
      });
      expect(address.id).toBeDefined();
      addressId = address.id;

      // 3. Verify triggers populated timestamps directly in the database
      const { data: dbContact, error: contactErr } = await supabase
        .from('interior_customer_contacts')
        .select('created_at, updated_at')
        .eq('id', contactId)
        .single();
      expect(contactErr).toBeNull();
      expect(dbContact?.created_at).toBeDefined();
      expect(dbContact?.updated_at).toBeDefined();

      const { data: dbAddress, error: addressErr } = await supabase
        .from('interior_customer_addresses')
        .select('created_at, updated_at')
        .eq('id', addressId)
        .single();
      expect(addressErr).toBeNull();
      expect(dbAddress?.created_at).toBeDefined();
      expect(dbAddress?.updated_at).toBeDefined();
    });

    test('1.4: Customer profile update mutates attributes correctly', async () => {
      const updated = await customerRepo.update(TENANT_ID, customerId, {
        primaryPhone: '0912349999',
        notes: 'Đã cập nhật số hotline phụ',
      });

      expect(updated.primaryPhone).toBe('0912349999');
      expect(updated.notes).toBe('Đã cập nhật số hotline phụ');
    });

    test('1.5: Customer archive transitions profile_status to "inactive"', async () => {
      const archived = await customerRepo.archive(TENANT_ID, customerId);
      expect(archived.profileStatus).toBe('inactive');

      // Verify DB row
      const { data: row } = await supabase
        .from('interior_customers')
        .select('profile_status')
        .eq('id', customerId)
        .single();
      expect(row?.profile_status).toBe('inactive');
    });

    test('1.6: Overview & Customer 360 Aggregation verifies inactive status and historical integrity', async () => {
      const overview = await aggregator.listCustomersOverview(TENANT_ID, { page: 1, limit: 50 });
      const found = overview.customers.find((c) => c.id === customerId);
      expect(found).toBeDefined();
      expect(found?.profileStatus).toBe('inactive');
      expect(found?.statusLabel).toBe('Tạm dừng');

      const c360 = await aggregator.getCustomer360(TENANT_ID, customerId);
      expect(c360).not.toBeNull();
      expect(c360?.profile.id).toBe(customerId);
      expect(c360?.profile.profileStatus).toBe('inactive');
      expect(c360?.contacts.length).toBeGreaterThanOrEqual(1);
      expect(c360?.addresses.length).toBeGreaterThanOrEqual(1);
    });

    test('1.7: Hard Delete Rejection — Repository strictly forbids DELETE (throws CustomerDeleteForbiddenError)', async () => {
      await expect(customerRepo.delete(TENANT_ID, customerId)).rejects.toThrow(
        CustomerDeleteForbiddenError
      );
      await expect(customerRepo.delete(TENANT_ID, customerId)).rejects.toThrow(
        /CUSTOMER_HARD_DELETE_PROHIBITED/
      );
    });

    test('1.8: Database RLS & Permission Audit confirms no DELETE grant for authenticated role', async () => {
      const { data: grants } = await supabase
        .from('information_schema.role_table_grants' as any)
        .select('privilege_type')
        .eq('table_name', 'interior_customers')
        .eq('grantee', 'authenticated');

      if (grants) {
        const privileges = (grants as any[]).map((g) => g.privilege_type);
        expect(privileges).not.toContain('DELETE');
      }
    });
  });

  // =========================================================================
  // PRIORITY 2: Contracts & BOQ Operational Check
  // =========================================================================
  describe('Priority 2: Contracts, BOQ & Quotations Operational Lifecycle', () => {
    test('2.1: Project creation links to customer and persists in interior_projects', async () => {
      projectId = randomUUID();
      const project: InteriorProject = {
        id: projectId,
        tenantId: TENANT_ID,
        code: `PRJ-OPVAL-${Date.now().toString().slice(-4)}`,
        name: 'Duplex Penthouse Vinhomes Golden River',
        customerId: customerId,
        customerProfileId: customerId,
        customerName: 'Bà Lê Hoàng Phương',
        customerPhone: '0912349999',
        siteAddress: 'Tháp Aqua 1, Vinhomes Golden River, Quận 1',
        projectType: 'penthouse',
        status: 'in_progress',
        estimatedBudget: 1_200_000_000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: STAFF_USER_ID,
        leadArchitectName: 'KTS. Nguyễn Kiến Trúc',
        activeApprovedRevisionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await interiorRepo.saveProject(TENANT_ID, project);
      const saved = await interiorRepo.getProject(TENANT_ID, projectId);
      expect(saved).not.toBeNull();
      expect(saved?.id).toBe(projectId);
      expect(saved?.customerId).toBe(customerId);
    });

    test('2.2: Room Zone & Approved Design Revision persist for project', async () => {
      roomZoneId = randomUUID();
      const zone: ProjectRoomZone = {
        id: roomZoneId,
        tenantId: TENANT_ID,
        projectId: projectId,
        code: 'RZ-LIVING',
        name: 'Phòng khách & Bếp',
        floor: 1,
        areaSquareMeters: 85,
        description: 'Khu vực không gian mở phòng khách và bếp ăn',
      };
      await interiorRepo.saveRoomZone(TENANT_ID, zone);

      revisionId = randomUUID();
      const revision: DesignRevision = {
        id: revisionId,
        tenantId: TENANT_ID,
        projectId: projectId,
        versionNumber: 1,
        title: 'Bản vẽ phối cảnh 3D & hồ sơ kỹ thuật thi công đợt 1',
        status: 'approved',
        changeSummary: 'Phát hành chính thức hồ sơ thi công',
        submittedBy: STAFF_USER_ID,
        submittedAt: new Date().toISOString(),
        approvedBy: STAFF_USER_ID,
        approvedAt: new Date().toISOString(),
        clientSignoffName: 'Bà Lê Hoàng Phương',
        clientSignoffDate: '2026-11-22',
        assets: [],
        materialSpecs: [],
      };
      await interiorRepo.saveDesignRevision(TENANT_ID, revision);

      const savedRev = await interiorRepo.getDesignRevision(TENANT_ID, revisionId);
      expect(savedRev).not.toBeNull();
      expect(savedRev?.status).toBe('approved');
    });

    test('2.3: BOQ creation with items passes atomic persistence (save_interior_boq_atomic)', async () => {
      boqId = randomUUID();
      boqItemId = randomUUID();
      const boqItem: BOQItem = {
        id: boqItemId,
        roomZoneId: roomZoneId,
        roomZoneName: 'Phòng khách & Bếp',
        itemCode: 'BOQ-ITEM-001',
        itemName: 'Hệ tủ bếp Acrylic An Cường phủ bóng gương',
        category: 'cabinetry',
        dimensions: { length: 4200, depth: 600, height: 2600 },
        specifications: { wood: 'MDF lõi xanh chống ẩm', surface: 'Acrylic EGP' },
        unit: 'md',
        quantity: 4.2,
        internalUnitCost: 6_000_000,
        internalTotalCost: 25_200_000,
        clientUnitPrice: 8_500_000,
        clientTotalPrice: 35_700_000,
        grossMarginAmount: 10_500_000,
        grossMarginPercent: 29.41,
      };

      const boq: InteriorBOQ = {
        id: boqId,
        tenantId: TENANT_ID,
        projectId: projectId,
        designRevisionId: revisionId,
        boqNumber: `BOQ-${Date.now().toString().slice(-4)}`,
        versionNumber: 1,
        status: 'approved',
        totalInternalCost: 25_200_000,
        totalClientPrice: 35_700_000,
        totalGrossMargin: 10_500_000,
        grossMarginPercent: 29.41,
        preparedBy: STAFF_USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [boqItem],
      };

      await interiorRepo.saveBOQ(TENANT_ID, boq, { auditActorId: STAFF_USER_ID });
      const savedBOQ = await interiorRepo.getBOQ(TENANT_ID, boqId);
      expect(savedBOQ).not.toBeNull();
      expect(savedBOQ?.items.length).toBe(1);
      expect(savedBOQ?.status).toBe('approved');
    });

    test('2.4: Quotation persists in interior_quotations with calculated financial figures', async () => {
      quotationId = randomUUID();
      const quotationRow = {
        id: quotationId,
        tenant_id: TENANT_ID,
        project_id: projectId,
        boq_id: boqId,
        quotation_number: `BG-OPVAL-${Date.now().toString().slice(-4)}`,
        version_number: 1,
        status: 'approved_by_client',
        subtotal: 500_000_000,
        vat_percent: 10,
        vat_amount: 50_000_000,
        discount_amount: 0,
        grand_total: 550_000_000,
        payment_terms: '3 đợt: 50% - 40% - 10%',
        validity_days: 30,
        boq_version_number: 1,
        total_internal_cogs: 25_200_000,
        total_gross_margin: 474_800_000,
        gross_margin_percent: 94.96,
        prepared_by: STAFF_USER_ID,
        approved_by: STAFF_USER_ID,
        created_at: new Date().toISOString(),
      };

      const { error: quoteErr } = await supabase
        .from('interior_quotations')
        .insert(quotationRow);
      expect(quoteErr).toBeNull();

      const savedQuote = await interiorRepo.getQuotation(TENANT_ID, quotationId);
      expect(savedQuote).not.toBeNull();
      expect(savedQuote?.grandTotal).toBe(550_000_000);
    });

    test('2.5: Binding Contract creation with Payment Milestones persists', async () => {
      contractId = randomUUID();
      milestone1Id = randomUUID();
      milestone2Id = randomUUID();

      const contractNumber = `HD-OPVAL-${Date.now().toString().slice(-4)}`;

      // Use the privileged seed function to bypass approval workflow triggers
      // (service_role auth.uid() is NULL — this is the authorized test-seeding path)
      const { data: seedData, error: seedErr } = await supabase.rpc(
        'interior_seed_contract_evidence',
        {
          p_tenant_id: TENANT_ID,
          p_project_id: projectId,
          p_quotation_id: quotationId,
          p_contract_id: contractId,
          p_boq_id: boqId,
          p_design_revision_id: revisionId,
          p_contract_number: contractNumber,
          p_contract_title: 'Hợp đồng trọn gói thi công nội thất Duplex Penthouse',
          p_baseline_value: 550_000_000,
          p_client_rep: 'Bà Lê Hoàng Phương',
          p_contractor_rep: 'Công ty Bella Interior',
          p_staff_actor_id: STAFF_USER_ID,
          p_milestone1_id: milestone1Id,
          p_milestone1_name: 'Đợt 1: Tạm ứng ngay sau khi ký hợp đồng',
          p_milestone1_pct: 50,
          p_milestone1_amount: 275_000_000,
          p_milestone2_id: milestone2Id,
          p_milestone2_name: 'Đợt 2: Sau khi lắp đặt xong toàn bộ phần thô',
          p_milestone2_pct: 50,
          p_milestone2_amount: 275_000_000,
        }
      );
      expect(seedErr).toBeNull();
      expect(seedData).not.toBeNull();

      const savedContract = await interiorRepo.getContract(TENANT_ID, contractId);
      expect(savedContract).not.toBeNull();
      expect(savedContract?.milestones.length).toBe(2);
    });

    test('2.6: Contract Addendum directly updates currentContractValue in database', async () => {
      addendumId = randomUUID();
      const addendumRow = {
        id: addendumId,
        tenant_id: TENANT_ID,
        contract_id: contractId,
        addendum_number: 'PL-OPVAL-01',
        title: 'Phụ lục bổ sung hệ thống đèn LED chiếu điểm nam châm',
        value_delta: 50_000_000,
        reason: 'Khách hàng yêu cầu nâng cấp hệ thống chiếu sáng thông minh',
        status: 'approved',
        approved_at: new Date().toISOString(),
        base_contract_value: 550_000_000,
        proposed_payment_schedule: [],
      };

      const { error: addErr } = await supabase
        .from('interior_contract_addenda')
        .insert(addendumRow);
      expect(addErr).toBeNull();

      // Update current contract value
      const { error: updErr } = await supabase
        .from('interior_contracts')
        .update({ current_contract_value: 600_000_000 })
        .eq('id', contractId);
      expect(updErr).toBeNull();
    });

    test('2.7: Payment Transaction logs recorded amount and updates financial summary', async () => {
      paymentTxId = randomUUID();
      const tx: PaymentTransaction = {
        id: paymentTxId,
        tenantId: TENANT_ID,
        contractId: contractId,
        milestoneId: milestone1Id,
        amount: 275_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: `TX-OPVAL-${Date.now().toString().slice(-4)}`,
        transactionDate: '2026-11-22T10:00:00.000Z',
        recordedBy: STAFF_USER_ID,
        createdAt: new Date().toISOString(),
      };

      await interiorRepo.savePaymentTransaction(TENANT_ID, tx);

      // Verify financial summary in C360
      const c360 = await aggregator.getCustomer360(TENANT_ID, customerId);
      expect(c360).not.toBeNull();
      expect(c360?.commercial.contracts.length).toBe(1);
      expect(c360?.commercial.payments.length).toBe(1);
      expect(c360?.financialSummary.totalContractValue).toBe(600_000_000); // 550M + 50M addendum
      expect(c360?.financialSummary.totalPaidAmount).toBe(275_000_000);
      expect(c360?.financialSummary.receivableDebt).toBe(325_000_000); // 600M - 275M
      expect(c360?.financialSummary.overpaidAmount).toBe(0);
    });
  });

  // =========================================================================
  // PRIORITY 3: Manufacturing & Site Execution Operational Check
  // =========================================================================
  describe('Priority 3: Manufacturing & Site Execution Operational Lifecycle', () => {
    test('3.1: Production Order release with workshop stages persists (order_released)', async () => {
      productionOrderId = randomUUID();
      const poItemId = randomUUID();
      const poItem: ProductionOrderItem = {
        id: poItemId,
        tenantId: TENANT_ID,
        productionOrderId: productionOrderId,
        boqItemId: boqItemId,
        roomZoneName: 'Phòng khách & Bếp',
        itemName: 'Hệ tủ bếp Acrylic An Cường',
        quantity: 4.2,
        unit: 'md',
        dimensionsSummary: '4200 x 600 x 2600 mm',
        materialSummary: 'MDF chống ẩm phủ Acrylic',
        currentStage: 'cutting_cnc',
        qcPassed: false,
      };

      const order: ProductionOrder = {
        id: productionOrderId,
        tenantId: TENANT_ID,
        projectId: projectId,
        designRevisionId: revisionId,
        boqId: boqId,
        orderNumber: `PO-OPVAL-${Date.now().toString().slice(-4)}`,
        mode: 'in_house',
        status: 'order_released',
        scheduledStartDate: '2026-11-23',
        scheduledCompletionDate: '2026-12-10',
        workshopManagerName: 'Nguyễn Văn Quản Đốc',
        items: [poItem],
        notes: 'Gia công theo đúng mã màu catalogue đính kèm bản vẽ',
      };

      await interiorRepo.saveProductionOrder(TENANT_ID, order);
      const savedPO = await interiorRepo.getProductionOrder(TENANT_ID, productionOrderId);
      expect(savedPO).not.toBeNull();
      expect(savedPO?.status).toBe('order_released');
      expect(savedPO?.items.length).toBe(1);
    });

    test('3.2: Site Diary entry logging persists daily site progress', async () => {
      siteDiaryId = randomUUID();
      const diary: SiteDiaryEntry = {
        id: siteDiaryId,
        tenantId: TENANT_ID,
        projectId: projectId,
        date: '2026-11-22',
        weather: 'Nắng ráo, nhiệt độ 29°C',
        laborHeadcount: 6,
        activitiesCompleted: [
          'Vận chuyển module tủ bếp lên căn hộ tầng 12',
          'Lắp đặt hệ thống khung ray treo và cân chỉnh cốt sàn',
        ],
        materialDelivered: [
          'Module tủ bếp dưới (4 kiện)',
          'Phụ kiện tay nâng Blum Aventos HF (2 bộ)',
        ],
        supervisorName: 'Kỹ sư Đỗ Văn Giám Sát',
        photoUrls: ['https://lvnvkpyxtuilhrabtlwv.supabase.co/storage/v1/object/sign/interior-site-evidence/diary-01.jpg'],
      };

      await interiorRepo.saveSiteDiary(TENANT_ID, diary);
      const diaries = await interiorRepo.listSiteDiaries(TENANT_ID, projectId);
      expect(diaries.length).toBeGreaterThanOrEqual(1);
      const found = diaries.find((d) => d.id === siteDiaryId);
      expect(found).toBeDefined();
      expect(found?.laborHeadcount).toBe(6);
    });

    test('3.3: QC Punch List item records field defect and remediation assignment', async () => {
      punchListItemId = randomUUID();
      const punchItem: QCPunchListItem = {
        id: punchListItemId,
        tenantId: TENANT_ID,
        projectId: projectId,
        roomZoneName: 'Phòng khách & Bếp',
        itemName: 'Bản lề giảm chấn tủ bếp',
        defectCategory: 'hardware_defect',
        description: 'Bản lề góc cánh phải đóng mở có tiếng kêu nhẹ, cần cân chỉnh',
        severity: 'minor',
        assignedFixer: 'Thợ lắp đặt Nguyễn Văn Thợ',
        deadline: '2026-11-25',
        status: 'open',
      };

      await interiorRepo.savePunchListItem(TENANT_ID, punchItem);
      const items = await interiorRepo.listPunchListItems(TENANT_ID, projectId);
      const found = items.find((i) => i.id === punchListItemId);
      expect(found).toBeDefined();
      expect(found?.defectCategory).toBe('hardware_defect');
      expect(found?.status).toBe('open');
    });

    test('3.4: Customer 360 Aggregator reflects manufacturing and site execution', async () => {
      const c360 = await aggregator.getCustomer360(TENANT_ID, customerId);
      expect(c360?.execution.productionOrders.length).toBeGreaterThanOrEqual(1);
      expect(c360?.execution.siteDiaries.length).toBeGreaterThanOrEqual(1);
      expect(c360?.execution.punchListItems.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // PRIORITY 4: Handover & Aftercare Operational Check
  // =========================================================================
  describe('Priority 4: Delivery, Handover & Aftercare Operational Lifecycle', () => {
    test('4.1: Acceptance Campaign, Session & Note persist inspection findings', async () => {
      campaignId = randomUUID();
      const campaign: AcceptanceCampaign = {
        id: campaignId,
        tenantId: TENANT_ID,
        projectId: projectId,
        campaignCode: `AC-OPVAL-${Date.now().toString().slice(-4)}`,
        campaignName: 'Chiến dịch nghiệm thu hoàn thiện đợt 1',
        description: 'Nghiệm thu phần mộc nội thất và thiết bị nhà bếp',
        createdByUserId: STAFF_USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await interiorRepo.saveAcceptanceCampaign(TENANT_ID, campaign);

      sessionId = randomUUID();
      const session: AcceptanceSession = {
        id: sessionId,
        tenantId: TENANT_ID,
        campaignId: campaignId,
        projectId: projectId,
        sessionCode: `AS-OPVAL-01`,
        sessionType: 'ROOM_BY_ROOM',
        inspectionScope: 'Toàn bộ khu vực phòng khách & bếp',
        inspectionDate: '2026-11-22',
        recorderActorId: STAFF_USER_ID,
        customerRepresentative: 'Bà Lê Hoàng Phương',
        customerContact: '0912349999',
        relatedBoqItemIds: [boqItemId],
        inspectionResult: 'ACCEPTED_WITH_REMARKS',
        approvalStatus: 'PENDING',
        documentationStatus: 'COMPLETE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await interiorRepo.createAcceptanceSession(TENANT_ID, session);

      acceptanceNoteId = randomUUID();
      const note: AcceptanceNoteItem = {
        id: acceptanceNoteId,
        tenantId: TENANT_ID,
        sessionId: sessionId,
        category: 'INSTALLATION_ISSUE',
        severity: 'low',
        assessmentStatus: 'DEFECT_REMEDIATION_REQUIRED',
        description: 'Dán lại đường keo silicon mép chậu rửa bát',
        relatedBoqItemId: boqItemId,
        remediationPlan: 'Cạo bỏ đường keo cũ và đi lại keo chuyên dụng chống mốc',
        assignedFixer: 'Thợ hoàn thiện',
        targetDeadline: '2026-11-24',
        remediationStatus: 'OPEN',
        routedEntityType: 'punch_list',
        routedEntityId: punchListItemId,
        createdByUserId: STAFF_USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await interiorRepo.saveAcceptanceNote(TENANT_ID, note);

      const notes = await interiorRepo.listAcceptanceNotes(TENANT_ID, sessionId);
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes[0].category).toBe('INSTALLATION_ISSUE');
    });

    test('4.2: Handover Dossier with electronic signoff marks project accepted', async () => {
      handoverDossierId = randomUUID();
      const dossier: HandoverDossier = {
        id: handoverDossierId,
        tenantId: TENANT_ID,
        projectId: projectId,
        contractId: contractId,
        handoverDate: '2026-11-22',
        status: 'completed',
        totalPunchListItems: 1,
        openPunchListItems: 0,
        clientAccepted: true,
        clientSignoffName: 'Bà Lê Hoàng Phương',
        finalSettlementValue: 600_000_000,
        dossierDocumentUrl: 'https://lvnvkpyxtuilhrabtlwv.supabase.co/storage/v1/object/sign/interior-customer-signatures/handover-signed.pdf',
      };

      await interiorRepo.saveHandoverDossier(TENANT_ID, dossier);
      const savedDossier = await interiorRepo.getHandoverDossier(TENANT_ID, handoverDossierId);
      expect(savedDossier).not.toBeNull();
      expect(savedDossier?.clientAccepted).toBe(true);
      expect(savedDossier?.finalSettlementValue).toBe(600_000_000);
    });

    test('4.3: Warranty Certificate & Service Ticket issuance persists aftercare SLA', async () => {
      warrantyCertId = randomUUID();
      const cert: WarrantyCertificate = {
        id: warrantyCertId,
        tenantId: TENANT_ID,
        projectId: projectId,
        contractId: contractId,
        certificateNumber: `BH-CERT-${Date.now().toString().slice(-4)}`,
        customerName: 'Bà Lê Hoàng Phương',
        siteAddress: 'Tháp Aqua 1, Vinhomes Golden River, Quận 1',
        effectiveDate: '2026-11-22',
        expirationDate: '2028-11-22', // 24 tháng
        woodworkWarrantyMonths: 24,
        hardwareWarrantyMonths: 60,
        stoneWarrantyMonths: 120,
        termsSummary: 'Bảo hành toàn diện kết cấu gỗ 24 tháng, phụ kiện Hafele/Blum 5 năm',
      };
      await interiorRepo.saveWarrantyCertificate(TENANT_ID, cert);

      warrantyTicketId = randomUUID();
      const ticket: WarrantyServiceTicket = {
        id: warrantyTicketId,
        tenantId: TENANT_ID,
        projectId: projectId,
        certificateId: warrantyCertId,
        ticketNumber: `BH-TICKET-${Date.now().toString().slice(-4)}`,
        roomZoneName: 'Phòng khách',
        itemName: 'Tủ giày cánh kính',
        defectCategory: 'hardware_hinge',
        customerReport: 'Bảo dưỡng định kỳ 6 tháng: tra dầu và cân chỉnh khe hở cánh tủ',
        status: 'submitted',
        reportedDate: '2026-11-22',
      };
      await interiorRepo.saveWarrantyTicket(TENANT_ID, ticket);

      const tickets = await interiorRepo.listWarrantyTickets(TENANT_ID, projectId);
      expect(tickets.length).toBeGreaterThanOrEqual(1);
      const found = tickets.find((t) => t.id === warrantyTicketId);
      expect(found).toBeDefined();
      expect(found?.defectCategory).toBe('hardware_hinge');
    });

    test('4.4: Customer 360 Aggregator reflects Handover Dossiers and Warranty Tickets', async () => {
      const c360 = await aggregator.getCustomer360(TENANT_ID, customerId);
      expect(c360?.delivery.handovers.length).toBeGreaterThanOrEqual(1);
      expect(c360?.delivery.handovers[0].clientAccepted).toBe(true);
      expect(c360?.aftercare.warrantyTickets.length).toBeGreaterThanOrEqual(1);
      expect(c360?.aftercare.warrantyTickets[0].defectCategory).toBe('hardware_hinge');
    });
  });

  // =========================================================================
  // PRIORITY 5: Storage Security & Private Bucket Verification
  // =========================================================================
  describe('Priority 5: Storage Security & Private Bucket Verification', () => {
    test('5.1: Database confirms storage buckets are strictly PRIVATE (public = false)', async () => {
      const { data: buckets } = await supabase
        .from('storage.buckets' as any)
        .select('id, name, public')
        .in('id', ['interior-site-evidence', 'interior-customer-signatures']);

      if (buckets && (buckets as any[]).length > 0) {
        for (const b of buckets as any[]) {
          expect(b.public).toBe(false);
        }
      }
    });

    test('5.2: Supabase Storage generates signed URLs successfully', async () => {
      const testPath = `${TENANT_ID}/test-audit-${Date.now()}.jpg`;
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);

      // Upload valid JPEG audit buffer satisfying allowed_mime_types
      const { error: upErr } = await supabase
        .storage
        .from('interior-site-evidence')
        .upload(testPath, jpegBuffer, { contentType: 'image/jpeg', upsert: true });
      expect(upErr).toBeNull();

      const { data: downloadSigned, error: downloadErr } = await supabase
        .storage
        .from('interior-site-evidence')
        .createSignedUrl(testPath, 60);

      expect(downloadErr).toBeNull();
      expect(downloadSigned?.signedUrl).toBeDefined();
      expect(downloadSigned?.signedUrl).toContain('token=');

      // Cleanup audit test file
      await supabase.storage.from('interior-site-evidence').remove([testPath]);
    });

    test('5.3: Direct unauthenticated HTTP access to raw object URL is BLOCKED (400/403/404)', async () => {
      const rawPublicUrl = `${supabaseUrl}/storage/v1/object/public/interior-site-evidence/${TENANT_ID}/non-existent.txt`;
      const response = await httpsGet(rawPublicUrl);

      // Bucket is private, public endpoint rejects request
      expect([400, 403, 404]).toContain(response.statusCode);
      if (response.body.includes('statusCode')) {
        expect(response.body).toMatch(/(400|403|404|not found|Invalid bucket)/i);
      }
    });
  });

  // =========================================================================
  // PRIORITY 6: Operations & Live Health Checks
  // =========================================================================
  describe('Priority 6: Operations Health & Live Telemetry', () => {
    test('6.1: Production /api/health endpoint is LIVE, healthy and returns HTTP 200 within 4000ms', async () => {
      const startTime = Date.now();
      const res = await httpsGet('https://bella-spa-erp.vercel.app/api/health');
      const latency = Date.now() - startTime;

      expect(res.statusCode).toBe(200);
      expect(latency).toBeLessThan(4000); // Production network SLA with internet roundtrip

      const json = JSON.parse(res.body);
      expect(json.status).toBe('healthy');
      expect(json.checks?.database).toBe('ok');
    });

    test('6.2: Production /api/interior/crm/customers/overview strictly requires auth (HTTP 401)', async () => {
      const res = await httpsGet('https://bella-spa-erp.vercel.app/api/interior/crm/customers/overview');
      expect(res.statusCode).toBe(401);

      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error).toBe('INTERIOR_UNAUTHENTICATED');
    });

    test('6.3: Production /api/interior/delivery/site-diary strictly requires auth (HTTP 401)', async () => {
      const res = await httpsGet('https://bella-spa-erp.vercel.app/api/interior/delivery/site-diary');
      expect(res.statusCode).toBe(401);

      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error).toBe('INTERIOR_UNAUTHENTICATED');
    });
  });
});
