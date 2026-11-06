export type PlatformAuthorizationDecision =
  | { status: 'ALLOW'; reason: 'DIRECT_GRANT' }
  | {
      status: 'DENY';
      reason: 'NO_GRANT' | 'TENANT_MISMATCH' | 'ORG_UNIT_MISMATCH' | 'INVALID_CONTEXT';
    }
  | { status: 'UNAVAILABLE'; reason: 'RESOLVER_UNAVAILABLE' | 'ORG_UNIT_UNAVAILABLE' };

export type PlatformGrantScope =
  | { type: 'TENANT' }
  | { type: 'ORG_UNIT'; orgUnitId: string };

export interface PlatformDirectUserGrantInput {
  readonly targetUserId: string;
  readonly permissionId: string;
  readonly scope: PlatformGrantScope;
}

export type PlatformGrantMutationResult =
  | { status: 'COMMITTED'; grantId: string }
  | {
      status: 'DENIED';
      reason:
        | 'NOT_TENANT_GRANT_ADMIN'
        | 'TENANT_MISMATCH'
        | 'INVALID_TARGET_OR_SCOPE'
        | 'ALREADY_GRANTED';
    }
  | {
      status: 'UNAVAILABLE';
      reason:
        | 'AUTH_CONTEXT_UNAVAILABLE'
        | 'GRANT_ADMIN_AUTHORITY_UNAVAILABLE'
        | 'ORG_UNIT_UNAVAILABLE'
        | 'GRANT_STORE_UNAVAILABLE'
        | 'AUDIT_UNAVAILABLE'
        | 'PERSISTENCE_FAILED';
    };

export interface PlatformActionAuthorizationContract {
  authorize(input: {
    readonly permissionId: string;
    readonly tenantId: string;
    readonly orgUnitId?: string;
  }): Promise<PlatformAuthorizationDecision>;
}

export interface PlatformGrantAdministrationContract {
  grantDirectUser(input: PlatformDirectUserGrantInput): Promise<PlatformGrantMutationResult>;
  revokeDirectUser(input: { readonly grantId: string }): Promise<PlatformGrantMutationResult>;
}
