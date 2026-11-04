import { resolveSafePostLoginPath } from '../post-login-redirect';

describe('resolveSafePostLoginPath', () => {
  const origin = 'https://preschool.example.test';

  it('returns an internal requested path, including its query and hash', () => {
    expect(resolveSafePostLoginPath('/dashboard/education/care?date=2026-10-28#roster', origin))
      .toBe('/dashboard/education/care?date=2026-10-28#roster');
  });

  it.each([
    null,
    undefined,
    '',
    'https://attacker.example/redirect',
    '//attacker.example/redirect',
    '/\\attacker.example/redirect',
    '/login',
    '/login/reset',
  ])('falls back for an unsafe or missing destination: %s', (requestedPath) => {
    expect(resolveSafePostLoginPath(requestedPath, origin)).toBe('/dashboard');
  });
});
