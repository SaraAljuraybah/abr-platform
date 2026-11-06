-- SCRUM-27 (page 7): project details CHECKs, the two storage buckets and the storage.objects
-- policies. Storage objects are inserted and deleted as real users, the way the Storage API does it
-- (deletes need storage.allow_delete_query = 'true', which the API sets).

begin;

select plan(62);

-- The sign-up trigger is deferred; fire it at each statement's end.
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

-- Object names and storage calls, run as the current role (RLS applies).
create function pg_temp.name(p_project uuid, p_kind text, p_ext text)
returns text
language sql
as $$
  -- A valid uuid, different per kind and extension, so names never collide.
  select p_project::text || '/' || p_kind || '-0f0f0f0f-1111-4111-8111-'
         || left(md5(p_kind || p_ext), 12) || '.' || p_ext;
$$;
create function pg_temp.put(p_bucket text, p_name text)
returns void
language sql
as $$
  insert into storage.objects (bucket_id, name) values (p_bucket, p_name);
$$;
create function pg_temp.seen(p_name text)
returns int
language sql
as $$
  select count(*)::int from storage.objects where name = p_name;
$$;
create function pg_temp.drop_object(p_name text)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where name = p_name;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function pg_temp.name(uuid, text, text) to authenticated;
grant execute on function pg_temp.put(text, text) to authenticated;
grant execute on function pg_temp.seen(text) to authenticated;
grant execute on function pg_temp.drop_object(text) to authenticated;

-- A, B: verified, onboarded students. U: unconfirmed student. O: verified organization. X: admin.
select pg_temp.new_user('abababab-0000-4000-8000-00000000000a', 'a@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student A"}');
select pg_temp.new_user('abababab-0000-4000-8000-00000000000b', 'b@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student B"}');
select pg_temp.new_user('abababab-0000-4000-8000-00000000000c', 'u@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001", "full_name": "Student U"}',
  '{}', false);
select pg_temp.new_user('abababab-0000-4000-8000-00000000000d', 'o@org.test',
  '{"role": "organization", "full_name": "Org O", "organization_name": "Verified Org"}');
select pg_temp.new_user('abababab-0000-4000-8000-00000000000e', 'x@abr.test',
  '{"full_name": "Admin X"}', '{"abr_role": "admin"}');
select pg_temp.onboard('abababab-0000-4000-8000-00000000000a');
select pg_temp.onboard('abababab-0000-4000-8000-00000000000b');
update public.profiles set verification_status = 'verified', onboarding_completed = true
  where id = 'abababab-0000-4000-8000-00000000000d';

select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select public.create_project('Project A');
reset role;
select pg_temp.act_as('abababab-0000-4000-8000-00000000000b');
select public.create_project('Project B');
reset role;

create temporary table ids on commit drop as
  select
    (select id from public.projects where owner_id = 'abababab-0000-4000-8000-00000000000a') as a,
    (select id from public.projects where owner_id = 'abababab-0000-4000-8000-00000000000b') as b;
grant select on ids to authenticated;

-- Column CHECKs (as the table owner) -----------------------------------------------------------------

select throws_ok(
  $$ update public.projects set wanted_specializations = '{cs}' where id = (select a from ids) $$,
  '23514', null, 'wanted specializations need looking_for_members');
select lives_ok(
  $$ update public.projects set looking_for_members = true, wanted_specializations = '{cs,design}'
     where id = (select a from ids) $$,
  'wanted specializations are accepted when looking for members');
select throws_ok(
  $$ update public.projects set looking_for_members = false where id = (select a from ids) $$,
  '23514', null, 'turning looking_for_members off with specializations left is refused');
select throws_ok(
  $$ update public.projects set wanted_specializations = '{cs,astronomy}' where id = (select a from ids) $$,
  '23514', null, 'a specialization must be a code');
select throws_ok(
  $$ update public.projects
     set wanted_specializations = '{cs,se,it,is,cyber,ai,data,ce,design}' where id = (select a from ids) $$,
  '23514', null, 'more than 8 specializations are refused');
select throws_ok(
  $$ update public.projects set stage = 'unicorn' where id = (select a from ids) $$,
  '23514', null, 'stage must be a code');
select lives_ok(
  $$ update public.projects set stage = 'mvp' where id = (select a from ids) $$,
  'a stage code is accepted');
select throws_ok(
  $$ update public.projects set needs = '{funding,coffee}' where id = (select a from ids) $$,
  '23514', null, 'needs must be codes');
select lives_ok(
  $$ update public.projects set needs = '{funding,investor,mentor,legal_advisor,financial_advisor,
       workspace,marketing,design,programming,manufacturing,tech_partner}' where id = (select a from ids) $$,
  'all 11 needs are accepted');
select throws_ok(
  $$ update public.projects set needs = needs || '{funding}'::text[] where id = (select a from ids) $$,
  '23514', null, 'more than 11 needs are refused');
select throws_ok(
  $$ update public.projects set team_size = 0 where id = (select a from ids) $$,
  '23514', null, 'team size below 1 is refused');
