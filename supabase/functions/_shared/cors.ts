/**
 * CORS for public form endpoints. Only exact origins from the ALLOWED_ORIGINS secret
 * (comma-separated) get CORS headers; a browser on any other origin cannot read the response.
 * Non-browser clients ignore CORS, so the rate limit, not CORS, is the abuse control.
 */
export function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
