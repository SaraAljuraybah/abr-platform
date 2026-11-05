-- SCRUM-18: projects and project members. Who can create, read, edit and delete a draft, and which
-- columns stay out of reach. Acting as real users through request.jwt.claims, the way PostgREST does.

begin;

select plan(82);

-- The sign-up trigger and projects_owner_required are deferred; run them at each statement's end.
-- create_project() writes a project and its owner row in one statement, so it still passes.
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

-- Completes a student's onboarding as the table owner.
create function pg_temp.onboard(p_user uuid)
returns void
language plpgsql
as $$
begin
  update public.student_profiles
    set major = 'cs', academic_level = 'undergraduate', graduation_year = '2026'
    where user_id = p_user;
  update public.profiles set onboarding_completed = true where id = p_user;
end;
$$;

-- How many rows an UPDATE of the title changed for the current user (RLS hides the others).
create function pg_temp.rename(p_project uuid, p_title text)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  update public.projects set title = p_title where id = p_project;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function pg_temp.rename(uuid, text) to authenticated;

-- A, B: verified, onboarded students. N: verified, not onboarded. U: unconfirmed (unverified) but
-- onboarded. O: verified organization. P: pending organization. X: admin.
select pg_temp.new_user('ffffffff-0000-4000-8000-00000000000a', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student A"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-00000000000b', 'b@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student B"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-00000000000c', 'n@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student N"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-00000000000d', 'u@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student U"}',
  '{}', false);
select pg_temp.new_user('ffffffff-0000-4000-8000-00000000000e', 'o@org.test',
  '{"role": "organization", "full_name": "Org O", "organization_name": "Verified Org"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-00000000000f', 'p@org.test',
  '{"role": "organization", "full_name": "Org P", "organization_name": "Pending Org"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-000000000010', 'x@abr.test',
  '{"full_name": "Admin X"}', '{"abr_role": "admin"}');

select pg_temp.onboard('ffffffff-0000-4000-8000-00000000000a');
select pg_temp.onboard('ffffffff-0000-4000-8000-00000000000b');
select pg_temp.onboard('ffffffff-0000-4000-8000-00000000000d');
update public.profiles set verification_status = 'verified', onboarding_completed = true
  where id = 'ffffffff-0000-4000-8000-00000000000e';

select results_eq(
  $$ select id::text || ':' || role::text || ':' || verification_status::text || ':'
            || onboarding_completed::text
     from public.profiles where id::text like 'ffffffff-%' order by id $$,
  array[
    'ffffffff-0000-4000-8000-00000000000a:student:verified:true',
    'ffffffff-0000-4000-8000-00000000000b:student:verified:true',
    'ffffffff-0000-4000-8000-00000000000c:student:verified:false',
    'ffffffff-0000-4000-8000-00000000000d:student:unverified:true',
    'ffffffff-0000-4000-8000-00000000000e:organization:verified:true',
    'ffffffff-0000-4000-8000-00000000000f:organization:pending:false',
    'ffffffff-0000-4000-8000-000000000010:admin:verified:true'
  ],
  'fixtures: roles, statuses and onboarding as intended'
);

-- Privileges --------------------------------------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'public.projects', 'INSERT')
  and not has_table_privilege('authenticated', 'public.projects', 'DELETE')
  and not has_table_privilege('authenticated', 'public.projects', 'TRUNCATE'),
  'authenticated cannot INSERT, DELETE or TRUNCATE projects'
);
select ok(
  not has_table_privilege('authenticated', 'public.project_members', 'INSERT')
  and not has_table_privilege('authenticated', 'public.project_members', 'DELETE')
  and not has_any_column_privilege('authenticated', 'public.project_members', 'UPDATE'),
  'authenticated cannot write project_members at all'
);
select is_empty(
  $$ select c from unnest(array['id', 'owner_id', 'status', 'university_id', 'submitted_at',
       'published_at', 'created_at', 'updated_at']) c
     where has_column_privilege('authenticated', 'public.projects', c, 'UPDATE') $$,
  'status, owner_id, university_id, submitted_at, published_at and timestamps have no UPDATE grant'
);
select ok(
  has_column_privilege('authenticated', 'public.projects', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'summary', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'description', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'track', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'sectors', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'academic_year', 'UPDATE'),
  'the six editable columns have UPDATE grants'
);
select ok(
  not has_table_privilege('anon', 'public.projects', 'SELECT')
  and not has_table_privilege('anon', 'public.project_members', 'SELECT'),
  'anon cannot read projects or members'
);
select ok(
  not has_function_privilege('anon', 'public.create_project(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.delete_project(uuid)', 'EXECUTE'),
  'anon cannot execute create_project or delete_project'
);

