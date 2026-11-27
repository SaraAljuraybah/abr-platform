-- SCRUM-17: organization and mentor onboarding (server-side completion rule, option codes) and
-- the admin verification queue (admin only, includes the sign-up email, ready profiles only).

begin;

select plan(26);

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

insert into public.universities (id, name_ar, name_en) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار', 'Test University');
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-test.test');

select pg_temp.new_user('e1e1e1e1-0000-4000-8000-000000000001', 'hr@clinic.test',
  '{"role": "organization", "full_name": "Huda", "organization_name": "Clinic Co"}');
select pg_temp.new_user('e1e1e1e1-0000-4000-8000-000000000002', 'mentor@example.test',
  '{"role": "mentor", "full_name": "Majed"}');
select pg_temp.new_user('e1e1e1e1-0000-4000-8000-000000000003', 'idle@company.test',
  '{"role": "organization", "full_name": "Idle", "organization_name": "Idle Co"}');
select pg_temp.new_user('e1e1e1e1-0000-4000-8000-000000000004', 's@uni-test.test',
  '{"role": "student", "full_name": "Sara", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}');
select pg_temp.new_user('e1e1e1e1-0000-4000-8000-0000000000a1', 'admin@abr.test',
  '{"full_name": "Admin"}', '{"abr_role": "admin"}');

-- Organization ------------------------------------------------------------------------------

select pg_temp.act_as('e1e1e1e1-0000-4000-8000-000000000001');
select throws_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'e1e1e1e1-0000-4000-8000-000000000001' $$,
  '23514', 'ABR_ONBOARDING_INCOMPLETE', 'an organization cannot finish with an empty profile');
select throws_ok(
  $$ update public.organization_profiles set sector = 'crypto'
     where user_id = 'e1e1e1e1-0000-4000-8000-000000000001' $$,
  '23514', null, 'an unknown sector code is refused');
select throws_ok(
  $$ update public.organization_profiles set support_types = array['free money']
     where user_id = 'e1e1e1e1-0000-4000-8000-000000000001' $$,
  '23514', null, 'an unknown support type is refused');
select lives_ok(
  $$ update public.organization_profiles
     set sector = 'healthcare', org_size = '51_500',
         description = 'A clinic network looking for health-tech graduation projects.',
         support_types = array['hire_talent', 'sponsor_projects'],
         website = 'https://clinic.test'
     where user_id = 'e1e1e1e1-0000-4000-8000-000000000001' $$,
  'the organization fills in its profile');
select throws_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'e1e1e1e1-0000-4000-8000-000000000001' $$,
  '23514', 'ABR_ONBOARDING_INCOMPLETE', 'without a phone it still cannot finish');
select lives_ok(
  $$ select public.update_my_contact('+966501112222', '', false, false) $$,
  'the organization saves its mobile number');
select lives_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'e1e1e1e1-0000-4000-8000-000000000001' $$,
  'with every required field and a phone, the organization finishes onboarding');
select is(
  (select verification_status::text from public.profiles
   where id = 'e1e1e1e1-0000-4000-8000-000000000001'),
  'pending', 'it stays pending: finishing onboarding is not verification');
select throws_ok(
  $$ update public.profiles set verification_status = 'verified'
     where id = 'e1e1e1e1-0000-4000-8000-000000000001' $$,
  '42501', null, 'it cannot verify itself');
select throws_ok(
  $$ select * from public.admin_verification_queue() $$,
  '42501', 'ABR_NOT_ADMIN', 'it cannot read the verification queue');
reset role;

-- Mentor -----------------------------------------------------------------------------------

select pg_temp.act_as('e1e1e1e1-0000-4000-8000-000000000002');
select throws_ok(
  $$ update public.mentor_profiles set expertise = array['astrology']
     where user_id = 'e1e1e1e1-0000-4000-8000-000000000002' $$,
  '23514', null, 'an unknown expertise code is refused');
select lives_ok(
  $$ update public.mentor_profiles
     set job_title = 'Data Lead', company = 'Data Co', years_of_experience = 9,
         expertise = array['software_data'],
         professional_summary = 'Nine years building data products; happy to mentor students.'
     where user_id = 'e1e1e1e1-0000-4000-8000-000000000002' $$,
  'the mentor fills in their profile');
select throws_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'e1e1e1e1-0000-4000-8000-000000000002' $$,
  '23514', 'ABR_ONBOARDING_INCOMPLETE', 'a mentor without a phone cannot finish');
select lives_ok(
  $$ select public.update_my_contact('+966503334444', 'https://www.linkedin.com/in/majed', true, true) $$,
  'the mentor saves a phone and LinkedIn');
select lives_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'e1e1e1e1-0000-4000-8000-000000000002' $$,
  'the mentor finishes onboarding');
reset role;

-- A short description does not count.
select pg_temp.act_as('e1e1e1e1-0000-4000-8000-000000000003');
select lives_ok(
  $$ update public.organization_profiles
     set sector = 'other', description = 'Too short.', support_types = array['offer_mentoring']
     where user_id = 'e1e1e1e1-0000-4000-8000-000000000003' $$,
  'an organization saves a too-short description');
select lives_ok(
  $$ select public.update_my_contact('+966505556666', '', false, false) $$,
  'and a phone');
select throws_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'e1e1e1e1-0000-4000-8000-000000000003' $$,
  '23514', 'ABR_ONBOARDING_INCOMPLETE', 'a description under 30 characters blocks finishing');
reset role;

-- The verification queue ---------------------------------------------------------------------

select pg_temp.act_as('e1e1e1e1-0000-4000-8000-000000000004');
select throws_ok(
  $$ select * from public.admin_verification_queue() $$,
  '42501', 'ABR_NOT_ADMIN', 'a student cannot read the queue');
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.admin_verification_queue() $$,
  '42501', null, 'anon cannot read the queue');
reset role;

select pg_temp.act_as('e1e1e1e1-0000-4000-8000-0000000000a1');
select results_eq(
  $$ select email from public.admin_verification_queue() order by email $$,
  $$ values ('hr@clinic.test'::text), ('mentor@example.test'::text) $$,
  'the queue lists only onboarded pending partners, with their sign-up email');
select is(
  (select sector from public.admin_verification_queue() where email = 'hr@clinic.test'),
  'healthcare', 'the queue carries the organization profile');
select is(
  (select professional_summary from public.admin_verification_queue()
   where email = 'mentor@example.test'),
  'Nine years building data products; happy to mentor students.',
  'the queue carries the mentor profile');
select lives_ok(
  $$ select public.review_verification('e1e1e1e1-0000-4000-8000-000000000001', 'approved') $$,
  'the admin approves the organization');
select lives_ok(
  $$ select public.review_verification('e1e1e1e1-0000-4000-8000-000000000002', 'rejected',
       'Please add your company website.') $$,
  'the admin rejects the mentor with a reason');
select results_eq(
  $$ select email from public.admin_verification_queue('rejected') $$,
  $$ values ('mentor@example.test'::text) $$,
  'the rejected filter shows the rejected mentor');
reset role;

select * from finish();
rollback;
