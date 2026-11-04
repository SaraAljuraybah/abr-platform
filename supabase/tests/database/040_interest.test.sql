-- SCRUM-34: interest signups. Clients reach nothing; the Edge Function (service role) writes through
-- submit_interest() after consume_rate_limit(); only admins read aggregated stats.
-- Threat model (Plan §15): an authenticated user with a REST client calling everything directly.

begin;

select plan(90);

set constraints all immediate;

-- Fixtures ------------------------------------------------------------------

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'جامعة الاهتمام', 'Interest University', true);
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'uni.test');

create function pg_temp.new_user(p_id uuid, p_email text, p_user_meta jsonb, p_app_meta jsonb)
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

-- Valid payloads per role; tests change one key at a time.
create function pg_temp.student(p_changes jsonb default '{}')
returns jsonb
language sql
as $$
  select '{
    "role": "student", "full_name": "Sara Student", "email": "sara@student.test",
    "university_code": "king_saud", "field_of_study": "cs",
    "graduation_year": "2027_or_later", "project_stage": "idea",
    "heard_from": "linkedin", "consent_contact": true, "consent_version": "2026-11-v2", "locale": "ar"
  }'::jsonb || p_changes;
$$;
create function pg_temp.organization(p_changes jsonb default '{}')
returns jsonb
language sql
as $$
  select '{
    "role": "organization", "full_name": "Omar Org", "email": "omar@org.test",
    "organization_name": "Org Labs", "sector": "technology",
    "looking_for": ["hire_talent", "sponsor_projects"], "org_size": "51_500",
    "heard_from": "event", "consent_contact": true, "consent_version": "2026-11-v2", "locale": "en"
  }'::jsonb || p_changes;
$$;
create function pg_temp.mentor(p_changes jsonb default '{}')
returns jsonb
language sql
as $$
  select '{
    "role": "mentor", "full_name": "Mona Mentor", "email": "mona@mentor.test",
    "expertise": "software_data", "experience": "8_15",
    "heard_from": "friend", "consent_contact": true, "consent_version": "2026-11-v2", "locale": "en"
  }'::jsonb || p_changes;
$$;

select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000a', 's@uni.test',
  '{"role": "student", "full_name": "Student", "university_id": "aaaaaaaa-0000-4000-8000-0000000000a1"}',
  '{}');
select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000b', 'o@org.test',
  '{"role": "organization", "full_name": "Org"}', '{}');
select pg_temp.new_user('dddddddd-0000-4000-8000-00000000000f', 'x@abr.test', '{}',
  '{"abr_role": "admin"}');

-- Privileges (catalog) ------------------------------------------------------------

select ok(
  not has_table_privilege(r.role, 'public.interest_signups', p.priv),
  format('%s has no %s on interest_signups', r.role, p.priv)
)
from (values ('anon'), ('authenticated')) as r (role)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p (priv);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.interest_signups'::regclass),
  'RLS is enabled on interest_signups'
);
select is(
  (select count(*)::int from pg_policies where tablename = 'interest_signups'),
  0,
  'interest_signups has no policies (nothing for any client role)'
);
select ok(
  not has_table_privilege('authenticated', 'private.rate_limits', 'SELECT'),
  'authenticated cannot read private.rate_limits'
);

select ok(
  not has_function_privilege(r.role, f.sig, 'EXECUTE'),
  format('%s cannot execute %s', r.role, f.sig)
)
from (values ('anon'), ('authenticated')) as r (role)
cross join (values
  ('public.submit_interest(jsonb)'),
  ('public.consume_rate_limit(text,text,integer,interval)')
) as f (sig);

select ok(
  not has_function_privilege('anon', 'public.get_interest_stats()', 'EXECUTE'),
  'anon cannot execute get_interest_stats'
);
select ok(
  has_function_privilege('service_role', 'public.submit_interest(jsonb)', 'EXECUTE')
  and has_function_privilege(
    'service_role', 'public.consume_rate_limit(text,text,integer,interval)', 'EXECUTE'
  ),
  'service_role can execute submit_interest and consume_rate_limit'
);

