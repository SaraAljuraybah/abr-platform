-- SCRUM-27 (page 7, with SCRUM-18): project stage and team, needs, an image, a document and links.
-- * New owner-editable columns on public.projects: column grants only (ADR 0011); writes go through
--   the existing projects_update_own policy (owner, verified, draft or changes_requested).
--   Option codes: src/features/projects/options.ts (Vitest compares them with the CHECKs below).
-- * Two PRIVATE storage buckets, created here so every environment gets them from `db push`.
-- * storage.objects policies: reading follows the project's own visibility (projects_select, D-15);
--   writing needs the project's verified owner, an editable status and a name inside the project's
--   folder. Files are served only through short-lived signed URLs.

-- Columns ------------------------------------------------------------------------------------------

alter table public.projects
  add column stage text
    constraint projects_stage_values check (
      stage in ('idea', 'prototype', 'mvp', 'revenue', 'startup')
    ),
  add column team_size integer not null default 1
    constraint projects_team_size_range check (team_size between 1 and 10),
  add column looking_for_members boolean not null default false,
  add column wanted_specializations text[] not null default '{}'
    constraint projects_wanted_specializations_limit check (
      pg_catalog.cardinality(wanted_specializations) <= 8
      and pg_catalog.array_position(wanted_specializations, null) is null
    )
    constraint projects_wanted_specializations_values check (
      wanted_specializations <@ array[
        'cs', 'se', 'it', 'is', 'cyber', 'ai', 'data', 'ce', 'design', 'business', 'marketing',
        'other'
      ]::text[]
    ),
  add column needs text[] not null default '{}'
    constraint projects_needs_limit check (
      pg_catalog.cardinality(needs) <= 11 and pg_catalog.array_position(needs, null) is null
    )
    constraint projects_needs_values check (
      needs <@ array[
        'funding', 'investor', 'mentor', 'legal_advisor', 'financial_advisor', 'workspace',
        'marketing', 'design', 'programming', 'manufacturing', 'tech_partner'
      ]::text[]
    ),
  -- Object names inside this project's own folder: <project id>/<kind>-<uuid>.<ext>.
  add column image_path text
    constraint projects_image_path_folder check (
      image_path ~ (
        '^' || id::text
        || '/image-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      )
    ),
  add column document_path text
    constraint projects_document_path_folder check (
      document_path ~ (
        '^' || id::text
        || '/document-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
      )
    ),
  add column video_url text
    constraint projects_video_url_format check (
      pg_catalog.char_length(video_url) <= 500
      and video_url ~ '^https://((www|m)\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com)/[^[:space:]]+$'
    ),
  add column repo_url text
    constraint projects_repo_url_format check (
      pg_catalog.char_length(repo_url) <= 500
      and repo_url ~ '^https://(www\.)?(github\.com|gitlab\.com)/[^[:space:]]+$'
    ),
  add column demo_url text
    constraint projects_demo_url_format check (
      pg_catalog.char_length(demo_url) <= 500
      and demo_url ~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(/[^[:space:]]*)?$'
    ),
  add constraint projects_wanted_needs_members check (
    looking_for_members or pg_catalog.cardinality(wanted_specializations) = 0
  );

grant update (
  stage, team_size, looking_for_members, wanted_specializations, needs,
  image_path, document_path, video_url, repo_url, demo_url
) on public.projects to authenticated;

-- Buckets ------------------------------------------------------------------------------------------

-- Private: no public URLs. Size and type are enforced by the Storage service on upload. Its type
-- check trusts the declared Content-Type; files are served back with that type through signed URLs,
-- and no SVG or HTML type is allowed, so a disguised file cannot run in the browser.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-images', 'project-images', false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('project-documents', 'project-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects policies ---------------------------------------------------------------------------

-- Read: exactly who may see the project. The subquery runs under projects_select (owner, admin, or
-- a published project with a verified viewer and a verified owner), so the two never drift apart.
create policy project_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('project-images', 'project-documents')
    and exists (
      select 1 from public.projects pr where pr.id::text = (storage.foldername(name))[1]
    )
  );

-- Write: the right bucket, a well-formed name inside the folder of a project the caller owns,
-- while it is editable and the caller is verified. Names are new uuids, so nothing is overwritten.
create policy project_files_insert on storage.objects
  for insert to authenticated
  with check (
    (
      (
        bucket_id = 'project-images'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/image-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      )
      or (
        bucket_id = 'project-documents'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/document-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
      )
    )
    and (select public.is_verified())
    and exists (
      select 1 from public.projects pr
      where pr.id::text = (storage.foldername(name))[1]
        and pr.owner_id = (select auth.uid())
        and pr.status in ('draft', 'changes_requested')
    )
  );

create policy project_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('project-images', 'project-documents')
    and (select public.is_verified())
    and exists (
      select 1 from public.projects pr
      where pr.id::text = (storage.foldername(name))[1]
        and pr.owner_id = (select auth.uid())
        and pr.status in ('draft', 'changes_requested')
    )
  )
  with check (
    (
      (
        bucket_id = 'project-images'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/image-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      )
      or (
        bucket_id = 'project-documents'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/document-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
      )
    )
    and (select public.is_verified())
    and exists (
      select 1 from public.projects pr
      where pr.id::text = (storage.foldername(name))[1]
        and pr.owner_id = (select auth.uid())
        and pr.status in ('draft', 'changes_requested')
    )
  );

create policy project_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('project-images', 'project-documents')
    and (select public.is_verified())
    and exists (
      select 1 from public.projects pr
      where pr.id::text = (storage.foldername(name))[1]
        and pr.owner_id = (select auth.uid())
        and pr.status in ('draft', 'changes_requested')
    )
  );
