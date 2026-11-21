/**
 * Bella Interior OS — Customer Domain Foundation Acceptance Tests
 * Phase B: Customer Domain Foundation
 *
 * Verifies core domain rules, tenant isolation, alias resolution,
 * duplicate detection without auto-merge, financial protection,
 * and merge integrity.
 *
 * @module src/products/bella-interior/__tests__/crm-customer-domain.test
 */

import { InMemoryCustomerRepository } from '../repositories/crm/in-memory-customer.repository';
import { CustomerValidationService } from '../services/crm/customer-validation.service';
import { CustomerDuplicateDetectionService } from '../services/crm/customer-duplicate-detection.service';
import { CustomerMergeService } from '../services/crm/customer-merge.service';
import {
  TenantIsolationViolationError,
  CustomerNotFoundError,
  CustomerAlreadyMergedError,
  CustomerMergeSelfError,
  CustomerMergeCrossTenantError,
  CustomerMergeCycleDetectedError,
  DirectFinancialMutationError,
  InvalidCustomerDataError,
} from '../domain/crm/customer-errors';

describe('Bella Interior CRM — Customer Domain Foundation (Phase B)', () => {
  let repo: InMemoryCustomerRepository;
  let mergeService: CustomerMergeService;

  const TENANT_A = 'tenant-interior-alpha-1111';
  const TENANT_B = 'tenant-interior-beta-2222';
  const ACTOR_ADMIN = 'actor-admin-001';

  beforeEach(() => {
    repo = new InMemoryCustomerRepository();
    mergeService = new CustomerMergeService(repo);
  });

  // ─── 1. CRUD & Identity ───────────────────────────────────────────────────────

  it('1. Tạo Customer mới thành công với mã tự sinh và trạng thái active', async () => {
    CustomerValidationService.validateCreateInput({
      name: 'Công ty Cổ phần Xây dựng Ecopark',
      taxCode: '0102030405',
      type: 'enterprise',
      tier: 'vip',
      primaryPhone: '0912345678',
    });

    const customer = await repo.create(TENANT_A, {
      name: 'Công ty Cổ phần Xây dựng Ecopark',
      taxCode: '0102030405',
      type: 'enterprise',
      tier: 'vip',
      primaryPhone: '0912345678',
    });

    expect(customer.id).toBeDefined();
    expect(customer.tenantId).toBe(TENANT_A);
    expect(customer.code).toMatch(/^KH-\d{6}$/);
    expect(customer.name).toBe('Công ty Cổ phần Xây dựng Ecopark');
    expect(customer.profileStatus).toBe('active');
    expect(customer.createdAt).toBeDefined();
    expect(customer.updatedAt).toBe(customer.createdAt);
  });

  it('2. Hai Customer cùng số điện thoại: Không tự động gộp, tồn tại độc lập', async () => {
    const cust1 = await repo.create(TENANT_A, {
      name: 'Nguyễn Văn Minh (Chủ đầu tư)',
      primaryPhone: '0988888888',
    });

    const cust2 = await repo.create(TENANT_A, {
      name: 'Trần Thị Thu (Trợ lý)',
      primaryPhone: '0988888888', // Shared company phone
    });

    expect(cust1.id).not.toBe(cust2.id);
    expect(cust1.code).not.toBe(cust2.code);

    const list = await repo.list(TENANT_A);
    expect(list.length).toBe(2);

    // Duplicate evaluation score for same phone only must be 40 (< 80 threshold)
    const similarity = CustomerDuplicateDetectionService.evaluateSimilarity(cust1, cust2);
    expect(similarity.score).toBe(40);
    expect(similarity.criteria).toContain('exact_primary_phone');

    // Duplicate detection service must NOT flag them as actionable duplicate candidates
    const duplicates = CustomerDuplicateDetectionService.findDuplicates(cust1, list);
    expect(duplicates.length).toBe(0); // Score 40 < 80 threshold
  });

  it('3. Hai tenant có cùng Customer code: Hoàn toàn độc lập', async () => {
    const customCode = 'KH-VIP-001';

    const custA = await repo.create(TENANT_A, {
      code: customCode,
      name: 'Khách hàng VIP Alpha',
    });

    const custB = await repo.create(TENANT_B, {
      code: customCode,
      name: 'Khách hàng VIP Beta',
    });

    expect(custA.code).toBe(customCode);
    expect(custB.code).toBe(customCode);
    expect(custA.tenantId).toBe(TENANT_A);
    expect(custB.tenantId).toBe(TENANT_B);

    const foundA = await repo.findByCode(TENANT_A, customCode);
    const foundB = await repo.findByCode(TENANT_B, customCode);

    expect(foundA?.name).toBe('Khách hàng VIP Alpha');
    expect(foundB?.name).toBe('Khách hàng VIP Beta');
  });

  it('4. Truy vấn chéo tenant: Bị từ chối và cô lập hoàn toàn', async () => {
    const custA = await repo.create(TENANT_A, { name: 'Customer Alpha' });

    // Tenant B cannot find Tenant A's customer by ID
    const crossFind = await repo.findById(TENANT_B, custA.id);
    expect(crossFind).toBeNull();

    // Tenant B list is empty
    const listB = await repo.list(TENANT_B);
    expect(listB.length).toBe(0);

    // Empty tenantId fails closed
    await expect(repo.findById('', custA.id)).rejects.toThrow(TenantIsolationViolationError);
  });

  it('5. Cập nhật Customer không tồn tại: Báo lỗi CustomerNotFoundError, không tạo ngầm', async () => {
    await expect(
      repo.update(TENANT_A, 'non-existent-uuid', { name: 'New Name' })
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('6. Cập nhật hồ sơ: Bảo toàn createdAt, cập nhật updatedAt', async () => {
    const cust = await repo.create(TENANT_A, { name: 'Tên Ban Đầu' });
    const originalCreatedAt = cust.createdAt;

    // Small delay to ensure timestamp progression
    await new Promise((r) => setTimeout(r, 10));

    CustomerValidationService.validateUpdateInput({ name: 'Tên Mới Sau Cập Nhật' });
    const updated = await repo.update(TENANT_A, cust.id, { name: 'Tên Mới Sau Cập Nhật' });

    expect(updated.name).toBe('Tên Mới Sau Cập Nhật');
    expect(updated.createdAt).toBe(originalCreatedAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(originalCreatedAt).getTime());
  });

  // ─── 2. Financial Protection Invariant ────────────────────────────────────────

  it('7. Financial fields: Chặn đứng mọi hành vi CRM tự ghi/sửa dữ liệu tài chính', () => {
    expect(() => {
      CustomerValidationService.validateCreateInput({
        name: 'Attempt Financial Inject',
        totalContractValue: 500_000_000,
      } as unknown as Parameters<typeof CustomerValidationService.validateCreateInput>[0]);
    }).toThrow(DirectFinancialMutationError);

    expect(() => {
      CustomerValidationService.validateUpdateInput({
        receivableDebt: 100_000_000,
      } as unknown as Parameters<typeof CustomerValidationService.validateUpdateInput>[0]);
    }).toThrow(DirectFinancialMutationError);
  });

  // ─── 3. Multi-Relationship Contacts & Addresses ───────────────────────────────

  it('8. Customer có nhiều Contacts: Hỗ trợ nhiều vai trò và quản lý primary contact', async () => {
    const cust = await repo.create(TENANT_A, { name: 'Công ty Cổ phần Tập đoàn Hòa Phát' });

    const contact1 = await repo.addContact(TENANT_A, cust.id, {
      name: 'Trần Đình Long',
      role: 'legal_representative',
      phone: '0901111111',
      isPrimary: true,
    });

    const contact2 = await repo.addContact(TENANT_A, cust.id, {
      name: 'Lê Văn Kỹ Thuật',
      role: 'site_manager',
      phone: '0902222222',
      isPrimary: false,
    });

    await expect(repo.addContact(TENANT_A, cust.id, {
      name: 'Liên hệ trùng primary',
      role: 'accountant',
      phone: '0903333333',
      isPrimary: true,
    })).rejects.toThrow('only one primary contact');

    const contacts = await repo.listContacts(TENANT_A, cust.id);
    expect(contacts.length).toBe(2);
    expect(contacts[0].id).toBe(contact1.id);
    expect(contacts[0].isPrimary).toBe(true);

    // Make contact 2 primary -> contact 1 is un-primaried
    await repo.updateContact(TENANT_A, contact2.id, { isPrimary: true });
    const updatedContacts = await repo.listContacts(TENANT_A, cust.id);
    const updated1 = updatedContacts.find((c) => c.id === contact1.id);
    const updated2 = updatedContacts.find((c) => c.id === contact2.id);

    expect(updated2?.isPrimary).toBe(true);
    expect(updated1?.isPrimary).toBe(false);
  });

  it('9. Customer có nhiều Addresses: Quản lý địa chỉ trụ sở và công trường', async () => {
    const cust = await repo.create(TENANT_A, { name: 'Nguyễn Bích Ngọc' });

    const addr1 = await repo.addAddress(TENANT_A, cust.id, {
      addressType: 'billing',
      fullAddress: 'Tầng 12, Tòa nhà Keangnam, Mễ Trì',
      city: 'Hà Nội',
      isDefault: true,
    });

    const addr2 = await repo.addAddress(TENANT_A, cust.id, {
      addressType: 'site_location',
      fullAddress: 'Căn hộ R2.05, Aqua Bay Ecopark',
      city: 'Hưng Yên',
      isDefault: false,
    });

    const addresses = await repo.listAddresses(TENANT_A, cust.id);
    expect(addresses.length).toBe(2);
    expect(addresses.find((a) => a.id === addr1.id)?.isDefault).toBe(true);
    expect(addresses.find((a) => a.id === addr2.id)?.isDefault).toBe(false);
  });

  // ─── 4. Customer Merge & Alias Resolution ─────────────────────────────────────

  it('10. Merge hai Customer cùng tenant: Chuyển giao quan hệ, ghi log và lưu alias', async () => {
    const target = await repo.create(TENANT_A, { name: 'Nguyễn Văn Nam (Chính thức)', primaryPhone: '0901234567' });
    const source = await repo.create(TENANT_A, { name: 'Nguyễn V. Nam (Trùng)', primaryPhone: '0901234567' });

    await repo.addContact(TENANT_A, source.id, {
      name: 'Vợ Nam',
      role: 'occupant',
      phone: '0907654321',
      isPrimary: false,
    });

    await repo.addAddress(TENANT_A, source.id, {
      addressType: 'site_location',
      fullAddress: 'Aqua Bay Park 2',
      city: 'Hưng Yên',
      isDefault: false,
    });

    const mergeResult = await mergeService.mergeCustomers({
      tenantId: TENANT_A,
      sourceCustomerId: source.id,
      targetCustomerId: target.id,
      reason: 'Trùng lặp hồ sơ do nhân viên sale gõ tay 2 lần',
      actorId: ACTOR_ADMIN,
    });

    expect(mergeResult.success).toBe(true);
    expect(mergeResult.contactsTransferred).toBe(1);
    expect(mergeResult.addressesTransferred).toBe(1);

    // Source customer is marked 'merged'
    const sourceUpdated = await repo.findById(TENANT_A, source.id);
    expect(sourceUpdated?.profileStatus).toBe('merged');
    expect(sourceUpdated?.mergedIntoId).toBe(target.id);

    // Target customer now owns the contacts and addresses
    const targetContacts = await repo.listContacts(TENANT_A, target.id);
    expect(targetContacts.some((c) => c.name === 'Vợ Nam')).toBe(true);

    const targetAddresses = await repo.listAddresses(TENANT_A, target.id);
    expect(targetAddresses.some((a) => a.fullAddress === 'Aqua Bay Park 2')).toBe(true);

    // Alias resolution: old source ID points to target ID
    const canonicalId = await repo.resolveCanonicalId(TENANT_A, source.id);
    expect(canonicalId).toBe(target.id);

    // Merge log audit verification
    const mergeLogs = await repo.getMergeLogs(TENANT_A, target.id);
    expect(mergeLogs.length).toBe(1);
    expect(mergeLogs[0].reason).toContain('Trùng lặp hồ sơ');
  });

  it('11. Merge Customer khác tenant: REJECTED với CustomerMergeCrossTenantError', async () => {
    const custA = await repo.create(TENANT_A, { name: 'Customer In A' });
    const custB = await repo.create(TENANT_B, { name: 'Customer In B' });

    await expect(
      mergeService.mergeCustomers({
        tenantId: TENANT_A,
        sourceCustomerId: custA.id,
        targetCustomerId: custB.id,
        reason: 'Attempt cross tenant merge',
        actorId: ACTOR_ADMIN,
      })
    ).rejects.toThrow(CustomerNotFoundError); // Tenant A cannot see custB, fails securely
  });

  it('12. Merge Customer đã merged: REJECTED với CustomerAlreadyMergedError', async () => {
    const target = await repo.create(TENANT_A, { name: 'Target A' });
    const source = await repo.create(TENANT_A, { name: 'Source A' });
    const another = await repo.create(TENANT_A, { name: 'Another A' });

    await mergeService.mergeCustomers({
      tenantId: TENANT_A,
      sourceCustomerId: source.id,
      targetCustomerId: target.id,
      reason: 'First merge',
      actorId: ACTOR_ADMIN,
    });

    // Attempting to merge 'source' again must fail
    await expect(
      mergeService.mergeCustomers({
        tenantId: TENANT_A,
        sourceCustomerId: source.id,
        targetCustomerId: another.id,
        reason: 'Second merge on already merged source',
        actorId: ACTOR_ADMIN,
      })
    ).rejects.toThrow(CustomerAlreadyMergedError);
  });

  it('13. Merge vào chính mình: REJECTED với CustomerMergeSelfError', async () => {
    const cust = await repo.create(TENANT_A, { name: 'Self Merge Test' });

    await expect(
      mergeService.mergeCustomers({
        tenantId: TENANT_A,
        sourceCustomerId: cust.id,
        targetCustomerId: cust.id,
        reason: 'Merge self',
        actorId: ACTOR_ADMIN,
      })
    ).rejects.toThrow(CustomerMergeSelfError);
  });

  it('14. Merge tạo chu kỳ alias: REJECTED với CustomerMergeCycleDetectedError', async () => {
    const a = await repo.create(TENANT_A, { name: 'Customer A' });
    const b = await repo.create(TENANT_A, { name: 'Customer B' });

    // Simulate a corrupt legacy alias for the service-level cycle guard.
    jest.spyOn(repo, 'resolveCanonicalId').mockResolvedValueOnce(a.id);

    // Now attempting to merge a into b would create a -> b -> a cycle!
    await expect(
      mergeService.mergeCustomers({
        tenantId: TENANT_A,
        sourceCustomerId: a.id,
        targetCustomerId: b.id,
        reason: 'Attempt cycle merge',
        actorId: ACTOR_ADMIN,
      })
    ).rejects.toThrow(CustomerMergeCycleDetectedError);
  });

  it('15. Merge thất bại giữa chừng: Không để lại trạng thái nửa hoàn thành', async () => {
    const target = await repo.create(TENANT_A, { name: 'Target Safe' });
    const source = await repo.create(TENANT_A, { name: 'Source Safe' });

    // The atomic repository operation must fail before any persistent state changes.
    jest.spyOn(repo, 'mergeAtomically').mockRejectedValueOnce(new Error('Simulated DB Failure on atomic merge'));

    await expect(
      mergeService.mergeCustomers({
        tenantId: TENANT_A,
        sourceCustomerId: source.id,
        targetCustomerId: target.id,
        reason: 'Simulated fail merge',
        actorId: ACTOR_ADMIN,
      })
    ).rejects.toThrow('Simulated DB Failure on atomic merge');

    // Both customers must remain active and not left in corrupted state
    const sourceAfter = await repo.findById(TENANT_A, source.id);
    const targetAfter = await repo.findById(TENANT_A, target.id);

    expect(sourceAfter?.profileStatus).toBe('active');
    expect(targetAfter?.profileStatus).toBe('active');
  });

  it('16. Chống sửa profileStatus thành merged qua update thông thường', async () => {
    const cust = await repo.create(TENANT_A, { name: 'Status Security Test' });

    expect(() => {
      CustomerValidationService.validateUpdateInput({
        profileStatus: 'merged' as unknown as 'active',
      });
    }).toThrow(InvalidCustomerDataError);
  });

  // ─── 5. Duplicate Detection Scoring ───────────────────────────────────────────

  it('17. Thuật toán phát hiện trùng lặp: Phân định rạch ròi điểm số', () => {
    const base: Parameters<typeof CustomerDuplicateDetectionService.evaluateSimilarity>[0] = {
      id: 'cust-1',
      tenantId: TENANT_A,
      code: 'KH-001',
      name: 'Công ty Cổ phần Nội thất Bella',
      taxCode: '0109998888',
      type: 'enterprise',
      tier: 'standard',
      profileStatus: 'active',
      primaryPhone: '0987654321',
      primaryEmail: 'info@bellainterior.vn',
      createdAt: '',
      updatedAt: '',
    };

    // Case 1: Trùng mã số thuế -> 100 điểm
    const duplicateTax = { ...base, id: 'cust-2', name: 'Bella Interior JSC', primaryPhone: '0911111111' };
    const score1 = CustomerDuplicateDetectionService.evaluateSimilarity(base, duplicateTax);
    expect(score1.score).toBe(100);
    expect(score1.criteria).toContain('exact_tax_code');

    // Case 2: Chỉ trùng số điện thoại -> 40 điểm (Dưới ngưỡng 80, không gợi ý gộp)
    const phoneOnly = { ...base, id: 'cust-3', name: 'Nguyễn Văn Khác', taxCode: undefined, primaryEmail: 'other@gmail.com' };
    const score2 = CustomerDuplicateDetectionService.evaluateSimilarity(base, phoneOnly);
    expect(score2.score).toBe(40);
    expect(score2.criteria).toContain('exact_primary_phone');

    // Case 3: Trùng SĐT + Tên tương đồng cao -> 40 + ~40 = 80 điểm (Đạt ngưỡng review)
    const phoneAndName = { ...base, id: 'cust-4', name: 'Cty CP Noi That Bella', taxCode: undefined, primaryEmail: 'diff@gmail.com' };
    const score3 = CustomerDuplicateDetectionService.evaluateSimilarity(base, phoneAndName);
    expect(score3.score).toBeGreaterThanOrEqual(80);
  });
});
