/**
 * @jest-environment jsdom
 */

import { INTERIOR_ROLES } from '../lib/interior-rbac-navigation';
import {
  INTERIOR_PWA_MODULES,
  getInteriorBottomNavItems,
  getInteriorLaunchpadItems,
  isInteriorMobileShellPath,
  isInteriorPwaModuleAllowed,
} from '../lib/interior-pwa-navigation';

describe('Bella Interior Full-Product Mobile PWA Navigation', () => {
  it('provides exactly 4 authorized bottom-bar items for all 12 official Interior roles', () => {
    for (const role of INTERIOR_ROLES) {
      const items = getInteriorBottomNavItems(role.roleKey);
      expect(items).toHaveLength(4);
      items.forEach((item) => {
        expect(isInteriorPwaModuleAllowed(role.roleKey, item)).toBe(true);
      });
    }
  });

  it('tailors primary bottom-bar routes to each role workflow', () => {
    expect(getInteriorBottomNavItems('SITE_MANAGER').map((i) => i.id)).toEqual([
      'overview',
      'projects',
      'site-diary',
      'qc-handover',
    ]);
    expect(getInteriorBottomNavItems('PRODUCTION_MANAGER').map((i) => i.id)).toEqual([
      'overview',
      'projects',
      'production',
      'qc-handover',
    ]);
    expect(getInteriorBottomNavItems('WARRANTY').map((i) => i.id)).toEqual([
      'overview',
      'projects',
      'warranty',
      'qc-handover',
    ]);
    expect(getInteriorBottomNavItems('DESIGNER').map((i) => i.id)).toEqual([
      'overview',
      'projects',
      'design',
      'boq',
    ]);
    expect(getInteriorBottomNavItems('ACCOUNTANT').map((i) => i.id)).toEqual([
      'overview',
      'finance',
      'accounting',
      'reports',
    ]);
  });

  it('unlocks and promotes site-diary PWA into bottom bar when a non-site role holds direct grants', () => {
    const designerDefault = getInteriorLaunchpadItems('DESIGNER');
    expect(designerDefault.some((i) => i.id === 'site-diary')).toBe(false);

    const designerWithGrant = getInteriorLaunchpadItems('DESIGNER', { canCreateDiary: true });
    expect(designerWithGrant.some((i) => i.id === 'site-diary')).toBe(true);

    const designerBottomWithGrant = getInteriorBottomNavItems('DESIGNER', { canCreateDiary: true });
    expect(designerBottomWithGrant.map((i) => i.id)).toContain('site-diary');
    expect(designerBottomWithGrant).toHaveLength(4);
  });

  it('exposes the full launchpad grid to OWNER and filters restricted modules for specialized roles', () => {
    const ownerItems = getInteriorLaunchpadItems('OWNER');
    expect(ownerItems).toHaveLength(INTERIOR_PWA_MODULES.length);

    const salesItems = getInteriorLaunchpadItems('SALES');
    expect(salesItems.some((i) => i.id === 'contracts')).toBe(true);
    expect(salesItems.some((i) => i.id === 'roles')).toBe(false);
    expect(salesItems.some((i) => i.id === 'production')).toBe(false);
  });

  it('activates the mobile bottom shell strictly for Bella Interior routes and shared workspace pages', () => {
    expect(isInteriorMobileShellPath('/dashboard/interior', 'bella_interior')).toBe(true);
    expect(isInteriorMobileShellPath('/dashboard/interior/production', 'bella_interior')).toBe(true);
    expect(isInteriorMobileShellPath('/dashboard/inventory', 'bella_interior')).toBe(true);
    expect(isInteriorMobileShellPath('/dashboard/accounting', 'bella_interior')).toBe(true);

    // Non-interior verticals stay untouched
    expect(isInteriorMobileShellPath('/dashboard/beauty-spa-v2', 'bella_spa')).toBe(false);
    expect(isInteriorMobileShellPath('/dashboard/inventory', 'bella_spa')).toBe(false);
    expect(isInteriorMobileShellPath('/dashboard/education', 'bella_preschool')).toBe(false);
    expect(isInteriorMobileShellPath('/dashboard/medical', 'bella_hospital')).toBe(false);
  });
});