set local role anon;
select throws_ok(
  $$ select public.create_project('Anonymous project') $$,
  '42501', null,
  'anon calling create_project is refused'
);
reset role;

-- create_project: who may create ------------------------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000d');
select throws_ok($$ select public.create_project('Unverified project') $$,
  '42501', 'ABR_NOT_VERIFIED', 'an unverified student cannot create a project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000c');
select throws_ok($$ select public.create_project('Not onboarded project') $$,
  '55000', 'ABR_ONBOARDING_INCOMPLETE', 'a student who has not finished onboarding cannot create');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000e');
select throws_ok($$ select public.create_project('Organization project') $$,
  '42501', 'ABR_NOT_STUDENT', 'an organization cannot create a student project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000010');
select throws_ok($$ select public.create_project('Admin project') $$,
  '42501', 'ABR_NOT_STUDENT', 'an admin cannot create a student project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select throws_ok($$ select public.create_project('ab') $$,
  '22023', 'ABR_INVALID_TITLE', 'a title shorter than 3 characters is refused');
select throws_ok($$ select public.create_project('   ab   ') $$,
  '22023', 'ABR_INVALID_TITLE', 'the title length is counted after trimming');
select throws_ok($$ select public.create_project(repeat('x', 141)) $$,
  '22023', 'ABR_INVALID_TITLE', 'a title longer than 140 characters is refused');
select throws_ok($$ select public.create_project(null) $$,
  '22023', 'ABR_INVALID_TITLE', 'a missing title is refused');
select lives_ok($$ select public.create_project('  Campus Navigator  ') $$,
  'a verified, onboarded student creates a draft');
select throws_ok($$ select public.create_project('A second project') $$,
  '55000', 'ABR_PROJECT_LIMIT', 'a second project is refused (one project per student in V1)');
reset role;

-- What create_project wrote (read as the table owner).
create temporary table a_project on commit drop as
  select id from public.projects where owner_id = 'ffffffff-0000-4000-8000-00000000000a';
grant select on a_project to authenticated;

select is((select count(*)::int from public.projects
           where owner_id = 'ffffffff-0000-4000-8000-00000000000a'), 1,
  'exactly one project exists for A');
select results_eq(
  $$ select status::text, title, university_id::text, submitted_at is null and published_at is null
     from public.projects where id = (select id from a_project) $$,
  $$ values ('draft', 'Campus Navigator', 'aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  'the draft has a trimmed title, A''s university set server-side, and no submission dates'
);
select results_eq(
  $$ select user_id::text, member_role from public.project_members
     where project_id = (select id from a_project) $$,
  $$ values ('ffffffff-0000-4000-8000-00000000000a', 'owner') $$,
  'A is the project''s only member, as owner'
);
select is(
  (select count(*)::int from public.audit_events
   where action = 'project.created' and entity_type = 'project'
     and entity_id = (select id from a_project)
     and actor_id = 'ffffffff-0000-4000-8000-00000000000a'),
  1,
  'project.created is audited with A as actor'
);

-- The owner edits their draft ---------------------------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 1,
  'A reads their own project');
select is((select count(*)::int from public.project_members
           where project_id = (select id from a_project)), 1,
  'A reads their own membership');
select lives_ok(
  $$ update public.projects
     set title = 'Campus Navigator 2', summary = 'Indoor maps for campus.',
         description = 'A longer description.', track = 'mobile',
         sectors = array['education', 'smart_cities'], academic_year = '2026'
     where id = (select id from a_project) $$,
  'A updates the six editable columns'
);
select is(pg_temp.rename((select id from a_project), 'Campus Navigator'), 1,
  'the owner''s title update changes one row');
select throws_ok(
  $$ update public.projects set track = 'blockchain' where id = (select id from a_project) $$,
  '23514', null, 'track must be a track code');
select throws_ok(
  $$ update public.projects
     set sectors = array['fintech', 'health_tech', 'education', 'smart_cities', 'ecommerce', 'gaming']
     where id = (select id from a_project) $$,
  '23514', null, 'more than 5 sectors are refused');
select throws_ok(
  $$ update public.projects set sectors = array['space'] where id = (select id from a_project) $$,
  '23514', null, 'sectors must be interest codes');
select throws_ok(
  $$ update public.projects set academic_year = '1999' where id = (select id from a_project) $$,
  '23514', null, 'academic_year must be a graduation-year code');
select throws_ok(
  $$ update public.projects set summary = repeat('x', 301) where id = (select id from a_project) $$,
  '23514', null, 'a summary longer than 300 characters is refused');
select throws_ok(
  $$ update public.projects set description = repeat('x', 5001)
     where id = (select id from a_project) $$,
  '23514', null, 'a description longer than 5000 characters is refused');
