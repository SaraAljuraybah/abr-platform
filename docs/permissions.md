# Permissions matrix

Role × table × operation, kept in sync with RLS policies, grants and RPCs. Every migration that
changes access updates this file in the same pull request (Definition of Done item 10). The database
is the authority; this file documents it.

**Legend:** `—` no access · `✓` allowed · `own` own rows only · `RPC` only through the named
function · `cols` only the listed columns · `vis` rows whose owner is verified and not an admin.

**Roles:** `anon` (signed out) · `student` · `organization` · `mentor` · `admin` (all `authenticated`;
the app role comes from `profiles.role`). An admin is `role = 'admin'` **and** `verified`; a
suspended admin has no admin rights.

**Visibility rule (profiles and role profiles):** your own row, plus rows whose owner is
`verified` and **not an admin**, plus everything for an admin. Admin profiles are never visible to
non-admins. Unverified, pending, rejected and suspended users are visible only to themselves and
admins.

## Tables (SCRUM-12)

No client role has `INSERT`, `DELETE` or `TRUNCATE` on any table. Rows are created by
`private.handle_new_user()` (sign-up) or by the RPCs below.

| Table                      | Operation          | anon        | student / organization / mentor                                                          | admin                                  | Enforced by                                                          |
| -------------------------- | ------------------ | ----------- | ---------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `profiles`                 | select             | —           | own + vis                                                                                | ✓                                      | grant select; policy `profiles_select`                               |
|                            | update             | —           | own, cols `full_name, bio, avatar_path, onboarding_completed`                            | same as others                         | column grant; policy `profiles_update_own`; trigger `profiles_guard` |
|                            | role / status / id | —           | never (status via RPC only)                                                              | via RPC only                           | no column grant; guard trigger (`ABR_PROTECTED_COLUMN`)              |
| `student_profiles`         | select             | —           | own + vis                                                                                | ✓                                      | policy `student_profiles_select`                                     |
|                            | update             | —           | own, cols `major, academic_level, skills, interests, github_url` (never `university_id`) | same as others                         | column grant; guard trigger                                          |
| `organization_profiles`    | select             | —           | own + vis                                                                                | ✓                                      | policy `organization_profiles_select`                                |
|                            | update             | —           | own, cols `organization_name, description, website, support_types, logo_path`            | same as others                         | column grant; guard trigger                                          |
| `mentor_profiles`          | select             | —           | own + vis                                                                                | ✓                                      | policy `mentor_profiles_select`                                      |
|                            | update             | —           | own, cols `job_title, company, expertise, years_of_experience, professional_summary`     | same as others                         | column grant; guard trigger                                          |
| `universities`             | select             | active rows | active rows                                                                              | all rows                               | policies `universities_select_active`, `universities_select_admin`   |
|                            | write              | —           | —                                                                                        | — (admin RPC later)                    | no grant                                                             |
| `university_email_domains` | select             | —           | — (0 rows; use `check_student_email`)                                                    | ✓                                      | no anon grant; admin-only policy                                     |
| `university_requests`      | select             | —           | —                                                                                        | ✓                                      | admin-only policy (inserts: Edge Function, later)                    |
| `verification_reviews`     | select             | —           | own (as subject), every column **except `reviewer_id`**                                  | ✓ (not `reviewer_id`; admin RPC later) | column grant; policy `verification_reviews_select`                   |
|                            | write              | —           | —                                                                                        | RPC                                    | append-only triggers (`ABR_APPEND_ONLY`), even for the owner         |
| `audit_events`             | select             | —           | —                                                                                        | ✓                                      | admin-only policy                                                    |
|                            | write              | —           | —                                                                                        | —                                      | written only by `private.log_event()`; append-only triggers          |
| `private.contact_details`  | any                | —           | RPC (`get_my_contact`, `update_my_contact`), own row only                                | RPC, own row                           | schema `private` not exposed; no grants at all                       |

