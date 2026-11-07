-- SCRUM-19: review_project, admin_project_reviews, admin_project_counts, and what admins (and
-- nobody else) can read. Acting as real users through request.jwt.claims, the way PostgREST does.

begin;

select plan(52);

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
    case when p_confirmed then now() end, p_app_meta,
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

-- Creates, completes and submits a project for a student, all as that student. Returns its id.
create function pg_temp.submitted(p_user uuid, p_title text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  perform pg_temp.act_as(p_user);
  v_id := public.create_project(p_title);
  update public.projects
  set summary = 'Indoor maps for campus.',
      description = repeat('A clear description of the project. ', 4),
      track = 'mobile', academic_year = '2026', stage = 'prototype'
  where id = v_id;
  perform public.submit_project(v_id);
  reset role;
  return v_id;
end;
$$;

-- review_project as a user: 'ok', or the error message.
create function pg_temp.review(p_user uuid, p_project uuid, p_decision text, p_notes text)
returns text
language plpgsql
as $$
declare
  v_message text;
begin
  perform pg_temp.act_as(p_user);
  begin
    perform public.review_project(p_project, p_decision::public.review_decision, p_notes);
    v_message := 'ok';
  exception when others then
    v_message := sqlerrm;
  end;
  reset role;
  return v_message;
end;
$$;

-- A, B, C: verified students. U: unconfirmed student. O: verified organization. P: pending
-- organization. M: verified mentor. X: admin. S: suspended admin.
select pg_temp.new_user('efefefef-0000-4000-8000-00000000000a', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student A"}');
select pg_temp.new_user('efefefef-0000-4000-8000-00000000000b', 'b@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student B"}');
select pg_temp.new_user('efefefef-0000-4000-8000-00000000000c', 'c@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student C"}');
select pg_temp.new_user('efefefef-0000-4000-8000-00000000000d', 'u@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student U"}',
  '{}', false);
select pg_temp.new_user('efefefef-0000-4000-8000-00000000000e', 'o@org.test',
  '{"role": "organization", "full_name": "Org O", "organization_name": "Verified Org"}');
select pg_temp.new_user('efefefef-0000-4000-8000-00000000000f', 'p@org.test',
  '{"role": "organization", "full_name": "Org P", "organization_name": "Pending Org"}');
select pg_temp.new_user('efefefef-0000-4000-8000-000000000010', 'm@mentor.test',
  '{"role": "mentor", "full_name": "Mentor M"}');
select pg_temp.new_user('efefefef-0000-4000-8000-000000000011', 'x@abr.test',
  '{"full_name": "Admin X"}', '{"abr_role": "admin"}');
select pg_temp.new_user('efefefef-0000-4000-8000-000000000012', 's@abr.test',
  '{"full_name": "Admin S"}', '{"abr_role": "admin"}');
select pg_temp.onboard('efefefef-0000-4000-8000-00000000000a');
select pg_temp.onboard('efefefef-0000-4000-8000-00000000000b');
select pg_temp.onboard('efefefef-0000-4000-8000-00000000000c');
update public.profiles set verification_status = 'verified', onboarding_completed = true
  where id in ('efefefef-0000-4000-8000-00000000000e', 'efefefef-0000-4000-8000-000000000010');
update public.profiles set verification_status = 'suspended'
  where id = 'efefefef-0000-4000-8000-000000000012';

create temporary table ids on commit drop as
  select pg_temp.submitted('efefefef-0000-4000-8000-00000000000a', 'Project A') as a,
         pg_temp.submitted('efefefef-0000-4000-8000-00000000000b', 'Project B') as b,
         pg_temp.submitted('efefefef-0000-4000-8000-00000000000c', 'Project C') as c;
grant select on ids to authenticated;

-- An image in A's folder (as the table owner), to check who can read it after the decision.
insert into storage.objects (bucket_id, name)
  values ('project-images', (select a from ids)::text || '/image-0f0f0f0f-1111-4111-8111-111111111111.png');

select results_eq(
  $$ select status::text from public.projects where id in (select a from ids union select b from ids
     union select c from ids) order by 1 $$,
  $$ values ('pending_review'), ('pending_review'), ('pending_review') $$,
  'fixtures: three projects are pending review');

-- Who may review --------------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.review_project(uuid, public.review_decision, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_project_reviews(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_project_counts()', 'EXECUTE'),
  'anon cannot execute the three review functions');
set local role anon;
select throws_ok($$ select public.review_project((select a from ids), 'approved', null) $$,
  '42501', null, 'anon calling review_project is refused');
reset role;

select is(pg_temp.review('efefefef-0000-4000-8000-00000000000a', (select a from ids), 'approved', null),
  'ABR_NOT_ADMIN', 'the owner cannot review their own project');
select is(pg_temp.review('efefefef-0000-4000-8000-00000000000b', (select a from ids), 'approved', null),
  'ABR_NOT_ADMIN', 'another student cannot review');
select is(pg_temp.review('efefefef-0000-4000-8000-00000000000e', (select a from ids), 'approved', null),
  'ABR_NOT_ADMIN', 'a verified organization cannot review');
select is(pg_temp.review('efefefef-0000-4000-8000-000000000010', (select a from ids), 'approved', null),
  'ABR_NOT_ADMIN', 'a verified mentor cannot review');
select is(pg_temp.review('efefefef-0000-4000-8000-000000000012', (select a from ids), 'approved', null),
  'ABR_NOT_ADMIN', 'a suspended admin cannot review');

select pg_temp.act_as('efefefef-0000-4000-8000-00000000000b');
select throws_ok($$ select * from public.admin_project_reviews((select a from ids)) $$,
  '42501', 'ABR_NOT_ADMIN', 'a student cannot read the review history with reviewer names');
select throws_ok($$ select * from public.admin_project_counts() $$,
  '42501', 'ABR_NOT_ADMIN', 'a student cannot read the admin counts');
reset role;
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000e');
select throws_ok($$ select * from public.admin_project_counts() $$,
  '42501', 'ABR_NOT_ADMIN', 'an organization cannot read the admin counts');
reset role;

-- Input checks ---------------------------------------------------------------------------------------

select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select a from ids), 'changes_requested', null),
  'ABR_NOTES_REQUIRED', 'requesting changes needs notes');