select throws_ok(
  $$ update public.projects set title = ' padded ' where id = (select id from a_project) $$,
  '23514', null, 'a title with surrounding spaces is refused');

-- The owner cannot write protected columns.
select throws_ok(
  $$ update public.projects set status = 'published' where id = (select id from a_project) $$,
  '42501', null, 'A cannot write status');
select throws_ok(
  $$ update public.projects set owner_id = 'ffffffff-0000-4000-8000-00000000000b'
     where id = (select id from a_project) $$,
  '42501', null, 'A cannot write owner_id');
select throws_ok(
  $$ update public.projects set university_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     where id = (select id from a_project) $$,
  '42501', null, 'A cannot write university_id');
select throws_ok(
  $$ update public.projects set published_at = now() where id = (select id from a_project) $$,
  '42501', null, 'A cannot write published_at');
select throws_ok(
  $$ update public.projects set submitted_at = now() where id = (select id from a_project) $$,
  '42501', null, 'A cannot write submitted_at');
select throws_ok(
  $$ insert into public.projects (owner_id, title, university_id)
     values ('ffffffff-0000-4000-8000-00000000000a', 'Direct insert',
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null, 'A cannot insert a project directly');
select throws_ok(
  $$ delete from public.projects where id = (select id from a_project) $$,
  '42501', null, 'A cannot delete a project directly');
reset role;

-- Other users ----------------------------------------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 0,
  'another student cannot read A''s draft');
select is((select count(*)::int from public.project_members
           where project_id = (select id from a_project)), 0,
  'another student cannot read A''s membership');
select is(pg_temp.rename((select id from a_project), 'Hijacked'), 0,
  'another student''s update of A''s draft changes 0 rows');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000e');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 0,
  'a verified organization cannot read A''s draft');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000010');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 1,
  'an admin reads A''s draft');
select is((select count(*)::int from public.project_members
           where project_id = (select id from a_project)), 1,
  'an admin reads A''s membership');
reset role;

select is((select title from public.projects where id = (select id from a_project)),
  'Campus Navigator', 'the title is unchanged by the refused updates');

-- Editing is allowed only in draft and changes_requested ----------------------------------------

update public.projects set status = 'pending_review' where id = (select id from a_project);
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is(pg_temp.rename((select id from a_project), 'Edited in review'), 0,
  'the owner cannot edit while pending_review (0 rows)');
reset role;

update public.projects set status = 'rejected' where id = (select id from a_project);
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is(pg_temp.rename((select id from a_project), 'Edited when rejected'), 0,
  'the owner cannot edit a rejected project (0 rows)');
reset role;

update public.projects set status = 'unpublished' where id = (select id from a_project);
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is(pg_temp.rename((select id from a_project), 'Edited when unpublished'), 0,
  'the owner cannot edit an unpublished project (0 rows)');
reset role;

update public.projects set status = 'changes_requested' where id = (select id from a_project);
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is(pg_temp.rename((select id from a_project), 'Campus Navigator'), 1,
  'the owner can edit when changes are requested');
reset role;

-- Published projects: visible to verified viewers while the owner is verified ---------------------

update public.projects set status = 'published', published_at = now()
  where id = (select id from a_project);

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is(pg_temp.rename((select id from a_project), 'Edited when published'), 0,
  'the owner cannot edit a published project (0 rows)');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 1,
  'a verified student reads a published project');
select is((select count(*)::int from public.project_members
           where project_id = (select id from a_project)), 1,
  'a verified student reads a published project''s members');
select is(pg_temp.rename((select id from a_project), 'Hijacked'), 0,
  'a verified student cannot edit a published project they can read');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000e');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 1,
  'a verified organization reads a published project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000d');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 0,
  'an unverified student cannot read a published project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000f');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 0,
  'a pending organization cannot read a published project');
reset role;

update public.profiles set verification_status = 'suspended'
  where id = 'ffffffff-0000-4000-8000-00000000000a';
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 0,
  'a suspended owner''s published project is hidden from verified users');
reset role;
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 1,
  'a suspended owner still reads their own project');
reset role;

-- A suspended owner cannot edit their draft --------------------------------------------------------

update public.projects set status = 'draft', published_at = null
  where id = (select id from a_project);
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is(pg_temp.rename((select id from a_project), 'Edited while suspended'), 0,
  'a suspended owner''s title update changes 0 rows');
reset role;
update public.profiles set verification_status = 'verified'
  where id = 'ffffffff-0000-4000-8000-00000000000a';
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select is(pg_temp.rename((select id from a_project), 'Campus Navigator'), 1,
  'the same update works once the owner is verified again');
reset role;

-- delete_project ---------------------------------------------------------------------------------

set local role anon;
select throws_ok($$ select public.delete_project((select id from a_project)) $$,
  '42501', null, 'anon calling delete_project is refused');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000b');
