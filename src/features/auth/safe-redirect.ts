export const DEFAULT_AFTER_SIGN_IN = '/app';

const ORIGIN = 'http://abr.invalid';

/**
 * The `next` value if it is a safe in-app path, otherwise /app (open-redirect protection).
 * Accepts only a path with a single leading "/": no "//" or "/\" (protocol-relative), no scheme,
 * no backslashes or control characters, and it must still resolve to the same origin.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw?.startsWith('/') || raw.startsWith('//')) return DEFAULT_AFTER_SIGN_IN;
  // Browsers treat "\" as "/" and strip tabs and newlines, so "/\evil.com" would leave the site.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_AFTER_SIGN_IN;

  try {
    const url = new URL(raw, ORIGIN);
    if (url.origin !== ORIGIN) return DEFAULT_AFTER_SIGN_IN;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
}
