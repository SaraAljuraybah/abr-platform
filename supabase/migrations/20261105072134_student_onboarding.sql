-- SCRUM-15: student onboarding.
-- * profiles.onboarding_step: the last completed step, so a refresh resumes at the next one.
-- * student_profiles: graduation_year and major_other, and value CHECKs so major, academic_level,
--   graduation_year and interests hold stable codes. major and graduation_year use the lists in
--   supabase/functions/_shared/interest-options.ts; academic_level and interests the lists in
--   src/features/onboarding/options.ts. Vitest tests compare both with the CHECKs below.
-- * A student can mark onboarding complete only once the required fields are set.
-- Clients keep writing only through column grants (ADR 0011); university_id, role and
-- verification_status stay out of reach.

-- profiles --------------------------------------------------------------------------------------

alter table public.profiles
  add column onboarding_step smallint not null default 0
    constraint profiles_onboarding_step_range check (onboarding_step between 0 and 4);

grant update (onboarding_step) on public.profiles to authenticated;

-- student_profiles ------------------------------------------------------------------------------

alter table public.student_profiles
  add column graduation_year text,
  add column major_other text
    check (pg_catalog.char_length(major_other) between 2 and 100),
  add constraint student_profiles_major_values check (
    major in ('cs', 'se', 'it', 'is', 'cyber', 'ai', 'data', 'ce', 'other')
  ),
  add constraint student_profiles_major_other_required check (
    (major is not distinct from 'other') = (major_other is not null)
  ),
  add constraint student_profiles_academic_level_values check (
    academic_level in ('undergraduate', 'final_year', 'recent_graduate', 'postgraduate')
  ),
  add constraint student_profiles_graduation_year_values check (
    graduation_year in (
      '2027_or_later', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018',
      '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010', '2009', '2008', '2007',
      '2006', '2005', '2004', '2003', '2002', '2001', '2000'
    )
  ),
  add constraint student_profiles_interests_values check (
    interests <@ array[
      'fintech', 'health_tech', 'education', 'smart_cities', 'ecommerce', 'sustainability',
      'gaming', 'other'
    ]::text[]
  );

grant update (graduation_year, major_other) on public.student_profiles to authenticated;

-- Completion guard ------------------------------------------------------------------------------

-- Runs as the caller (no SECURITY DEFINER): RLS lets a user read their own student profile, and
-- the check applies to every writer, trusted code included. Organization and mentor rules arrive
-- with their onboarding.
create function private.guard_onboarding_completed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.onboarding_completed and not old.onboarding_completed and new.role = 'student' then
    if new.full_name is null or not exists (
      select 1
      from public.student_profiles s
      where s.user_id = new.id
        and s.major is not null
        and s.academic_level is not null
        and s.graduation_year is not null
    ) then
      raise exception using
        errcode = '23514',
        message = 'ABR_ONBOARDING_INCOMPLETE',
        detail = 'full_name, major, academic_level and graduation_year are required';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_onboarding_completed() from public, anon, authenticated;

create trigger profiles_guard_onboarding_completed
  before update of onboarding_completed on public.profiles
  for each row execute function private.guard_onboarding_completed();
