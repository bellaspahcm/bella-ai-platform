import { createClient as createSdkClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { TradeInPhotoService, type UploadPhotoData } from '../TradeInPhotoService';

// Synthetic Auth/PostgREST transport with the actual Supabase SDK. These tests
// prove request/session propagation only; they do not execute a database or RLS.
let mockBrowserClient: SupabaseClient<Database>;
const mockBrowserFactory = jest.fn(() => mockBrowserClient);
const mockLegacyFactory = jest.fn(() => {
  throw new Error('Legacy client is unavailable in this synthetic session-boundary test');
});
jest.mock('@/lib/supabase-client', () => ({ createClient: () => mockBrowserFactory() }));
jest.mock('@/lib/database/read-replica', () => ({ getPrimaryClient: () => mockLegacyFactory() }));

const fixtureOrigin = 'https://trade-in-fixture.invalid';
const fixturePublicKey = 'fixture-public-key';
const tenantId = '00000000-0000-0000-0000-000000000001';
const appraisalId = '00000000-0000-0000-0000-000000000002';
const photoId = '00000000-0000-0000-0000-000000000003';
const actorA = '00000000-0000-0000-0000-000000000004';
const actorB = '00000000-0000-0000-0000-000000000005';
const fixtureExpiry = Math.floor(Date.now() / 1000) + 3600;
const photoFixture = {
  id: photoId, tenant_id: tenantId, appraisal_id: appraisalId,
  photo_category: 'front', photo_url: 'https://trade-in-fixture.invalid/front.jpg',
  display_order: 2, uploaded_at: '2026-10-23T03:00:00Z', is_primary: true,
};
const uploadInput: UploadPhotoData = {
  tenantId, appraisalId, photoCategory: 'front', photoUrl: photoFixture.photo_url,
  uploadedBy: actorA, fileName: 'front.jpg', fileSizeBytes: 21, mimeType: 'image/jpeg',
  description: 'Synthetic front photo', notes: 'Synthetic metadata',
  damageMarkers: [{ x: 0.1, y: 0.2, label: 'Synthetic marker', severity: 'minor' }],
  displayOrder: 2, isPrimary: true,
};

type CapturedRequest = {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
};
let requests: CapturedRequest[];
let nextActor: string;
let denied: boolean;

function syntheticToken(actor: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: actor, role: 'authenticated', aud: 'authenticated', exp: fixtureExpiry,
  })).toString('base64url');
  return `${header}.${payload}.synthetic-fixture-signature`;
}

