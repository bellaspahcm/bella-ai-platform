import { GET } from '@/app/manifest.webmanifest/route';

const mockGetUser = jest.fn();
const mockSingle = jest.fn();
const mockSelections: string[] = [];
jest.mock('next/headers', () => ({ cookies: async () => ({ get: jest.fn(), set: jest.fn() }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({
  auth: { getUser: mockGetUser },
  from: () => ({ select: (columns: string) => {
    mockSelections.push(columns);
    return { eq: () => ({ single: mockSingle }) };
  } }),
}) }));

describe('manifest identity does not require branding access', () => {
  beforeEach(() => {
    mockSelections.length = 0;
    mockSingle.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-id' } }, error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fixture-public-key';
  });

  function identity() {
    mockSingle.mockResolvedValueOnce({ data: { tenant_id: 'tenant-id' }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: 'tenant-id', product_key: 'bella_preschool' }, error: null });
  }

  it.each(['42501', '42703'])('keeps canonical Product when optional branding is unavailable: %s', async code => {
    identity();
    mockSingle.mockResolvedValueOnce({ data: null, error: { code } });
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.name).toMatch(/Preschool/i);
    expect(mockSelections).toEqual(['tenant_id', 'id, product_key', 'brand_theme, logo_url']);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  });

  it('preserves custom branding when readable', async () => {
    identity();
    mockSingle.mockResolvedValueOnce({ data: { brand_theme: { brandName: 'Synthetic school' }, logo_url: null }, error: null });
    const body = await (await GET()).json();
    expect(body.name).toContain('Synthetic school');
  });

  it('does not resolve a Product without authenticated tenant identity', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const body = await (await GET()).json();
    expect(body.name).not.toMatch(/Preschool/i);
    expect(mockSelections).toEqual([]);
  });
});
