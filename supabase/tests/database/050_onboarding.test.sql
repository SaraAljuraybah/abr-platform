-- SCRUM-15: student onboarding writes, acting as real users through request.jwt.claims.
-- Threat model (Plan §15): an authenticated user with a REST client calling everything directly.

begin;

select plan(33);

set constraints all immediate;

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'جامعة الاختبار الثانية', 'Test University Two', true);
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'uni-two.test');

create function pg_temp.new_user(p_id uuid, p_email text, p_user_meta jsonb)
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
    now(), '{}'::jsonb, coalesce(p_user_meta, '{}'::jsonb) || (
      -- SCRUM-38: every sign-up carries the current Terms and Privacy Policy versions.
      select jsonb_build_object('terms_version', v.terms_version, 'privacy_version', v.privacy_version)
      from private.current_legal_versions() v
    ), now(), now()
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

-- A, B: verified students. M: mentor.
select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000a', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student A"}');
select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000b', 'b@uni-two.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000002", "full_name": "Student B"}');
select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000c', 'm@example.test',
  '{"role": "mentor", "full_name": "Mentor M"}');

-- Schema -----------------------------------------------------------------------------------------

select col_not_null('public', 'profiles', 'onboarding_step', 'profiles.onboarding_step is not null');
select col_default_is('public', 'profiles', 'onboarding_step', '0', 'onboarding_step starts at 0');
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'onboarding_step', 'UPDATE')
  and has_column_privilege('authenticated', 'public.student_profiles', 'graduation_year', 'UPDATE')
  and has_column_privilege('authenticated', 'public.student_profiles', 'major_other', 'UPDATE'),
  'authenticated may update the new onboarding columns'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'onboarding_step', 'UPDATE')
  and not has_column_privilege('anon', 'public.student_profiles', 'graduation_year', 'UPDATE')
  and not has_column_privilege('anon', 'public.student_profiles', 'major_other', 'UPDATE'),
  'anon may not update them'
);
select ok(
  not has_column_privilege('authenticated', 'public.student_profiles', 'university_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'verification_status', 'UPDATE'),
  'university_id, role and verification_status stay without UPDATE grants'
);

-- A student fills in their own profile -----------------------------------------------------------

select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000a');

select lives_ok(
  $$ update public.profiles set full_name = 'Student A', bio = 'Builds things.', onboarding_step = 1
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  'step 1: a student saves their name, bio and step'
);
select throws_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', 'ABR_ONBOARDING_INCOMPLETE',
  'onboarding cannot be completed before the studies step is saved'
);
select throws_ok(
  $$ update public.student_profiles set major = 'Computer Science'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'major must be a field-of-study code'
);
select throws_ok(
  $$ update public.student_profiles set major = 'other'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'major "other" requires major_other'
);
select throws_ok(
  $$ update public.student_profiles set major = 'cs', major_other = 'Robotics'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'major_other is refused unless major is "other"'
);
select throws_ok(
  $$ update public.student_profiles set major = 'other', major_other = 'R'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'major_other shorter than 2 characters is refused'
);
select throws_ok(
  $$ update public.student_profiles set major = 'other', major_other = repeat('x', 101)
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'major_other longer than 100 characters is refused'
);
select throws_ok(
  $$ update public.student_profiles set academic_level = 'PhD'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'academic_level must be a level code'
);
select throws_ok(
  $$ update public.student_profiles set graduation_year = '1999'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'graduation_year must be in the option list'
);
select lives_ok(
  $$ update public.student_profiles
     set major = 'other', major_other = 'Robotics', academic_level = 'final_year',
         graduation_year = '2026'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  'step 2: valid studies are saved'
);
select throws_ok(
  $$ update public.student_profiles set interests = '{fintech,crypto}'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'interests must be interest codes'
);
select throws_ok(
  $$ update public.student_profiles
     set skills = array(select 'skill' || g from generate_series(1, 21) g)
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'more than 20 skills are refused'
);
select lives_ok(
  $$ update public.student_profiles
     set skills = '{React,Python}', interests = '{fintech,other}'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  'step 3: skills and interest codes are saved'
);
select throws_ok(
  $$ update public.student_profiles set github_url = 'https://gitlab.com/student-a'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'a non-GitHub URL is refused'
);
select throws_ok(
  $$ update public.profiles set onboarding_step = 5
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'onboarding_step above 4 is refused'
);
-- SCRUM-38: the phone, through the contact RPC (never a public table).
select lives_ok(
  $$ select public.update_my_contact('+966501234567', '', false, false) $$,
  'step 1: a student saves their mobile number through update_my_contact'
);
select lives_ok(
  $$ update public.profiles set onboarding_completed = true, onboarding_step = 4
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  'with the required fields set, the student completes onboarding'
);

-- What a student can never do --------------------------------------------------------------------

select throws_ok(
  $$ update public.student_profiles set university_id = 'aaaaaaaa-0000-4000-8000-000000000002'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table student_profiles',
  'a student cannot change their university'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table profiles',
  'a student cannot change their role'
);
select throws_ok(
  $$ update public.profiles set verification_status = 'suspended'
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table profiles',
  'a student cannot change their verification status'
);

with changed as (
  update public.student_profiles set major = 'ai', skills = '{Hacked}'
  where user_id = 'dddddddd-0000-4000-8000-00000000000b'
  returning 1
)
select is(count(*)::int, 0, 'a student cannot update another student''s profile (0 rows)')
from changed;

with changed as (
  update public.profiles set onboarding_step = 4, full_name = 'Hacked', onboarding_completed = true
  where id = 'dddddddd-0000-4000-8000-00000000000b'
  returning 1
)
select is(count(*)::int, 0, 'a student cannot change another user''s onboarding (0 rows)')
from changed;

reset role;

select is(
  (select row(s.university_id, p.role, p.verification_status, p.onboarding_completed)::text
   from public.profiles p join public.student_profiles s on s.user_id = p.id
   where p.id = 'dddddddd-0000-4000-8000-00000000000a'),
  row('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'student'::public.user_role,
      'verified'::public.verification_status, true)::text,
  'student A: university, role and status unchanged; onboarding completed'
);
select is(
  (select row(p.full_name, p.onboarding_step, p.onboarding_completed, s.major, s.skills)::text
   from public.profiles p join public.student_profiles s on s.user_id = p.id
   where p.id = 'dddddddd-0000-4000-8000-00000000000b'),
  row('Student B', 0::smallint, false, null::text, '{}'::text[])::text,
  'student B is untouched'
);

-- The guard covers trusted code too, and only students for now.
select throws_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'dddddddd-0000-4000-8000-00000000000b' $$,
  '23514', 'ABR_ONBOARDING_INCOMPLETE',
  'even the table owner cannot complete an incomplete student onboarding'
);
select lives_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'dddddddd-0000-4000-8000-00000000000c' $$,
  'the student rule does not apply to mentors'
);

-- anon -------------------------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ update public.profiles set onboarding_step = 1
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table profiles',
  'anon cannot update onboarding_step'
);
select throws_ok(
  $$ update public.student_profiles set graduation_year = '2026'
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', 'permission denied for table student_profiles',
  'anon cannot update student profiles'
);
reset role;

select * from finish();

rollback;
