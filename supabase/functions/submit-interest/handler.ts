import { clientIp } from '../_shared/client-ip.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  HONEYPOT_KEY,
  type InterestSubmission,
  validateInterest,
} from '../_shared/interest-validate.ts';

export const RATE_LIMIT = { bucket: 'submit-interest', max: 5, windowMinutes: 10 } as const;
const MAX_BODY_BYTES = 8_192;
export const UNKNOWN_IP_KEY = 'unknown';

/** Everything the handler needs from the outside, so tests run it without Deno or a database. */
export interface SubmitInterestDeps {
  allowedOrigins: Set<string>;
  /** HMAC of the client address; the raw address never leaves the handler. */
  hashIp: (ip: string) => Promise<string>;
  /** public.consume_rate_limit(): true when the attempt is within the limit. */
  consumeRateLimit: (key: string) => Promise<boolean>;
  /** public.submit_interest(). */
  submit: (submission: InterestSubmission) => Promise<void>;
  logError: (message: string, detail: Record<string, unknown>) => void;
}

/**
 * POST /functions/v1/submit-interest. Order: CORS → rate limit (every attempt counts, valid or
 * not) → body → spam trap (dropped with the normal answer) → validation → save. A new and a
 * repeat email get the same answer, so the endpoint never reveals whether an email is known.
 */
export function createSubmitInterestHandler(deps: SubmitInterestDeps) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    if (origin !== null && !deps.allowedOrigins.has(origin)) {
      return json(403, { error: 'origin_not_allowed' });
    }
    const cors = origin ? corsHeaders(origin) : {};

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

    try {
      const ip = clientIp(request.headers);
      const key = ip ? await deps.hashIp(ip) : UNKNOWN_IP_KEY;
      if (!(await deps.consumeRateLimit(key))) return json(429, { error: 'rate_limited' }, cors);

      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
        return json(400, { error: 'invalid' }, cors);
      }
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(400, { error: 'invalid' }, cors);
      }

      // Spam trap: bots fill it. Same answer as a real submission, nothing saved.
      const trap = (body as Record<string, unknown> | null)?.[HONEYPOT_KEY];
      if (typeof trap === 'string' && trap.trim() !== '') return json(200, { ok: true }, cors);

      const submission = validateInterest(body);
      if (!submission) return json(400, { error: 'invalid' }, cors);

      await deps.submit(submission);
      return json(200, { ok: true }, cors);
    } catch (error) {
      deps.logError('submit-interest failed', {
        code: (error as { code?: unknown } | null)?.code ?? null,
      });
      return json(500, { error: 'failed' }, cors);
    }
  };
}

/** HMAC key length floor: a short key makes the stored address hashes guessable. */
export const MIN_IP_SECRET_LENGTH = 32;

type Handler = (request: Request) => Promise<Response>;

/**
 * Fails closed: with a missing, blank or short INTEREST_IP_HASH_SECRET (or no Supabase
 * environment) every request gets the generic 500 and the reason is logged server-side only,
 * never the secret itself. Otherwise `build` makes the real handler with the secret.
 */
export function createConfiguredHandler(
  env: {
    ipSecret: string | undefined;
    supabaseUrl: string | undefined;
    serviceKey: string | undefined;
  },
  build: (config: { ipSecret: string; supabaseUrl: string; serviceKey: string }) => Handler,
  logError: SubmitInterestDeps['logError'],
): Handler {
  const misconfigured =
    (reason: string): Handler =>
    () => {
      logError(reason, {});
      return Promise.resolve(json(500, { error: 'failed' }));
    };
  const { ipSecret, supabaseUrl, serviceKey } = env;
  if (!ipSecret || ipSecret.trim().length < MIN_IP_SECRET_LENGTH) {
    return misconfigured('misconfigured: IP hash secret');
  }
  if (!supabaseUrl || !serviceKey) return misconfigured('misconfigured: Supabase environment');
  return build({ ipSecret, supabaseUrl, serviceKey });
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
