/**
 * Architecture Verification: Bella Interior OS
 *
 * Verifies that Bella Interior OS is properly registered across the Platform:
 * - ProductRegistry
 * - VerticalRegistry
 * - TenantModules
 *
 * @module src/products/bella-interior/__tests__
 */

import { productRegistry } from '@/platform/registry/product-registry';
import { verticalRegistry } from '@/platform/registry/vertical-registry';
import {
  isTenantModuleEnabled,
  getDefaultTenantBrandThemeForModule,
  TENANT_MODULE_KEYS,
  TENANT_PRIMARY_BUSINESS_MODULE_KEYS,
} from '@/lib/business-rules/tenant-modules';
import { bellaInteriorManifest } from '../manifest';

describe('Bella Interior OS — Architecture Conformance', () => {
  it('should be registered in ProductRegistry with correct product definition', () => {
    expect(productRegistry.has('bella_interior')).toBe(true);
    const product = productRegistry.get('bella_interior');
    expect(product).toBeDefined();
    expect(product?.displayName).toBe('Bella Interior OS');
    expect(product?.serviceProfile).toBe('interior');
    expect(product?.defaultRoute).toBe('/dashboard/interior');
    expect(product?.navigationProfile).toBe('interior');
    expect(product?.requiredModules).toContain('bella_interior');
  });

  it('should be registered in VerticalRegistry with 4 bounded contexts and 10 menus', () => {
    expect(verticalRegistry.has('bella_interior')).toBe(true);
    const manifest = verticalRegistry.get('bella_interior');
    expect(manifest).toBeDefined();
    expect(manifest?.key).toBe('bella_interior');
    expect(manifest?.name).toBe('Bella Interior OS');
    expect(manifest?.defaultRoute).toBe('/dashboard/interior');
    expect(manifest?.menus.length).toBe(10);

    // Verify 4 bounded contexts
    expect(bellaInteriorManifest.boundedContexts).toEqual([
      'design_specification',
      'commercial_costing',
      'manufacturing_installation',
      'project_delivery_aftercare',
    ]);
  });

  it('should be registered in TenantModules with distinct brand theme', () => {
    expect(TENANT_MODULE_KEYS).toContain('bella_interior');
    expect(TENANT_PRIMARY_BUSINESS_MODULE_KEYS).toContain('bella_interior');

    const isEnabled = isTenantModuleEnabled({ bella_interior: true }, 'bella_interior');
    expect(isEnabled).toBe(true);

    const theme = getDefaultTenantBrandThemeForModule('bella_interior');
    expect(theme.primaryColor).toBe('#8B5E3C'); // Warm Walnut Bronze
    expect(theme.accentColor).toBe('#D4AF37'); // Brushed Gold
    expect(theme.stylePreset).toBe('graphite_luxe');
  });
});

