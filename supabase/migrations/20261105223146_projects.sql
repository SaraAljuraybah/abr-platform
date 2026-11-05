-- SCRUM-18: projects and project members; a student creates, edits and deletes a draft.
-- * ADR 0011: RLS on, revoke all, then select + update on the editable columns only. status,
--   owner_id, university_id, submitted_at and published_at are never client-writable (no column
--   grant, plus the guard trigger below).
-- * D-15 (ADR 0013): a published project is visible only to a verified viewer, and only while its
--   owner is verified. The owner edits only while verified and while the project is a draft or has
--   changes requested.
-- * Rows are created only by create_project() and deleted only by delete_project().
-- * track uses src/features/projects/options.ts; sectors the onboarding interest codes
--   (src/features/onboarding/options.ts); academic_year the shared graduation-year list
--   (supabase/functions/_shared/interest-options.ts). Vitest compares them with the CHECKs below.
-- Media and links arrive with page 7; submission and review with page 8.

-- projects ---------------------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  status public.project_status not null default 'draft',
  title text not null
    constraint projects_title_length check (
      pg_catalog.char_length(title) between 3 and 140 and title = pg_catalog.btrim(title)
    ),
  summary text constraint projects_summary_length check (pg_catalog.char_length(summary) <= 300),
  description text
    constraint projects_description_length check (pg_catalog.char_length(description) <= 5000),
  track text constraint projects_track_values check (
    track in ('ai', 'web', 'mobile', 'cyber', 'data', 'iot', 'games', 'cloud', 'robotics', 'other')
  ),
  sectors text[] not null default '{}'
    constraint projects_sectors_limit check (
      pg_catalog.cardinality(sectors) <= 5 and pg_catalog.array_position(sectors, null) is null
    )
    constraint projects_sectors_values check (
      sectors <@ array[
        'fintech', 'health_tech', 'education', 'smart_cities', 'ecommerce', 'sustainability',
        'gaming', 'other'
      ]::text[]
    ),
  academic_year text constraint projects_academic_year_values check (
    academic_year in (
      '2027_or_later', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018',
      '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010', '2009', '2008', '2007',
      '2006', '2005', '2004', '2003', '2002', '2001', '2000'
    )
  ),
  -- Copied from the owner's student profile by create_project(); never client-written.
  university_id uuid not null references public.universities (id),
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
create index projects_owner_idx on public.projects (owner_id);
create index projects_status_idx on public.projects (status);
create index projects_university_idx on public.projects (university_id);

alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;
grant select on public.projects to authenticated;
grant update (title, summary, description, track, sectors, academic_year)
  on public.projects to authenticated;

-- Second layer behind the column grants (ADR 0011).
create function private.guard_project_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.owner_id is distinct from old.owner_id
    or new.university_id is distinct from old.university_id
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'ABR_PROTECTED_COLUMN',
      detail = 'projects.id, owner_id, university_id and created_at cannot change';
  end if;

  if (
    new.status is distinct from old.status
    or new.submitted_at is distinct from old.submitted_at
    or new.published_at is distinct from old.published_at
  ) and current_user in ('anon', 'authenticated') then
    raise exception using
      errcode = '42501',
      message = 'ABR_PROTECTED_COLUMN',
      detail = 'projects.status, submitted_at and published_at change only through trusted functions';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_project_update() from public, anon, authenticated;

create trigger projects_guard
  before update on public.projects
  for each row execute function private.guard_project_update();
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

create policy projects_select on public.projects
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (select public.is_admin())
    or (
      (select public.is_verified())
      and status = 'published'
      and exists (
        select 1 from public.profiles p
        where p.id = owner_id and p.verification_status = 'verified'
      )
    )
  );

create policy projects_update_own on public.projects
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (select public.is_verified())
    and status in ('draft', 'changes_requested')
  )
  with check (
    owner_id = (select auth.uid())
    and (select public.is_verified())
    and status in ('draft', 'changes_requested')
  );

-- project_members --------------------------------------------------------------------------------

-- member_role is text with a CHECK, so adding teammates only widens the list.
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null constraint project_members_role_values check (member_role in ('owner')),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (project_id, user_id)
);
-- At most one owner per project; the triggers below make it exactly one.
create unique index project_members_one_owner_idx
  on public.project_members (project_id) where member_role = 'owner';
create index project_members_user_idx on public.project_members (user_id);

alter table public.project_members enable row level security;
revoke all on public.project_members from anon, authenticated;
grant select on public.project_members to authenticated;

-- Visible with the project (projects RLS applies inside the subquery), or your own membership.
create policy project_members_select on public.project_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.projects pr where pr.id = project_id)
  );