select throws_ok(
  $$ update public.projects set team_size = 11 where id = (select a from ids) $$,
  '23514', null, 'team size above 10 is refused');
select lives_ok(
  $$ update public.projects set team_size = 10 where id = (select a from ids) $$,
  'team size 10 is accepted');

select lives_ok(
  $$ update public.projects set image_path = pg_temp.name(id, 'image', 'webp'),
       document_path = pg_temp.name(id, 'document', 'pdf') where id = (select a from ids) $$,
  'image and document paths inside the project folder are accepted');
select throws_ok(
  $$ update public.projects set image_path = pg_temp.name((select b from ids), 'image', 'png')
     where id = (select a from ids) $$,
  '23514', null, 'an image path in another project''s folder is refused');
select throws_ok(
  $$ update public.projects set image_path = 'image-0f0f0f0f-1111-4111-8111-111111111111.png'
     where id = (select a from ids) $$,
  '23514', null, 'an image path outside any folder is refused');
select throws_ok(
  $$ update public.projects set image_path = (select a from ids)::text || '/../evil.png'
     where id = (select a from ids) $$,
  '23514', null, 'a free-form image path is refused');
select throws_ok(
  $$ update public.projects set image_path = pg_temp.name(id, 'image', 'svg') where id = (select a from ids) $$,
  '23514', null, 'an SVG image path is refused');
select throws_ok(
  $$ update public.projects set document_path = pg_temp.name(id, 'document', 'docx')
     where id = (select a from ids) $$,
  '23514', null, 'a document that is not a PDF is refused');

select lives_ok(
  $$ update public.projects set video_url = 'https://www.youtube.com/watch?v=abc',
       repo_url = 'https://github.com/abr/project', demo_url = 'https://demo.example.com/app'
     where id = (select a from ids) $$,
  'well-formed links are accepted');
select lives_ok(
  $$ update public.projects set video_url = 'https://youtu.be/abc', repo_url = 'https://gitlab.com/abr/p'
     where id = (select a from ids) $$,
  'youtu.be and GitLab links are accepted');
select throws_ok(
  $$ update public.projects set video_url = 'http://www.youtube.com/watch?v=abc' where id = (select a from ids) $$,
  '23514', null, 'a video link without https is refused');
select throws_ok(
  $$ update public.projects set video_url = 'https://evil.example/watch' where id = (select a from ids) $$,
  '23514', null, 'a video link on another host is refused');
select throws_ok(
  $$ update public.projects set video_url = 'https://youtube.com.evil.example/x' where id = (select a from ids) $$,
  '23514', null, 'a look-alike video host is refused');
select throws_ok(
  $$ update public.projects set repo_url = 'https://bitbucket.org/abr/p' where id = (select a from ids) $$,
  '23514', null, 'a repository outside GitHub and GitLab is refused');
select throws_ok(
  $$ update public.projects set demo_url = 'http://demo.example.com' where id = (select a from ids) $$,
  '23514', null, 'a demo link without https is refused');
select throws_ok(
  $$ update public.projects set demo_url = 'javascript:alert(1)' where id = (select a from ids) $$,
  '23514', null, 'a javascript: demo link is refused');

update public.projects set image_path = null, document_path = null where id = (select a from ids);

-- Grants: the owner writes the new columns while editable -------------------------------------------

select ok(
  has_column_privilege('authenticated', 'public.projects', 'stage', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'team_size', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'looking_for_members', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'wanted_specializations', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'needs', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'image_path', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'document_path', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'video_url', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'repo_url', 'UPDATE')
  and has_column_privilege('authenticated', 'public.projects', 'demo_url', 'UPDATE'),
  'the ten new columns have UPDATE grants');

select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
with changed as (
  update public.projects set stage = 'prototype', team_size = 3 where id = (select a from ids)
  returning 1
)
select is(count(*)::int, 1, 'the owner updates the new columns of a draft') from changed;
reset role;

select pg_temp.act_as('abababab-0000-4000-8000-00000000000b');
with changed as (
  update public.projects set stage = 'idea' where id = (select a from ids) returning 1
)
select is(count(*)::int, 0, 'another student''s update changes 0 rows') from changed;
reset role;

-- Buckets -------------------------------------------------------------------------------------------

select results_eq(
  $$ select id, public, file_size_limit, allowed_mime_types from storage.buckets
     where id in ('project-images', 'project-documents') order by id $$,
  $$ values
       ('project-documents'::text, false, 10485760::bigint, array['application/pdf']::text[]),
       ('project-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'both buckets are private with the agreed size and type limits');

-- Storage policies: writing ---------------------------------------------------------------------

select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'png')) $$,
  'the owner uploads an image into their project folder');
select lives_ok(
  $$ select pg_temp.put('project-documents', pg_temp.name((select a from ids), 'document', 'pdf')) $$,
  'the owner uploads a PDF into their project folder');
select throws_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select b from ids), 'image', 'png')) $$,
  '42501', null, 'the owner cannot upload into another project''s folder');
select throws_ok(
  $$ select pg_temp.put('project-images', 'image-0f0f0f0f-1111-4111-8111-111111111111.png') $$,
  '42501', null, 'an upload outside any folder is refused');