`service_role` (secret key, server-side only) additionally has `SELECT` on `profiles` so
`scripts/provision-admin.mjs` can verify a new admin.

## Functions (RPCs)

All functions set `search_path = ''`, revoke `EXECUTE` from `public, anon, authenticated` and then
grant it explicitly. Error codes: `42501` not allowed · `22023` invalid input · `55000` wrong state
· `P0002` not found.

| Function                                                          | Callable by             | Checks                                                                                                                                                                                                                                                         | Negative tests                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `check_student_email(university_id, email)`                       | anon, authenticated     | Exact, case-insensitive domain match against an active domain of an active university; returns false (never raises) on bad input. **The only anon-executable function** (schema guard allowlist).                                                              | `010_signup`: other university, malformed input                                                                                      |
| `current_app_role()`, `is_admin()`, `is_verified()`               | authenticated           | Read the caller's own profile (`SECURITY DEFINER`, no RLS recursion)                                                                                                                                                                                           | `020_permissions`: anon refused                                                                                                      |
| `get_my_contact()`                                                | authenticated           | `auth.uid()` required; returns the caller's row only                                                                                                                                                                                                           | `020_permissions`: own row only; anon refused                                                                                        |
| `update_my_contact(phone, linkedin, share_phone, share_linkedin)` | authenticated           | E.164 phone, `https://(www.)linkedin.com/in                                                                                                                                                                                                                    | company/…`; audited as `contact.updated` with the changed field names, never values                                                  | `020_permissions`: invalid phone, non-LinkedIn URL |
| `review_verification(subject, decision, reason)`                  | authenticated (admin)   | Admin (`42501`); decision approved/rejected (`22023`); subject organization/mentor (`22023`); pending (`55000`); onboarding completed (`55000`); reason on reject (`22023`); row lock; status + review row + audit in one transaction                          | `030_verification`: self-verify, non-admin, no reason, student, admin, incomplete onboarding, twice                                  |
| `resubmit_verification()`                                         | authenticated           | Caller is a rejected organization/mentor (`55000`); back to pending; audited                                                                                                                                                                                   | `030_verification`: student, second resubmit                                                                                         |
| `private.handle_new_user()`                                       | trigger on `auth.users` | Deferred to COMMIT. Admin only from `raw_app_meta_data.abr_role`; otherwise role student/organization/mentor from user metadata (`ABR_INVALID_ROLE`); students need a valid university id and an allowlisted email domain (`ABR_UNSUPPORTED_UNIVERSITY_EMAIL`) | `010_signup`: gmail, other university, unlisted subdomain, inactive domain/university, malformed/missing id, metadata admin, no role |
| `private.handle_user_email_confirmed()`                           | trigger on `auth.users` | Unverified student → verified; contact email verified; audited                                                                                                                                                                                                 | `010_signup`                                                                                                                         |
| `private.log_event(…)`                                            | trusted code only       | Sole writer of `audit_events`                                                                                                                                                                                                                                  | `020_permissions`: private schema unreachable                                                                                        |
| `private.email_domain(email)`                                     | trusted code only       | Lower-cased text after the last `@`                                                                                                                                                                                                                            | —                                                                                                                                    |

## Always true

- anon has no INSERT, UPDATE, DELETE or TRUNCATE on any public relation.
- authenticated has no table INSERT, DELETE or TRUNCATE; UPDATE only on explicitly granted columns.
- Schema `private` is not exposed through the Data API; anon/authenticated have no USAGE on it.
- No `SECURITY DEFINER` function is executable by anon or PUBLIC, except the allowlisted
  `check_student_email(uuid, text)`, which is granted to anon explicitly (never to PUBLIC).
- anon can execute no other function in `public`.
- `audit_events` and `verification_reviews` are append-only for everyone, the owner included.

These invariants are enforced by `supabase/tests/database/000_schema_guard.test.sql`; the
behaviour is covered by `010_signup`, `020_permissions` and `030_verification`.
