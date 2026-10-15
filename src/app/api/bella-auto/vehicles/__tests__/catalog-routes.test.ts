import { NextRequest } from 'next/server';
import { GET as brands } from '../brands/route';
import { GET as models } from '../models/route';
import { GET as variants } from '../variants/route';

jest.mock('@/lib/supabase-server', () => ({ createServerClient: () => mockClient }));

const getUser = jest.fn();
const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn() };
type CatalogResult = { data: { id: string; name: string; year?: number }[] | null; error: { code: string } | null };
let result: CatalogResult;
const catalog = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  then: (resolve: (value: CatalogResult) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
};
const mockClient = { auth: { getUser }, from: jest.fn((table: string) => table === 'users' ? profile : catalog) };
const cases = [
  { name: 'brands', table: 'auto_brands', select: 'id, name', query: '', parent: null, run: brands },
  { name: 'models', table: 'auto_models', select: 'id, name', query: '?brandId=brand-1', parent: ['brand_id', 'brand-1'], run: models },
  { name: 'variants', table: 'auto_variants', select: 'id, name, year', query: '?modelId=model-1', parent: ['model_id', 'model-1'], run: variants },
];

beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'actor-1' } }, error: null });
  profile.single.mockResolvedValue({ data: { tenant_id: 'tenant-1' }, error: null });
  result = { data: [{ id: 'catalog-1', name: 'Canonical catalog' }], error: null };
});

describe.each(cases)('$name catalog boundary', entry => {
  const request = () => new NextRequest(`http://localhost/api/bella-auto/vehicles/${entry.name}${entry.query}`);

  it('selects canonical fields and uses the authenticated profile tenant', async () => {
    if (entry.name === 'variants') result.data = [{ id: 'variant-1', name: 'Variant', year: 2026 }];
    const response = await entry.run(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ [entry.name]: result.data });
    expect(profile.eq).toHaveBeenCalledWith('id', 'actor-1');
    expect(mockClient.from).toHaveBeenCalledWith(entry.table);
    expect(catalog.select).toHaveBeenCalledWith(entry.select);
    expect(catalog.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    if (entry.parent) expect(catalog.eq).toHaveBeenCalledWith(...entry.parent);
    expect(catalog.order).toHaveBeenCalledWith('name');
    if (entry.name === 'variants') expect(catalog.order).toHaveBeenCalledWith('year', { ascending: false });
    else expect(catalog.order).not.toHaveBeenCalledWith('year', expect.anything());
  });

  it('returns an empty list without inventing catalog or price data', async () => {
    result.data = null;
    expect(await (await entry.run(request())).json()).toEqual({ [entry.name]: [] });
  });

  it('rejects unauthenticated requests before querying a catalog', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await entry.run(request())).status).toBe(401);
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it('rejects a missing tenant without querying a catalog', async () => {
    profile.single.mockResolvedValueOnce({ data: null, error: null });
    expect((await entry.run(request())).status).toBe(403);
    expect(catalog.select).not.toHaveBeenCalled();
  });

  it('does not convert database failures into successful empty lists', async () => {
    result = { data: null, error: { code: '42703' } };
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await entry.run(request())).status).toBe(500);
    } finally {
      log.mockRestore();
    }
  });

  if (entry.parent) it('requires the parent catalog identifier', async () => {
    expect((await entry.run(new NextRequest('http://localhost/catalog'))).status).toBe(400);
    expect(catalog.select).not.toHaveBeenCalled();
  });
});
