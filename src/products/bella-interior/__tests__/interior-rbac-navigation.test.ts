/**
 * @jest-environment jsdom
 */

import {
  INTERIOR_ROLES,
  INTERIOR_ROLE_ALLOWED_HREFS,
  normalizeInteriorRoleKey,
  isInteriorMenuItemAllowed,
  getInteriorRoleDisplayName,
  getSimulatedInteriorRole,
  setSimulatedInteriorRole,
  INTERIOR_SIMULATED_ROLE_STORAGE_KEY,
  INTERIOR_ROLE_CHANGE_EVENT,
} from '../lib/interior-rbac-navigation';

describe('Bella Interior RBAC Navigation', () => {
  describe('INTERIOR_ROLES Metadata', () => {
    it('defines exactly 12 official interior roles matching database schema', () => {
      expect(INTERIOR_ROLES).toHaveLength(12);
      const keys = INTERIOR_ROLES.map((r) => r.roleKey);
      expect(keys).toContain('OWNER');
      expect(keys).toContain('ADMIN');
      expect(keys).toContain('EXECUTIVE');
      expect(keys).toContain('PM');
      expect(keys).toContain('SALES');
      expect(keys).toContain('DESIGNER');
      expect(keys).toContain('QS');
      expect(keys).toContain('PRODUCTION_MANAGER');
      expect(keys).toContain('SITE_MANAGER');
      expect(keys).toContain('QC');
      expect(keys).toContain('ACCOUNTANT');
      expect(keys).toContain('WARRANTY');
    });

    it('all 12 roles have allowed hrefs defined in INTERIOR_ROLE_ALLOWED_HREFS', () => {
      INTERIOR_ROLES.forEach((r) => {
        expect(INTERIOR_ROLE_ALLOWED_HREFS[r.roleKey]).toBeDefined();
        expect(INTERIOR_ROLE_ALLOWED_HREFS[r.roleKey].length).toBeGreaterThan(0);
      });
    });
  });

  describe('normalizeInteriorRoleKey', () => {
    it('normalizes exact keys case-insensitively', () => {
      expect(normalizeInteriorRoleKey('designer')).toBe('DESIGNER');
      expect(normalizeInteriorRoleKey('PM')).toBe('PM');
      expect(normalizeInteriorRoleKey('Owner')).toBe('OWNER');
    });

    it('maps common aliases correctly', () => {
      expect(normalizeInteriorRoleKey('architect')).toBe('DESIGNER');
      expect(normalizeInteriorRoleKey('project_manager')).toBe('PM');
      expect(normalizeInteriorRoleKey('workshop_manager')).toBe('PRODUCTION_MANAGER');
      expect(normalizeInteriorRoleKey('site_supervisor')).toBe('SITE_MANAGER');
      expect(normalizeInteriorRoleKey('kcs')).toBe('QC');
      expect(normalizeInteriorRoleKey('ke_toan')).toBe('ACCOUNTANT');
      expect(normalizeInteriorRoleKey('super_admin')).toBe('ADMIN');
    });

    it('returns null for empty or invalid input', () => {
      expect(normalizeInteriorRoleKey(null)).toBeNull();
      expect(normalizeInteriorRoleKey('')).toBeNull();
      expect(normalizeInteriorRoleKey('unknown_random_role')).toBeNull();
    });
  });

  describe('isInteriorMenuItemAllowed', () => {
    it('allows all items for OWNER and ADMIN', () => {
      expect(isInteriorMenuItemAllowed('OWNER', '/dashboard/interior/roles')).toBe(true);
      expect(isInteriorMenuItemAllowed('ADMIN', '/dashboard/interior/roles')).toBe(true);
      expect(isInteriorMenuItemAllowed('ADMIN', '/dashboard/interior/production')).toBe(true);
      expect(isInteriorMenuItemAllowed(null, '/dashboard/interior/roles')).toBe(true);
    });

    it('permits Designer only their allowed modules', () => {
      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/interior/design')).toBe(true);
      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/interior/projects')).toBe(true);
      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/interior/boq')).toBe(true);
      // Denied modules:
      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/interior/production')).toBe(false);
      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/interior/installation')).toBe(false);
      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/interior/roles')).toBe(false);
      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/settings?product=bella_interior')).toBe(false);
    });

    it('permits Production Manager (Quản đốc xưởng) only workshop modules', () => {
      expect(isInteriorMenuItemAllowed('PRODUCTION_MANAGER', '/dashboard/interior/production')).toBe(true);
      expect(isInteriorMenuItemAllowed('PRODUCTION_MANAGER', '/dashboard/interior/qc-handover')).toBe(true);
      expect(isInteriorMenuItemAllowed('PRODUCTION_MANAGER', '/dashboard/interior/design')).toBe(true);
      // Denied modules:
      expect(isInteriorMenuItemAllowed('PRODUCTION_MANAGER', '/dashboard/interior/contracts')).toBe(false);
      expect(isInteriorMenuItemAllowed('PRODUCTION_MANAGER', '/dashboard/interior/finance')).toBe(false);
      expect(isInteriorMenuItemAllowed('PRODUCTION_MANAGER', '/dashboard/interior/installation')).toBe(false);
    });

    it('permits Accountant (Kế toán) financial & contract modules only', () => {
      expect(isInteriorMenuItemAllowed('ACCOUNTANT', '/dashboard/interior/finance')).toBe(true);
      expect(isInteriorMenuItemAllowed('ACCOUNTANT', '/dashboard/interior/contracts')).toBe(true);
      expect(isInteriorMenuItemAllowed('ACCOUNTANT', '/dashboard/interior/reports')).toBe(true);
      // Denied modules:
      expect(isInteriorMenuItemAllowed('ACCOUNTANT', '/dashboard/interior/design')).toBe(false);
      expect(isInteriorMenuItemAllowed('ACCOUNTANT', '/dashboard/interior/production')).toBe(false);
      expect(isInteriorMenuItemAllowed('ACCOUNTANT', '/dashboard/interior/roles')).toBe(false);
    });
  });

  describe('getInteriorRoleDisplayName', () => {
    it('returns Vietnamese friendly display names', () => {
      expect(getInteriorRoleDisplayName('DESIGNER')).toBe('Kiến trúc sư / Thiết kế');
      expect(getInteriorRoleDisplayName('QS')).toBe('Kỹ sư Dự toán (QS)');
      expect(getInteriorRoleDisplayName('PM')).toBe('Quản lý dự án');
      expect(getInteriorRoleDisplayName('PRODUCTION_MANAGER')).toBe('Quản đốc xưởng sản xuất');
      expect(getInteriorRoleDisplayName('SITE_MANAGER')).toBe('Chỉ huy trưởng công trường');
      expect(getInteriorRoleDisplayName('QC')).toBe('Kỹ sư Kiểm soát Chất lượng (QC)');
      expect(getInteriorRoleDisplayName('ACCOUNTANT')).toBe('Kế toán dự án');
      expect(getInteriorRoleDisplayName('WARRANTY')).toBe('Chăm sóc & Bảo hành');
      expect(getInteriorRoleDisplayName('OWNER')).toBe('Chủ doanh nghiệp');
    });
  });

  describe('Simulated Role Storage & Event', () => {
    beforeEach(() => {
      window.localStorage.clear();
      jest.clearAllMocks();
    });

    it('gets null when nothing is stored', () => {
      expect(getSimulatedInteriorRole()).toBeNull();
    });

    it('stores and retrieves simulated role', () => {
      setSimulatedInteriorRole('DESIGNER');
      expect(window.localStorage.getItem(INTERIOR_SIMULATED_ROLE_STORAGE_KEY)).toBe('DESIGNER');
      expect(getSimulatedInteriorRole()).toBe('DESIGNER');
    });

    it('clears simulated role on null', () => {
      setSimulatedInteriorRole('QS');
      expect(getSimulatedInteriorRole()).toBe('QS');
      setSimulatedInteriorRole(null);
      expect(getSimulatedInteriorRole()).toBeNull();
      expect(window.localStorage.getItem(INTERIOR_SIMULATED_ROLE_STORAGE_KEY)).toBeNull();
    });

    it('dispatches custom event on role change', () => {
      const listener = jest.fn();
      window.addEventListener(INTERIOR_ROLE_CHANGE_EVENT, listener);

      setSimulatedInteriorRole('QC');
      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent<{ role: string }>;
      expect(event.detail.role).toBe('QC');

      window.removeEventListener(INTERIOR_ROLE_CHANGE_EVENT, listener);
    });
  });
});
