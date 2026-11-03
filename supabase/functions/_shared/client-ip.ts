/**
 * The client address for rate limiting, from headers a client cannot choose.
 *
 * Never the FIRST x-forwarded-for value: a client can send its own header and every proxy keeps
 * it, so rotating it would rotate the rate-limit key. Supabase's own Edge Function example reads
 * that first value; we do not. Order of trust:
 *
 * 1. cf-connecting-ip. Hosted Supabase (*.supabase.co) is served through Cloudflare, which sets
 *    this header to the address that connected to it and overwrites any value the client sent.
 * 2. The right-most x-forwarded-for entry: the address the last proxy saw, appended by the
 *    platform, not by the client (a spoofed value can only sit to its left).
 * 3. Nothing usable: null. The caller then uses one shared "unknown" bucket, so such requests are
 *    still limited (together) rather than skipped.
 *
 * Supabase does not document which header its Edge Functions receive; this is verified on the
 * hosted project (CHANGELOG "Hosted settings to verify", docs/permissions.md). Locally there is no
 * Cloudflare, and the local gateway's x-forwarded-for entry is used.
 */
export function clientIp(headers: Headers): string | null {
  const cloudflare = headers.get('cf-connecting-ip')?.trim();
  if (cloudflare && isIpAddress(cloudflare)) return cloudflare;

  const forwarded = headers.get('x-forwarded-for');
  const last = forwarded
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  if (last && isIpAddress(last)) return last;

  return null;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+(%[0-9a-z]+)?$/i;

/** Rough shape check: anything else is treated as missing, never used as a key. */
export function isIpAddress(value: string): boolean {
  if (value.length > 45) return false;
  if (IPV4.test(value)) return true;
  return value.includes(':') && IPV6.test(value);
}

/** Lower-case hex HMAC-SHA256: the stored rate-limit key. The raw address is never stored. */
export async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
