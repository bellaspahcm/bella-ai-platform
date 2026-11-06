/**
 * Bella Interior OS — Platform Authorization Adapter
 *
 * Adapts Platform Action Authorization Contract (`PlatformActionAuthorizationContract`)
 * into the Interior domain authorization port.
 *
 * @module src/products/bella-interior/adapters
 */

import type { PlatformActionAuthorizationContract } from '@/platform/authorization';
import { InteriorAuthorizationError } from '../domain/errors';
import type { InteriorAuthorizationPort } from '../ports/interior-authorization.port';

export class PlatformInteriorAuthorizationAdapter implements InteriorAuthorizationPort {
  constructor(private readonly authorization: PlatformActionAuthorizationContract) {}

  async ensureAllowed(params: Parameters<InteriorAuthorizationPort['ensureAllowed']>[0]): Promise<void> {
    const decision = await this.authorization.authorize({
      permissionId: params.permission,
      tenantId: params.tenantId,
      orgUnitId: params.orgUnitId,
    });

    if (decision.status === 'ALLOW') {
      return;
    }

    throw new InteriorAuthorizationError(decision.reason);
  }
}

