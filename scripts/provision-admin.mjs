#!/usr/bin/env node
// Provision an ABR admin (SCRUM-12). Admin comes only from app_metadata.abr_role, which only a
// secret key can set; the sign-up trigger turns it into an admin profile.
//
// Usage (the key comes from your shell or a secret manager, never from a committed file):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY="$ABR_SECRET_KEY" \
//     node scripts/provision-admin.mjs admin@example.com
//
// The account gets a random password that is never shown. The script prints one single-use
// recovery link; the new admin opens it to set their own password.

import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`provision-admin: ${message}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.argv[2]?.trim().toLowerCase();

if (!url || !secretKey)
  fail('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in the environment.');
if (!secretKey.startsWith('sb_secret_')) {
  fail('SUPABASE_SECRET_KEY is not a secret key (expected the sb_secret_ prefix).');
}
const parsed = URL.canParse(url) ? new URL(url) : null;
const isLocal = parsed && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
if (!parsed || (parsed.protocol !== 'https:' && !isLocal)) {
  fail('SUPABASE_URL must be an https URL (http is allowed for localhost only).');
}
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  fail('Pass the admin email address as the first argument.');
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  email_confirm: true,
  password: randomBytes(32).toString('base64url'),
  app_metadata: { abr_role: 'admin' },
});
if (createError || !created.user) {
  fail(`could not create the user: ${createError?.message ?? 'no user returned'}`);
}
const userId = created.user.id;

// The trigger must have produced a verified admin profile. Anything else is a broken environment:
// remove the account rather than leave a half-provisioned user behind.
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role, verification_status, onboarding_completed')
  .eq('id', userId)
  .maybeSingle();

if (profileError || profile?.role !== 'admin' || profile.verification_status !== 'verified') {
  await supabase.auth.admin.deleteUser(userId);
  fail(
    `the profile is not a verified admin (${profileError?.message ?? JSON.stringify(profile)}). ` +
      'The account was deleted. Check that the SCRUM-12 migrations are applied.',
  );
}

const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
  type: 'recovery',
  email,
});
if (linkError || !link.properties?.action_link) {
  fail(
    `admin ${email} was created, but no recovery link was returned: ${linkError?.message ?? ''}`,
  );
}

console.log(`Admin provisioned: ${email} (${userId})`);
console.log('Single-use recovery link (send it privately; it sets the first password):');
console.log(link.properties.action_link);
