-- SCRUM-12 (7/7): trusted role assignment on sign-up, and student verification on email
-- confirmation.
--
-- The role comes from user metadata only for student / organization / mentor. Admin comes only
-- from raw_app_meta_data.abr_role, which only a secret (service) key can set.
--
-- The sign-up trigger is a deferred constraint trigger: it runs at COMMIT and re-reads the user
-- row. Supabase Auth's admin API inserts the user first and only then, in the same transaction,
-- sets app_metadata and confirms the email, so an ordinary AFTER INSERT trigger would never see
-- abr_role. Raising at COMMIT still aborts the whole sign-up.
--
-- Errors raised here abort the sign-up, but Supabase Auth reports them to the client as a generic
-- "Database error saving new user": the sign-up form must pre-check with check_student_email().
--
-- TODO(SCRUM-13+): a student who changes their auth email to a domain that is not allowlisted for
-- their university keeps "verified". Block the change or re-validate it.

create function private.handle_new_user()
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
    insert into public.organization_profiles (user_id) values (new.id);
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

create constraint trigger on_auth_user_created
  after insert on auth.users
  deferrable initially deferred
  for each row execute function private.handle_new_user();

-- Email confirmation: an unverified student becomes verified (their domain was checked at
-- sign-up), and the sign-up contact email counts as verified. When the email is confirmed in the
-- same transaction as the sign-up (admin API), the profile does not exist yet and this is a no-op:
-- handle_new_user() then reads the confirmed row at commit instead.
create function private.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.contact_details c
  set contact_email_verified_at = new.email_confirmed_at
  where c.user_id = new.id
    and c.contact_email = pg_catalog.lower(new.email)
    and c.contact_email_verified_at is null;

  update public.profiles p
  set verification_status = 'verified'
  where p.id = new.id and p.role = 'student' and p.verification_status = 'unverified';

  if found then
    perform private.log_event(
      'verification.email_confirmed', 'profile', new.id,
      pg_catalog.jsonb_build_object('from', 'unverified', 'to', 'verified'),
      new.id
    );
  end if;

  return new;
end;
$$;
revoke all on function private.handle_user_email_confirmed() from public, anon, authenticated;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.handle_user_email_confirmed();
