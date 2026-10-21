# Definition of Done

Source: ABR Product & Technology Plan v2.0, Section 24.

A feature is not done because its UI renders. It is done when **all** of the following hold:

| #   | Criterion                                                        | Evidence                                                                             |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Database migration written, reviewed and applied to development  | Migration file in `supabase/migrations/`; PR reviewed; applied with the Supabase CLI |
| 2   | Server-side authorization enforced (RLS / RPC / Edge Function)   | Policies, grants or function checks in the migration; schema guard passes            |
| 3   | Validation implemented on client and in the database             | Zod schema in the feature's `schemas.ts`; constraints or RPC checks in SQL           |
| 4   | Loading, empty and error states handled                          | Visible in the PR screenshots                                                        |
| 5   | Arabic RTL and English LTR considered and checked                | PR checklist; screenshots in both languages                                          |
| 6   | Happy-path tests pass                                            | Vitest and/or pgTAP in CI                                                            |
| 7   | Unauthorized-access tests pass                                   | Negative pgTAP tests (actor → attempt → expected failure) in CI                      |
| 8   | No open critical defects                                         | Jira                                                                                 |
| 9   | Generated types up to date; CI green                             | `npm run db:types` committed; both CI jobs green                                     |
| 10  | Documentation updated (permissions matrix, decisions, changelog) | `docs/permissions.md`, `docs/decisions/`, `CHANGELOG.md`                             |

Defect severity (Plan §19): **Critical** (data exposure, authorization bypass, data loss, core journey
blocked) stops work and blocks the pilot. **High** is fixed before the readiness decision.
