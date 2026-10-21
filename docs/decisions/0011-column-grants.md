# ADR-0011: Revoke table privileges, then grant columns

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** CTO
- **Related:** CLAUDE.md rules 2 and 3; Plan v2.0 §15 (immutable roles, column-level grants)

## Context

Supabase grants privileges on new `public` tables to `anon` and `authenticated` by default. Which
privileges depends on the platform version and on who owns the object:

- Objects created by `supabase_admin`, and projects on older default privileges, get **ALL**
  (`arwdDxtm`) for both roles.
- On this repository's local stack (Supabase CLI 2.113.0, Postgres 17.6.1.158), tables created by
  `postgres` in a migration still get `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` for both roles
  (observed with `information_schema.role_table_grants` during SCRUM-11). `TRUNCATE` is not subject
  to RLS.
- Functions are executable by `PUBLIC` (and therefore `anon`) unless revoked.

Defaults that vary between environments cannot be relied on in either direction.

In PostgreSQL, **a column-level `REVOKE` has no effect while a table-level grant exists.** A pattern
such as `revoke update (status, published_at, owner_id) on projects from authenticated` therefore
leaves those columns writable. Testing this pattern during planning let a user change their own
role and verification status. Re-verified locally during SCRUM-11: after
`grant update on t to authenticated; revoke update (role) on t from authenticated;`,
`has_column_privilege('authenticated', 't', 'role', 'UPDATE')` is still `true`.

## Decision

Every table migration:

1. enables row level security;
2. runs `revoke all on <table> from anon, authenticated`;
3. grants `select` and `update (<editable columns>)` explicitly, and nothing else that is not needed;
4. adds a `BEFORE UPDATE` guard trigger on sensitive columns (role, verification status, ownership,
   status) as a second layer.

The schema guard test (`supabase/tests/database/000_schema_guard.test.sql`) enforces the result in
CI. It fails if anon can write to any public relation, if authenticated can `INSERT`, `DELETE` or
`TRUNCATE` one, or if RLS is off on any table.

## Consequences

- Row creation goes through `SECURITY DEFINER` RPCs or triggers. Clients never `INSERT` directly.
- Authenticated users may only `UPDATE` explicitly granted columns of their own rows (rows selected
  by RLS policies).
- Every migration is explicit about privileges, so behaviour is identical on local, development and
  production regardless of each project's default privileges.
- Adding an editable column requires a matching `grant update (<column>)` in the same migration.
