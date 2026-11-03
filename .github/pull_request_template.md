<!-- dev → main promotion. Merge with "Create a merge commit" (never squash or rebase). -->

## What's included

<!-- Jira keys and one line each, e.g. SCRUM-34: interest form at /forms/interest. -->

## Authorization impact

<!-- Tables, policies, RPCs or Edge Functions added or changed, or "none". -->

## Database changes

<!-- New migrations, in order; anything that needs a hosted step. -->

## Hosted settings to verify

<!-- Copied from the CHANGELOG section "Hosted settings to verify", if any. -->

## Verification

- [ ] `npm run ci` green on dev
- [ ] `supabase test db` green (<!-- N --> tests)
- [ ] CI green on the last dev commit

## CTO review

- [ ] Reviewed in the running site in Arabic (RTL) and English (LTR)
- [ ] Merge with "Create a merge commit" (not squash or rebase)
