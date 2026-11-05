-- D-15 (ADR-0013): profiles are visible only between verified users. Acting as real users through
-- request.jwt.claims, the way PostgREST does.

begin;

select plan(38);

set constraints all immediate;

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One', true);
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test');

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

-- How many rows of each table the current user can see for one owner.
create function pg_temp.visible(p_table text, p_owner uuid)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  execute pg_catalog.format(
    'select count(*)::int from public.%I where %I = $1',
    p_table, case when p_table = 'profiles' then 'id' else 'user_id' end
  ) into v_count using p_owner;
  return v_count;
end;
$$;
grant execute on function pg_temp.visible(text, uuid) to authenticated;

-- A, B: verified students. U: unconfirmed student. S: suspended student.
-- P: pending organization. V: verified organization. M: pending mentor. W: verified mentor.
-- X: admin.
select pg_temp.new_user('eeeeeeee-0000-4000-8000-00000000000a', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student A"}');
select pg_temp.new_user('eeeeeeee-0000-4000-8000-00000000000b', 'b@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student B"}');
select pg_temp.new_user('eeeeeeee-0000-4000-8000-00000000000c', 'u@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student U"}',
  '{}', false);
select pg_temp.new_user('eeeeeeee-0000-4000-8000-00000000000d', 's@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student S"}');
select pg_temp.new_user('eeeeeeee-0000-4000-8000-00000000000e', 'p@org.test',
  '{"role": "organization", "full_name": "Org P", "organization_name": "Pending Org"}');
select pg_temp.new_user('eeeeeeee-0000-4000-8000-00000000000f', 'v@org.test',
  '{"role": "organization", "full_name": "Org V", "organization_name": "Verified Org"}');
select pg_temp.new_user('eeeeeeee-0000-4000-8000-000000000010', 'm@mentor.test',
  '{"role": "mentor", "full_name": "Mentor M"}');
select pg_temp.new_user('eeeeeeee-0000-4000-8000-000000000011', 'w@mentor.test',
  '{"role": "mentor", "full_name": "Mentor W"}');
select pg_temp.new_user('eeeeeeee-0000-4000-8000-000000000012', 'x@abr.test',
  '{"full_name": "Admin X"}', '{"abr_role": "admin"}');

-- Statuses set as the table owner (trusted code); clients can never do this.
update public.profiles set verification_status = 'verified'
  where id in ('eeeeeeee-0000-4000-8000-00000000000f', 'eeeeeeee-0000-4000-8000-000000000011');
update public.profiles set verification_status = 'suspended'
  where id = 'eeeeeeee-0000-4000-8000-00000000000d';

select results_eq(
  $$ select id::text || ':' || role::text || ':' || verification_status::text
     from public.profiles where id::text like 'eeeeeeee-%' order by id $$,
  array[
    'eeeeeeee-0000-4000-8000-00000000000a:student:verified',
    'eeeeeeee-0000-4000-8000-00000000000b:student:verified',
    'eeeeeeee-0000-4000-8000-00000000000c:student:unverified',
    'eeeeeeee-0000-4000-8000-00000000000d:student:suspended',
    'eeeeeeee-0000-4000-8000-00000000000e:organization:pending',
    'eeeeeeee-0000-4000-8000-00000000000f:organization:verified',
    'eeeeeeee-0000-4000-8000-000000000010:mentor:pending',
    'eeeeeeee-0000-4000-8000-000000000011:mentor:verified',
    'eeeeeeee-0000-4000-8000-000000000012:admin:verified'
  ],
  'fixtures: roles and statuses as intended'
);

-- A pending organization sees only itself ----------------------------------------------------------

select pg_temp.act_as('eeeeeeee-0000-4000-8000-00000000000e');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000a'), 0,
  'a pending organization cannot read a verified student''s profile');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000a'), 0,
  'a pending organization cannot read a verified student''s student profile');
select is(pg_temp.visible('organization_profiles', 'eeeeeeee-0000-4000-8000-00000000000f'), 0,
  'a pending organization cannot read a verified organization');
select is(pg_temp.visible('mentor_profiles', 'eeeeeeee-0000-4000-8000-000000000011'), 0,
  'a pending organization cannot read a verified mentor');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000e'), 1,
  'a pending organization reads its own profile');