-- Columns: region and the old university link are gone -----------------------------

select hasnt_column('public', 'interest_signups', 'region', 'region is removed');
select hasnt_column('public', 'interest_signups', 'university_id', 'no link to public.universities');
select hasnt_column('public', 'interest_signups', 'channel', 'channel is renamed heard_from');
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.interest_signups'::regclass and contype = 'f'),
  0,
  'interest_signups has no foreign keys'
);

-- Direct client access (REST-client attacker) -------------------------------------

select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select * from public.interest_signups $$, '42501', null,
  'a student cannot select interest_signups'
);
select throws_ok(
  $$ select public.submit_interest(pg_temp.student()) $$, '42501', null,
  'a student cannot call submit_interest'
);
select throws_ok(
  $$ select public.consume_rate_limit('submit-interest', 'unknown', 5, interval '10 minutes') $$,
  '42501', null,
  'a student cannot call consume_rate_limit'
);
select throws_ok(
  $$ select * from public.get_interest_stats() $$, '42501', null,
  'a student cannot read interest stats'
);
reset role;

select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000b');
select throws_ok(
  $$ select * from public.get_interest_stats() $$, '42501', null,
  'an organization cannot read interest stats'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$ insert into public.interest_signups (role, full_name, email, heard_from, consent_contact, locale)
     values ('mentor', 'Anon', 'anon@x.test', 'x', true, 'en') $$,
  '42501', null,
  'anon cannot insert into interest_signups'
);
select throws_ok(
  $$ select * from public.get_interest_stats() $$, '42501', null,
  'anon cannot read interest stats'
);
reset role;

-- submit_interest as the service role ---------------------------------------------

