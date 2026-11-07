-- SCRUM-18 (page 8): submit_project, withdraw_submission and project_reviews. Acting as real users
-- through request.jwt.claims, the way PostgREST does.

begin;

select plan(51);

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
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.onboard(p_user uuid)
returns void
language plpgsql
as $$
begin
  update public.student_profiles
    set major = 'cs', academic_level = 'undergraduate', graduation_year = '2026'
    where user_id = p_user;
  update private.contact_details set phone = '+966500000000' where user_id = p_user;
  update public.profiles set onboarding_completed = true where id = p_user;
end;
$$;

-- A complete project, as the table owner.
create function pg_temp.complete(p_project uuid)
returns void
language sql
as $$
  update public.projects
  set summary = 'Indoor maps for campus.',
      description = repeat('A clear description of the project. ', 4),
      track = 'mobile', academic_year = '2026', stage = 'prototype'
  where id = p_project;
$$;

-- A: owner. B: another verified student. O: verified organization. X: admin.
select pg_temp.new_user('cdcdcdcd-0000-4000-8000-00000000000a', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student A"}');
select pg_temp.new_user('cdcdcdcd-0000-4000-8000-00000000000b', 'b@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student B"}');
select pg_temp.new_user('cdcdcdcd-0000-4000-8000-00000000000c', 'o@org.test',
  '{"role": "organization", "full_name": "Org O", "organization_name": "Verified Org"}');
select pg_temp.new_user('cdcdcdcd-0000-4000-8000-00000000000d', 'x@abr.test',
  '{"full_name": "Admin X"}', '{"abr_role": "admin"}');
select pg_temp.onboard('cdcdcdcd-0000-4000-8000-00000000000a');
select pg_temp.onboard('cdcdcdcd-0000-4000-8000-00000000000b');
update public.profiles set verification_status = 'verified', onboarding_completed = true
  where id = 'cdcdcdcd-0000-4000-8000-00000000000c';

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select public.create_project('Campus Navigator');
reset role;

create temporary table ids on commit drop as
  select id as a from public.projects where owner_id = 'cdcdcdcd-0000-4000-8000-00000000000a';
grant select on ids to authenticated;

select ok(
  not has_function_privilege('anon', 'public.submit_project(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.withdraw_submission(uuid)', 'EXECUTE'),
  'anon cannot execute submit_project or withdraw_submission');
set local role anon;
select throws_ok($$ select public.submit_project((select a from ids)) $$, '42501', null,
  'anon calling submit_project is refused');
reset role;

-- Completeness ---------------------------------------------------------------------------------------

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select throws_ok($$ select public.submit_project((select a from ids)) $$,
  '22023', 'ABR_PROJECT_INCOMPLETE: summary,description,track,academic_year,stage',
  'a new draft lists every missing field, in form order');
reset role;

select pg_temp.complete((select a from ids));

-- Each field missing on its own.
create function pg_temp.missing(p_column text, p_value text)
returns text
language plpgsql
as $$
declare
  v_message text;
begin
  execute format('update public.projects set %I = %L where id = (select a from ids)', p_column, p_value);
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'cdcdcdcd-0000-4000-8000-00000000000a', 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    perform public.submit_project((select a from ids));
    v_message := 'submitted';
  exception when others then
    v_message := sqlerrm;
  end;
  reset role;
  perform pg_temp.complete((select a from ids));
  return v_message;
end;
$$;

select is(pg_temp.missing('summary', null), 'ABR_PROJECT_INCOMPLETE: summary',
  'a missing summary is refused and named');
select is(pg_temp.missing('summary', '   '), 'ABR_PROJECT_INCOMPLETE: summary',
  'a blank summary counts as missing');
select is(pg_temp.missing('description', null), 'ABR_PROJECT_INCOMPLETE: description',
  'a missing description is refused and named');
select is(pg_temp.missing('description', repeat('x', 99)), 'ABR_PROJECT_INCOMPLETE: description',
  'a description of 99 characters is too short');
select is(pg_temp.missing('track', null), 'ABR_PROJECT_INCOMPLETE: track',
  'a missing track is refused and named');
select is(pg_temp.missing('academic_year', null), 'ABR_PROJECT_INCOMPLETE: academic_year',
  'a missing academic year is refused and named');
select is(pg_temp.missing('stage', null), 'ABR_PROJECT_INCOMPLETE: stage',
  'a missing stage is refused and named');
select is((select status::text from public.projects where id = (select a from ids)), 'draft',
  'refused submissions leave the draft as it was');

-- Who may submit -------------------------------------------------------------------------------------

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000b');
select throws_ok($$ select public.submit_project((select a from ids)) $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'another student cannot submit my project');
reset role;
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000c');
select throws_ok($$ select public.submit_project((select a from ids)) $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'an organization cannot submit my project');
reset role;
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000d');
select throws_ok($$ select public.submit_project((select a from ids)) $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'an admin cannot submit a student''s project');
reset role;
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select throws_ok($$ select public.submit_project('99999999-0000-4000-8000-000000000000') $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'a missing project gives the same answer');
reset role;

update public.profiles set verification_status = 'suspended'
  where id = 'cdcdcdcd-0000-4000-8000-00000000000a';
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select throws_ok($$ select public.submit_project((select a from ids)) $$,
  '42501', 'ABR_NOT_VERIFIED', 'a suspended owner cannot submit');
reset role;
update public.profiles set verification_status = 'verified'
  where id = 'cdcdcdcd-0000-4000-8000-00000000000a';

-- Submit ---------------------------------------------------------------------------------------------

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select lives_ok($$ select public.submit_project((select a from ids)) $$,
  'the owner submits a complete draft');
reset role;
select results_eq(
  $$ select status::text, submitted_at is not null from public.projects where id = (select a from ids) $$,
  $$ values ('pending_review', true) $$,
  'the project is pending review with a submission time');
select is(
  (select count(*)::int from public.audit_events
   where action = 'project.submitted' and entity_id = (select a from ids)
     and actor_id = 'cdcdcdcd-0000-4000-8000-00000000000a'
     and metadata = '{"from": "draft"}'::jsonb),
  1, 'project.submitted is audited with the owner and the previous status');

-- Locked while pending.
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
with changed as (
  update public.projects set title = 'Edited in review' where id = (select a from ids) returning 1
)
select is(count(*)::int, 0, 'the owner cannot edit while pending review (0 rows)') from changed;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('project-images',
       (select a from ids)::text || '/image-0f0f0f0f-1111-4111-8111-111111111111.png') $$,
  '42501', null, 'the owner cannot upload while pending review');
