-- SCRUM-12 (5/7): private contact details. Schema private is not exposed and the table has no
-- grants for client roles at all: owners read and write their own row only through the two RPCs
-- below; other users only through get_connection_contact() (a later story).

create table private.contact_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Defaults to the sign-up email but is independent of it afterwards.
  contact_email text not null check (
    pg_catalog.char_length(contact_email) <= 254
    and contact_email = pg_catalog.lower(contact_email)
    and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  -- Written when the owner changes the contact email; replaces contact_email on confirmation.
  pending_contact_email text check (
    pg_catalog.char_length(pending_contact_email) <= 254
    and pending_contact_email = pg_catalog.lower(pending_contact_email)
    and pending_contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  contact_email_verified_at timestamptz,
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  linkedin_url text check (
    pg_catalog.char_length(linkedin_url) <= 255
    and linkedin_url ~ '^https://(www\.)?linkedin\.com/(in|company)/[A-Za-z0-9_%-]{1,100}/?$'
  ),
  share_phone boolean not null default false,
  share_linkedin boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table private.contact_details enable row level security;
revoke all on private.contact_details from public, anon, authenticated;

create trigger contact_details_set_updated_at
  before update on private.contact_details
  for each row execute function private.set_updated_at();

-- The caller's own contact details (one row, or none).
create function public.get_my_contact()
returns table (
  contact_email text,
  pending_contact_email text,
  contact_email_verified_at timestamptz,
  phone text,
  linkedin_url text,
  share_phone boolean,
  share_linkedin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  return query
    select c.contact_email, c.pending_contact_email, c.contact_email_verified_at,
           c.phone, c.linkedin_url, c.share_phone, c.share_linkedin
    from private.contact_details c
    where c.user_id = v_user_id;
end;
$$;

-- Update the caller's phone, LinkedIn and sharing choices. Empty strings clear a value. The audit
-- event records which fields changed, never their values.
create function public.update_my_contact(
  p_phone text,
  p_linkedin_url text,
  p_share_phone boolean,
  p_share_linkedin boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_phone text := nullif(pg_catalog.btrim(p_phone), '');
  v_linkedin text := nullif(pg_catalog.btrim(p_linkedin_url), '');
  v_old private.contact_details;
  v_changed text[] := '{}';
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception using errcode = '22023', message = 'ABR_INVALID_PHONE';
  end if;
  if v_linkedin is not null
    and (
      pg_catalog.char_length(v_linkedin) > 255
      or v_linkedin !~ '^https://(www\.)?linkedin\.com/(in|company)/[A-Za-z0-9_%-]{1,100}/?$'
    ) then
    raise exception using errcode = '22023', message = 'ABR_INVALID_LINKEDIN';
  end if;
  if p_share_phone is null or p_share_linkedin is null then
    raise exception using errcode = '22023', message = 'ABR_INVALID_SHARE_FLAGS';
  end if;

  select * into v_old from private.contact_details c where c.user_id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ABR_CONTACT_NOT_FOUND';
  end if;

  if v_phone is distinct from v_old.phone then
    v_changed := pg_catalog.array_append(v_changed, 'phone');
  end if;
  if v_linkedin is distinct from v_old.linkedin_url then
    v_changed := pg_catalog.array_append(v_changed, 'linkedin_url');
  end if;
  if p_share_phone is distinct from v_old.share_phone then
    v_changed := pg_catalog.array_append(v_changed, 'share_phone');
  end if;
  if p_share_linkedin is distinct from v_old.share_linkedin then
    v_changed := pg_catalog.array_append(v_changed, 'share_linkedin');
  end if;

  if pg_catalog.cardinality(v_changed) = 0 then
    return;
  end if;

  update private.contact_details c
  set phone = v_phone,
      linkedin_url = v_linkedin,
      share_phone = p_share_phone,
      share_linkedin = p_share_linkedin
  where c.user_id = v_user_id;

  perform private.log_event(
    'contact.updated', 'profile', v_user_id, pg_catalog.jsonb_build_object('changed', v_changed)
  );
end;
$$;

revoke all on function public.get_my_contact() from public, anon, authenticated;
revoke all on function public.update_my_contact(text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.get_my_contact() to authenticated;
grant execute on function public.update_my_contact(text, text, boolean, boolean) to authenticated;