select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select a from ids), 'rejected', '   '),
  'ABR_NOTES_REQUIRED', 'rejecting needs notes (blank counts as none)');
select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select a from ids), 'rejected', repeat('x', 2001)),
  'ABR_NOTES_TOO_LONG', 'notes over 2000 characters are refused');
select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select a from ids), null, null),
  'ABR_INVALID_DECISION', 'a decision is required');
select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', '99999999-0000-4000-8000-000000000000', 'approved', null),
  'ABR_PROJECT_NOT_FOUND', 'a missing project is not found');
select is((select count(*)::int from public.project_reviews), 0,
  'no refused review left a row');
select is((select status::text from public.projects where id = (select a from ids)), 'pending_review',
  'refused reviews leave the project pending');

-- Not pending: the withdraw race --------------------------------------------------------------------

select pg_temp.act_as('efefefef-0000-4000-8000-00000000000a');
select public.withdraw_submission((select a from ids));
reset role;
select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select a from ids), 'approved', null),
  'ABR_NOT_PENDING', 'a withdrawn project (now a draft) cannot be approved');
select results_eq(
  $$ select status::text, published_at is null from public.projects where id = (select a from ids) $$,
  $$ values ('draft', true) $$,
  'the withdrawn draft was not published');
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000a');
select public.submit_project((select a from ids));
reset role;

-- approved ---------------------------------------------------------------------------------------

select pg_temp.act_as('efefefef-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.projects where id = (select a from ids)), 0,
  'before approval, another student cannot see the project');
reset role;

select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select a from ids), 'approved', '  Great work.  '),
  'ok', 'an admin approves and publishes');
select results_eq(
  $$ select status::text, published_at is not null from public.projects where id = (select a from ids) $$,
  $$ values ('published', true) $$,
  'approved: the project is published with a publication time');
select results_eq(
  $$ select reviewer_id::text, decision::text, notes from public.project_reviews
     where project_id = (select a from ids) $$,
  $$ values ('efefefef-0000-4000-8000-000000000011', 'approved', 'Great work.') $$,
  'the review row names the admin and stores the trimmed notes');
select results_eq(
  $$ select actor_id::text, metadata - 'review_id' from public.audit_events
     where action = 'project.reviewed' and entity_id = (select a from ids) $$,
  $$ values ('efefefef-0000-4000-8000-000000000011',
             '{"decision": "approved", "from": "pending_review", "to": "published"}'::jsonb) $$,
  'project.reviewed is audited with the admin, the decision and the change');
select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select a from ids), 'approved', null),
  'ABR_NOT_PENDING', 'a published project cannot be reviewed again');