select throws_ok(
  $$ select pg_temp.put('project-images', (select a from ids)::text || '/avatar.png') $$,
  '42501', null, 'an upload with a free-form name is refused');
select throws_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'svg')) $$,
  '42501', null, 'an SVG name is refused in the images bucket');
select throws_ok(
  $$ select pg_temp.put('project-documents', pg_temp.name((select a from ids), 'image', 'png')) $$,
  '42501', null, 'an image name is refused in the documents bucket');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 1,
  'the owner reads their own image');
reset role;

select pg_temp.act_as('abababab-0000-4000-8000-00000000000b');
select throws_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'jpg')) $$,
  '42501', null, 'another student cannot upload into my folder');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 0,
  'another student cannot read my draft''s image');
select is(pg_temp.drop_object(pg_temp.name((select a from ids), 'image', 'png')), 0,
  'another student cannot delete my image (0 rows)');
with changed as (
  update storage.objects set name = pg_temp.name((select b from ids), 'image', 'png')
  where name = pg_temp.name((select a from ids), 'image', 'png') returning 1
)
select is(count(*)::int, 0, 'another student cannot move my image (0 rows)') from changed;
reset role;

select pg_temp.act_as('abababab-0000-4000-8000-00000000000d');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 0,
  'a verified organization cannot read an unpublished project''s files');
reset role;

select pg_temp.act_as('abababab-0000-4000-8000-00000000000e');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'document', 'pdf')), 1,
  'an admin reads a draft''s document');
-- An admin can SEE the draft, so only the owner condition stops this write.
select throws_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'jpg')) $$,
  '42501', null, 'an admin cannot upload into a student''s project folder');
select is(pg_temp.drop_object(pg_temp.name((select a from ids), 'document', 'pdf')), 0,
  'an admin cannot delete a student''s file (0 rows)');
reset role;

set local role anon;
select is((select count(*)::int from storage.objects where bucket_id like 'project-%'), 0,
  'anon reads no project files');
reset role;

-- The owner cannot move a file out of their folder.
select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select throws_ok(
  $$ update storage.objects set name = pg_temp.name((select b from ids), 'image', 'png')
     where name = pg_temp.name((select a from ids), 'image', 'png') $$,
  '42501', null, 'the owner cannot move a file into another project''s folder');
reset role;

-- Published: verified viewers read while the owner is verified ---------------------------------

update public.projects set status = 'published', published_at = now() where id = (select a from ids);

select pg_temp.act_as('abababab-0000-4000-8000-00000000000b');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 1,
  'a verified student reads a published project''s image');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'document', 'pdf')), 1,
  'a verified student reads a published project''s document');
reset role;
select pg_temp.act_as('abababab-0000-4000-8000-00000000000d');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 1,
  'a verified organization reads a published project''s image');
reset role;
select pg_temp.act_as('abababab-0000-4000-8000-00000000000c');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 0,
  'an unverified student cannot read a published project''s image');
reset role;

-- Published means not editable: no uploads, no deletes.
select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'webp')) $$,
  '42501', null, 'the owner cannot upload while the project is published');
reset role;

update public.profiles set verification_status = 'suspended'
  where id = 'abababab-0000-4000-8000-00000000000a';
select pg_temp.act_as('abababab-0000-4000-8000-00000000000b');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 0,
  'a suspended owner''s files become unreadable for others');
reset role;
select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select is(pg_temp.seen(pg_temp.name((select a from ids), 'image', 'png')), 1,
  'the suspended owner still reads their own file');
reset role;

-- Back to a draft, owner suspended: no uploads.
update public.projects set status = 'draft', published_at = null where id = (select a from ids);
select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'webp')) $$,
  '42501', null, 'a suspended owner cannot upload');
reset role;
update public.profiles set verification_status = 'verified'
  where id = 'abababab-0000-4000-8000-00000000000a';

-- Submitted for review: uploads and deletes refused ------------------------------------------------

update public.projects set status = 'pending_review', submitted_at = now()
  where id = (select a from ids);
select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'webp')) $$,
  '42501', null, 'uploads are refused once the project is pending review');
select is(pg_temp.drop_object(pg_temp.name((select a from ids), 'image', 'png')), 0,
  'deletes remove 0 rows once the project is pending review');
reset role;

-- Changes requested: editable again.
update public.projects set status = 'changes_requested' where id = (select a from ids);
select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select pg_temp.put('project-images', pg_temp.name((select a from ids), 'image', 'webp')) $$,
  'uploads work again when changes are requested');
select is(pg_temp.drop_object(pg_temp.name((select a from ids), 'image', 'png')), 1,
  'the owner deletes their own file while editable');
reset role;

-- No project, no files: a folder named after a missing project matches nothing.
select pg_temp.act_as('abababab-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select pg_temp.put('project-images',
       pg_temp.name('99999999-0000-4000-8000-000000000000', 'image', 'png')) $$,
  '42501', null, 'an upload for a project that does not exist is refused');
reset role;

select * from finish();
rollback;
