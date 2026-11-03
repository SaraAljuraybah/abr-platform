-- SCRUM-34 (follow-up): new interest form options.
-- * Students pick a university from the form's own fixed list (a stable code), not from
--   public.universities (that table is for sign-up: verified email-domain universities only).
-- * Tech-only fields of study, graduation years 2027-or-later down to 2000, five project stages.
-- * "Other" on university, field of study and how they heard about ABR requires a short text.
-- * Region is removed; channel is renamed heard_from.
-- Every option list below must match supabase/functions/_shared/interest-options.ts exactly
-- (a Vitest test compares them with the latest CHECK of each column).

-- The form has not launched: no environment holds real submissions. Old values cannot be mapped
-- to the new lists, so refuse to run rather than guess or drop rows silently.
do $$
begin
  if exists (select 1 from public.interest_signups) then
    raise exception 'interest_signups is not empty: export and clear it before this migration';
  end if;
end;
$$;

alter table public.interest_signups
  drop constraint interest_signups_role_fields,
  drop constraint interest_signups_field_of_study_values,
  drop constraint interest_signups_graduation_year_values,
  drop constraint interest_signups_project_stage_values,
  drop constraint interest_signups_region_values,
  drop constraint interest_signups_channel_values,
  drop column university_id,
  drop column region;

alter table public.interest_signups rename column channel to heard_from;

alter table public.interest_signups
  add column university_code text,
  add column field_of_study_other text
    check (pg_catalog.char_length(field_of_study_other) between 2 and 100),
  add column heard_from_other text
    check (pg_catalog.char_length(heard_from_other) between 2 and 100),

  add constraint interest_signups_university_code_values check (
    university_code in (
      'king_saud', 'imam', 'pnu', 'ksau_hs', 'seu', 'naif',
      'psu', 'alfaisal', 'yamamah', 'dau', 'reu', 'maarefa', 'aou',
      'other'
    )
  ),
  add constraint interest_signups_field_of_study_values check (
    field_of_study in ('cs', 'se', 'it', 'is', 'cyber', 'ai', 'data', 'ce', 'other')
  ),
  add constraint interest_signups_graduation_year_values check (
    graduation_year in (
      '2027_or_later', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018',
      '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010', '2009', '2008', '2007',
      '2006', '2005', '2004', '2003', '2002', '2001', '2000'
    )
  ),
  add constraint interest_signups_project_stage_values check (
    project_stage in ('not_started', 'idea', 'in_progress', 'finished', 'business')
  ),
  add constraint interest_signups_heard_from_values check (
    heard_from in ('x', 'linkedin', 'instagram', 'friend', 'university', 'event', 'other')
  ),

  -- "Other" requires its text, and the text is only kept with "Other".
  add constraint interest_signups_university_other_required check (
    (university_code is not distinct from 'other') = (university_other is not null)
  ),
  add constraint interest_signups_field_of_study_other_required check (
    (field_of_study is not distinct from 'other') = (field_of_study_other is not null)
  ),
  add constraint interest_signups_heard_from_other_required check (
    (heard_from = 'other') = (heard_from_other is not null)
  ),

  -- Each role fills its own fields and nothing else.
  add constraint interest_signups_role_fields check (
    case role
      when 'student' then
        university_code is not null and field_of_study is not null
        and graduation_year is not null and project_stage is not null
        and organization_name is null and sector is null and looking_for is null
        and org_size is null and expertise is null and experience is null
      when 'organization' then
        organization_name is not null and sector is not null and looking_for is not null
        and org_size is not null
        and university_code is null and university_other is null and field_of_study is null
        and field_of_study_other is null and graduation_year is null and project_stage is null
        and expertise is null and experience is null
      when 'mentor' then
        expertise is not null and experience is not null
        and university_code is null and university_other is null and field_of_study is null
        and field_of_study_other is null and graduation_year is null and project_stage is null
        and organization_name is null and sector is null and looking_for is null
        and org_size is null
      else false
    end
  );

