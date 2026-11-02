-- SCRUM-12: what clients can and cannot do, acting as real users through request.jwt.claims.
-- Threat model (Plan §15): an authenticated user with a REST client calling everything directly.

begin;

select plan(44);

-- The sign-up trigger is deferred to COMMIT, which a rolled-back test never reaches: fire it
-- at the end of each statement instead.
set constraints all immediate;

-- Fixtures ------------------------------------------------------------------

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'جامعة الاختبار الثانية', 'Test University Two', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'جامعة متوقفة', 'Inactive University', false);
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'uni-two.test');

create function pg_temp.new_user(
  p_id uuid, p_email text, p_user_meta jsonb, p_app_meta jsonb default '{}'::jsonb,
  p_confirmed boolean default true
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
    case when p_confirmed then now() end, p_app_meta, p_user_meta, now(), now()
  );
  return p_id;
end;
$$;

-- Act as a signed-in user (role authenticated + JWT sub), the way PostgREST does.
create function pg_temp.act_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- A, B: verified students. U: unverified student. P: pending organization.
-- V: verified organization. X: admin.
select pg_temp.new_user('cccccccc-0000-4000-8000-00000000000a', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student A"}');
select pg_temp.new_user('cccccccc-0000-4000-8000-00000000000b', 'b@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student B"}');
select pg_temp.new_user('cccccccc-0000-4000-8000-00000000000c', 'u@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}', '{}', false);
select pg_temp.new_user('cccccccc-0000-4000-8000-00000000000d', 'p@company.test',
  '{"role": "organization"}');
select pg_temp.new_user('cccccccc-0000-4000-8000-00000000000e', 'v@company.test',
  '{"role": "organization"}');
select pg_temp.new_user('cccccccc-0000-4000-8000-00000000000f', 'x@abr.test', '{}',
  '{"abr_role": "admin"}');
-- Trusted context (the table owner) verifies V, as review_verification() would.
update public.profiles set verification_status = 'verified'
where id = 'cccccccc-0000-4000-8000-00000000000e';

-- Privileges (catalog) ------------------------------------------------------------

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated has no UPDATE privilege on profiles.role'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'verification_status', 'UPDATE'),
  'authenticated has no UPDATE privilege on profiles.verification_status'
);
select ok(
  not has_column_privilege('authenticated', 'public.student_profiles', 'university_id', 'UPDATE'),
  'authenticated has no UPDATE privilege on student_profiles.university_id'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated has no INSERT or DELETE privilege on profiles'
);

-- Second layer: even the owner cannot change a role.
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  '42501', 'ABR_PROTECTED_COLUMN',
  'the guard trigger refuses a role change even in a trusted context'
);

-- Acting as student A ---------------------------------------------------------------

select pg_temp.act_as('cccccccc-0000-4000-8000-00000000000a');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table profiles',
  'a student cannot change their own role'
);
select throws_ok(
  $$ update public.profiles set verification_status = 'suspended'
     where id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table profiles',
  'a student cannot change their own verification status'
);
select throws_ok(
  $$ update public.student_profiles set university_id = 'aaaaaaaa-0000-4000-8000-000000000002'
     where user_id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table student_profiles',
  'a student cannot change their university'
);
select throws_ok(
  $$ insert into public.profiles (id, role, verification_status)
     values (gen_random_uuid(), 'admin', 'verified') $$,
  '42501', 'permission denied for table profiles',
  'a student cannot insert a profile'
);
select throws_ok(
  $$ delete from public.profiles where id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table profiles',
  'a student cannot delete their profile'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Student A Renamed'
     where id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  'a student can edit their own name'
);
select is(
  (select full_name from public.profiles where id = 'cccccccc-0000-4000-8000-00000000000a'),
  'Student A Renamed',
  'the name change is stored'
);
select lives_ok(
  $$ update public.student_profiles set major = 'Computer Science', skills = '{SQL,React}'
     where user_id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  'a student can edit their own student profile fields'
);
select throws_ok(
  $$ update public.student_profiles set skills = array[repeat('x', 41)]
     where user_id = 'cccccccc-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'list items over the length limit are refused by a CHECK'
);

with changed as (
  update public.profiles set full_name = 'Hacked'
  where id = 'cccccccc-0000-4000-8000-00000000000b'
  returning 1
)
select is(count(*)::int, 0, 'a student cannot edit another user''s profile (0 rows)') from changed;

select throws_ok(
  $$ select * from private.contact_details $$,
  '42501', 'permission denied for schema private',
  'the private schema is unreachable (contact details)'
);
select throws_ok(
  $$ select private.log_event('x', 'y', null) $$,
  '42501', 'permission denied for schema private',
  'the private schema is unreachable (functions)'
);