set local role service_role;
select lives_ok($$ select public.submit_interest(pg_temp.student()) $$, 'student saved');
select lives_ok($$ select public.submit_interest(pg_temp.organization()) $$, 'organization saved');
select lives_ok($$ select public.submit_interest(pg_temp.mentor()) $$, 'mentor saved');
select lives_ok(
  $$ select public.submit_interest(pg_temp.student('{"email": "noor@student.test",
       "university_code": "other", "university_other": "Unlisted University",
       "field_of_study": "other", "field_of_study_other": "Robotics",
       "heard_from": "other", "heard_from_other": "A podcast"}')) $$,
  'student with "Other" university, field of study and heard_from, each with its text, saved'
);
reset role;

select is((select count(*)::int from public.interest_signups), 4, 'four rows');

set local role service_role;
select lives_ok(
  $$ select public.submit_interest(pg_temp.student('{"email": "SARA@Student.test",
       "graduation_year": "2000"}')) $$,
  'the same email in another case is accepted'
);
reset role;
select is((select count(*)::int from public.interest_signups), 4, 'still four rows');
select results_eq(
  $$ select submission_count, graduation_year from public.interest_signups
     where lower(email) = 'sara@student.test' $$,
  $$ values (2, '2000') $$,
  'the repeat updates the row and counts the submission'
);
select throws_ok(
  $$ insert into public.interest_signups (role, full_name, email, expertise, experience, heard_from,
       consent_contact, consent_version, locale)
     values ('mentor', 'Dup', 'Mona@Mentor.TEST', 'health', '0_3', 'x', true, '2026-11-v2', 'en') $$,
  '23505', null,
  'the email is unique whatever its case'
);

-- Consent version -----------------------------------------------------------------

select col_not_null('public', 'interest_signups', 'consent_version', 'consent_version is required');
select col_hasnt_default('public', 'interest_signups', 'consent_version',
  'consent_version has no default: the caller states the version');
select is(
  (select consent_version from public.interest_signups where email = 'mona@mentor.test'),
  '2026-11-v2',
  'the accepted consent version is stored'
);
update public.interest_signups set consent_at = now() - interval '30 days', consent_version = '2026-11-v1'
where email = 'mona@mentor.test';
set local role service_role;
select lives_ok(
  $$ select public.submit_interest(pg_temp.mentor('{"consent_version": "2026-12-v3"}')) $$,
  'a resubmission with a newer consent text is accepted'
);
reset role;
select results_eq(
  $$ select consent_version, consent_at = now() from public.interest_signups
     where email = 'mona@mentor.test' $$,
  $$ values ('2026-12-v3', true) $$,
  'a resubmission updates consent_version and consent_at'
);
set local role service_role;
select throws_ok(
  $$ select public.submit_interest(pg_temp.mentor('{"email": "nv@mentor.test"}') - 'consent_version') $$,
  '23502', null,
  'a submission without a consent version is refused'
);
select throws_ok(
  $$ select public.submit_interest(pg_temp.mentor('{"email": "bv@mentor.test", "consent_version": "v2"}')) $$,
  '23514', null,
  'a malformed consent version is refused'
);
reset role;

-- New universities (2026-11-04): accepted; old codes still accepted.
set local role service_role;
select lives_ok(
  $$ select public.submit_interest(pg_temp.student('{"email": "kaust@student.test", "university_code": "kaust"}')) $$,
  'a student at a newly listed university (kaust) is saved'
);
select lives_ok(
  $$ select public.submit_interest(pg_temp.student('{"email": "pmu@student.test", "university_code": "pmu_madinah"}')) $$,
  'a student at a newly listed private university (pmu_madinah) is saved'
);
reset role;
delete from public.interest_signups where email in ('kaust@student.test', 'pmu@student.test');

-- CHECK constraints reject anything outside the option lists ---------------------

select throws_ok(
  format('select public.submit_interest(%L::jsonb)', c.payload), '23514', null, c.description
)
from (values
  (pg_temp.mentor('{"role": "admin"}'), 'unknown role'),
  (pg_temp.student('{"university_code": "mit"}'), 'unknown university code'),
  (pg_temp.student('{"university_code": "naif"}'), 'Naif is no longer in the list'),
  (pg_temp.student('{"field_of_study": "cs_it"}'), 'old field of study'),
  (pg_temp.student('{"graduation_year": "1999"}'), 'graduation year before 2000'),
  (pg_temp.student('{"graduation_year": "2028_or_later"}'), 'old graduation year'),
  (pg_temp.student('{"project_stage": "have_idea"}'), 'old project stage'),
  (pg_temp.organization('{"sector": "retail"}'), 'unknown sector'),
  (pg_temp.organization('{"looking_for": ["hire_talent", "buy_data"]}'), 'unknown looking_for item'),
  (pg_temp.organization('{"looking_for": []}'), 'empty looking_for'),
  (pg_temp.organization('{"org_size": "5000_plus"}'), 'unknown organization size'),
  (pg_temp.mentor('{"expertise": "law"}'), 'unknown expertise'),
  (pg_temp.mentor('{"experience": "30_plus"}'), 'unknown experience'),
  (pg_temp.mentor('{"heard_from": "tv"}'), 'unknown heard_from'),
  (pg_temp.mentor('{"locale": "fr"}'), 'unknown locale'),
  (pg_temp.mentor('{"consent_contact": false}'), 'consent not given'),
  (pg_temp.student('{"university_code": "other"}'), 'university other without its text'),
  (pg_temp.student('{"university_other": "Both Given"}'), 'university text without other'),
  (pg_temp.student('{"university_code": "other", "university_other": "A"}'), 'university other text too short'),
  (pg_temp.student('{"field_of_study": "other"}'), 'field of study other without its text'),
  (pg_temp.student('{"field_of_study_other": "Robotics"}'), 'field of study text without other'),
  (pg_temp.student(jsonb_build_object('field_of_study', 'other', 'field_of_study_other', repeat('x', 101))), 'field of study other text too long'),
  (pg_temp.mentor('{"heard_from": "other"}'), 'heard_from other without its text'),
  (pg_temp.mentor('{"heard_from_other": "A podcast"}'), 'heard_from text without other'),
  (pg_temp.mentor('{"heard_from": "other", "heard_from_other": "A"}'), 'heard_from other text too short'),
  (pg_temp.student('{"university_code": null}'), 'student with no university'),
  (pg_temp.organization('{"field_of_study": "cs"}'), 'organization with a student field'),
  (pg_temp.mentor('{"university_code": "king_saud"}'), 'mentor with a student university'),
  (pg_temp.mentor('{"sector": "technology"}'), 'mentor with an organization field')
) as c (payload, description);

-- Rate limit ---------------------------------------------------------------------

select is(
  (select count(*)::int from generate_series(1, 5) as i
   where public.consume_rate_limit('submit-interest', repeat('a', 64), 5, interval '10 minutes')),
  5,
  'five attempts are allowed'
);
select is(
  public.consume_rate_limit('submit-interest', repeat('a', 64), 5, interval '10 minutes'),
  false,
  'the sixth attempt within the window is refused'
);
select is(
  public.consume_rate_limit('submit-interest', repeat('b', 64), 5, interval '10 minutes'),
  true,
  'another key is not affected'
);
update private.rate_limits set created_at = now() - interval '11 minutes'
where key = repeat('a', 64);
select is(
  public.consume_rate_limit('submit-interest', repeat('a', 64), 5, interval '10 minutes'),
  true,
  'attempts older than the window no longer count'
);
select is(
  public.consume_rate_limit('submit-interest', 'unknown', 5, interval '10 minutes'),
  true,
  'the shared unknown bucket is limited like any key'
);
select throws_ok(
  $$ select public.consume_rate_limit('submit-interest', '203.0.113.7', 5, interval '10 minutes') $$,
  '23514', null,
  'a raw IP address is never stored as a key'
);

-- Stats for admins ---------------------------------------------------------------

select pg_temp.act_as('dddddddd-0000-4000-8000-00000000000f');
select results_eq(
  $$ select value, count from public.get_interest_stats() where dimension = 'role' $$,
  $$ values ('mentor', 1::bigint), ('organization', 1::bigint), ('student', 2::bigint) $$,
  'admin: counts by role'
);
select results_eq(
  $$ select value, count from public.get_interest_stats() where dimension = 'university' $$,
  $$ values ('king_saud', 1::bigint), ('other', 1::bigint) $$,
  'admin: counts by university code, free text as other'
);
select results_eq(
  $$ select value, count from public.get_interest_stats() where dimension = 'field_of_study' $$,
  $$ values ('cs', 1::bigint), ('other', 1::bigint) $$,
  'admin: counts by field of study, free text as other'
);
select results_eq(
  $$ select value, count from public.get_interest_stats() where dimension = 'graduation_year' $$,
  $$ values ('2000', 1::bigint), ('2027_or_later', 1::bigint) $$,
  'admin: counts by graduation year'
);
select results_eq(
  $$ select value, count from public.get_interest_stats() where dimension = 'project_stage' $$,
  $$ values ('idea', 2::bigint) $$,
  'admin: counts by project stage'
);
select results_eq(
  $$ select value, count from public.get_interest_stats() where dimension = 'heard_from' $$,
  $$ values ('event', 1::bigint), ('friend', 1::bigint), ('linkedin', 1::bigint),
            ('other', 1::bigint) $$,
  'admin: counts by heard_from, free text as other'
);
select results_eq(
  $$ select value, count from public.get_interest_stats() where dimension = 'looking_for' $$,
  $$ values ('hire_talent', 1::bigint), ('sponsor_projects', 1::bigint) $$,
  'admin: counts per looking_for item'
);
select is(
  (select count(*)::int from public.get_interest_stats() where dimension in ('region', 'channel')),
  0,
  'admin: no region or channel dimension'
);
select is(
  (select count(*)::int from public.get_interest_stats()
   where value ilike '%@%' or value in ('Sara Student', 'Omar Org', 'Mona Mentor', 'Org Labs',
     'Unlisted University', 'Robotics', 'A podcast')),
  0,
  'admin: no emails, names or free text in the stats'
);
reset role;

select * from finish();
rollback;