select throws_ok(
  $$ update public.projects set status = 'draft' where id = (select a from ids) $$,
  '42501', null, 'the owner cannot write status directly');
select throws_ok($$ select public.submit_project((select a from ids)) $$,
  '55000', 'ABR_NOT_SUBMITTABLE', 'a pending project cannot be submitted again');
reset role;

-- Withdraw ---------------------------------------------------------------------------------------

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000b');
select throws_ok($$ select public.withdraw_submission((select a from ids)) $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'another student cannot withdraw my submission');
reset role;
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000c');
select throws_ok($$ select public.withdraw_submission((select a from ids)) $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'an organization cannot withdraw my submission');
reset role;
set local role anon;
select throws_ok($$ select public.withdraw_submission((select a from ids)) $$, '42501', null,
  'anon calling withdraw_submission is refused');
reset role;

update public.profiles set verification_status = 'suspended'
  where id = 'cdcdcdcd-0000-4000-8000-00000000000a';
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select throws_ok($$ select public.withdraw_submission((select a from ids)) $$,
  '42501', 'ABR_NOT_VERIFIED', 'a suspended owner cannot withdraw');
reset role;
update public.profiles set verification_status = 'verified'
  where id = 'cdcdcdcd-0000-4000-8000-00000000000a';

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select lives_ok($$ select public.withdraw_submission((select a from ids)) $$,
  'the owner withdraws a pending submission');
reset role;
select results_eq(
  $$ select status::text, submitted_at is null from public.projects where id = (select a from ids) $$,
  $$ values ('draft', true) $$,
  'withdrawing returns the project to a draft and clears the submission time');
select is(
  (select count(*)::int from public.audit_events
   where action = 'project.withdrawn' and entity_id = (select a from ids)
     and actor_id = 'cdcdcdcd-0000-4000-8000-00000000000a'),
  1, 'project.withdrawn is audited with the owner');

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
with changed as (
  update public.projects set title = 'Campus Navigator 2' where id = (select a from ids) returning 1
)
select is(count(*)::int, 1, 'after withdrawing, the owner can edit again') from changed;
select throws_ok($$ select public.withdraw_submission((select a from ids)) $$,
  '55000', 'ABR_NOT_PENDING', 'a draft cannot be withdrawn');