select is(pg_temp.visible('organization_profiles', 'eeeeeeee-0000-4000-8000-00000000000e'), 1,
  'a pending organization reads its own organization profile');
select is((select count(*)::int from public.profiles), 1,
  'a pending organization sees exactly one profile: its own');
select is((select count(*)::int from public.student_profiles), 0,
  'a pending organization sees no student profiles');
reset role;

-- A pending mentor -------------------------------------------------------------------------------

select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000010');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000a'), 0,
  'a pending mentor cannot read a verified student');
select is(pg_temp.visible('mentor_profiles', 'eeeeeeee-0000-4000-8000-000000000011'), 0,
  'a pending mentor cannot read a verified mentor');
select is(pg_temp.visible('mentor_profiles', 'eeeeeeee-0000-4000-8000-000000000010'), 1,
  'a pending mentor reads its own mentor profile');
reset role;

-- An unconfirmed student and a suspended student see only themselves ------------------------------

select pg_temp.act_as('eeeeeeee-0000-4000-8000-00000000000c');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000b'), 0,
  'an unverified student cannot read another student''s profile');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000b'), 0,
  'an unverified student cannot read another student''s student profile');
select is(pg_temp.visible('organization_profiles', 'eeeeeeee-0000-4000-8000-00000000000f'), 0,
  'an unverified student cannot read a verified organization');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000c'), 1,
  'an unverified student reads their own profile');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000c'), 1,
  'an unverified student reads their own student profile');
reset role;

select pg_temp.act_as('eeeeeeee-0000-4000-8000-00000000000d');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000a'), 0,
  'a suspended student cannot read another student''s profile');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000d'), 1,
  'a suspended student still reads their own student profile');
reset role;

-- A verified student sees verified, non-admin users only ------------------------------------------

select pg_temp.act_as('eeeeeeee-0000-4000-8000-00000000000a');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000b'), 1,
  'a verified student CAN read another verified student''s profile');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000b'), 1,
  'a verified student CAN read another verified student''s student profile');
select is(pg_temp.visible('organization_profiles', 'eeeeeeee-0000-4000-8000-00000000000f'), 1,
  'a verified student can read a verified organization');
select is(pg_temp.visible('mentor_profiles', 'eeeeeeee-0000-4000-8000-000000000011'), 1,
  'a verified student can read a verified mentor');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000c'), 0,
  'a verified student cannot read an unverified student');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000d'), 0,
  'a verified student cannot read a suspended student');
select is(pg_temp.visible('organization_profiles', 'eeeeeeee-0000-4000-8000-00000000000e'), 0,
  'a verified student cannot read a pending organization');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-000000000012'), 0,
  'a verified student cannot read an admin''s profile');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000a'), 1,
  'a verified student reads their own profile');
reset role;

-- A verified organization and a verified mentor ----------------------------------------------------

select pg_temp.act_as('eeeeeeee-0000-4000-8000-00000000000f');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000a'), 1,
  'a verified organization can read a verified student');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-000000000012'), 0,
  'a verified organization cannot read an admin');
reset role;

select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000011');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000b'), 1,
  'a verified mentor can read a verified student');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-000000000012'), 0,
  'a verified mentor cannot read an admin');
reset role;

-- The admin sees everyone, and only an admin sees admins ------------------------------------------

select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000012');
select is(pg_temp.visible('profiles', 'eeeeeeee-0000-4000-8000-00000000000e'), 1,
  'an admin reads a pending organization');
select is(pg_temp.visible('student_profiles', 'eeeeeeee-0000-4000-8000-00000000000c'), 1,
  'an admin reads an unverified student');
select is(pg_temp.visible('mentor_profiles', 'eeeeeeee-0000-4000-8000-000000000010'), 1,
  'an admin reads a pending mentor');
select is(
  (select count(*)::int from public.profiles where id::text like 'eeeeeeee-%'), 9,
  'an admin reads every profile, their own included'
);
reset role;

-- Contact details stay private ---------------------------------------------------------------------

select pg_temp.act_as('eeeeeeee-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select * from private.contact_details $$,
  '42501', 'permission denied for schema private',
  'contact details stay unreachable, even between verified users'
);
reset role;

set local role anon;
select throws_ok(
  $$ select * from public.profiles $$,
  '42501', 'permission denied for table profiles',
  'anon cannot read profiles'
);
reset role;

select * from finish();

rollback;