-- Same contract as before (validated by the Edge Function, upsert by lower(email), returns
-- nothing), with the new columns.
create or replace function public.submit_interest(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.interest_signups as s (
    role, full_name, email, university_code, university_other, field_of_study,
    field_of_study_other, graduation_year, project_stage, organization_name, sector, looking_for,
    org_size, expertise, experience, heard_from, heard_from_other, consent_contact, locale
  )
  values (
    p_payload ->> 'role',
    p_payload ->> 'full_name',
    p_payload ->> 'email',
    p_payload ->> 'university_code',
    p_payload ->> 'university_other',
    p_payload ->> 'field_of_study',
    p_payload ->> 'field_of_study_other',
    p_payload ->> 'graduation_year',
    p_payload ->> 'project_stage',
    p_payload ->> 'organization_name',
    p_payload ->> 'sector',
    case
      when p_payload ? 'looking_for' and pg_catalog.jsonb_typeof(p_payload -> 'looking_for') = 'array'
        then array(select pg_catalog.jsonb_array_elements_text(p_payload -> 'looking_for'))
    end,
    p_payload ->> 'org_size',
    p_payload ->> 'expertise',
    p_payload ->> 'experience',
    p_payload ->> 'heard_from',
    p_payload ->> 'heard_from_other',
    coalesce((p_payload ->> 'consent_contact')::boolean, false),
    p_payload ->> 'locale'
  )
  on conflict ((pg_catalog.lower(email))) do update set
    role = excluded.role,
    full_name = excluded.full_name,
    email = excluded.email,
    university_code = excluded.university_code,
    university_other = excluded.university_other,
    field_of_study = excluded.field_of_study,
    field_of_study_other = excluded.field_of_study_other,
    graduation_year = excluded.graduation_year,
    project_stage = excluded.project_stage,
    organization_name = excluded.organization_name,
    sector = excluded.sector,
    looking_for = excluded.looking_for,
    org_size = excluded.org_size,
    expertise = excluded.expertise,
    experience = excluded.experience,
    heard_from = excluded.heard_from,
    heard_from_other = excluded.heard_from_other,
    consent_contact = excluded.consent_contact,
    consent_at = pg_catalog.now(),
    locale = excluded.locale,
    submission_count = s.submission_count + 1;
end;
$$;
revoke all on function public.submit_interest(jsonb) from public, anon, authenticated;
grant execute on function public.submit_interest(jsonb) to service_role;

-- Aggregated counts for admins: one row per dimension and value code. No names, emails, ids or
-- free text: an "Other" answer counts as 'other', its text never leaves the table.
create or replace function public.get_interest_stats()
returns table (dimension text, value text, count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with s as (select * from public.interest_signups)
  select 'role', s.role, pg_catalog.count(*) from s group by s.role
  union all
  select 'university', s.university_code, pg_catalog.count(*)
    from s where s.university_code is not null group by s.university_code
  union all
  select 'field_of_study', s.field_of_study, pg_catalog.count(*)
    from s where s.field_of_study is not null group by s.field_of_study
  union all
  select 'graduation_year', s.graduation_year, pg_catalog.count(*)
    from s where s.graduation_year is not null group by s.graduation_year
  union all
  select 'project_stage', s.project_stage, pg_catalog.count(*)
    from s where s.project_stage is not null group by s.project_stage
  union all
  select 'sector', s.sector, pg_catalog.count(*)
    from s where s.sector is not null group by s.sector
  union all
  select 'looking_for', l.item, pg_catalog.count(*)
    from s cross join lateral pg_catalog.unnest(s.looking_for) as l (item) group by l.item
  union all
  select 'org_size', s.org_size, pg_catalog.count(*)
    from s where s.org_size is not null group by s.org_size
  union all
  select 'expertise', s.expertise, pg_catalog.count(*)
    from s where s.expertise is not null group by s.expertise
  union all
  select 'experience', s.experience, pg_catalog.count(*)
    from s where s.experience is not null group by s.experience
  union all
  select 'heard_from', s.heard_from, pg_catalog.count(*) from s group by s.heard_from
  order by 1, 2;
end;
$$;
revoke all on function public.get_interest_stats() from public, anon, authenticated;
grant execute on function public.get_interest_stats() to authenticated;
