-- SCRUM-12 (3/7): universities, their approved student email domains and university requests.
-- Domain matching is exact (D-05): a subdomain such as student.ksu.edu.sa must be listed itself.

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (pg_catalog.char_length(name_ar) between 2 and 200),
  name_en text not null check (pg_catalog.char_length(name_en) between 2 and 200),
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.universities enable row level security;
revoke all on public.universities from anon, authenticated;
grant select on public.universities to anon, authenticated;

create trigger universities_set_updated_at
  before update on public.universities
  for each row execute function private.set_updated_at();

-- anon cannot execute helpers, so its policy uses only the row itself.
create policy universities_select_active on public.universities
  for select to anon, authenticated
  using (active);
create policy universities_select_admin on public.universities
  for select to authenticated
  using ((select public.is_admin()));

create table public.university_email_domains (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  domain text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint university_email_domains_lowercase check (domain = pg_catalog.lower(domain)),
  constraint university_email_domains_format check (
    pg_catalog.char_length(domain) <= 253
    and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  )
);
create index university_email_domains_university_idx
  on public.university_email_domains (university_id);

alter table public.university_email_domains enable row level security;
revoke all on public.university_email_domains from anon, authenticated;
grant select on public.university_email_domains to authenticated;

create trigger university_email_domains_set_updated_at
  before update on public.university_email_domains
  for each row execute function private.set_updated_at();

-- Clients never list domains; sign-up checks go through check_student_email().
create policy university_email_domains_select_admin on public.university_email_domains
  for select to authenticated
  using ((select public.is_admin()));

-- Requests to add a university. Inserted later by a rate-limited Edge Function; admin read only.
create table public.university_requests (
  id uuid primary key default gen_random_uuid(),
  requested_name text not null check (pg_catalog.char_length(requested_name) between 2 and 200),
  email_domain text not null check (
    pg_catalog.char_length(email_domain) <= 253
    and email_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  requester_email text not null check (
    pg_catalog.char_length(requester_email) <= 254
    and requester_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  status text not null default 'open' check (status in ('open', 'added', 'declined')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.university_requests enable row level security;
revoke all on public.university_requests from anon, authenticated;
grant select on public.university_requests to authenticated;

create trigger university_requests_set_updated_at
  before update on public.university_requests
  for each row execute function private.set_updated_at();

create policy university_requests_select_admin on public.university_requests
  for select to authenticated
  using ((select public.is_admin()));

-- Lower-cased text after the last '@'; null when there is no '@' or nothing after it.
create function private.email_domain(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(pg_catalog.lower(pg_catalog.substring(p_email, '@([^@]*)$')), '');
$$;
revoke all on function private.email_domain(text) from public, anon, authenticated;

-- Whether an email's exact domain is an active domain of an active university. Never raises on
-- bad input. The only function anon may execute (allowlisted in the schema guard): the sign-up
-- form pre-checks with it, and private.handle_new_user() enforces the same rule.
create function public.check_student_email(p_university_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.university_email_domains d
    join public.universities u on u.id = d.university_id
    where d.university_id = p_university_id
      and d.active
      and u.active
      and d.domain = private.email_domain(p_email)
  );
$$;
revoke all on function public.check_student_email(uuid, text) from public, anon, authenticated;
grant execute on function public.check_student_email(uuid, text) to anon, authenticated;
