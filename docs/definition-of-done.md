# Definition of Done

Source: ABR Product & Technology Plan v2.0, Section 24.

A feature is not done because its UI renders. It is done when **all** of the following hold:

- [ ] Migration written, self-reviewed against the security checklist (the non-negotiable rules
      and database rules in [CLAUDE.md](../CLAUDE.md)), applied locally (`supabase db reset`)
- [ ] Server-side authorization enforced (RLS / RPC / Edge Function)
- [ ] Validation on the client (Zod) and in the database
- [ ] Loading, empty and error states handled
- [ ] Reviewed by the CTO in the running site, in Arabic (RTL) and English (LTR)
- [ ] Happy-path tests pass
- [ ] Unauthorized-access (negative) tests pass; mutation check done for new security controls
- [ ] `npm run ci` green; `supabase test db` green for database work; generated types current
- [ ] No open critical defects
- [ ] Docs updated (permissions matrix, decisions, CHANGELOG)
- [ ] "Done" in Jira means merged into `main` (production)

Defect severity (Plan §19): **Critical** (data exposure, authorization bypass, data loss, core journey
blocked) stops work and blocks the pilot. **High** is fixed before the readiness decision.
