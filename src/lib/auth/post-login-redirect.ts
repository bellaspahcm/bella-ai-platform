const DEFAULT_POST_LOGIN_PATH = '/dashboard';

export function resolveSafePostLoginPath(
  requestedPath: string | null | undefined,
  origin: string,
): string {
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//') || requestedPath.startsWith('/\\')) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  try {
    const expectedOrigin = new URL(origin).origin;
    const target = new URL(requestedPath, expectedOrigin);
    if (target.origin !== expectedOrigin || target.pathname === '/login' || target.pathname.startsWith('/login/')) {
      return DEFAULT_POST_LOGIN_PATH;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }
}
