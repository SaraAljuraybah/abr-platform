-- SCRUM-34 (follow-up): record which consent text a person accepted. The text changes to cover
-- launch, news and updates (version 2026-11-v2); the accepted version is stored with consent_at
-- and both are refreshed on every resubmission. Rows accepted before this migration accepted the
-- first text, so they are backfilled as 2026-11-v1.

alter table public.interest_signups
  add column consent_version text not null default '2026-11-v1'
    constraint interest_signups_consent_version_format
      check (consent_version ~ '^[0-9]{4}-[0-9]{2}-v[0-9]+$');

-- No default from now on: the Edge Function must state the version the person saw.
alter table public.interest_signups alter column consent_version drop default;

-- Same contract as before, plus consent_version.
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
    org_size, expertise, experience, heard_from, heard_from_other, consent_contact,
    consent_version, locale
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
    p_payload ->> 'consent_version',
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
    consent_version = excluded.consent_version,
    locale = excluded.locale,
    submission_count = s.submission_count + 1;
end;
$$;
revoke all on function public.submit_interest(jsonb) from public, anon, authenticated;
grant execute on function public.submit_interest(jsonb) to service_role;
