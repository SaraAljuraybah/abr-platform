-- SCRUM-12 (2/7): profiles, the role/status guard, role helpers and profile policies.
-- Rows are created only by private.handle_new_user() (auth trigger migration). Clients may
-- update their own name, bio, avatar path and onboarding flag; role and status never.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  verification_status public.verification_status not null,
  full_name text check (pg_catalog.char_length(full_name) between 1 and 120),
  bio text check (pg_catalog.char_length(bio) <= 1000),
  -- A storage object path such as "<user id>/avatar.webp": no scheme, no "..", no leading slash.
  avatar_path text check (
    pg_catalog.char_length(avatar_path) <= 255
    and avatar_path ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$'
  ),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  -- Statuses each role can hold.
  constraint profiles_status_matches_role check (
    (role = 'student' and verification_status in ('unverified', 'verified', 'suspended'))
    or (
      role in ('organization', 'mentor')
      and verification_status in ('pending', 'verified', 'rejected', 'suspended')
    )
    or (role = 'admin' and verification_status in ('verified', 'suspended'))
  )
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, bio, avatar_path, onboarding_completed) on public.profiles to authenticated;
-- Server-side only (secret key): scripts/provision-admin.mjs reads the profile back to verify it.
-- Default privileges give service_role no SELECT on tables created by postgres (ADR 0011).
grant select on public.profiles to service_role;

-- Second layer behind the column grants (ADR 0011): id and role never change; the status
-- changes only in trusted SECURITY DEFINER code, which runs as the owner, not as a client role.
create function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.role is distinct from old.role then
    raise exception using
      errcode = '42501',
      message = 'ABR_PROTECTED_COLUMN',
      detail = 'profiles.id and profiles.role cannot change';
  end if;

  if new.verification_status is distinct from old.verification_status
    and current_user in ('anon', 'authenticated') then
    raise exception using
      errcode = '42501',
      message = 'ABR_PROTECTED_COLUMN',
      detail = 'profiles.verification_status changes only through trusted functions';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_profile_update() from public, anon, authenticated;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function private.guard_profile_update();
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Role helpers for policies and RPCs. SECURITY DEFINER so they read profiles without RLS
-- recursion; executable by authenticated only (anon policies never call them).
-- Never name a helper current_role(): CURRENT_ROLE is a reserved SQL keyword.
create function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- A suspended admin is not an admin.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role = 'admin' and p.verification_status = 'verified'
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create function public.is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.verification_status = 'verified' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_app_role() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_verified() from public, anon, authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_verified() to authenticated;

-- Visible: your own row, verified non-admin profiles, everything for an admin. Admin profiles
-- are never visible to non-admins.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (verification_status = 'verified' and role <> 'admin')
    or (select public.is_admin())
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- audit_events (migration 1): readable by admins only.
create policy audit_events_select_admin on public.audit_events
  for select to authenticated
  using ((select public.is_admin()));
