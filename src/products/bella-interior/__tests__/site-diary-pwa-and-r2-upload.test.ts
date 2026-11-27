import { NextRequest, NextResponse } from 'next/server';
import { POST as uploadSitePhoto } from '@/app/api/interior/delivery/site-diary/upload/route';
import { POST as aliasUploadSitePhoto } from '@/app/api/interior/upload/site-photo/route';
import {
  POST as createSiteDiary,
  PATCH as updateSiteDiary,
  GET as getSiteDiary,
} from '@/app/api/interior/delivery/site-diary/route';
import { GET as getMyInteriorAccess } from '@/app/api/interior/me/access/route';
import {
  R2StorageConfigError,
  buildSiteEvidenceR2Key,
  getR2Config,
  isR2PublicUrl,
  uploadBufferToR2,
} from '../lib/r2-storage';
import {
  INTERIOR_ROLE_ALLOWED_HREFS,
  isInteriorMenuItemAllowed,
} from '../lib/interior-rbac-navigation';
import {
  INTERIOR_PERMISSIONS,
  requiredInteriorPermission,
  resolveInteriorActorAccess,
  resolveInteriorContext,
} from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';
import { createServiceClient } from '@/lib/supabase-service-client';

jest.mock('../lib/server-context', () => {
  const actual = jest.requireActual<typeof import('../lib/server-context')>('../lib/server-context');
  return {
    ...actual,
    resolveInteriorContext: jest.fn(),
    resolveInteriorActorAccess: jest.fn(),
  };
});

jest.mock('../lib/rbac-api', () => ({
  interiorRbacRpcClient: jest.fn(),
  interiorMutationRow: (value: unknown): Record<string, unknown> | null =>
    Array.isArray(value) && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])
      ? (value[0] as Record<string, unknown>)
      : null,
  isInteriorRbacRecord: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  validInteriorUuid: (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
}));

jest.mock('@/lib/supabase-service-client', () => ({
  createServiceClient: jest.fn(),
}));

const resolveContextMock = jest.mocked(resolveInteriorContext);
const resolveActorAccessMock = jest.mocked(resolveInteriorActorAccess);
const rpcClientFactoryMock = jest.mocked(interiorRbacRpcClient);
const createServiceClientMock = jest.mocked(createServiceClient);

const tenantId = '11111111-2222-3333-4444-555555555555';
const projectId = '123e4567-e89b-42d3-a456-426614174000';
const otherProjectId = '123e4567-e89b-42d3-a456-426614174999';
const diaryId = '123e4567-e89b-42d3-a456-426614174001';

const jpegMagicBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const pngMagicBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