-- The owner row names the project's owner_id, never changes, and goes only with its project or
-- its user (the cascades from delete_project() and account deletion). Applies to every writer.
create function private.guard_project_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.member_role = 'owner' and not exists (
      select 1 from public.projects pr where pr.id = new.project_id and pr.owner_id = new.user_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'ABR_OWNER_MISMATCH',
        detail = 'the owner member row must name the project''s owner_id';
    end if;
    return new;
  end if;

  if old.member_role = 'owner' then
    if tg_op = 'UPDATE' then
      if new.project_id is distinct from old.project_id
        or new.user_id is distinct from old.user_id
        or new.member_role is distinct from old.member_role then
        raise exception using
          errcode = '42501',
          message = 'ABR_OWNER_REQUIRED',
          detail = 'the owner member row cannot change';
      end if;
    elsif exists (select 1 from public.projects pr where pr.id = old.project_id)
      and exists (select 1 from public.profiles p where p.id = old.user_id) then
      raise exception using
        errcode = '42501',
        message = 'ABR_OWNER_REQUIRED',
        detail = 'the owner member row is removed only with its project';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.guard_project_member() from public, anon, authenticated;

create trigger project_members_guard
  before insert or update or delete on public.project_members
  for each row execute function private.guard_project_member();

-- Every project has its owner row at commit. create_project() writes both in one statement, so
-- this holds even when a caller sets constraints immediate.
create function private.require_project_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.projects pr where pr.id = new.id) and not exists (
    select 1 from public.project_members m
    where m.project_id = new.id and m.member_role = 'owner' and m.user_id = new.owner_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'ABR_OWNER_REQUIRED',
      detail = 'every project needs its owner member row';
  end if;
  return null;
end;
$$;
revoke all on function private.require_project_owner() from public, anon, authenticated;

create constraint trigger projects_owner_required
  after insert on public.projects
  deferrable initially deferred
  for each row execute function private.require_project_owner();

-- RPCs -------------------------------------------------------------------------------------------

-- A verified, onboarded student creates their draft. V1: one project per student, enforced here
-- only. The profile row lock serialises concurrent calls from the same student.
create function public.create_project(p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := pg_catalog.btrim(p_title);
  v_profile public.profiles;
  v_university_id uuid;
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles p where p.id = v_user_id for update;
  if not found or v_profile.role <> 'student' then
    raise exception using errcode = '42501', message = 'ABR_NOT_STUDENT';
  end if;
  if v_profile.verification_status <> 'verified' then
    raise exception using errcode = '42501', message = 'ABR_NOT_VERIFIED';
  end if;
  if not v_profile.onboarding_completed then
    raise exception using errcode = '55000', message = 'ABR_ONBOARDING_INCOMPLETE';
  end if;
  if v_title is null or pg_catalog.char_length(v_title) not between 3 and 140 then
    raise exception using errcode = '22023', message = 'ABR_INVALID_TITLE';
  end if;
  if exists (select 1 from public.projects pr where pr.owner_id = v_user_id) then
    raise exception using errcode = '55000', message = 'ABR_PROJECT_LIMIT';
  end if;

  select s.university_id into v_university_id
  from public.student_profiles s where s.user_id = v_user_id;
  if v_university_id is null then
    raise exception using errcode = '55000', message = 'ABR_ONBOARDING_INCOMPLETE';
  end if;

  -- One statement, so the owner row exists before any constraint check runs.
  with new_project as (
    insert into public.projects (owner_id, title, university_id)
    values (v_user_id, v_title, v_university_id)
    returning id
  ), owner_row as (
    insert into public.project_members (project_id, user_id, member_role)
    select np.id, v_user_id, 'owner' from new_project np
  )
  select np.id into v_project_id from new_project np;

  perform private.log_event('project.created', 'project', v_project_id, '{}'::jsonb);

  return v_project_id;
end;
$$;

-- The owner deletes their own draft. Someone else's project and a missing one get the same answer.
create function public.delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  select * into v_project from public.projects pr where pr.id = p_project_id for update;
  if not found or v_project.owner_id <> v_user_id then
    raise exception using errcode = 'P0002', message = 'ABR_PROJECT_NOT_FOUND';
  end if;
  if v_project.status <> 'draft' then
    raise exception using errcode = '55000', message = 'ABR_NOT_DRAFT';
  end if;

  perform private.log_event(
    'project.deleted', 'project', p_project_id, pg_catalog.jsonb_build_object('status', 'draft')
  );

  delete from public.projects pr where pr.id = p_project_id;
end;
$$;

revoke all on function public.create_project(text) from public, anon, authenticated;
revoke all on function public.delete_project(uuid) from public, anon, authenticated;
grant execute on function public.create_project(text) to authenticated;
grant execute on function public.delete_project(uuid) to authenticated;
