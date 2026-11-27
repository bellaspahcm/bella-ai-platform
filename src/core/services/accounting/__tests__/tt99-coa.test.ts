import { TT99_FULL_COA_CATALOG } from '../tt99-coa';

describe('TT99 Full Chart of Accounts Catalog (99/2025/TT-BTC)', () => {
  it('has unique account codes and valid parent references', () => {
    const codes = new Set<string>();
    const rootCodes = new Set<string>();

    for (const item of TT99_FULL_COA_CATALOG) {
      expect(codes.has(item.account_code)).toBe(false);
      codes.add(item.account_code);
      if (!item.parent_code) {
        rootCodes.add(item.account_code);
      }
    }

    for (const item of TT99_FULL_COA_CATALOG) {
      if (item.parent_code) {
        expect(rootCodes.has(item.parent_code)).toBe(true);
      }
    }
  });

  it('includes canonical TT99/2025/TT-BTC accounts across classes 1-9', () => {
    const byCode = new Map(TT99_FULL_COA_CATALOG.map((item) => [item.account_code, item]));

    expect(byCode.get('111')?.account_type).toBe('ASSET');
    expect(byCode.get('1383')?.parent_code).toBe('138');
    expect(byCode.get('154')?.account_type).toBe('ASSET');
    expect(byCode.get('215')?.account_type).toBe('ASSET');
    expect(byCode.get('332')?.account_type).toBe('LIABILITY');
    expect(byCode.get('3387')?.parent_code).toBe('338');
    expect(byCode.get('352')?.account_type).toBe('LIABILITY');
    expect(byCode.get('411')?.account_type).toBe('EQUITY');
    expect(byCode.get('511')?.account_type).toBe('REVENUE');
    expect(byCode.get('632')?.account_type).toBe('EXPENSE');
    expect(byCode.get('911')?.account_type).toBe('EQUITY');
  });
});