describe('Site Diary PWA & Cloudflare R2 Upload Suite', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = originalFetch;

    createServiceClientMock.mockReturnValue({
      storage: {
        from: jest.fn(() => ({
          download: jest.fn().mockResolvedValue({ data: new Blob(['mock-image']), error: null }),
        })),
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId,
      actor: { id: 'user-supervisor-01', full_name: 'Nguyễn Văn Giám Sát', email: 'supervisor@example.invalid' },
      authorization: {
        authorize: jest.fn().mockResolvedValue({ status: 'ALLOW', reason: 'TEST' }),
      },
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('1. Cloudflare R2 Storage Helper', () => {
    it('resolves R2 config with production CDN base when credentials are configured', () => {
      process.env.R2_ACCOUNT_ID = 'acc-test-123';
      process.env.R2_ACCESS_KEY_ID = 'key-test-123';
      process.env.R2_SECRET_ACCESS_KEY = 'secret-test-123';
      delete process.env.R2_BUCKET_NAME;
      delete process.env.NEXT_PUBLIC_R2_BASE_URL;
      delete process.env.R2_PUBLIC_BASE_URL;

      const config = getR2Config();
      expect(config.bucket).toBe('bella-production');
      expect(config.publicBaseUrl).toBe('https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev');
      expect(config.accountId).toBe('acc-test-123');
    });

    it('builds an isolated site evidence key containing tenantId and projectId', () => {
      const key = buildSiteEvidenceR2Key({
        tenantId,
        projectId,
        filename: 'hien-truong-phong-master.jpg',
      });
      expect(key).toMatch(new RegExp(`^interior/site-evidence/${tenantId}/${projectId}/\\d+-[a-f0-9]{8}\\.jpg$`));
    });

    it('strictly validates R2 public URLs and rejects XSS, traversal, or foreign origins', () => {
      expect(isR2PublicUrl('https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/site-evidence/t/p/a.jpg')).toBe(true);
      expect(isR2PublicUrl('javascript:alert(1)')).toBe(false);
      expect(isR2PublicUrl('https://evil.example/interior/site-evidence/t/p/a.jpg')).toBe(false);
      expect(isR2PublicUrl('https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/../secret.txt')).toBe(false);
    });

    it('fails closed with R2StorageConfigError when R2 credentials are missing', async () => {
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;

      const key = `interior/site-evidence/${tenantId}/${projectId}/missing-creds.jpg`;
      await expect(
        uploadBufferToR2({
          buffer: Buffer.from(jpegMagicBytes),
          key,
          contentType: 'image/jpeg',
        })
      ).rejects.toBeInstanceOf(R2StorageConfigError);
    });

    it('uploadBufferToR2 signs and PUTs object to Cloudflare R2 and returns public CDN URL', async () => {
      process.env.R2_ACCOUNT_ID = 'acc-test-123';
      process.env.R2_ACCESS_KEY_ID = 'key-test-123';
      process.env.R2_SECRET_ACCESS_KEY = 'secret-test-123';

      const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const buffer = Buffer.from(jpegMagicBytes);
      const key = `interior/site-evidence/${tenantId}/${projectId}/test.jpg`;
      const result = await uploadBufferToR2({
        buffer,
        key,
        contentType: 'image/jpeg',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(requestUrl).toBe(`https://acc-test-123.r2.cloudflarestorage.com/bella-production/${key}`);
      expect(requestInit.method).toBe('PUT');
      expect((requestInit.headers as Record<string, string>)['Authorization']).toContain('AWS4-HMAC-SHA256');
      expect(result.key).toBe(key);
      expect(result.publicUrl).toBe(`https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/${key}`);
      expect(result.size).toBe(buffer.length);
    });
  });

  describe('2. Site Photo Multipart Upload API Route', () => {
    it('exports POST handler on both /site-diary/upload and /upload/site-photo alias', () => {
      expect(typeof uploadSitePhoto).toBe('function');
      expect(typeof aliasUploadSitePhoto).toBe('function');
    });

    it('rejects requests with invalid projectId UUID', async () => {
      const formData = new FormData();
      formData.append('file', new Blob([jpegMagicBytes], { type: 'image/jpeg' }), 'photo.jpg');
      formData.append('projectId', 'invalid-uuid');

      const req = new NextRequest('https://bella.example/api/interior/delivery/site-diary/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadSitePhoto(req);
      expect(res.status).toBe(400);
    });

    it('rejects query projectId and formData projectId mismatch', async () => {
      const formData = new FormData();
      formData.append('file', new Blob([jpegMagicBytes], { type: 'image/jpeg' }), 'photo.jpg');
      formData.append('projectId', otherProjectId);

      const req = new NextRequest(`https://bella.example/api/interior/delivery/site-diary/upload?projectId=${projectId}`, {
        method: 'POST',
        body: formData,
      });

      const res = await uploadSitePhoto(req);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('PROJECT_SCOPE_MISMATCH');
    });

    it('rejects spoofed non-image binary uploads with 415 UNSUPPORTED MEDIA TYPE', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['<svg onload="alert(1)"/>'], { type: 'image/jpeg' }), 'spoofed.jpg');
      formData.append('projectId', projectId);

      const req = new NextRequest(`https://bella.example/api/interior/delivery/site-diary/upload?projectId=${projectId}`, {
        method: 'POST',
        body: formData,
      });

      const res = await uploadSitePhoto(req);
      expect(res.status).toBe(415);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('INVALID_FILE_TYPE');
    });

    it('returns 503 when R2 credentials are not configured', async () => {
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;

      const formData = new FormData();
      formData.append('file', new Blob([jpegMagicBytes], { type: 'image/jpeg' }), 'site-kitchen.jpg');
      formData.append('projectId', projectId);

      const req = new NextRequest(`https://bella.example/api/interior/delivery/site-diary/upload?projectId=${projectId}`, {
        method: 'POST',
        body: formData,
      });

      const res = await uploadSitePhoto(req);
      expect(res.status).toBe(503);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('R2_STORAGE_NOT_CONFIGURED');
    });

    it('accepts valid JPEG & PNG magic-byte images and uploads to Cloudflare R2', async () => {
      process.env.R2_ACCOUNT_ID = 'acc-test-123';
      process.env.R2_ACCESS_KEY_ID = 'key-test-123';
      process.env.R2_SECRET_ACCESS_KEY = 'secret-test-123';
      global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 })) as unknown as typeof fetch;

      for (const sample of [
        { bytes: jpegMagicBytes, mime: 'image/jpeg', name: 'site-kitchen.jpg' },
        { bytes: pngMagicBytes, mime: 'image/png', name: 'site-living.png' },
      ]) {
        const formData = new FormData();
        formData.append('file', new Blob([sample.bytes], { type: sample.mime }), sample.name);
        formData.append('projectId', projectId);

        const req = new NextRequest(`https://bella.example/api/interior/delivery/site-diary/upload?projectId=${projectId}`, {
          method: 'POST',
          body: formData,
        });

        const res = await uploadSitePhoto(req);
        expect(res.status).toBe(201);
        const json = (await res.json()) as {
          success: boolean;
          data: { url: string; key: string; storageType: string; filename: string; contentType: string };
        };
        expect(json.success).toBe(true);
        expect(json.data.storageType).toBe('cloudflare_r2');
        expect(json.data.key).toContain(`interior/site-evidence/${tenantId}/${projectId}/`);
        expect(json.data.url).toContain(`https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/site-evidence/${tenantId}/${projectId}/`);
      }
    });

    it('allows delegated QC permission when query projectId is omitted and explicit project auth succeeds', async () => {
      process.env.R2_ACCOUNT_ID = 'acc-test-123';
      process.env.R2_ACCESS_KEY_ID = 'key-test-123';
      process.env.R2_SECRET_ACCESS_KEY = 'secret-test-123';
      global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 })) as unknown as typeof fetch;

      resolveContextMock.mockResolvedValue({
        ok: true,
        tenantId,
        actor: { id: 'user-qc-01', full_name: 'Trần QC', email: 'qc@example.invalid' },
        authorization: {
          authorize: jest.fn().mockImplementation(({ permissionId }: { permissionId: string }) =>
            Promise.resolve(
              permissionId === INTERIOR_PERMISSIONS.qcCreate
                ? { status: 'ALLOW', reason: 'QC_GRANT' }
                : { status: 'DENY', reason: 'NO_GRANT' }
            )
          ),
        },
        supabase: {},
      } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);

      const formData = new FormData();
      formData.append('file', new Blob([jpegMagicBytes], { type: 'image/jpeg' }), 'qc-check.jpg');
      formData.append('projectId', projectId);

      const req = new NextRequest('https://bella.example/api/interior/delivery/site-diary/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadSitePhoto(req);
      expect(res.status).toBe(201);
    });
  });

  describe('3. Site Diary API Route Text & R2 URL Persistence + Scoping', () => {
    it('creates site diary via RPC and persists 3-key scoped R2 photo_urls through service client', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: [{
          status: 'COMMITTED',
          entry_id: diaryId,
        }],
        error: null,
      });
      rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

      const updateEqTenant = jest.fn().mockResolvedValue({ error: null });
      const updateEqProject = jest.fn().mockReturnValue({ eq: updateEqTenant });
      const updateEqId = jest.fn().mockReturnValue({ eq: updateEqProject });
      const mockUpdate = jest.fn().mockReturnValue({ eq: updateEqId });
      const mockServiceFrom = jest.fn().mockReturnValue({ update: mockUpdate });

      createServiceClientMock.mockReturnValue({
        from: mockServiceFrom,
        storage: { from: jest.fn() },
      } as unknown as ReturnType<typeof createServiceClient>);

      const r2PhotoUrl = `https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/site-evidence/${tenantId}/${projectId}/170000-abcd1234.jpg`;

      const response = await createSiteDiary(new Request('https://bella.example/api/interior/delivery/site-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          date: '2026-11-28',
          workersPresent: 8,
          weatherCondition: 'sunny',
          activitiesCompleted: ['Lắp tủ bếp trên', 'Kiểm tra bản lề'],
          issuesEncountered: ['Thiếu 2 tay nắm cánh tủ'],
          notes: 'Bổ sung vào sáng mai',
          photoUrls: [r2PhotoUrl],
        }),
      }));

      expect(response.status).toBe(201);
      const body = (await response.json()) as { data: { id: string; photoUrls: string[]; notes?: string } };
      expect(body.data.id).toBe(diaryId);
      expect(body.data.photoUrls).toEqual([r2PhotoUrl]);
      expect(body.data.notes).toContain('Thiếu 2 tay nắm cánh tủ');
      expect(body.data.notes).toContain('Bổ sung vào sáng mai');
      expect(rpc).toHaveBeenCalledWith(
        'interior_create_site_diary',
        expect.objectContaining({
          p_issues_noted: expect.stringContaining('Thiếu 2 tay nắm cánh tủ'),
        })
      );
      expect(mockServiceFrom).toHaveBeenCalledWith('interior_site_diaries');
      expect(mockUpdate).toHaveBeenCalledWith({ photo_urls: [r2PhotoUrl] });
      expect(updateEqId).toHaveBeenCalledWith('id', diaryId);
      expect(updateEqProject).toHaveBeenCalledWith('project_id', projectId);
      expect(updateEqTenant).toHaveBeenCalledWith('tenant_id', tenantId);
    });

    it('rejects XSS or cross-tenant photoUrls in POST with 400 INVALID_PHOTO_URLS', async () => {
      const foreignTenantUrl = `https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/site-evidence/99999999-9999-9999-9999-999999999999/${projectId}/bad.jpg`;
      for (const badPhoto of ['javascript:alert(1)', foreignTenantUrl]) {
        const res = await createSiteDiary(new Request('https://bella.example/api/interior/delivery/site-diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            date: '2026-11-28',
            workersPresent: 3,
            weatherCondition: 'sunny',
            activitiesCompleted: ['Lắp đặt'],
            photoUrls: [badPhoto],
          }),
        }));
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: string };
        expect(json.error).toBe('INVALID_PHOTO_URLS');
      }
    });

    it('updates site diary workersPresent and photoUrls through PATCH with 3-key isolation', async () => {
      const rpc = jest.fn().mockImplementation((fn: string) => {
        if (fn === 'interior_has_permission') return Promise.resolve({ data: true, error: null });
        if (fn === 'interior_list_site_diaries') {
          return Promise.resolve({
            data: [{
              id: diaryId,
              tenantId,
              projectId,
              date: '2026-11-28',
              supervisorName: 'Nguyễn Văn Giám Sát',
              workersPresent: 5,
              weatherCondition: 'sunny',
              activitiesCompleted: ['Lắp ray trượt'],
              photoUrls: [],
            }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
      rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

      const updateEqTenant = jest.fn().mockResolvedValue({ error: null });
      const updateEqProject = jest.fn().mockReturnValue({ eq: updateEqTenant });
      const updateEqId = jest.fn().mockReturnValue({ eq: updateEqProject });
      const mockUpdate = jest.fn().mockReturnValue({ eq: updateEqId });
      const mockServiceFrom = jest.fn().mockReturnValue({ update: mockUpdate });

      createServiceClientMock.mockReturnValue({
        from: mockServiceFrom,
        storage: { from: jest.fn() },
      } as unknown as ReturnType<typeof createServiceClient>);

      const newR2Url = `https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/site-evidence/${tenantId}/${projectId}/updated.jpg`;

      const response = await updateSiteDiary(new Request('https://bella.example/api/interior/delivery/site-diary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diaryId,
          projectId,
          workersPresent: 7,
          photoUrls: [newR2Url],
        }),
      }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { data: { photoUrls: string[]; workersPresent: number } };
      expect(body.data.workersPresent).toBe(7);
      expect(body.data.photoUrls).toEqual([newR2Url]);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        labor_headcount: 7,
        photo_urls: [newR2Url],
      }));
      expect(updateEqId).toHaveBeenCalledWith('id', diaryId);
      expect(updateEqProject).toHaveBeenCalledWith('project_id', projectId);
      expect(updateEqTenant).toHaveBeenCalledWith('tenant_id', tenantId);
    });

    it('returns R2 photos in GET listing with storageType: cloudflare_r2 and direct URL', async () => {
      const r2PhotoUrl = `https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/site-evidence/${tenantId}/${projectId}/photo-1.jpg`;
      const supabasePhotoPath = `${tenantId}/${projectId}/photo-2.jpg`;

      const rpc = jest.fn().mockResolvedValue({
        data: [{
          id: diaryId,
          tenantId,
          projectId,
          date: '2026-11-28',
          supervisorName: 'Nguyễn Văn Giám Sát',
          workersPresent: 4,
          weatherCondition: 'sunny',
          activitiesCompleted: ['Lắp đặt hoàn thiện'],
          photoUrls: [r2PhotoUrl, supabasePhotoPath],
        }],
        error: null,
      });
      rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

      const response = await getSiteDiary(new Request(`https://bella.example/api/interior/delivery/site-diary?projectId=${projectId}`));
      expect(response.status).toBe(200);
      const json = (await response.json()) as {
        data: Array<{
          photoUrls: string[];
          photos: Array<{ url?: string; storageType: string; status: string }>;
        }>;
      };

      expect(json.data[0].photoUrls).toHaveLength(2);
      expect(json.data[0].photoUrls[0]).toBe(r2PhotoUrl);
      expect(json.data[0].photos[0].storageType).toBe('cloudflare_r2');
      expect(json.data[0].photos[0].status).toBe('available');
      expect(json.data[0].photos[0].url).toBe(r2PhotoUrl);
    });
  });

  describe('4. Self Access Introspection (/api/interior/me/access) & RBAC Mapping', () => {
    it('returns 401 when actor is unauthenticated on GET /api/interior/me/access', async () => {
      resolveActorAccessMock.mockResolvedValue({
        ok: false,
        response: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
      });

      const res = await getMyInteriorAccess(new Request('https://bella.example/api/interior/me/access'));
      expect(res.status).toBe(401);
    });

    it('returns self roles, delegations, directGrants, assignedProjectIds, and capabilities', async () => {
      const grantedSet = new Set<string>([
        INTERIOR_PERMISSIONS.installationRead,
        INTERIOR_PERMISSIONS.installationCreate,
        INTERIOR_PERMISSIONS.installationUpdate,
        INTERIOR_PERMISSIONS.qcRead,
        INTERIOR_PERMISSIONS.qcCreate,
        INTERIOR_PERMISSIONS.acceptanceEvidenceUpload,
      ]);

      resolveActorAccessMock.mockResolvedValue({
        ok: true,
        tenantId,
        actor: {
          id: 'user-supervisor-01',
          full_name: 'Nguyễn Văn Giám Sát',
          email: 'supervisor@example.invalid',
          role: 'SITE_MANAGER',
        },
        authorization: {
          authorize: jest.fn().mockImplementation(({ permissionId }: { permissionId: string }) =>
            Promise.resolve(
              grantedSet.has(permissionId)
                ? { status: 'ALLOW', reason: 'GRANTED' }
                : { status: 'DENY', reason: 'NO_GRANT' }
            )
          ),
        },
        supabase: {},
      } as unknown as Awaited<ReturnType<typeof resolveInteriorActorAccess>>);

      const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
        interior_user_roles: [
          {
            id: 'ur-1',
            role_key: 'SITE_MANAGER',
            scope_type: 'PROJECT',
            scope_id: projectId,
            status: 'ACTIVE',
          },
        ],
        interior_user_permission_grants: [
          {
            id: 'ug-1',
            permission_id: INTERIOR_PERMISSIONS.installationUpdate,
            scope_type: 'PROJECT',
            scope_id: projectId,
            status: 'ACTIVE',
          },
        ],
        interior_admin_role_delegations: [
          {
            id: 'del-1',
            role_key: 'QC',
            status: 'ACTIVE',
          },
        ],
        interior_user_project_assignments: [
          {
            project_id: projectId,
            status: 'ACTIVE',
          },
        ],
      };

      const makeFluentQuery = (rows: Array<Record<string, unknown>>) => {
        const result = Promise.resolve({ data: rows, error: null });
        const builder: Record<string, unknown> = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          is: jest.fn(() => builder),
          gt: jest.fn(() => builder),
          or: jest.fn(() => builder),
          order: jest.fn(() => builder),
          then: result.then.bind(result),
        };
        return builder;
      };

      createServiceClientMock.mockReturnValue({
        from: jest.fn((table: string) => makeFluentQuery(rowsByTable[table] ?? [])),
      } as unknown as ReturnType<typeof createServiceClient>);

      const res = await getMyInteriorAccess(
        new Request(`https://bella.example/api/interior/me/access?projectId=${projectId}`)
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: {
          primaryRoleKey: string;
          roles: Array<{ roleKey: string }>;
          delegations: Array<{ roleKey: string }>;
          directGrants: Array<{ permissionId: string }>;
          assignedProjectIds: string[];
          capabilities: Record<string, boolean>;
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.primaryRoleKey).toBe('SITE_MANAGER');
      expect(json.data.roles).toEqual(expect.arrayContaining([expect.objectContaining({ roleKey: 'SITE_MANAGER' })]));
      expect(json.data.delegations).toEqual(expect.arrayContaining([expect.objectContaining({ roleKey: 'QC' })]));
      expect(json.data.directGrants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ permissionId: INTERIOR_PERMISSIONS.installationUpdate }),
        ])
      );
      expect(json.data.assignedProjectIds).toContain(projectId);
      expect(json.data.capabilities.canCreateDiary).toBe(true);
      expect(json.data.capabilities.canUploadSitePhoto).toBe(true);
      expect(json.data.capabilities.canCreateQc).toBe(true);
    });

    it('maps PATCH site-diary and upload routes to appropriate Interior RBAC permissions', () => {
      const patchPerm = requiredInteriorPermission(
        new Request('https://bella.example/api/interior/delivery/site-diary', { method: 'PATCH' }),
        null
      );
      expect(patchPerm).toBe(INTERIOR_PERMISSIONS.installationUpdate);

      const uploadPerm = requiredInteriorPermission(
        new Request('https://bella.example/api/interior/delivery/site-diary/upload', { method: 'POST' }),
        null
      );
      const aliasUploadPerm = requiredInteriorPermission(
        new Request('https://bella.example/api/interior/upload/site-photo', { method: 'POST' }),
        null
      );
      expect(uploadPerm).toBe(INTERIOR_PERMISSIONS.installationCreate);
      expect(aliasUploadPerm).toBe(INTERIOR_PERMISSIONS.installationCreate);
    });

    it('authorizes /dashboard/interior/site-diary for supervisor & control roles and restricts default non-field roles', () => {
      expect(isInteriorMenuItemAllowed('SITE_MANAGER', '/dashboard/interior/site-diary')).toBe(true);
      expect(isInteriorMenuItemAllowed('QC', '/dashboard/interior/site-diary')).toBe(true);
      expect(isInteriorMenuItemAllowed('PM', '/dashboard/interior/site-diary')).toBe(true);
      expect(isInteriorMenuItemAllowed('ADMIN', '/dashboard/interior/site-diary')).toBe(true);
      expect(isInteriorMenuItemAllowed('OWNER', '/dashboard/interior/site-diary')).toBe(true);

      expect(isInteriorMenuItemAllowed('DESIGNER', '/dashboard/interior/site-diary')).toBe(false);
      expect(isInteriorMenuItemAllowed('SALES', '/dashboard/interior/site-diary')).toBe(false);
      expect(isInteriorMenuItemAllowed('QS', '/dashboard/interior/site-diary')).toBe(false);

      expect(INTERIOR_ROLE_ALLOWED_HREFS.SITE_MANAGER).toContain('/dashboard/interior/site-diary');
      expect(INTERIOR_ROLE_ALLOWED_HREFS.QC).toContain('/dashboard/interior/site-diary');
    });
  });
});
