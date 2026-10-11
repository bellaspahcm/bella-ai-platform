/**
 * Bella Manufacturing product identity contract tests.
 *
 * This registration exposes the Manufacturing operational surface only. It must
 * not imply Go-Live, Factory EIP, Finance posting, MES/IoT, or Logistics Kernel
 * ownership.
 */

import { describe, expect, it, beforeEach } from '@jest/globals';

describe('Bella Manufacturing Product Identity', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('registers bella_manufacturing with the Manufacturing dashboard route', async () => {
    const { productRegistry } = await import('../product-registry');

    const product = productRegistry.getRequired('bella_manufacturing');

    expect(product.productKey).toBe('bella_manufacturing');
    expect(product.displayName).toBe('Bella Manufacturing');
    expect(product.subtitle).toBe('Manufacturing Operations');
    expect(product.requiredModules).toEqual([]);
    expect(product.serviceProfile).toBe('manufacturing');
    expect(product.defaultRoute).toBe('/dashboard/manufacturing');
    expect(product.navigationProfile).toBe('manufacturing');
  });

  it('resolves tenant.product_key through the existing ProductResolver contract', async () => {
    const { productResolver } = await import('../product-resolver');

    const tenant = {
      id: 'tenant-manufacturing-operational-readiness',
      product_key: 'bella_manufacturing',
    };

    const resolved = productResolver.resolve(tenant);

    expect(resolved.tenant).toBe(tenant);
    expect(resolved.product.productKey).toBe('bella_manufacturing');
    expect(resolved.product.defaultRoute).toBe('/dashboard/manufacturing');
    expect(resolved.product.navigationProfile).toBe('manufacturing');
  });

  it('does not bind Manufacturing identity to Finance, Factory EIP, or Logistics Kernel ownership', async () => {
    const { productRegistry } = await import('../product-registry');

    const product = productRegistry.getRequired('bella_manufacturing');

    expect(product.requiredModules).not.toContain('finance');
    expect(product.requiredModules).not.toContain('factory_eip');
    expect(product.requiredModules).not.toContain('logistics_kernel');
    expect(product.requiredModules).not.toContain('mes_iot');
  });
});
