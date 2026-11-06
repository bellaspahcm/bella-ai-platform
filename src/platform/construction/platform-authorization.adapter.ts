import {
  ConstructionAuthorizationError,
  ConstructionAuthorizationUnavailableError,
} from './domain/errors';
import type { ConstructionAuthorizationPort } from './ports';
import type { PlatformActionAuthorizationContract } from '@/platform/authorization';

export class PlatformConstructionAuthorizationAdapter implements ConstructionAuthorizationPort {
  constructor(private readonly authorization: PlatformActionAuthorizationContract) {}

  async ensureAllowed(params: Parameters<ConstructionAuthorizationPort['ensureAllowed']>[0]): Promise<void> {
    const decision = await this.authorization.authorize({
      permissionId: params.permission,
      tenantId: params.tenantId,
      orgUnitId: params.orgUnitId,
    });

    if (decision.status === 'ALLOW') return;
    if (decision.status === 'UNAVAILABLE') {
      throw new ConstructionAuthorizationUnavailableError(decision.reason);
    }
    throw new ConstructionAuthorizationError(decision.reason);
  }
}
