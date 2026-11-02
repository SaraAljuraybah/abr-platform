-- SCRUM-13: the sign-up trigger saves the organization name from user metadata.
--
-- Only for role = organization; ignored for every other role. The value is trimmed, and an empty
-- or missing name is stored as NULL (it is collected again in onboarding). Length is enforced by
-- the existing organization_profiles.organization_name CHECK (2-150 characters), not by a second
-- rule here: a name that violates it aborts the sign-up, like the other trigger validations.
--
-- Everything else is unchanged from 20261026200722_auth_triggers.sql.

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

  insert into public.profiles (id, role, verification_status, full_name, onboarding_completed)
  values (new.id, v_role, v_status, v_full_name, v_role = 'admin');

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
  end if;

  return null;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
