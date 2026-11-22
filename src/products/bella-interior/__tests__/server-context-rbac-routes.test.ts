import {
  INTERIOR_PERMISSIONS,
  requiredInteriorPermission,
  requestedProjectScope,
  resolveInteriorContext,
} from '../lib/server-context';

describe('Interior route action and scope mapping', () => {
  it('rejects client-controlled actor, tenant and role identity headers before auth resolution', async () => {
    for (const header of ['x-user-id', 'x-actor-id', 'x-tenant-id', 'x-role', 'x-impersonate']) {
      const result = await resolveInteriorContext(new Request(
        'https://bella.example/api/interior/crm/customers',
        { headers: { [header]: 'spoofed-identity' } },
      ));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    }
  });

  it('assigns separate CRM customer, contact and address actions', () => {
    const base = 'https://bella.example/api/interior/crm/customers';
    expect(requiredInteriorPermission(new Request(base, { method: 'GET' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerRead);
    expect(requiredInteriorPermission(new Request(base, { method: 'POST' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerCreate);
    expect(requiredInteriorPermission(new Request(`${base}/merge`, { method: 'POST' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerMerge);
    expect(requiredInteriorPermission(new Request(`${base}/123e4567-e89b-42d3-a456-426614174000`, { method: 'PATCH' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerUpdate);
    expect(requiredInteriorPermission(new Request(`${base}/123e4567-e89b-42d3-a456-426614174000`, { method: 'DELETE' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerUpdate);
    expect(requiredInteriorPermission(new Request(`${base}/123e4567-e89b-42d3-a456-426614174000?hard=true`, { method: 'DELETE' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerUpdate);
    expect(requiredInteriorPermission(new Request(`${base}/123e4567-e89b-42d3-a456-426614174000/contacts`, { method: 'POST' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerContactCreate);
    expect(requiredInteriorPermission(new Request(`${base}/123e4567-e89b-42d3-a456-426614174000/contacts/123e4567-e89b-42d3-a456-426614174001`, { method: 'DELETE' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerContactDelete);
    expect(requiredInteriorPermission(new Request(`${base}/123e4567-e89b-42d3-a456-426614174000/addresses`, { method: 'GET' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerAddressRead);
    expect(requiredInteriorPermission(new Request(`${base}/123e4567-e89b-42d3-a456-426614174000/addresses/123e4567-e89b-42d3-a456-426614174001`, { method: 'PATCH' }), null))
      .toBe(INTERIOR_PERMISSIONS.customerAddressUpdate);
  });

  it('maps acceptance reads, writes, uploads and decisions to distinct actions', () => {
    const base = 'https://bella.example/api/interior/delivery/acceptance';
    expect(requiredInteriorPermission(new Request(`${base}/campaigns`, { method: 'GET' }), null))
      .toBe(INTERIOR_PERMISSIONS.acceptanceCampaignRead);
    expect(requiredInteriorPermission(new Request(`${base}/sessions`, { method: 'POST' }), null))
      .toBe(INTERIOR_PERMISSIONS.acceptanceSessionCreate);
    expect(requiredInteriorPermission(new Request(`${base}/sessions/123e4567-e89b-42d3-a456-426614174000/notes`, { method: 'GET' }), null))
      .toBe(INTERIOR_PERMISSIONS.acceptanceNoteRead);
    expect(requiredInteriorPermission(new Request(`${base}/sessions/123e4567-e89b-42d3-a456-426614174000/evidence`, { method: 'POST' }), null))
      .toBe(INTERIOR_PERMISSIONS.acceptanceEvidenceUpload);
    expect(requiredInteriorPermission(new Request(`${base}/sessions/123e4567-e89b-42d3-a456-426614174000/approval`, { method: 'POST' }), null))
      .toBe(INTERIOR_PERMISSIONS.acceptanceApprove);
  });

  it('requires the evidence deletion permission for deletion requests', () => {
    const request = new Request('https://bella.example/api/interior/delivery/evidence-deletions', { method: 'POST' });
    expect(requiredInteriorPermission(request, null)).toBe(INTERIOR_PERMISSIONS.evidenceDelete);
  });

  it('does not parse a nested acceptance upload body to determine project scope', async () => {
    const request = new Request(
      'https://bella.example/api/interior/delivery/acceptance/sessions/123e4567-e89b-42d3-a456-426614174000/evidence',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64: 'A'.repeat(10000) }) },
    );
    const result = await requestedProjectScope(request);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') expect(result.body).toBeNull();
  });

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