reset role;

-- Submit only from draft and changes_requested; withdraw only from pending_review ------------------

create function pg_temp.try(p_rpc text, p_status public.project_status)
returns text
language plpgsql
as $$
declare
  v_message text;
begin
  update public.projects set status = p_status where id = (select a from ids);
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'cdcdcdcd-0000-4000-8000-00000000000a', 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    execute format('select public.%I(%L)', p_rpc, (select a from ids));
    v_message := 'ok';
  exception when others then
    v_message := sqlerrm;
  end;
  reset role;
  return v_message;
end;
$$;

select is(pg_temp.try('submit_project', 'changes_requested'), 'ok',
  'a project with changes requested can be resubmitted');
select is(pg_temp.try('submit_project', 'published'), 'ABR_NOT_SUBMITTABLE',
  'a published project cannot be submitted');
select is(pg_temp.try('submit_project', 'rejected'), 'ABR_NOT_SUBMITTABLE',
  'a rejected project cannot be submitted');
select is(pg_temp.try('submit_project', 'unpublished'), 'ABR_NOT_SUBMITTABLE',
  'an unpublished project cannot be submitted');
select is(pg_temp.try('withdraw_submission', 'changes_requested'), 'ABR_NOT_PENDING',
  'changes requested cannot be withdrawn');
select is(pg_temp.try('withdraw_submission', 'published'), 'ABR_NOT_PENDING',
  'a published project cannot be withdrawn');
select is(pg_temp.try('withdraw_submission', 'rejected'), 'ABR_NOT_PENDING',
  'a rejected project cannot be withdrawn');

-- project_reviews --------------------------------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'public.project_reviews', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.project_reviews', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.project_reviews', 'DELETE')
  and not has_column_privilege('authenticated', 'public.project_reviews', 'reviewer_id', 'SELECT')
  and not has_table_privilege('anon', 'public.project_reviews', 'SELECT'),
  'clients cannot write project_reviews, and never read reviewer_id');

insert into public.project_reviews (project_id, reviewer_id, decision, notes) values
  ((select a from ids), 'cdcdcdcd-0000-4000-8000-00000000000d', 'changes_requested', 'Add a demo video.');

select throws_ok(
  $$ insert into public.project_reviews (project_id, reviewer_id, decision)
     values ((select a from ids), 'cdcdcdcd-0000-4000-8000-00000000000d', 'rejected') $$,
  '23514', null, 'a rejection needs notes');
select throws_ok(
  $$ insert into public.project_reviews (project_id, reviewer_id, decision)
     values ((select a from ids), 'cdcdcdcd-0000-4000-8000-00000000000d', 'changes_requested') $$,
  '23514', null, 'a request for changes needs notes');
select lives_ok(
  $$ insert into public.project_reviews (project_id, reviewer_id, decision)
     values ((select a from ids), 'cdcdcdcd-0000-4000-8000-00000000000d', 'approved') $$,
  'an approval may have no notes');
select throws_ok(
  $$ update public.project_reviews set notes = 'Rewritten' where project_id = (select a from ids) $$,
  '42501', 'ABR_APPEND_ONLY', 'reviews are append-only, even for the table owner');

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000a');
select results_eq(
  $$ select decision::text, notes from public.project_reviews
     where project_id = (select a from ids) order by created_at, decision $$,
  $$ values ('approved', null::text), ('changes_requested', 'Add a demo video.') $$,
  'the owner reads the reviews of their project');
select throws_ok(
  $$ select reviewer_id from public.project_reviews $$,
  '42501', null, 'the owner cannot read reviewer_id');
select throws_ok(
  $$ insert into public.project_reviews (project_id, reviewer_id, decision)
     values ((select a from ids), 'cdcdcdcd-0000-4000-8000-00000000000a', 'approved') $$,
  '42501', null, 'the owner cannot write a review');
reset role;

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.project_reviews), 0,
  'another student reads no reviews');
reset role;
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000c');
select is((select count(*)::int from public.project_reviews), 0,
  'an organization reads no reviews');
reset role;
-- Published does not make reviews public.
update public.projects set status = 'published', published_at = now() where id = (select a from ids);
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.project_reviews), 0,
  'a published project''s reviews stay private');
reset role;
select pg_temp.act_as('cdcdcdcd-0000-4000-8000-00000000000d');
select is((select count(*)::int from public.project_reviews), 2, 'an admin reads every review');
reset role;

select * from finish();
rollback;
