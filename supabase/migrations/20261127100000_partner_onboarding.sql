-- Organization and mentor onboarding (SCRUM-17) and the admin verification queue.
--
-- * organization_profiles gains sector and org_size; support_types, sector, org_size and mentor
--   expertise use the interest form's codes (supabase/functions/_shared/interest-options.ts),
--   enforced here so clients cannot store arbitrary labels.
-- * guard_onboarding_completed() now also covers organizations and mentors: the server refuses to
--   mark onboarding complete until the required fields and a phone exist. Only then does
--   review_verification() accept the profile (it already requires onboarding_completed).
-- * admin_verification_queue(): admin-only list of organizations and mentors with their sign-up
--   email, which clients cannot otherwise read (it is the main signal for verifying a company).

alter table public.organization_profiles
  add column sector text check (
    sector in ('technology', 'healthcare', 'finance', 'energy', 'government', 'education',
               'nonprofit', 'other')
  ),
  add column org_size text check (org_size in ('1_50', '51_500', '500_plus')),
  add constraint organization_profiles_support_types_codes check (
    support_types <@ array['hire_talent', 'sponsor_projects', 'adopt_commercialize',
                           'offer_mentoring']::text[]
  );

grant update (sector, org_size) on public.organization_profiles to authenticated;

alter table public.mentor_profiles
  add constraint mentor_profiles_expertise_codes check (
    expertise <@ array['software_data', 'engineering', 'business_entrepreneurship', 'health',
                       'design', 'other']::text[]
  );

-- Onboarding completion for every role ------------------------------------------------------

create or replace function private.guard_onboarding_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_phone boolean;
begin
  if not (new.onboarding_completed and not old.onboarding_completed) then
    return new;
  end if;

  v_has_phone := exists (
    select 1 from private.contact_details c where c.user_id = new.id and c.phone is not null
  );

  if new.role = 'student' then
    if new.full_name is null
      or not exists (
        select 1
        from public.student_profiles s
        where s.user_id = new.id
          and s.major is not null
          and s.academic_level is not null
          and s.graduation_year is not null
      )
      or not v_has_phone then
      raise exception using
        errcode = '23514',
        message = 'ABR_ONBOARDING_INCOMPLETE',
        detail = 'full_name, major, academic_level, graduation_year and a phone are required';
    end if;
  elsif new.role = 'organization' then
    if new.full_name is null
      or not exists (
        select 1
        from public.organization_profiles o
        where o.user_id = new.id
          and o.organization_name is not null
          and o.sector is not null
          and pg_catalog.char_length(o.description) >= 30
          and pg_catalog.cardinality(o.support_types) >= 1
      )
      or not v_has_phone then
      raise exception using
        errcode = '23514',
        message = 'ABR_ONBOARDING_INCOMPLETE',
        detail = 'full_name, organization_name, sector, description (30+), support_types and a phone are required';
    end if;
  elsif new.role = 'mentor' then
    if new.full_name is null
      or not exists (
        select 1
        from public.mentor_profiles m
        where m.user_id = new.id
          and m.job_title is not null
          and m.company is not null
          and m.years_of_experience is not null
          and pg_catalog.cardinality(m.expertise) >= 1
          and pg_catalog.char_length(m.professional_summary) >= 30
      )
      or not v_has_phone then
      raise exception using
        errcode = '23514',
        message = 'ABR_ONBOARDING_INCOMPLETE',
        detail = 'full_name, job_title, company, years_of_experience, expertise, professional_summary (30+) and a phone are required';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.guard_onboarding_completed() from public, anon, authenticated;

-- Admin verification queue --------------------------------------------------------------------

create function public.admin_verification_queue(p_status public.verification_status default 'pending')
returns table (
  id uuid,
  role public.user_role,
  verification_status public.verification_status,
  onboarding_completed boolean,
  full_name text,
  email text,
  updated_at timestamptz,
  organization_name text,
  sector text,
  org_size text,
  description text,
  website text,
  support_types text[],
  job_title text,
  company text,
  expertise text[],
  years_of_experience integer,
  professional_summary text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'ABR_NOT_ADMIN';
  end if;

  return query
  select
    p.id, p.role, p.verification_status, p.onboarding_completed, p.full_name,
    u.email::text, p.updated_at,
    o.organization_name, o.sector, o.org_size, o.description, o.website, o.support_types,
    m.job_title, m.company, m.expertise, m.years_of_experience, m.professional_summary
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.organization_profiles o on o.user_id = p.id
  left join public.mentor_profiles m on m.user_id = p.id
  where p.role in ('organization', 'mentor')
    and p.verification_status = p_status
    -- Pending means "ready for review" only once onboarding is complete.
    and (p_status <> 'pending' or p.onboarding_completed)
  order by p.updated_at asc;
end;
$$;
revoke all on function public.admin_verification_queue(public.verification_status)
  from public, anon, authenticated;
grant execute on function public.admin_verification_queue(public.verification_status)
  to authenticated;
