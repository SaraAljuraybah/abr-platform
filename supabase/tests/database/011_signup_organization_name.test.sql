-- SCRUM-13: the sign-up trigger saves organization_name for organizations only. Length limits come
-- from the organization_profiles.organization_name CHECK (2-150 characters).

begin;

select plan(12);

-- The sign-up trigger is deferred to COMMIT, which a rolled-back test never reaches: fire it
-- at the end of each statement instead.
set constraints all immediate;

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One', true);

insert into public.university_email_domains (university_id, domain, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test', true);

create function pg_temp.new_user(p_id uuid, p_email text, p_user_meta jsonb)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '',
    '{}'::jsonb, coalesce(p_user_meta, '{}'::jsonb) || (
      -- SCRUM-38: every sign-up carries the current Terms and Privacy Policy versions.
      select jsonb_build_object('terms_version', v.terms_version, 'privacy_version', v.privacy_version)
      from private.current_legal_versions() v
    ), now(), now()
  );
  return p_id;
end;
$$;

-- Organizations -------------------------------------------------------------

select lives_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000001', 'org1@company.test',
       '{"role": "organization", "full_name": "Org Owner", "organization_name": "  Acme Labs \t"}') $$,
  'an organization signs up with a name'
);

select is(
  (select organization_name from public.organization_profiles
   where user_id = 'cccccccc-0000-4000-8000-000000000001'),
  'Acme Labs',
  'the organization name is saved trimmed'
);

select lives_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000002', 'org2@company.test',
       '{"role": "organization"}') $$,
  'an organization signs up without a name'
);

select ok(
  exists (select 1 from public.organization_profiles
          where user_id = 'cccccccc-0000-4000-8000-000000000002' and organization_name is null),
  'a missing organization name is stored as NULL'
);

select lives_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000003', 'org3@company.test',
       '{"role": "organization", "organization_name": "   "}') $$,
  'an organization signs up with a blank name'
);

select ok(
  exists (select 1 from public.organization_profiles
          where user_id = 'cccccccc-0000-4000-8000-000000000003' and organization_name is null),
  'a blank organization name is stored as NULL'
);

select lives_ok(
  format(
    $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000004', 'org4@company.test',
         jsonb_build_object('role', 'organization', 'organization_name', %L)) $$,
    ' ' || repeat('x', 150) || ' '
  ),
  'a 150-character name (after trimming) is accepted'
);

select throws_ok(
  format(
    $$ select pg_temp.new_user(gen_random_uuid(), 'org5@company.test',
         jsonb_build_object('role', 'organization', 'organization_name', %L)) $$,
    repeat('x', 151)
  ),
  '23514', null,
  'refused: an organization name over 150 characters (never truncated)'
);

select throws_ok(
  $$ select pg_temp.new_user(gen_random_uuid(), 'org6@company.test',
       '{"role": "organization", "organization_name": " A "}') $$,
  '23514', null,
  'refused: an organization name under 2 characters'
);

-- Other roles ---------------------------------------------------------------

select lives_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000007', 'sara@uni-one.test',
       '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001",
         "organization_name": "Not An Org"}') $$,
  'a student sending organization_name still signs up'
);

select ok(
  not exists (select 1 from public.organization_profiles
              where user_id = 'cccccccc-0000-4000-8000-000000000007'),
  'a student sending organization_name gets nothing written to organization_profiles'
);

select lives_ok(
  $$ select pg_temp.new_user('cccccccc-0000-4000-8000-000000000008', 'mentor@example.test',
       '{"role": "mentor", "organization_name": "x"}') $$,
  'a mentor sending organization_name (even an invalid one) is unaffected'
);

select * from finish();

rollback;
