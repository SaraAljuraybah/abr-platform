-- SCRUM-20: the projects directory. RLS stays the only gate (projects_select, profiles_select,
-- project_files_select; D-15): a verified viewer of any role sees published projects of verified
-- owners, with the owner card and the image; anyone else sees nothing. The directory's explicit
-- filters (status = published, owner verified) are checked to be needed for owners and admins.
-- Acting as real users through request.jwt.claims, the way PostgREST does.

begin;

select plan(26);

-- The sign-up trigger is deferred; run it at each statement's end, so profiles exist at once.
set constraints all immediate;

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'جامعة الاختبار الثانية', 'Test University Two', true);
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'uni-two.test');

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
    case when p_confirmed then now() end, p_app_meta, coalesce(p_user_meta, '{}'::jsonb) || (
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

-- A project and its owner row in one statement (as the table owner), with a fixed id.
create function pg_temp.project(
  p_id uuid, p_owner uuid, p_title text, p_status public.project_status,
  p_sectors text[] default '{}', p_university uuid default 'aaaaaaaa-0000-4000-8000-000000000001',
  p_summary text default null
)
returns uuid
language plpgsql
as $$
begin
  with new_project as (
    insert into public.projects (id, owner_id, title, status, sectors, university_id, summary,
                                 published_at)
    values (p_id, p_owner, p_title, p_status, p_sectors, p_university, p_summary,
            case when p_status = 'published' then now() end)
    returning id
  )
  insert into public.project_members (project_id, user_id, member_role)
  select np.id, p_owner, 'owner' from new_project np;
  return p_id;
end;
$$;

-- The directory query, as PostgREST runs it for the page: published, owner row visible (the !inner
-- embed, under profiles_select) and verified, newest first.
create function pg_temp.directory()
returns setof text
language sql
as $$
  select pr.title from public.projects pr
  where pr.status = 'published'
    and pr.id::text like 'cccccccc-%' -- this file's fixtures only (the stack may hold other rows)
    and exists (
      select 1 from public.profiles p
      where p.id = pr.owner_id and p.verification_status = 'verified'
    )
  order by pr.published_at desc, pr.title;
$$;
grant execute on function pg_temp.directory() to authenticated;

-- Owners (students): A, B, S publish; C, D, E, F, G hold the other statuses.
-- Viewers: V verified student, O verified organization, M verified mentor, P pending organization,
-- U unconfirmed (unverified) student, R rejected mentor, X admin.
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a1', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Owner A"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a2', 'b@uni-two.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000002", "full_name": "Owner B"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a3', 's@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Owner S"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a4', 'c@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Owner C"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a5', 'd@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Owner D"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a6', 'e@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Owner E"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a7', 'f@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Owner F"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000a8', 'g@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Owner G"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000b1', 'v@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Viewer V"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000b2', 'o@org.test',
  '{"role": "organization", "full_name": "Org O", "organization_name": "Verified Org"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000b3', 'm@mentor.test',
  '{"role": "mentor", "full_name": "Mentor M"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000b4', 'p@org.test',
  '{"role": "organization", "full_name": "Org P", "organization_name": "Pending Org"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000b5', 'u@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student U"}',
  '{}', false);
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000b6', 'r@mentor.test',
  '{"role": "mentor", "full_name": "Mentor R"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-0000000000b7', 'x@abr.test',
  '{"full_name": "Admin X"}', '{"abr_role": "admin"}');

update public.profiles set verification_status = 'verified'
  where id in ('ffffffff-0000-4000-8000-0000000000b2', 'ffffffff-0000-4000-8000-0000000000b3');
update public.profiles set verification_status = 'rejected'
  where id = 'ffffffff-0000-4000-8000-0000000000b6';
update public.student_profiles set major = 'cs' where user_id = 'ffffffff-0000-4000-8000-0000000000a1';

select pg_temp.project('cccccccc-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-0000000000a1',
  'Campus Navigator', 'published', '{education,fintech}', p_summary => 'Indoor maps, 50% faster');