select throws_ok($$ select public.delete_project((select id from a_project)) $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'another student cannot delete A''s draft');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000010');
select throws_ok($$ select public.delete_project((select id from a_project)) $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'an admin cannot delete A''s draft through this RPC');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select throws_ok($$ select public.delete_project('99999999-0000-4000-8000-000000000000') $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'a missing project gives the same answer');
reset role;

update public.projects set status = 'changes_requested' where id = (select id from a_project);
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select throws_ok($$ select public.delete_project((select id from a_project)) $$,
  '55000', 'ABR_NOT_DRAFT', 'the owner cannot delete a project that is no longer a draft');
reset role;
update public.projects set status = 'draft' where id = (select id from a_project);

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select lives_ok($$ select public.delete_project((select id from a_project)) $$,
  'the owner deletes their own draft');
reset role;

select is((select count(*)::int from public.projects where id = (select id from a_project)), 0,
  'the draft is gone');
select is((select count(*)::int from public.project_members
           where project_id = (select id from a_project)), 0,
  'its member rows are gone');
select is(
  (select count(*)::int from public.audit_events
   where action = 'project.deleted' and entity_id = (select id from a_project)
     and actor_id = 'ffffffff-0000-4000-8000-00000000000a'),
  1,
  'project.deleted is audited with A as actor'
);

select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select lives_ok($$ select public.create_project('Campus Navigator again') $$,
  'after deleting the draft, A can create a project again');
reset role;

truncate a_project;
insert into a_project
  select id from public.projects where owner_id = 'ffffffff-0000-4000-8000-00000000000a';

-- Guard trigger: holds even if a table-level grant appears (the hosted worst case, ADR 0011) -----

grant update on public.projects to authenticated;
select pg_temp.act_as('ffffffff-0000-4000-8000-00000000000a');
select throws_ok(
  $$ update public.projects set status = 'published' where id = (select id from a_project) $$,
  '42501', 'ABR_PROTECTED_COLUMN', 'guard: status cannot change from a client role');
select throws_ok(
  $$ update public.projects set published_at = now() where id = (select id from a_project) $$,
  '42501', 'ABR_PROTECTED_COLUMN', 'guard: published_at cannot change from a client role');
select throws_ok(
  $$ update public.projects set owner_id = 'ffffffff-0000-4000-8000-00000000000b'
     where id = (select id from a_project) $$,
  '42501', 'ABR_PROTECTED_COLUMN', 'guard: owner_id cannot change');
reset role;
revoke update on public.projects from authenticated;
grant update (title, summary, description, track, sectors, academic_year)
  on public.projects to authenticated;

select throws_ok(
  $$ update public.projects set university_id = gen_random_uuid()
     where id = (select id from a_project) $$,
  '42501', 'ABR_PROTECTED_COLUMN', 'guard: university_id cannot change, even for the table owner');

-- Exactly one owner ------------------------------------------------------------------------------

select throws_ok(
  $$ delete from public.project_members where project_id = (select id from a_project) $$,
  '42501', 'ABR_OWNER_REQUIRED', 'the owner member row cannot be removed while the project exists');
select throws_ok(
  $$ update public.project_members set user_id = 'ffffffff-0000-4000-8000-00000000000b'
     where project_id = (select id from a_project) $$,
  '42501', 'ABR_OWNER_REQUIRED', 'the owner member row cannot be handed to someone else');
select throws_ok(
  $$ do $do$
     begin
       insert into public.projects (owner_id, title, university_id)
       values ('ffffffff-0000-4000-8000-00000000000b', 'Ownerless',
               'aaaaaaaa-0000-4000-8000-000000000001');
       set constraints projects_owner_required immediate;
     end
     $do$ $$,
  '23514', 'ABR_OWNER_REQUIRED', 'a project without its owner member row is refused');
select throws_ok(
  $$ with p as (
       insert into public.projects (owner_id, title, university_id)
       values ('ffffffff-0000-4000-8000-00000000000b', 'Wrong owner',
               'aaaaaaaa-0000-4000-8000-000000000001')
       returning id
     )
     insert into public.project_members (project_id, user_id, member_role)
     select p.id, 'ffffffff-0000-4000-8000-00000000000a', 'owner' from p $$,
  '23514', 'ABR_OWNER_MISMATCH', 'the owner member row must be the project''s owner');

-- Account deletion still cascades through the owner row.
select lives_ok(
  $$ delete from auth.users where id = 'ffffffff-0000-4000-8000-00000000000a' $$,
  'deleting the owner''s account removes their project and membership');
select is((select count(*)::int from public.projects where id = (select id from a_project)), 0,
  'the deleted account''s project is gone');

select * from finish();
rollback;
