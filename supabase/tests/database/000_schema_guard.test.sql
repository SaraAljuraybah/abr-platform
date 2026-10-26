-- Schema guard (SCRUM-11). Protects every future migration.
--
-- Passes on an empty schema. Each check lists offending objects, so a failure names
-- exactly what a migration forgot. See CLAUDE.md and docs/decisions/0011-column-grants.md.
--
--   (a) RLS enabled on every table in public and private
--   (b) every SECURITY DEFINER function in public/private pins search_path = ''
--   (c) anon/authenticated have no USAGE on schema private
--   (d) anon cannot INSERT/UPDATE/DELETE/TRUNCATE any public relation
--   (e) authenticated cannot INSERT/DELETE/TRUNCATE any public relation
--       (column-level UPDATE grants remain allowed)
--   (f) no SECURITY DEFINER function in public/private is executable by anon or PUBLIC,
--       except the allowlist below
--   (g) anon can execute no function in public at all (definer or not), except the allowlist
--
-- Anon allowlist (SCRUM-12): public.check_student_email(uuid,text), the sign-up email pre-check.
-- Adding to it is a security decision: record it in docs/permissions.md and the PR.

begin;

select plan(7);

-- (a) ------------------------------------------------------------------------
select is_empty(
  $$
    select format('%I.%I', n.nspname, c.relname)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
    order by 1
  $$,
  '(a) RLS is enabled on every table in schemas public and private'
);

-- (b) ------------------------------------------------------------------------
select is_empty(
  $$
    select p.oid::pg_catalog.regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
      and not coalesce('search_path=""' = any (p.proconfig), false)
    order by 1
  $$,
  '(b) every SECURITY DEFINER function in public/private sets search_path = '''''
);

-- (c) ------------------------------------------------------------------------
select is_empty(
  $$
    select format('%s has USAGE on schema private', r.rolname)
    from pg_catalog.pg_namespace n
    cross join (values ('anon'), ('authenticated')) as r (rolname)
    where n.nspname = 'private'
      and pg_catalog.has_schema_privilege(r.rolname, n.oid, 'USAGE')
    order by 1
  $$,
  '(c) anon and authenticated have no USAGE on schema private'
);

-- (d) ------------------------------------------------------------------------
-- has_any_column_privilege also catches column-level INSERT/UPDATE grants.
select is_empty(
  $$
    select format('%I.%I: anon has %s', n.nspname, c.relname, v.priv)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) as v (priv)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and case
        when v.priv in ('INSERT', 'UPDATE')
          then pg_catalog.has_any_column_privilege('anon', c.oid, v.priv)
        else pg_catalog.has_table_privilege('anon', c.oid, v.priv)
      end
    order by 1
  $$,
  '(d) anon cannot INSERT, UPDATE, DELETE or TRUNCATE any public relation'
);

-- (e) ------------------------------------------------------------------------
select is_empty(
  $$
    select format('%I.%I: authenticated has %s', n.nspname, c.relname, v.priv)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (values ('INSERT'), ('DELETE'), ('TRUNCATE')) as v (priv)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and case
        when v.priv = 'INSERT'
          then pg_catalog.has_any_column_privilege('authenticated', c.oid, v.priv)
        else pg_catalog.has_table_privilege('authenticated', c.oid, v.priv)
      end
    order by 1
  $$,
  '(e) authenticated cannot INSERT, DELETE or TRUNCATE any public relation directly'
);

-- (f) ------------------------------------------------------------------------
-- has_function_privilege('anon', ...) is true for grants to anon and to PUBLIC.
select is_empty(
  $$
    select format('%s is executable by %s', p.oid::pg_catalog.regprocedure, g.grantee)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral (
      select 'anon' as grantee
      where pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      union all
      select 'PUBLIC'
      where exists (
        select 1
        from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
    ) as g
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
      -- Allowlisted functions may be granted to anon explicitly, never to PUBLIC.
      and not (
        g.grantee = 'anon'
        and p.oid::pg_catalog.regprocedure::text in ('check_student_email(uuid,text)')
      )
    order by 1
  $$,
  '(f) no SECURITY DEFINER function in public/private is executable by anon or PUBLIC (allowlist excepted)'
);

-- (g) ------------------------------------------------------------------------
-- Covers non-definer functions too: anon should reach nothing in public but the allowlist.
select is_empty(
  $$
    select format('%s is executable by anon', p.oid::pg_catalog.regprocedure)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
      and p.oid::pg_catalog.regprocedure::text not in ('check_student_email(uuid,text)')
    order by 1
  $$,
  '(g) anon can execute no function in public except the allowlist'
);

select * from finish();

rollback;
