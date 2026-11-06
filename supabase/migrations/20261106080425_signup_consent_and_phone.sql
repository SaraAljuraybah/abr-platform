-- SCRUM-38: sign-up consents and a required student phone.
-- * private.current_legal_versions(): the ONE place for the current Terms and Privacy Policy
--   versions. The web app sends the versions it showed (src/features/legal/versions.ts; a Vitest
--   test compares them with this function). Bumping a version = a new migration replacing it.
-- * profiles: terms_version, terms_accepted_at, privacy_version, privacy_accepted_at, written only
--   by the sign-up trigger. No column grant, plus the guard trigger (ADR 0011).
-- * handle_new_user(): students, organizations and mentors must send both CURRENT versions, or the
--   sign-up is refused (ABR_CONSENT_REQUIRED). Admins are provisioned with the secret key
--   (scripts/provision-admin.mjs), never use the form, and are exempt: their columns stay null.
-- * guard_onboarding_completed(): a student also needs a phone in private.contact_details.
--   The phone is still written only by update_my_contact() (E.164); the Saudi-mobile format is a
--   form rule.

-- Current legal versions --------------------------------------------------------------------------

create function private.current_legal_versions()
returns table (terms_version text, privacy_version text)
language sql
immutable
set search_path = ''
as $$
  select '2026-11-v1'::text, '2026-11-v1'::text;
$$;
revoke all on function private.current_legal_versions() from public, anon, authenticated;

-- Consent columns on profiles ---------------------------------------------------------------------

alter table public.profiles
  add column terms_version text
    constraint profiles_terms_version_length check (pg_catalog.char_length(terms_version) <= 40),
  add column terms_accepted_at timestamptz,
  add column privacy_version text
    constraint profiles_privacy_version_length check (pg_catalog.char_length(privacy_version) <= 40),
  add column privacy_accepted_at timestamptz,
  add constraint profiles_consent_pairs check (
    (terms_version is null) = (terms_accepted_at is null)
    and (privacy_version is null) = (privacy_accepted_at is null)
  );
-- No grant: the table-level revoke from SCRUM-12 stands and profiles has column grants only.

-- Same as 20261026200711_profiles.sql, plus the four consent columns.
create or replace function private.guard_profile_update()
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

  if (
    new.terms_version is distinct from old.terms_version
    or new.terms_accepted_at is distinct from old.terms_accepted_at
    or new.privacy_version is distinct from old.privacy_version
    or new.privacy_accepted_at is distinct from old.privacy_accepted_at
  ) and current_user in ('anon', 'authenticated') then
    raise exception using
      errcode = '42501',
      message = 'ABR_PROTECTED_COLUMN',
      detail = 'profiles consent columns change only through trusted functions';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_profile_update() from public, anon, authenticated;

-- Sign-up trigger -------------------------------------------------------------------------------

-- Same as 20261102184242_signup_organization_name.sql, plus the consent check and columns.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users;
  v_requested_role text;
  v_university text;
  v_email text;
  v_full_name text;
  v_organization_name text;
  v_role public.user_role;
  v_status public.verification_status;
  v_university_id uuid;
  v_terms_version text;
  v_privacy_version text;
  v_consented_at timestamptz;