select pg_temp.project('cccccccc-0000-4000-8000-000000000002', 'ffffffff-0000-4000-8000-0000000000a2',
  'Budget Buddy 500', 'published', '{fintech}', 'aaaaaaaa-0000-4000-8000-000000000002');
select pg_temp.project('cccccccc-0000-4000-8000-000000000003', 'ffffffff-0000-4000-8000-0000000000a3',
  'Suspended Soon', 'published', '{gaming}');
select pg_temp.project('cccccccc-0000-4000-8000-000000000004', 'ffffffff-0000-4000-8000-0000000000a4',
  'A draft', 'draft');
select pg_temp.project('cccccccc-0000-4000-8000-000000000005', 'ffffffff-0000-4000-8000-0000000000a5',
  'Pending review', 'pending_review');
select pg_temp.project('cccccccc-0000-4000-8000-000000000006', 'ffffffff-0000-4000-8000-0000000000a6',
  'Rejected one', 'rejected');
select pg_temp.project('cccccccc-0000-4000-8000-000000000007', 'ffffffff-0000-4000-8000-0000000000a7',
  'Changes requested', 'changes_requested');
select pg_temp.project('cccccccc-0000-4000-8000-000000000008', 'ffffffff-0000-4000-8000-0000000000a8',
  'Unpublished one', 'unpublished');
-- Published dates in a known order: A newest, then B, then S.
update public.projects set published_at = now() - interval '1 day'
  where id = 'cccccccc-0000-4000-8000-000000000002';
update public.projects set published_at = now() - interval '2 days'
  where id = 'cccccccc-0000-4000-8000-000000000003';
-- One image object each for A and S (names inside the project's folder).
insert into storage.objects (bucket_id, name) values
  ('project-images', 'cccccccc-0000-4000-8000-000000000001/image-aaaaaaaa-0000-4000-8000-000000000001.png'),
  ('project-images', 'cccccccc-0000-4000-8000-000000000003/image-aaaaaaaa-0000-4000-8000-000000000003.png'),
  ('project-images', 'cccccccc-0000-4000-8000-000000000004/image-aaaaaaaa-0000-4000-8000-000000000004.png');

select results_eq(
  $$ select role::text || ':' || verification_status::text from public.profiles
     where id in ('ffffffff-0000-4000-8000-0000000000b1', 'ffffffff-0000-4000-8000-0000000000b2',
                  'ffffffff-0000-4000-8000-0000000000b3', 'ffffffff-0000-4000-8000-0000000000b4',
                  'ffffffff-0000-4000-8000-0000000000b5', 'ffffffff-0000-4000-8000-0000000000b6',
                  'ffffffff-0000-4000-8000-0000000000b7')
     order by id $$,
  array['student:verified', 'organization:verified', 'mentor:verified', 'organization:pending',
        'student:unverified', 'mentor:rejected', 'admin:verified'],
  'fixtures: viewers with the intended roles and statuses'
);

-- Verified viewers of every role see the published projects of verified owners -------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b1');
select results_eq($$ select * from pg_temp.directory() $$,
  array['Campus Navigator', 'Budget Buddy 500', 'Suspended Soon'],
  'a verified student sees the three published projects, newest first');
select is((select count(*)::int from public.projects where status <> 'published'), 0,
  'a verified student sees no draft, pending, rejected, changes-requested or unpublished project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b2');
select results_eq($$ select * from pg_temp.directory() $$,
  array['Campus Navigator', 'Budget Buddy 500', 'Suspended Soon'],
  'a verified organization sees the same three');
select is((select count(*)::int from public.projects where status <> 'published'), 0,
  'a verified organization sees no unpublished status either');
-- The owner card: name, university and field of study.
select results_eq(
  $$ select p.full_name, u.name_en, s.major
     from public.projects pr
     join public.profiles p on p.id = pr.owner_id
     join public.universities u on u.id = pr.university_id
     left join public.student_profiles s on s.user_id = pr.owner_id
     where pr.id = 'cccccccc-0000-4000-8000-000000000001' $$,
  $$ values ('Owner A'::text, 'Test University One'::text, 'cs'::text) $$,
  'a verified organization reads the owner card (name, university, field of study)');
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'project-images' and name like 'cccccccc-%'),
  2,
  'a verified organization can read the images of published projects only (not the draft''s)');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b3');
