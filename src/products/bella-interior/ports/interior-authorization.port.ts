/**
 * Bella Interior OS — Authorization Port
 *
 * Defines the contract for verifying permissions within Interior OS.
 * @module src/products/bella-interior/ports
 */

export interface InteriorAuthorizationPort {
  ensureAllowed(input: {
    readonly permission: string;
    readonly tenantId: string;
    readonly orgUnitId?: string;
  }): Promise<void>;
}

