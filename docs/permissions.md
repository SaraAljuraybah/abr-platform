# Permissions matrix

Role × table × operation, kept in sync with RLS policies, grants and RPCs. Every migration that
changes access updates this file in the same pull request (Definition of Done item 10). The database
is the authority; this file documents it.

**Legend:** `—` no access · `✓` allowed · `own` own rows only · `RPC` only through the named
function · `cols` only the listed columns.

**Roles:** `anon` (signed out) · `student` · `organization` · `mentor` · `admin` (all `authenticated`;
the app role comes from `profiles.role`).

## Tables

No tables exist yet (SCRUM-11 ships the foundation only). The first rows arrive with SCRUM-12.

| Table     | Operation | anon | student | organization | mentor | admin | Enforced by |
| --------- | --------- | ---- | ------- | ------------ | ------ | ----- | ----------- |
| _example_ | select    | —    |         |              |        |       |             |
|           | insert    | —    |         |              |        |       |             |
|           | update    | —    |         |              |        |       |             |
|           | delete    | —    |         |              |        |       |             |

## Functions (RPCs)

| Function   | Callable by | Checks | Negative tests |
| ---------- | ----------- | ------ | -------------- |
| _none yet_ |             |        |                |

## Always true

- anon has no INSERT, UPDATE, DELETE or TRUNCATE on any public relation.
- authenticated has no table INSERT, DELETE or TRUNCATE; UPDATE only on explicitly granted columns.
- Schema `private` is not exposed through the Data API; anon/authenticated have no USAGE on it.
- No `SECURITY DEFINER` function is executable by anon or PUBLIC.

These invariants are enforced by `supabase/tests/database/000_schema_guard.test.sql`.
