import { INTERIOR_PERMISSIONS, requiredInteriorPermission, requestedProjectScope } from '../lib/server-context';

describe('Interior route action and scope mapping', () => {
  it('never lets a request body downgrade completed handover into ordinary create', () => {
    const request = new Request('https://bella.example/api/interior/delivery/handover', { method: 'POST' });
    expect(requiredInteriorPermission(request, null)).toBe(INTERIOR_PERMISSIONS.handoverApprove);
    expect(requiredInteriorPermission(request, { client_accepted: false })).toBe(INTERIOR_PERMISSIONS.handoverApprove);
  });

  it('does not treat a new warranty ticket as a warranty-close operation', () => {
    const request = new Request('https://bella.example/api/interior/delivery/warranty', { method: 'POST' });
    expect(requiredInteriorPermission(request, { status: 'resolved' })).toBe(INTERIOR_PERMISSIONS.warrantyCreate);
  });

  it('routes design revision approval through its dedicated permission', () => {
    const request = new Request('https://bella.example/api/interior/design/revisions/123e4567-e89b-42d3-a456-426614174000/approve', { method: 'POST' });
    expect(requiredInteriorPermission(request, null)).toBe(INTERIOR_PERMISSIONS.designApprove);
  });

  it('requires action-specific permissions for contract commands', () => {
    const request = new Request('https://bella.example/api/interior/contracts', { method: 'POST' });
    expect(requiredInteriorPermission(request, { action: 'create-contract' }))
      .toBe(INTERIOR_PERMISSIONS.contractCreate);
    expect(requiredInteriorPermission(request, { action: 'release-to-workshop' }))
      .toBe(INTERIOR_PERMISSIONS.productionRelease);
    expect(requiredInteriorPermission(request, { action: 'record-payment' }))
      .toBe(INTERIOR_PERMISSIONS.paymentRecord);
    expect(requiredInteriorPermission(request, { action: 'create-addendum' }))
      .toBe(INTERIOR_PERMISSIONS.contractAmend);
    expect(requiredInteriorPermission(request, { action: 'unknown-command' }))
      .toBeNull();
  });

  it('requires QC approval for verification and ordinary QC update for rectification', () => {
    const request = new Request('https://bella.example/api/interior/delivery/punch-list/123e4567-e89b-42d3-a456-426614174000', { method: 'PATCH' });
    expect(requiredInteriorPermission(request, { status: 'verified' })).toBe(INTERIOR_PERMISSIONS.qcApprove);
    expect(requiredInteriorPermission(request, { status: 'rectified' })).toBe(INTERIOR_PERMISSIONS.qcUpdate);
  });

  it('resolves camel-case project query IDs before authorization', async () => {
    const result = await requestedProjectScope(new Request(
      'https://bella.example/api/interior/boq?projectId=123e4567-e89b-42d3-a456-426614174000',
    ));
    expect(result).toEqual({
      status: 'OK',
      body: null,
      projectId: '123e4567-e89b-42d3-a456-426614174000',
    });
  });

  it('rejects contradictory project identifiers rather than choosing one', async () => {
    const result = await requestedProjectScope(new Request(
      'https://bella.example/api/interior/boq?projectId=123e4567-e89b-42d3-a456-426614174000',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: '123e4567-e89b-42d3-a456-426614174001' }),
      },
    ));
    expect(result).toEqual({ status: 'INVALID' });
  });
});
