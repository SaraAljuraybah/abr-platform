// Deno entry for the submit-interest Edge Function (SCRUM-34). The logic lives in handler.ts,
// which Vitest tests; this file only connects it to Supabase and the function's secrets.
// verify_jwt is off in config.toml: the publishable key is not a JWT, and this is a public
// endpoint whose controls are validation, the spam trap, the rate limit and the CORS allowlist.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { hmacHex } from '../_shared/client-ip.ts';
import { parseAllowedOrigins } from '../_shared/cors.ts';
import { createConfiguredHandler, createSubmitInterestHandler, RATE_LIMIT } from './handler.ts';

const logError = (message: string, detail: Record<string, unknown>) =>
  console.error(message, detail);

Deno.serve(
  // Fails closed without a usable IP hash secret: there is no safe rate-limit key without it.
  createConfiguredHandler(
    {
      ipSecret: Deno.env.get('INTEREST_IP_HASH_SECRET'),
      supabaseUrl: Deno.env.get('SUPABASE_URL'),
      // The service-role key never leaves this function; Supabase provides it to Edge Functions.
      serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    },
    ({ ipSecret, supabaseUrl, serviceKey }) => {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return createSubmitInterestHandler({
        allowedOrigins: parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS')),
        hashIp: (ip) => hmacHex(ipSecret, ip),
        consumeRateLimit: async (key) => {
          const { data, error } = await admin.rpc('consume_rate_limit', {
            p_bucket: RATE_LIMIT.bucket,
            p_key: key,
            p_max: RATE_LIMIT.max,
            p_window: `${RATE_LIMIT.windowMinutes} minutes`,
          });
          if (error) throw error;
          return data === true;
        },
        submit: async (submission) => {
          const { error } = await admin.rpc('submit_interest', { p_payload: submission });
          if (error) throw error;
        },
        logError,
      });
    },
    logError,
  ),
);