begin
  -- The row as it stands at commit, not as it was inserted.
  select * into v_user from auth.users u where u.id = new.id;
  if not found then
    return null;
  end if;

  v_requested_role := v_user.raw_user_meta_data ->> 'role';
  v_university := v_user.raw_user_meta_data ->> 'university_id';
  v_email := pg_catalog.lower(v_user.email);
  v_full_name := nullif(
    pg_catalog.btrim(pg_catalog.left(v_user.raw_user_meta_data ->> 'full_name', 120)), ''
  );

  if coalesce(v_user.raw_app_meta_data ->> 'abr_role', '') = 'admin' then
    v_role := 'admin';
  elsif v_requested_role in ('student', 'organization', 'mentor') then
    v_role := v_requested_role::public.user_role;
  else
    raise exception using errcode = '22023', message = 'ABR_INVALID_ROLE';
  end if;

  if v_email is null then
    raise exception using errcode = '22023', message = 'ABR_EMAIL_REQUIRED';
  end if;

  -- Consent: both CURRENT versions, exactly as the form sends them. Admins are exempt.
  if v_role <> 'admin' then
    if not exists (
      select 1 from private.current_legal_versions() v
      where v.terms_version = v_user.raw_user_meta_data ->> 'terms_version'
        and v.privacy_version = v_user.raw_user_meta_data ->> 'privacy_version'
    ) then
      raise exception using errcode = '22023', message = 'ABR_CONSENT_REQUIRED';
    end if;
    select v.terms_version, v.privacy_version into v_terms_version, v_privacy_version
    from private.current_legal_versions() v;
    v_consented_at := pg_catalog.now();
  end if;

  if v_role = 'student' then
    -- Checked as text first so a malformed id is the same refusal, not a uuid parse error.
    if v_university is null
      or v_university !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL';
    end if;
    v_university_id := v_university::uuid;
    if not public.check_student_email(v_university_id, v_email) then
      raise exception using errcode = '22023', message = 'ABR_UNSUPPORTED_UNIVERSITY_EMAIL';
    end if;
  end if;

  if v_role = 'organization' then
    -- Not truncated: a name over the CHECK limit is refused, never silently shortened.
    v_organization_name := nullif(
      pg_catalog.btrim(v_user.raw_user_meta_data ->> 'organization_name', E' \t\r\n'), ''
    );
  end if;

  v_status := case v_role
    when 'student' then
      case when v_user.email_confirmed_at is not null then 'verified' else 'unverified' end
    when 'admin' then 'verified'
    else 'pending'
  end::public.verification_status;

  insert into public.profiles (
    id, role, verification_status, full_name, onboarding_completed,
    terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
  )
  values (
    new.id, v_role, v_status, v_full_name, v_role = 'admin',
    v_terms_version, v_consented_at, v_privacy_version, v_consented_at
  );

  if v_role = 'student' then
    insert into public.student_profiles (user_id, university_id) values (new.id, v_university_id);
  elsif v_role = 'organization' then
    insert into public.organization_profiles (user_id, organization_name)
    values (new.id, v_organization_name);
  elsif v_role = 'mentor' then
    insert into public.mentor_profiles (user_id) values (new.id);
  end if;

  insert into private.contact_details (user_id, contact_email, contact_email_verified_at)
  values (new.id, v_email, v_user.email_confirmed_at);

  if v_role = 'admin' then
    perform private.log_event(
      'admin.provisioned', 'profile', new.id,
      pg_catalog.jsonb_build_object('role', v_role, 'verification_status', v_status),
      null
    );
  else
    perform private.log_event(
      'user.signed_up', 'profile', new.id,
      pg_catalog.jsonb_build_object(
        'role', v_role, 'verification_status', v_status, 'university_id', v_university_id
      ),
      new.id
    );
    perform private.log_event(
      'user.consented', 'profile', new.id,
      pg_catalog.jsonb_build_object(
        'terms_version', v_terms_version, 'privacy_version', v_privacy_version
      ),
      new.id
    );
  end if;

  return null;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Onboarding completion -------------------------------------------------------------------------

-- Same as 20261105072134_student_onboarding.sql, plus the phone. Now SECURITY DEFINER: the phone
-- lives in schema private, which client roles cannot use. It reads only new.id's own rows.
create or replace function private.guard_onboarding_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.onboarding_completed and not old.onboarding_completed and new.role = 'student' then
    if new.full_name is null
      or not exists (
        select 1
        from public.student_profiles s
        where s.user_id = new.id
          and s.major is not null
          and s.academic_level is not null
          and s.graduation_year is not null
      )
      or not exists (
        select 1 from private.contact_details c where c.user_id = new.id and c.phone is not null
      ) then
      raise exception using
        errcode = '23514',
        message = 'ABR_ONBOARDING_INCOMPLETE',
        detail = 'full_name, major, academic_level, graduation_year and a phone are required';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_onboarding_completed() from public, anon, authenticated;
