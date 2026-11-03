-- SCRUM-12 (4/7): role-specific profiles. Created with the profile by private.handle_new_user().
--
-- CHECK constraints are inline expressions only: a CHECK that calls one of our functions would
-- need EXECUTE for the updating client role. List columns (text[]) are limited in size and per
-- element: the elements are joined with U+001F and the result must be 1..N-character items.

create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Set at sign-up from the validated email domain; never client-writable.
  university_id uuid not null references public.universities (id),
  major text check (pg_catalog.char_length(major) between 1 and 120),
  academic_level text check (pg_catalog.char_length(academic_level) between 1 and 60),
  skills text[] not null default '{}' check (
    pg_catalog.cardinality(skills) <= 20
    and pg_catalog.array_position(skills, null) is null
    and pg_catalog.array_to_string(skills, pg_catalog.chr(31)) ~ '^([^\x1f]{1,40}(\x1f[^\x1f]{1,40})*)?$'
  ),
  interests text[] not null default '{}' check (
    pg_catalog.cardinality(interests) <= 20
    and pg_catalog.array_position(interests, null) is null
    and pg_catalog.array_to_string(interests, pg_catalog.chr(31)) ~ '^([^\x1f]{1,40}(\x1f[^\x1f]{1,40})*)?$'
  ),
  github_url text check (
    github_url ~ '^https://(www\.)?github\.com/[A-Za-z0-9](-?[A-Za-z0-9]){0,38}/?$'
  ),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
create index student_profiles_university_idx on public.student_profiles (university_id);

create table public.organization_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  organization_name text check (pg_catalog.char_length(organization_name) between 2 and 150),
  description text check (pg_catalog.char_length(description) <= 2000),
  website text check (
    pg_catalog.char_length(website) <= 255
    and website ~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(/[^[:space:]]*)?$'
  ),
  support_types text[] not null default '{}' check (
    pg_catalog.cardinality(support_types) <= 10
    and pg_catalog.array_position(support_types, null) is null
    and pg_catalog.array_to_string(support_types, pg_catalog.chr(31)) ~ '^([^\x1f]{1,60}(\x1f[^\x1f]{1,60})*)?$'
  ),
  logo_path text check (
    pg_catalog.char_length(logo_path) <= 255
    and logo_path ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$'
  ),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.mentor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  job_title text check (pg_catalog.char_length(job_title) between 1 and 120),
  company text check (pg_catalog.char_length(company) between 1 and 150),
  expertise text[] not null default '{}' check (
    pg_catalog.cardinality(expertise) <= 15
    and pg_catalog.array_position(expertise, null) is null
    and pg_catalog.array_to_string(expertise, pg_catalog.chr(31)) ~ '^([^\x1f]{1,40}(\x1f[^\x1f]{1,40})*)?$'
  ),
  years_of_experience integer check (years_of_experience between 0 and 60),
  professional_summary text check (pg_catalog.char_length(professional_summary) <= 2000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.student_profiles enable row level security;
alter table public.organization_profiles enable row level security;
alter table public.mentor_profiles enable row level security;
revoke all on public.student_profiles from anon, authenticated;
revoke all on public.organization_profiles from anon, authenticated;
revoke all on public.mentor_profiles from anon, authenticated;

grant select on public.student_profiles to authenticated;
grant select on public.organization_profiles to authenticated;
grant select on public.mentor_profiles to authenticated;
grant update (major, academic_level, skills, interests, github_url)
  on public.student_profiles to authenticated;
grant update (organization_name, description, website, support_types, logo_path)
  on public.organization_profiles to authenticated;
grant update (job_title, company, expertise, years_of_experience, professional_summary)
  on public.mentor_profiles to authenticated;

-- Second layer: user_id never changes; a student's university changes only in trusted code.
create function private.guard_role_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using
      errcode = '42501',
      message = 'ABR_PROTECTED_COLUMN',
      detail = pg_catalog.format('%I.user_id cannot change', tg_table_name);
  end if;

  -- Nested, not "and": PL/pgSQL does not short-circuit, and only student_profiles has the column.
  if tg_table_name = 'student_profiles' then
    if new.university_id is distinct from old.university_id
      and current_user in ('anon', 'authenticated') then
      raise exception using
        errcode = '42501',
        message = 'ABR_PROTECTED_COLUMN',
        detail = 'student_profiles.university_id changes only through trusted functions';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.guard_role_profile_update() from public, anon, authenticated;

create trigger student_profiles_guard
  before update on public.student_profiles
  for each row execute function private.guard_role_profile_update();
create trigger organization_profiles_guard
  before update on public.organization_profiles
  for each row execute function private.guard_role_profile_update();
create trigger mentor_profiles_guard
  before update on public.mentor_profiles
  for each row execute function private.guard_role_profile_update();

create trigger student_profiles_set_updated_at
  before update on public.student_profiles
  for each row execute function private.set_updated_at();
create trigger organization_profiles_set_updated_at
  before update on public.organization_profiles
  for each row execute function private.set_updated_at();
create trigger mentor_profiles_set_updated_at
  before update on public.mentor_profiles
  for each row execute function private.set_updated_at();

-- Same visibility rule as profiles: own row, the owner is verified and not an admin, or admin.
create policy student_profiles_select on public.student_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.verification_status = 'verified' and p.role <> 'admin'
    )
    or (select public.is_admin())
  );
create policy organization_profiles_select on public.organization_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.verification_status = 'verified' and p.role <> 'admin'
    )
    or (select public.is_admin())
  );
create policy mentor_profiles_select on public.mentor_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.verification_status = 'verified' and p.role <> 'admin'
    )
    or (select public.is_admin())
  );

create policy student_profiles_update_own on public.student_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy organization_profiles_update_own on public.organization_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy mentor_profiles_update_own on public.mentor_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