const transport: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  if (url.origin !== fixtureOrigin) throw new Error('Unexpected origin in synthetic transport');
  const method = init?.method ?? 'GET';
  const headers = new Headers(init?.headers);
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  requests.push({ url, method, headers, body });

  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    return new Response(JSON.stringify({
      access_token: syntheticToken(nextActor), token_type: 'bearer', expires_in: 3600,
      refresh_token: `synthetic-refresh-${nextActor}`,
      user: {
        id: nextActor, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid',
        app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-23T03:00:00Z',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.pathname !== '/rest/v1/auto_trade_in_photos') {
    throw new Error('Unexpected endpoint in synthetic transport');
  }
  if (denied) {
    return new Response(JSON.stringify({
      code: '42501', message: 'Synthetic actor denied', details: '', hint: '',
    }), { status: 403, headers: { 'content-type': 'application/json' } });
  }
  const wantsRow = headers.get('accept')?.includes('vnd.pgrst.object');
  if (method === 'DELETE' || (method === 'PATCH' && !wantsRow)) {
    return new Response(null, { status: 204 });
  }
  return new Response(JSON.stringify(wantsRow ? photoFixture : [photoFixture]), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};

async function signInAs(actor: string): Promise<void> {
  nextActor = actor;
  const { data, error } = await mockBrowserClient.auth.signInWithPassword({
    email: 'fixture@example.invalid', password: 'synthetic-fixture-password',
  });
  expect(error).toBeNull();
  expect(data.user?.id).toBe(actor);
}

function metadataRequests(): CapturedRequest[] {
  return requests.filter(request => request.url.pathname.startsWith('/rest/'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  requests = [];
  nextActor = actorA;
  denied = false;
  mockBrowserClient = createSdkClient<Database>(fixtureOrigin, fixturePublicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport },
  });
  await signInAs(actorA);
});

const operations: Array<{
  label: string;
  run: () => Promise<unknown>;
  methods: string[];
}> = [
  { label: 'uploadPhoto', run: () => TradeInPhotoService.uploadPhoto(uploadInput), methods: ['POST'] },
  { label: 'getPhotosForAppraisal', run: () => TradeInPhotoService.getPhotosForAppraisal(tenantId, appraisalId), methods: ['GET'] },
  { label: 'getPhotosByCategory', run: () => TradeInPhotoService.getPhotosByCategory(tenantId, appraisalId, 'front'), methods: ['GET'] },
  { label: 'setPrimaryPhoto', run: () => TradeInPhotoService.setPrimaryPhoto(photoId, tenantId, appraisalId), methods: ['PATCH', 'PATCH'] },
  { label: 'updatePhotoMetadata', run: () => TradeInPhotoService.updatePhotoMetadata(photoId, tenantId, { description: 'Synthetic update', displayOrder: 3 }), methods: ['PATCH'] },
  { label: 'deletePhoto', run: () => TradeInPhotoService.deletePhoto(photoId, tenantId), methods: ['GET', 'DELETE'] },
  { label: 'reorderPhotos', run: () => TradeInPhotoService.reorderPhotos(tenantId, [{ photoId, displayOrder: 4 }]), methods: ['PATCH'] },
  { label: 'getPrimaryPhoto', run: () => TradeInPhotoService.getPrimaryPhoto(tenantId, appraisalId), methods: ['GET'] },
];

describe('Trade-in browser client reuse: synthetic SDK boundary, not DB/RLS proof', () => {
  it.each(operations)('$label sends actual SDK requests under the current browser actor', async ({ run, methods, label }) => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try { await run(); } finally { log.mockRestore(); }
    const calls = metadataRequests();
    expect(calls.map(call => call.method)).toEqual(methods);
    for (const call of calls) {
      expect(call.headers.get('authorization')).toBe(`Bearer ${syntheticToken(actorA)}`);
      expect(call.headers.get('apikey')).toBe(fixturePublicKey);
      if (call.method !== 'POST') expect(call.url.searchParams.get('tenant_id')).toBe(`eq.${tenantId}`);
    }
    if (label === 'uploadPhoto') {
      expect(calls[0].body).toEqual({
        tenant_id: tenantId, appraisal_id: appraisalId, photo_category: 'front', photo_url: photoFixture.photo_url,
        file_name: 'front.jpg', file_size_bytes: 21, mime_type: 'image/jpeg',
        description: 'Synthetic front photo', notes: 'Synthetic metadata',
        damage_markers: [{ x: 0.1, y: 0.2, label: 'Synthetic marker', severity: 'minor' }],
        display_order: 2, is_primary: true, uploaded_by: actorA,
      });
    }
    if (label === 'getPhotosForAppraisal') {
      expect(calls[0].url.searchParams.get('appraisal_id')).toBe(`eq.${appraisalId}`);
      expect(calls[0].url.searchParams.get('order')).toBe('display_order.asc,uploaded_at.asc');
    }
    if (label === 'getPhotosByCategory') {
      expect(calls[0].url.searchParams.get('appraisal_id')).toBe(`eq.${appraisalId}`);
      expect(calls[0].url.searchParams.get('photo_category')).toBe('eq.front');
    }
    if (label === 'setPrimaryPhoto') {
      expect(calls[0].url.searchParams.get('appraisal_id')).toBe(`eq.${appraisalId}`);
      expect(calls[0].body).toEqual({ is_primary: false });
      expect(calls[1].url.searchParams.get('id')).toBe(`eq.${photoId}`);
      expect(calls[1].body).toEqual({ is_primary: true });
    }
    if (label === 'updatePhotoMetadata') {
      expect(calls[0].url.searchParams.get('id')).toBe(`eq.${photoId}`);
      expect(calls[0].body).toEqual({ description: 'Synthetic update', display_order: 3 });
    }
    if (label === 'deletePhoto') {
      expect(calls.every(call => call.url.searchParams.get('id') === `eq.${photoId}`)).toBe(true);
    }
    if (label === 'reorderPhotos') {
      expect(calls[0].url.searchParams.get('id')).toBe(`eq.${photoId}`);
      expect(calls[0].body).toEqual({ display_order: 4 });
    }
    if (label === 'getPrimaryPhoto') {
      expect(calls[0].url.searchParams.get('appraisal_id')).toBe(`eq.${appraisalId}`);
      expect(calls[0].url.searchParams.get('is_primary')).toBe('eq.true');
    }
    expect(mockBrowserFactory).toHaveBeenCalledTimes(1);
    expect(mockLegacyFactory).not.toHaveBeenCalled();
  });

  it('uses the next authenticated actor after the shared SDK session changes', async () => {
    await TradeInPhotoService.getPhotosForAppraisal(tenantId, appraisalId);
    await signInAs(actorB);
    await TradeInPhotoService.updatePhotoMetadata(photoId, tenantId, { notes: 'Actor B synthetic request' });
    const calls = metadataRequests();
    expect(calls).toHaveLength(2);
    expect(calls[0].headers.get('authorization')).toBe(`Bearer ${syntheticToken(actorA)}`);
    expect(calls[1].headers.get('authorization')).toBe(`Bearer ${syntheticToken(actorB)}`);
    expect(calls[1].body).toEqual({ notes: 'Actor B synthetic request' });
    expect(mockLegacyFactory).not.toHaveBeenCalled();
  });

  it.each(operations.filter(operation => operation.label !== 'reorderPhotos'))('$label surfaces a denied SDK response without privileged fallback', async ({ run, methods }) => {
    denied = true;
    await expect(run()).rejects.toThrow('Synthetic actor denied');
    const calls = metadataRequests();
    expect(calls.map(call => call.method)).toEqual(methods);
    expect(calls.every(call => call.headers.get('authorization') === `Bearer ${syntheticToken(actorA)}`)).toBe(true);
    expect(calls.every(call => call.headers.get('apikey') === fixturePublicKey)).toBe(true);
    expect(mockLegacyFactory).not.toHaveBeenCalled();
  });

  it('keeps category/completion calculations derived from returned photo metadata', async () => {
    const completion = await TradeInPhotoService.checkPhotoCompletionStatus(tenantId, appraisalId);
    const categories = await TradeInPhotoService.getPhotoCategoriesWithStatus(tenantId, appraisalId);
    expect(completion.totalPhotos).toBe(1);
    expect(completion.photosByCategory).toEqual({ front: 1 });
    expect(completion.isComplete).toBe(false);
    expect(completion.missingCategories).not.toContain('front');
    expect(categories.find(category => category.key === 'front')).toMatchObject({ count: 1, hasPhotos: true, isComplete: true });
    expect(categories.find(category => category.key === 'rear')).toMatchObject({ count: 0, hasPhotos: false, isComplete: false });
    expect(metadataRequests()).toHaveLength(2);
    expect(mockLegacyFactory).not.toHaveBeenCalled();
  });
});
