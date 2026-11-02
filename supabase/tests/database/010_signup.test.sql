-- SCRUM-12: sign-up trigger (trusted role assignment), email confirmation and the student email
-- check. Fixtures are created in this transaction and rolled back; nothing depends on seed.sql.

begin;

select plan(37);

-- The sign-up trigger is deferred to COMMIT, which a rolled-back test never reaches: fire it
-- at the end of each statement instead.
set constraints all immediate;

-- Fixtures ------------------------------------------------------------------

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'جامعة الاختبار الثانية', 'Test University Two', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'جامعة متوقفة', 'Inactive University', false);

insert into public.university_email_domains (university_id, domain, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test', true),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'students.uni-one.test', true),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'retired.uni-one.test', false),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'uni-two.test', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'uni-three.test', true);

-- Inserting into auth.users fires the real sign-up trigger, as Supabase Auth does.
create function pg_temp.new_user(
  p_id uuid,
  p_email text,
  p_user_meta jsonb,
  p_app_meta jsonb default '{}'::jsonb,
  p_confirmed boolean default false
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

-- Student sign-up -----------------------------------------------------------

select lives_ok(
  $$ select pg_temp.new_user(
       'bbbbbbbb-0000-4000-8000-000000000001', 'Sara@Uni-One.TEST',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Sara Test"}'
     ) $$,
  'student with an allowlisted email (any case) signs up'
);

select is(
  (select role::text || '/' || verification_status::text from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'student/unverified',
  'a student starts unverified until the email is confirmed'
);

select is(
  (select university_id from public.student_profiles
   where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'the student profile records the validated university'
);

select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'Sara Test',
  'full_name is taken from sign-up metadata'
);

select results_eq(
  $$ select contact_email, contact_email_verified_at is null
     from private.contact_details where user_id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  $$ values ('sara@uni-one.test'::text, true) $$,
  'contact details are created with the lower-cased sign-up email, not yet verified'
);

select is(
  (select count(*)::int from public.audit_events
   where action = 'user.signed_up' and entity_id = 'bbbbbbbb-0000-4000-8000-000000000001'
     and actor_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  1,
  'sign-up is audited'
);

update auth.users set email_confirmed_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000001';

select is(
  (select verification_status::text from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'verified',
  'confirming the email verifies the student'
);

select isnt(
  (select contact_email_verified_at from private.contact_details
   where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  null,
  'confirming the email marks the contact email verified'
);

select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.email_confirmed'
     and entity_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  1,
  'the email confirmation is audited'
);

select lives_ok(
  $$ select pg_temp.new_user(
       'bbbbbbbb-0000-4000-8000-000000000002', 'noura@students.uni-one.test',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}',
       '{}', true
     ) $$,
  'a subdomain that is listed explicitly is accepted'
);

select is(
  (select verification_status::text from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'verified',
  'a student whose email is already confirmed at sign-up starts verified'
);

-- Refused student sign-ups ----------------------------------------------------

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'a@uni-two.test',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}') $$,
  '22023', 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL',
  'refused: another university''s domain'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'a@gmail.com',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}') $$,
  '22023', 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL',
  'refused: a personal email domain'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'a@cs.uni-one.test',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}') $$,
  '22023', 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL',
  'refused: a subdomain that is not listed (exact matching only)'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'a@retired.uni-one.test',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}') $$,
  '22023', 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL',
  'refused: an inactive domain'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'a@uni-three.test',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000003"}') $$,
  '22023', 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL',
  'refused: an inactive university'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'a@uni-one.test',
       '{"role": "student", "university_id": "not-a-uuid"}') $$,
  '22023', 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL',
  'refused: a malformed university id'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'a@uni-one.test', '{"role": "student"}') $$,
  '22023', 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL',
  'refused: a student without a university id'
);

-- Roles -----------------------------------------------------------------------

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'boss@uni-one.test', '{"role": "admin"}') $$,
  '22023', 'ABR_INVALID_ROLE',
  'refused: role=admin in user metadata'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'nobody@example.test', '{}') $$,
  '22023', 'ABR_INVALID_ROLE',
  'refused: no role'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'nobody@example.test', '{}',
       '{"abr_role": "superuser"}') $$,
  '22023', 'ABR_INVALID_ROLE',
  'refused: app metadata grants nothing but abr_role=admin'
);

