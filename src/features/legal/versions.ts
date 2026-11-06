/**
 * The Terms and Privacy Policy versions this bundle shows at sign-up (SCRUM-38). The sign-up
 * trigger accepts an account only when both equal private.current_legal_versions() in the
 * database; versions.test.ts keeps the two in step. When the text of either page changes in a way
 * that needs new consent, bump its version here AND in a new migration that replaces the function.
 */
export const TERMS_VERSION = '2026-11-v1';
export const PRIVACY_VERSION = '2026-11-v1';
