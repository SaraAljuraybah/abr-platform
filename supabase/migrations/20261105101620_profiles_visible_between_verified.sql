-- D-15 (ADR-0013): profiles are visible only between verified users.
-- A row is visible when it is your own, when you are an admin, or when YOU are verified and the
-- row's owner is verified and not an admin. Before this, any signed-in user (pending
-- organizations and mentors, unconfirmed students) could read every verified profile.
-- The own-row and admin paths are unchanged; contact details (schema private) are untouched.
-- Each policy is replaced in this one migration (one transaction), so there is no moment with
-- no policy (no rows) or with the old one.

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
    or (
      (select public.is_verified())
      and verification_status = 'verified'
      and role <> 'admin'
    )
  );

drop policy student_profiles_select on public.student_profiles;
create policy student_profiles_select on public.student_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or (
      (select public.is_verified())
      and exists (
        select 1 from public.profiles p
        where p.id = user_id and p.verification_status = 'verified' and p.role <> 'admin'
      )
    )
  );

drop policy organization_profiles_select on public.organization_profiles;
create policy organization_profiles_select on public.organization_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or (
      (select public.is_verified())
      and exists (
        select 1 from public.profiles p
        where p.id = user_id and p.verification_status = 'verified' and p.role <> 'admin'
      )
    )
  );

drop policy mentor_profiles_select on public.mentor_profiles;
create policy mentor_profiles_select on public.mentor_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or (
      (select public.is_verified())
      and exists (
        select 1 from public.profiles p
        where p.id = user_id and p.verification_status = 'verified' and p.role <> 'admin'
      )
    )
  );