select results_eq(
  $$ select contact_email from public.get_my_contact() $$,
  $$ values ('a@uni-one.test'::text) $$,
  'get_my_contact returns only the caller''s row'
);
select lives_ok(
  $$ select public.update_my_contact('+966500000001', 'https://www.linkedin.com/in/student-a', true, false) $$,
  'a user can update their own contact details'
);
select is(
  (select phone from public.get_my_contact()),
  '+966500000001',
  'the contact update is stored'
);
select throws_ok(
  $$ select public.update_my_contact('0500', null, false, false) $$,
  '22023', 'ABR_INVALID_PHONE',
  'an invalid phone number is refused'
);
select throws_ok(
  $$ select public.update_my_contact(null, 'https://evil.example/in/x', false, false) $$,
  '22023', 'ABR_INVALID_LINKEDIN',
  'a non-LinkedIn URL is refused'
);

select throws_ok(
  $$ insert into public.audit_events (action, entity_type) values ('fake', 'fake') $$,
  '42501', 'permission denied for table audit_events',
  'a client cannot write audit events'
);
select is(
  (select count(*)::int from public.audit_events),
  0,
  'a non-admin sees no audit events'
);

select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-00000000000b'),
  1,
  'a verified student is visible to other users'
);
select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-00000000000c'),
  0,
  'an unverified student is invisible to other users'
);
select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-00000000000d'),
  0,
  'a pending organization is invisible to other users'
);
select is(
  (select count(*)::int from public.organization_profiles
   where user_id = 'cccccccc-0000-4000-8000-00000000000d'),
  0,
  'a pending organization''s role profile is invisible too'
);
select is(
  (select count(*)::int from public.organization_profiles
   where user_id = 'cccccccc-0000-4000-8000-00000000000e'),
  1,
  'a verified organization''s role profile is visible'
);
select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-00000000000f'),
  0,
  'a verified student cannot see an admin''s profile'
);
select is(
  (select count(*)::int from public.university_email_domains),
  0,
  'clients cannot list approved email domains'
);
select is(
  public.current_app_role()::text || '/' || public.is_admin()::text || '/' || public.is_verified()::text,
  'student/false/true',
  'the role helpers describe the caller'
);

reset role;

-- Acting as the pending organization P ------------------------------------------------------

select pg_temp.act_as('cccccccc-0000-4000-8000-00000000000d');
select lives_ok(
  $$ update public.organization_profiles
     set organization_name = 'Pending Org', website = 'https://pending.test'
     where user_id = 'cccccccc-0000-4000-8000-00000000000d' $$,
  'an organization can edit its own organization profile (guard trigger on a non-student table)'
);
reset role;

-- Acting as an admin ------------------------------------------------------------------

select pg_temp.act_as('cccccccc-0000-4000-8000-00000000000f');

select ok(
  (select count(*) from public.audit_events) > 0,
  'an admin can read audit events'
);
select is(
  (select count(*)::int from public.profiles
   where id in ('cccccccc-0000-4000-8000-00000000000c', 'cccccccc-0000-4000-8000-00000000000d')),
  2,
  'an admin sees unverified and pending profiles'
);
select ok(
  exists (select 1 from public.universities where not active),
  'an admin sees inactive universities'
);

reset role;

-- Acting as anon -------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is(
  (select count(*)::int from public.universities
   where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002')),
  2,
  'anon can list active universities'
);
select is(
  (select count(*)::int from public.universities where not active),
  0,
  'anon cannot see inactive universities'
);
select throws_ok(
  $$ select * from public.profiles $$,
  '42501', 'permission denied for table profiles',
  'anon cannot read profiles'
);
select throws_ok(
  $$ select * from public.university_email_domains $$,
  '42501', 'permission denied for table university_email_domains',
  'anon cannot read email domains'
);
select throws_ok(
  $$ select public.is_admin() $$,
  '42501', 'permission denied for function is_admin',
  'anon cannot call is_admin()'
);
select throws_ok(
  $$ select public.current_app_role() $$,
  '42501', 'permission denied for function current_app_role',
  'anon cannot call current_app_role()'
);
select throws_ok(
  $$ select public.is_verified() $$,
  '42501', 'permission denied for function is_verified',
  'anon cannot call is_verified()'
);
select throws_ok(
  $$ select * from public.get_my_contact() $$,
  '42501', 'permission denied for function get_my_contact',
  'anon cannot call get_my_contact()'
);

reset role;

select * from finish();

rollback;