select results_eq($$ select * from pg_temp.directory() $$,
  array['Campus Navigator', 'Budget Buddy 500', 'Suspended Soon'],
  'a verified mentor sees the same three');
reset role;

-- Filters and search run under the same RLS ---------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b2');
select results_eq(
  $$ select title from public.projects where status = 'published' and sectors && '{fintech}'
       and id::text like 'cccccccc-%' order by title $$,
  array['Budget Buddy 500', 'Campus Navigator'],
  'sectors (any of) filters the visible projects');
select results_eq(
  $$ select title from public.projects where status = 'published'
       and university_id = 'aaaaaaaa-0000-4000-8000-000000000002' and id::text like 'cccccccc-%' $$,
  array['Budget Buddy 500'],
  'university filters the visible projects');
select results_eq(
  $$ select title from public.projects where status = 'published' and id::text like 'cccccccc-%'
       and (title ilike '%50\%%' or summary ilike '%50\%%') $$,
  array['Campus Navigator'],
  'an escaped % matches a literal "50%", not "500"');
select is(
  (select count(*)::int from public.projects
   where status = 'published' and (title ilike '%a\_draft%' or summary ilike '%a\_draft%')),
  0,
  'a search never reaches a draft');
reset role;

-- Viewers who are not verified get nothing -----------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b4');
select is((select count(*)::int from public.projects), 0,
  'a pending organization reads 0 projects');
select is((select count(*)::int from storage.objects where bucket_id = 'project-images'), 0,
  'a pending organization reads 0 project images');
select is((select count(*)::int from public.profiles where id::text like 'ffffffff-%-0000000000a%'),
  0, 'a pending organization reads no owner profile');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b5');
select is((select count(*)::int from public.projects), 0,
  'an unverified student reads 0 projects');
select is((select count(*)::int from public.projects
           where status = 'published' and sectors && '{fintech}'), 0,
  'an unverified student gets 0 with filters too');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b6');
select is((select count(*)::int from public.projects), 0, 'a rejected mentor reads 0 projects');
reset role;

select ok(not has_table_privilege('anon', 'public.projects', 'SELECT'),
  'anon has no SELECT on projects');

-- Owners and admins: why the directory filters by status --------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000a4');
select is((select count(*)::int from public.projects where status = 'draft'), 1,
  'an owner reads their own draft through the table');
select ok(not exists (select 1 from pg_temp.directory() t where t = 'A draft'),
  'the directory query leaves the owner''s draft out');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b7');
select is((select count(*)::int from public.projects where id::text like 'cccccccc-%'), 8,
  'an admin reads every project through the table');
select results_eq($$ select * from pg_temp.directory() $$,
  array['Campus Navigator', 'Budget Buddy 500', 'Suspended Soon'],
  'the directory query gives an admin only the published projects');
reset role;

-- A suspended owner's project disappears --------------------------------------------------------

update public.profiles set verification_status = 'suspended'
  where id = 'ffffffff-0000-4000-8000-0000000000a3';

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b2');
select results_eq($$ select * from pg_temp.directory() $$,
  array['Campus Navigator', 'Budget Buddy 500'],
  'a suspended owner''s project leaves the directory');
select is(
  (select count(*)::int from storage.objects
   where name like 'cccccccc-0000-4000-8000-000000000003/%'),
  0,
  'and its image can no longer be read');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-0000000000b7');
select results_eq($$ select * from pg_temp.directory() $$,
  array['Campus Navigator', 'Budget Buddy 500'],
  'the directory query leaves it out for an admin too (owner not verified)');
reset role;

select * from finish();
rollback;