select lives_ok(
  $$ select pg_temp.new_user('bbbbbbbb-0000-4000-8000-000000000003', 'hello@company.test',
       '{"role": "organization"}') $$,
  'an organization signs up with any email domain'
);

select is(
  (select role::text || '/' || verification_status::text from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000003'),
  'organization/pending',
  'an organization starts pending'
);

select ok(
  exists (select 1 from public.organization_profiles
          where user_id = 'bbbbbbbb-0000-4000-8000-000000000003'),
  'an organization gets an organization profile'
);

select lives_ok(
  $$ select pg_temp.new_user('bbbbbbbb-0000-4000-8000-000000000004', 'mentor@example.test',
       '{"role": "mentor"}') $$,
  'a mentor signs up'
);

select is(
  (select role::text || '/' || verification_status::text from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000004'),
  'mentor/pending',
  'a mentor starts pending'
);

select ok(
  exists (select 1 from public.mentor_profiles
          where user_id = 'bbbbbbbb-0000-4000-8000-000000000004'),
  'a mentor gets a mentor profile'
);

-- Admin only through app metadata (settable only with a secret key); it wins over user metadata.
select lives_ok(
  $$ select pg_temp.new_user('bbbbbbbb-0000-4000-8000-000000000005', 'admin@abr.test',
       '{"role": "student"}', '{"abr_role": "admin"}', true) $$,
  'an admin is provisioned through app metadata'
);

select is(
  (select role::text || '/' || verification_status::text || '/' || onboarding_completed::text
   from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000005'),
  'admin/verified/true',
  'a provisioned admin is verified with onboarding complete'
);

select is(
  (select count(*)::int from public.audit_events
   where action = 'admin.provisioned' and entity_id = 'bbbbbbbb-0000-4000-8000-000000000005'),
  1,
  'admin provisioning is audited'
);

-- Supabase Auth's real order (admin API): insert the user, then set app_metadata, then confirm
-- the email, then COMMIT. The deferred trigger must see the final row.

set constraints all deferred;
select pg_temp.new_user('bbbbbbbb-0000-4000-8000-000000000006', 'admin2@abr.test', '{}');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"abr_role": "admin"}'
where id = 'bbbbbbbb-0000-4000-8000-000000000006';
update auth.users set email_confirmed_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000006';
select pg_temp.new_user('bbbbbbbb-0000-4000-8000-000000000007', 'huda@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}');
update auth.users set email_confirmed_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000007';
-- Fires the pending sign-up triggers, as COMMIT would.
set constraints all immediate;

select is(
  (select role::text || '/' || verification_status::text from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000006'),
  'admin/verified',
  'admin API order: app_metadata set after the insert still provisions an admin'
);
select is(
  (select role::text || '/' || verification_status::text from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000007'),
  'student/verified',
  'admin API order: a student confirmed in the same transaction starts verified'
);
select isnt(
  (select contact_email_verified_at from private.contact_details
   where user_id = 'bbbbbbbb-0000-4000-8000-000000000007'),
  null,
  'admin API order: the contact email is marked verified'
);

-- check_student_email -----------------------------------------------------------

select ok(
  public.check_student_email('aaaaaaaa-0000-4000-8000-000000000001', 'MIXED.Case@UNI-ONE.test'),
  'check_student_email is case-insensitive'
);

select ok(
  not public.check_student_email('aaaaaaaa-0000-4000-8000-000000000002', 'x@uni-one.test'),
  'check_student_email is university-specific'
);

select ok(
  not public.check_student_email('aaaaaaaa-0000-4000-8000-000000000001', 'no-at-sign')
  and not coalesce(public.check_student_email('aaaaaaaa-0000-4000-8000-000000000001', null), false),
  'check_student_email returns false for malformed input instead of raising'
);

set local role anon;
select ok(
  public.check_student_email('aaaaaaaa-0000-4000-8000-000000000001', 'x@uni-one.test'),
  'anon can call check_student_email (the sign-up pre-check)'
);
reset role;

select * from finish();

rollback;
