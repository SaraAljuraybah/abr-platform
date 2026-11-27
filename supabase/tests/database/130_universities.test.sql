-- All Saudi universities (reference data), their kind and codes, real student sign-up against
-- the listed domains, and the admin-only domain management RPCs.

begin;

select plan(31);

set constraints all immediate;

create function pg_temp.new_user(
  p_id uuid, p_email text, p_user_meta jsonb, p_app_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '',
    now(), p_app_meta,
    p_user_meta || (
      select jsonb_build_object('terms_version', v.terms_version, 'privacy_version', v.privacy_version)
      from private.current_legal_versions() v
    ),
    now(), now()
  );
  return p_id;
end;
$$;

create function pg_temp.act_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.uni(p_code text)
returns uuid
language sql
as $$ select id from public.universities where code = p_code $$;

-- Reference data -------------------------------------------------------------

select is((select count(*)::int from public.universities where kind = 'public'), 29,
  '29 public universities are listed');
select is((select count(*)::int from public.universities where kind = 'private'), 14,
  '14 private universities are listed');
select is((select count(*)::int from public.universities where code is not null and active), 43,
  'every listed university is active and has a code');
select is(
  (select count(*)::int from public.universities u
   where u.code is not null
     and not exists (select 1 from public.university_email_domains d where d.university_id = u.id)),
  0, 'every listed university has at least one email domain');
select is(
  (select array_agg(domain order by domain) from public.university_email_domains
   where university_id = pg_temp.uni('kau')),
  array['kau.edu.sa', 'stu.kau.edu.sa'], 'KAU accepts its staff and student domains');
select is(
  (select array_agg(domain order by domain) from public.university_email_domains
   where university_id = pg_temp.uni('uqu')),
  array['st.uqu.edu.sa', 'uqu.edu.sa'], 'UQU accepts its staff and student domains');
select ok(
  exists (select 1 from public.university_email_domains
          where university_id = pg_temp.uni('aou') and domain = 'aou.edu.sa'),
  'Arab Open University accepts its student domain aou.edu.sa');
select is(
  (select name_ar from public.universities where code = 'king_saud'), 'جامعة الملك سعود',
  'Arabic names come from the shared list');

-- Anonymous visitors see the list (sign-up), including code and kind --------------------

set local role anon;
select is((select count(*)::int from public.universities where code is not null), 43,
  'anon sees all 43 universities');
select is((select kind from public.universities where code = 'psu'), 'private',
  'anon can read the kind used for grouping');
select ok(public.check_student_email(pg_temp.uni('kau'), 'S123@stu.kau.edu.sa'),
  'a KAU student email passes the sign-up pre-check');
select ok(not public.check_student_email(pg_temp.uni('kau'), 'someone@ksu.edu.sa'),
  'another university''s domain does not pass');
select throws_ok(
  $$ insert into public.universities (name_ar, name_en) values ('جامعة', 'Fake University') $$,
  '42501', null, 'anon cannot add a university');
reset role;

-- A real student sign-up at a listed university -----------------------------------------

select lives_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000001', '4401@pnu.edu.sa',
       jsonb_build_object('role', 'student', 'university_id', pg_temp.uni('pnu'),
                          'full_name', 'Test Student')) $$,
  'a student signs up with a pnu.edu.sa address');
select is(
  (select university_id from public.student_profiles
   where user_id = 'cccccccc-0000-4000-8000-000000000001'),
  pg_temp.uni('pnu'), 'the student is linked to PNU');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000002', 'x@gmail.com',
       jsonb_build_object('role', 'student', 'university_id', pg_temp.uni('pnu'),
                          'full_name', 'Wrong Domain')) $$,
  null, null, 'a student email outside the university''s domains is refused');

-- Admin domain management ---------------------------------------------------------------

select pg_temp.new_user('cccccccc-0000-4000-8000-0000000000a1', 'admin@abr.test',
  '{"full_name": "Admin"}', '{"abr_role": "admin"}');
select pg_temp.new_user('cccccccc-0000-4000-8000-0000000000c1', 'org@company.test',
  '{"role": "organization", "full_name": "Org", "organization_name": "Org Co"}');

-- Non-admins are refused.
select pg_temp.act_as('cccccccc-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.admin_add_university_domain(pg_temp.uni('tu'), 'students.tu.edu.sa') $$,
  '42501', 'ABR_FORBIDDEN', 'a student cannot add a domain');
select throws_ok(
  $$ select public.admin_set_university_domain_active(
       (select id from public.university_email_domains where domain = 'tu.edu.sa'), false) $$,
  '42501', 'ABR_FORBIDDEN', 'a student cannot disable a domain');
reset role;
select pg_temp.act_as('cccccccc-0000-4000-8000-0000000000c1');
select throws_ok(
  $$ select public.admin_add_university_domain(pg_temp.uni('tu'), 'students.tu.edu.sa') $$,
  '42501', 'ABR_FORBIDDEN', 'an organization cannot add a domain');
reset role;
set local role anon;
select throws_ok(
  $$ select public.admin_add_university_domain(
       'cccccccc-0000-4000-8000-000000000099', 'x.edu.sa') $$,
  '42501', null, 'anon cannot call the admin RPC');
reset role;

-- The admin can.
select pg_temp.act_as('cccccccc-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ select public.admin_add_university_domain(pg_temp.uni('tu'), '  Students.TU.edu.sa ') $$,
  'the admin adds a student subdomain (trimmed and lower-cased)');
select ok(
  public.check_student_email(pg_temp.uni('tu'), 's44@students.tu.edu.sa'),
  'the new subdomain passes the student check at once');
select throws_ok(
  $$ select public.admin_add_university_domain(pg_temp.uni('tu'), 'students.tu.edu.sa') $$,
  '23505', 'ABR_DOMAIN_TAKEN', 'a duplicate domain is refused');
select throws_ok(
  $$ select public.admin_add_university_domain(pg_temp.uni('tu'), 'not a domain') $$,
  '22023', 'ABR_INVALID_DOMAIN', 'a malformed domain is refused');
select throws_ok(
  $$ select public.admin_add_university_domain(gen_random_uuid(), 'new.edu.sa') $$,
  'P0002', 'ABR_NOT_FOUND', 'an unknown university is refused');
select lives_ok(
  $$ select public.admin_set_university_domain_active(
       (select id from public.university_email_domains where domain = 'students.tu.edu.sa'), false) $$,
  'the admin disables a domain');
select ok(
  not public.check_student_email(pg_temp.uni('tu'), 's44@students.tu.edu.sa'),
  'a disabled domain no longer passes');
select throws_ok(
  $$ select public.admin_set_university_domain_active(gen_random_uuid(), true) $$,
  'P0002', 'ABR_NOT_FOUND', 'an unknown domain id is refused');
reset role;

select is(
  (select count(*)::int from public.audit_events
   where action in ('university_domain.added', 'university_domain.disabled')),
  2, 'both admin changes are audited');

-- Clients still cannot write domains directly.
select pg_temp.act_as('cccccccc-0000-4000-8000-0000000000a1');
select throws_ok(
  $$ insert into public.university_email_domains (university_id, domain)
     values (pg_temp.uni('tu'), 'direct.tu.edu.sa') $$,
  '42501', null, 'even an admin cannot insert a domain directly (RPC only)');
select throws_ok(
  $$ update public.universities set kind = 'private' where code = 'tu' $$,
  '42501', null, 'clients cannot change a university');
reset role;

select * from finish();
rollback;
