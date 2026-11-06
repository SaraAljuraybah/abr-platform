-- SCRUM-38: sign-up consents (Terms and Privacy Policy versions) and the required student phone.
-- Unlike the other files, the fixtures here pass their metadata as given: no consent is added.

begin;

select plan(31);

-- The sign-up trigger is deferred to COMMIT; fire it at the end of each statement instead.
set constraints all immediate;

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One', true);
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test');

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
    now(), p_app_meta, p_user_meta, now(), now()
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

-- Student metadata with the given consent fields merged in.
create function pg_temp.student(p_consent jsonb)
returns jsonb
language sql
as $$
  select '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001",
           "full_name": "Student"}'::jsonb || p_consent;
$$;

create function pg_temp.current_consent()
returns jsonb
language sql
as $$
  select jsonb_build_object('terms_version', v.terms_version, 'privacy_version', v.privacy_version)
  from private.current_legal_versions() v;
$$;

select results_eq(
  $$ select terms_version, privacy_version from private.current_legal_versions() $$,
  $$ values ('2026-11-v1', '2026-11-v1') $$,
  'the current versions are 2026-11-v1 (src/features/legal/versions.ts must match)'
);

-- Sign-up without (current) consent is refused ---------------------------------------------------

select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000001', 'n1@uni-one.test',
       pg_temp.student('{}')) $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'a student sign-up without any consent is refused');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000002', 'n2@uni-one.test',
       pg_temp.student(pg_temp.current_consent() - 'privacy_version')) $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'Terms alone are not enough');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000003', 'n3@uni-one.test',
       pg_temp.student(pg_temp.current_consent() - 'terms_version')) $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'the Privacy Policy alone is not enough');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000004', 'n4@uni-one.test',
       pg_temp.student(pg_temp.current_consent() || '{"terms_version": "2025-01-v1"}')) $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'an old Terms version is refused');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000005', 'n5@uni-one.test',
       pg_temp.student(pg_temp.current_consent() || '{"privacy_version": "2025-01-v1"}')) $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'an old Privacy Policy version is refused');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000006', 'n6@uni-one.test',
       pg_temp.student('{"terms_version": true, "privacy_version": true}')) $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'a "true" flag instead of the versions is refused');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000007', 'o@org.test',
       '{"role": "organization", "full_name": "Org", "organization_name": "Org"}') $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'an organization sign-up without consent is refused');
select throws_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000008', 'm@mentor.test',
       '{"role": "mentor", "full_name": "Mentor"}') $$,
  '22023', 'ABR_CONSENT_REQUIRED', 'a mentor sign-up without consent is refused');
select is((select count(*)::int from public.profiles where id::text like 'cccccccc-%'), 0,
  'no refused sign-up left a profile');

-- Sign-up with both current versions -------------------------------------------------------------

select lives_ok(
  $$ select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000a', 'a@uni-one.test',
       pg_temp.student(pg_temp.current_consent())) $$,
  'a student who accepted both current versions signs up');
select results_eq(
  $$ select terms_version, privacy_version,
            terms_accepted_at is not null, privacy_accepted_at is not null
     from public.profiles where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  $$ values ('2026-11-v1', '2026-11-v1', true, true) $$,
  'the versions and acceptance times are stored on the profile');
select results_eq(
  $$ select actor_id::text, metadata from public.audit_events
     where action = 'user.consented' and entity_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  $$ values ('dddddddd-0000-4000-8000-00000000000a',
             '{"terms_version": "2026-11-v1", "privacy_version": "2026-11-v1"}'::jsonb) $$,
  'user.consented is audited with both versions');
select lives_ok(
  $$ select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000b', 'b@uni-one.test',
       pg_temp.student(pg_temp.current_consent())) $$,
  'a second student signs up');
select lives_ok(
  $$ select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000c', 'v@org.test',
       '{"role": "organization", "full_name": "Org", "organization_name": "Org"}'::jsonb
       || pg_temp.current_consent()) $$,
  'an organization with both current versions signs up');
select lives_ok(
  $$ select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000d', 'x@abr.test',
       '{"full_name": "Admin"}', '{"abr_role": "admin"}') $$,
  'an admin is provisioned without consent (exempt)');
select results_eq(
  $$ select role::text, terms_version is null and privacy_version is null
     from public.profiles where id = 'dddddddd-0000-4000-8000-00000000000d' $$,
  $$ values ('admin', true) $$,
  'the admin''s consent columns stay null');

-- Consent columns are never client-writable -----------------------------------------------------

select is_empty(
  $$ select c from unnest(array['terms_version', 'terms_accepted_at', 'privacy_version',
       'privacy_accepted_at']) c
     where has_column_privilege('authenticated', 'public.profiles', c, 'UPDATE')
        or has_column_privilege('anon', 'public.profiles', c, 'UPDATE') $$,
  'no client role has UPDATE on the consent columns');

select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000a');
select throws_ok(
  $$ update public.profiles set terms_version = '2099-01-v9'
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', null, 'a student cannot write terms_version');
select throws_ok(
  $$ update public.profiles set privacy_accepted_at = now()
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', null, 'a student cannot write privacy_accepted_at');
reset role;

-- Hosted worst case (ADR 0011): even with a table-level grant, the guard trigger holds.
grant update on public.profiles to authenticated;
select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000a');
select throws_ok(
  $$ update public.profiles set terms_version = '2099-01-v9', terms_accepted_at = now()
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '42501', 'ABR_PROTECTED_COLUMN', 'guard: consent columns cannot change from a client role');
reset role;
revoke update on public.profiles from authenticated;
grant update (full_name, bio, avatar_path, onboarding_completed, onboarding_step)
  on public.profiles to authenticated;

select throws_ok(
  $$ update public.profiles set terms_accepted_at = null
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', null, 'a consent version never stands without its acceptance time');

-- The phone: required to complete student onboarding --------------------------------------------

update public.student_profiles
  set major = 'cs', academic_level = 'final_year', graduation_year = '2026'
  where user_id in ('dddddddd-0000-4000-8000-00000000000a', 'dddddddd-0000-4000-8000-00000000000b');

select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000a');
select throws_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  '23514', 'ABR_ONBOARDING_INCOMPLETE',
  'a student cannot complete onboarding without a phone');
select throws_ok(
  $$ select public.update_my_contact('0501234567', '', true, false) $$,
  '22023', 'ABR_INVALID_PHONE', 'the server stores E.164 only (the form normalises 05…)');
select lives_ok(
  $$ select public.update_my_contact('+966501234567', '', true, false) $$,
  'the student saves their mobile number and the share choice');
select lives_ok(
  $$ update public.profiles set onboarding_completed = true
     where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  'with a phone, the student completes onboarding');
reset role;

select results_eq(
  $$ select phone, share_phone from private.contact_details
     where user_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  $$ values ('+966501234567', true) $$,
  'the phone and share choice live in private.contact_details');

-- Nobody else reads the phone -----------------------------------------------------------------------

select is_empty(
  $$ select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'phone' $$,
  'no table in the Data API schema has a phone column');

select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000b');
select throws_ok(
  $$ select phone from private.contact_details $$,
  '42501', null, 'another student cannot read private.contact_details');
select results_eq(
  $$ select contact_email, phone from public.get_my_contact() $$,
  $$ values ('b@uni-one.test', null::text) $$,
  'get_my_contact returns only the caller''s own row');
reset role;

set local role anon;
select throws_ok(
  $$ select * from public.get_my_contact() $$,
  '42501', null, 'anon cannot call get_my_contact');
reset role;

select * from finish();
rollback;
