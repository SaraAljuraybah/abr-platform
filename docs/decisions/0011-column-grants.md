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
Verify default privileges on the hosted development project when it is linked (SCRUM-12); hosted and older projects may still grant ALL.

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

## Note (SCRUM-12, 2026-10-26): default privileges

**Local stack, observed** (Supabase CLI 2.113.0, Postgres 17.6.1.158, `pg_default_acl` for schema
`public`):

| Objects created by | Tables (`r`)                                              | Functions (`f`)                                    |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------- |
| `postgres`         | `anon`, `authenticated`, `service_role`: `Dxtm` only      | `postgres` only (no `PUBLIC` default)              |
| `supabase_admin`   | `anon`, `authenticated`, `service_role`: ALL (`arwdDxtm`) | `anon`, `authenticated`, `service_role`: `EXECUTE` |

Consequences seen while building SCRUM-12: `service_role` (the secret key) cannot even `SELECT` a
table created in a migration unless it is granted explicitly (`profiles` now grants it `SELECT`).
The migrations still revoke function `EXECUTE` from `PUBLIC` explicitly, so they do not depend on
the local function default either.

**Hosted development project: not yet verified.** It is not linked (no project ref in
`supabase/.temp`), and linking needs the CTO's credentials. When it is linked, run these in the SQL
editor and record the output here:

```sql
-- Default privileges per creating role in schema public.
select pg_catalog.pg_get_userbyid(d.defaclrole) as creator,
       d.defaclobjtype::text as object_type,
       pg_catalog.array_to_string(d.defaclacl, ' ') as privileges
from pg_catalog.pg_default_acl d
join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public'
order by 1, 2;

-- What the client roles actually hold on the migrated tables.
select grantee, table_name,
       string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
group by grantee, table_name
order by table_name, grantee;
```

The mutation check in SCRUM-12 simulated the hosted worst case (`grant all` to `authenticated`,
then a column-only `revoke`): the privilege tests and the schema guard fail, and only the guard
trigger still stops role and status changes. Both layers are needed.
