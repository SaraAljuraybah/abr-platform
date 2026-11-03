-- SCRUM-34: interest form (/forms/interest). Rows are written only by the submit-interest Edge
-- Function (service role) through public.submit_interest(); clients have no access at all.
-- Every option list below must match supabase/functions/_shared/interest-options.ts exactly
-- (a Vitest test compares them).

create table public.interest_signups (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  full_name text not null check (pg_catalog.char_length(full_name) between 2 and 120),
  email text not null check (
    pg_catalog.char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  -- Student
  university_id uuid references public.universities (id) on delete restrict,
  university_other text check (pg_catalog.char_length(university_other) between 2 and 150),
  field_of_study text,
  graduation_year text,
  project_stage text,
  -- Organization
  organization_name text check (pg_catalog.char_length(organization_name) between 2 and 150),
  sector text,
  looking_for text[],
  org_size text,
  -- Mentor
  expertise text,
  experience text,
  -- Everyone
  region text,
  channel text not null,
  consent_contact boolean not null,
  consent_at timestamptz not null default pg_catalog.now(),
  locale text not null,
  submission_count integer not null default 1 check (submission_count >= 1),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint interest_signups_role_values check (role in ('student', 'organization', 'mentor')),
  constraint interest_signups_field_of_study_values check (
    field_of_study in ('cs_it', 'engineering', 'business', 'health', 'design', 'other')
  ),
  constraint interest_signups_graduation_year_values check (
    graduation_year in ('2026', '2027', '2028_or_later')
  ),
  constraint interest_signups_project_stage_values check (
    project_stage in ('have_project', 'have_idea', 'not_yet')
  ),
  constraint interest_signups_sector_values check (
    sector in (
      'technology', 'healthcare', 'finance', 'energy', 'government', 'education', 'nonprofit',
      'other'
    )
  ),
  constraint interest_signups_looking_for_values check (
    pg_catalog.cardinality(looking_for) >= 1
    and looking_for <@ array[
      'hire_talent', 'sponsor_projects', 'adopt_commercialize', 'offer_mentoring'
    ]::text[]
  ),
  constraint interest_signups_org_size_values check (org_size in ('1_50', '51_500', '500_plus')),
  constraint interest_signups_expertise_values check (
    expertise in (
      'software_data', 'engineering', 'business_entrepreneurship', 'health', 'design', 'other'
    )
  ),
  constraint interest_signups_experience_values check (
    experience in ('0_3', '4_7', '8_15', '15_plus')
  ),
  constraint interest_signups_region_values check (
    region in ('riyadh', 'makkah', 'eastern', 'other')
  ),
  constraint interest_signups_channel_values check (
    channel in ('x', 'linkedin', 'instagram', 'friend', 'university', 'event', 'other')
  ),
  constraint interest_signups_locale_values check (locale in ('en', 'ar')),
  constraint interest_signups_consent_given check (consent_contact),

  -- Each role fills its own fields and nothing else. A student names exactly one university:
  -- a listed one or a free-text name.
  constraint interest_signups_role_fields check (
    case role
      when 'student' then
        (university_id is null) <> (university_other is null)
        and field_of_study is not null and graduation_year is not null
        and project_stage is not null
        and organization_name is null and sector is null and looking_for is null
        and org_size is null and expertise is null and experience is null
      when 'organization' then
        organization_name is not null and sector is not null and looking_for is not null
        and org_size is not null
        and university_id is null and university_other is null and field_of_study is null
        and graduation_year is null and project_stage is null
        and expertise is null and experience is null
      when 'mentor' then
        expertise is not null and experience is not null
        and university_id is null and university_other is null and field_of_study is null
        and graduation_year is null and project_stage is null
        and organization_name is null and sector is null and looking_for is null
        and org_size is null
      else false
    end
  )
);

-- One row per address, whatever its case: a repeat submission updates it.
create unique index interest_signups_email_key on public.interest_signups (pg_catalog.lower(email));

alter table public.interest_signups enable row level security;
revoke all on public.interest_signups from anon, authenticated;
-- No grants and no policies: only the definer functions below read or write it.

create trigger interest_signups_set_updated_at
  before update on public.interest_signups
  for each row execute function private.set_updated_at();

-- Attempts per bucket and key for rate limiting. The key is an HMAC of the client IP (computed in
-- the Edge Function with a server secret) or the single 'unknown' bucket; never a raw IP.
create table private.rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket ~ '^[a-z][a-z0-9-]{0,62}$'),
  key text not null check (key ~ '^[0-9a-f]{64}$' or key = 'unknown'),
  created_at timestamptz not null default pg_catalog.now()
);
create index rate_limits_bucket_key_idx on private.rate_limits (bucket, key, created_at);

alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from anon, authenticated;

-- Records one attempt and says whether it is within the limit (true) or over it (false).
-- Attempts over the limit are not recorded, so a blocked caller is free again once its oldest
-- attempt leaves the window. Serialised per key with an advisory lock.
create function public.consume_rate_limit(
  p_bucket text,
  p_key text,
  p_max integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_max is null or p_max < 1 or p_window is null or p_window <= interval '0' then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_bucket || ':' || p_key, 0)
  );

  delete from private.rate_limits r
  where r.bucket = p_bucket and r.key = p_key and r.created_at <= pg_catalog.now() - p_window;

  select pg_catalog.count(*) into v_count
  from private.rate_limits r
  where r.bucket = p_bucket and r.key = p_key;

  if v_count >= p_max then
    return false;
  end if;

  insert into private.rate_limits (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;
revoke all on function public.consume_rate_limit(text, text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, interval) to service_role;

-- Saves an interest submission validated by the Edge Function. A repeat email updates the row and
-- increments submission_count; the caller learns nothing about which happened. Invalid values
-- fail the table's CHECK constraints (the function validates first, so that is a bug, not input).
create function public.submit_interest(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.interest_signups as s (
    role, full_name, email, university_id, university_other, field_of_study, graduation_year,
    project_stage, organization_name, sector, looking_for, org_size, expertise, experience,
    region, channel, consent_contact, locale
  )
  values (
    p_payload ->> 'role',
    p_payload ->> 'full_name',
    p_payload ->> 'email',
    (p_payload ->> 'university_id')::uuid,
    p_payload ->> 'university_other',
    p_payload ->> 'field_of_study',
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
    p_payload ->> 'region',
    p_payload ->> 'channel',
    coalesce((p_payload ->> 'consent_contact')::boolean, false),
    p_payload ->> 'locale'
  )
  on conflict ((pg_catalog.lower(email))) do update set
    role = excluded.role,
    full_name = excluded.full_name,
    email = excluded.email,
    university_id = excluded.university_id,
    university_other = excluded.university_other,
    field_of_study = excluded.field_of_study,
    graduation_year = excluded.graduation_year,
    project_stage = excluded.project_stage,
    organization_name = excluded.organization_name,
    sector = excluded.sector,
    looking_for = excluded.looking_for,
    org_size = excluded.org_size,
    expertise = excluded.expertise,
    experience = excluded.experience,
    region = excluded.region,
    channel = excluded.channel,
    consent_contact = excluded.consent_contact,
    consent_at = pg_catalog.now(),
    locale = excluded.locale,
    submission_count = s.submission_count + 1;
end;
$$;
revoke all on function public.submit_interest(jsonb) from public, anon, authenticated;
grant execute on function public.submit_interest(jsonb) to service_role;

-- Aggregated counts for admins: one row per dimension and value. No names, emails or ids.
-- Listed universities are named in English; free-text universities count as 'other'.
create function public.get_interest_stats()
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
  select 'university', coalesce(u.name_en, 'other'), pg_catalog.count(*)
    from s left join public.universities u on u.id = s.university_id
    where s.role = 'student' group by coalesce(u.name_en, 'other')
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
  select 'region', coalesce(s.region, 'not_given'), pg_catalog.count(*)
    from s group by coalesce(s.region, 'not_given')
  union all
  select 'channel', s.channel, pg_catalog.count(*) from s group by s.channel
  order by 1, 2;
end;
$$;
revoke all on function public.get_interest_stats() from public, anon, authenticated;
grant execute on function public.get_interest_stats() to authenticated;