-- Published: visible to verified users, files readable (D-15).
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.projects where id = (select a from ids)), 1,
  'a verified student reads the published project');
select is((select count(*)::int from public.project_members where project_id = (select a from ids)), 1,
  'a verified student reads its members');
select is((select count(*)::int from storage.objects where name like (select a from ids)::text || '/%'), 1,
  'a verified student can read its image (and so get a signed URL)');
select is((select count(*)::int from public.project_reviews where project_id = (select a from ids)), 0,
  'reviews stay private to the owner and admins');
reset role;
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000e');
select is((select count(*)::int from public.projects where id = (select a from ids)), 1,
  'a verified organization reads the published project');
reset role;
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000d');
select is((select count(*)::int from public.projects where id = (select a from ids)), 0,
  'an unverified student cannot read it');
reset role;
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000f');
select is((select count(*)::int from storage.objects where name like (select a from ids)::text || '/%'), 0,
  'a pending organization cannot read its files');
reset role;
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000a');
select results_eq(
  $$ select decision::text, notes from public.project_reviews where project_id = (select a from ids) $$,
  $$ values ('approved', 'Great work.') $$,
  'the owner reads the review');
reset role;

-- changes_requested → edit → resubmit → approved -------------------------------------------------------

select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select b from ids), 'changes_requested', 'Add a demo video.'),
  'ok', 'an admin requests changes');
select is((select status::text from public.projects where id = (select b from ids)), 'changes_requested',
  'changes requested: the status follows');
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000b');
with changed as (
  update public.projects set video_url = 'https://youtu.be/demo' where id = (select b from ids) returning 1
)
select is(count(*)::int, 1, 'the owner can edit again') from changed;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('project-images',
       (select b from ids)::text || '/image-0f0f0f0f-1111-4111-8111-222222222222.png') $$,
  'the owner can upload again');
select lives_ok($$ select public.submit_project((select b from ids)) $$, 'the owner resubmits');
reset role;
select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select b from ids), 'approved', null),
  'ok', 'the admin approves the resubmission (notes optional)');

select pg_temp.act_as('efefefef-0000-4000-8000-000000000011');
select results_eq(
  $$ select decision::text, notes, reviewer_name from public.admin_project_reviews((select b from ids)) $$,
  $$ values ('approved', null::text, 'Admin X'), ('changes_requested', 'Add a demo video.', 'Admin X') $$,
  'the admin history is newest first, with reviewer names');
reset role;

-- rejected -------------------------------------------------------------------------------------------

select is(pg_temp.review('efefefef-0000-4000-8000-000000000011', (select c from ids), 'rejected', 'Not a graduation project.'),
  'ok', 'an admin rejects');
select is((select status::text from public.projects where id = (select c from ids)), 'rejected',
  'rejected: the status follows');
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000c');
with changed as (
  update public.projects set title = 'Edited' where id = (select c from ids) returning 1
)
select is(count(*)::int, 0, 'the owner cannot edit a rejected project') from changed;
reset role;
select pg_temp.act_as('efefefef-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.projects where id = (select c from ids)), 0,
  'another student cannot read a rejected project');
reset role;

-- Admin read access ------------------------------------------------------------------------------

select pg_temp.act_as('efefefef-0000-4000-8000-000000000011');
select is((select count(*)::int from public.projects where id in (select a from ids union select b from ids
  union select c from ids)), 3, 'the admin reads every project, whatever its status');
select is((select count(*)::int from public.project_members), 3, 'the admin reads every membership');
select is((select count(*)::int from public.project_reviews), 4, 'the admin reads every review row');
select throws_ok($$ select reviewer_id from public.project_reviews $$, '42501', null,
  'reviewer_id stays ungranted on the table, even for admins (the RPC gives names)');
select is((select count(*)::int from storage.objects where bucket_id = 'project-images'), 2,
  'the admin reads files in every project folder');
select results_eq(
  $$ select c.status::text, c.count::int from public.admin_project_counts() c order by c.status $$,
  $$ values ('draft', 0), ('pending_review', 0), ('changes_requested', 0), ('published', 2),
            ('rejected', 1), ('unpublished', 0) $$,
  'admin_project_counts lists every status with its count, zeros included');
reset role;

select pg_temp.act_as('efefefef-0000-4000-8000-000000000012');
select is((select count(*)::int from public.projects where id = (select c from ids)), 0,
  'a suspended admin reads nothing extra');
reset role;

select * from finish();
rollback;
