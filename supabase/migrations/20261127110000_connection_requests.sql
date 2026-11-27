-- SCRUM-21: organization → project requests, connections, contact unlock and in-app
-- notifications (Plan v2.0 §11, §14, capabilities 10–12; request type 4 only in V1).
-- * ADR 0011: every table enables RLS, revokes all from anon and authenticated, then grants select
--   only. No client role can insert, update or delete a request, a connection or a notification:
--   rows are written only by the SECURITY DEFINER functions below, in one transaction each.
-- * The recipient is derived from the project owner, never supplied by the client.
-- * Contact details stay in private.contact_details; the only read path for another user is
--   get_connection_contact(), which logs every attempt and returns nothing (does not raise) when
--   refused, so the audit row of a denial is kept.
-- * Expiry (D-07, assumption 30 days) is applied lazily: a pending request past expires_at is
--   marked expired whenever it is next touched, and is never accepted.
-- * Daily cap 20 requests per organization (Plan B7); a 30-day cool-down after a decline for the
--   same organization and project (proposed, §11).

-- requests ---------------------------------------------------------------------------------------

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  type public.request_type not null,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  message text not null constraint requests_message_length check (
    pg_catalog.char_length(message) between 10 and 1000 and message = pg_catalog.btrim(message)
  ),
  status public.request_status not null default 'pending',
  decline_reason text constraint requests_decline_reason_length check (
    pg_catalog.char_length(decline_reason) between 1 and 300
  ),
  responded_at timestamptz,
  expires_at timestamptz not null default pg_catalog.now() + interval '30 days',
  created_at timestamptz not null default pg_catalog.now(),
  constraint requests_not_self check (sender_id <> recipient_id),
  -- Only type 4 is built in V1; widening this list is how the other types arrive.
  constraint requests_v1_types check (type = 'org_project_request'),
  constraint requests_type_references check (
    type <> 'org_project_request' or project_id is not null
  ),
  constraint requests_reason_only_on_decline check (decline_reason is null or status = 'declined'),
  constraint requests_responded_at check ((status = 'pending') = (responded_at is null))
);
create unique index requests_one_pending_idx on public.requests (type, sender_id, project_id)
  where status = 'pending';
create index requests_sender_idx on public.requests (sender_id, created_at desc);
create index requests_recipient_idx on public.requests (recipient_id, created_at desc);
create index requests_project_idx on public.requests (project_id) where status = 'pending';

alter table public.requests enable row level security;
revoke all on public.requests from anon, authenticated;
grant select on public.requests to authenticated;

create policy requests_select_party on public.requests
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- connections ------------------------------------------------------------------------------------

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete cascade,
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  connection_type text not null constraint connections_type_values check (
    connection_type in ('organization_project')
  ),
  project_id uuid references public.projects (id) on delete set null,
  status text not null default 'active' constraint connections_status_values check (
    status in ('active', 'revoked')
  ),
  created_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz,
  revoked_by uuid,
  constraint connections_canonical_order check (user_a < user_b),
  constraint connections_revoked check ((status = 'revoked') = (revoked_at is not null))
);
create index connections_user_a_idx on public.connections (user_a);
create index connections_user_b_idx on public.connections (user_b);

alter table public.connections enable row level security;
revoke all on public.connections from anon, authenticated;
grant select on public.connections to authenticated;

create policy connections_select_party on public.connections
  for select to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));

-- notifications ----------------------------------------------------------------------------------

-- payload never holds contact data: only ids, a project title and a display name (tests check it).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null constraint notifications_type_values check (
    type in ('request_received', 'request_accepted', 'request_declined', 'request_cancelled')
  ),
  request_id uuid references public.requests (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb constraint notifications_payload_object check (
    pg_catalog.jsonb_typeof(payload) = 'object'
  ),
  read_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

-- Internal helpers -------------------------------------------------------------------------------

create function private.notify(
  p_recipient uuid, p_type text, p_request uuid, p_payload jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, type, request_id, payload)
  values (p_recipient, p_type, p_request, coalesce(p_payload, '{}'::jsonb));
$$;
revoke all on function private.notify(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- Display name of an organization (its organization_name) or a person (full_name). Not contact data.
create function private.display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(o.organization_name, ''), p.full_name)
  from public.profiles p
  left join public.organization_profiles o on o.user_id = p.id
  where p.id = p_user;
$$;
revoke all on function private.display_name(uuid) from public, anon, authenticated;

-- Marks the caller-visible pending requests past expires_at as expired (lazy expiry).
create function private.expire_requests(p_project uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.requests r
  set status = 'expired', responded_at = pg_catalog.now()
  where r.status = 'pending'
    and r.expires_at <= pg_catalog.now()
    and (p_project is null or r.project_id = p_project);
$$;
revoke all on function private.expire_requests(uuid) from public, anon, authenticated;

-- send_org_project_request ------------------------------------------------------------------------

create function public.send_org_project_request(p_project_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_message text := pg_catalog.btrim(p_message);
  v_sender public.profiles;
  v_project public.projects;
  v_owner public.profiles;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  select * into v_sender from public.profiles p where p.id = v_user_id;
  if not found or v_sender.role <> 'organization' then
    raise exception using errcode = '42501', message = 'ABR_NOT_ORGANIZATION';
  end if;
  if v_sender.verification_status <> 'verified' then
    raise exception using errcode = '42501', message = 'ABR_NOT_VERIFIED';
  end if;

  if v_message is null or pg_catalog.char_length(v_message) not between 10 and 1000 then
    raise exception using errcode = '22023', message = 'ABR_INVALID_MESSAGE';
  end if;

  -- Lock the project so an unpublish cannot slip between the check and the insert.
  select * into v_project from public.projects pr where pr.id = p_project_id for share;
  if not found or v_project.status <> 'published' then
    raise exception using errcode = 'P0002', message = 'ABR_PROJECT_NOT_FOUND';
  end if;
  select * into v_owner from public.profiles p where p.id = v_project.owner_id;
  if v_owner.verification_status <> 'verified' then
    raise exception using errcode = 'P0002', message = 'ABR_PROJECT_NOT_FOUND';
  end if;

  -- Serialise this organization's sends so the cap and the duplicate check hold under concurrency.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('org_project_request:' || v_user_id::text, 0)
  );

  perform private.expire_requests(p_project_id);

  if exists (
    select 1 from public.requests r
    where r.type = 'org_project_request' and r.sender_id = v_user_id
      and r.project_id = p_project_id and r.status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'ABR_REQUEST_PENDING';
  end if;

  if exists (
    select 1 from public.requests r
    where r.type = 'org_project_request' and r.sender_id = v_user_id
      and r.project_id = p_project_id and r.status = 'declined'
      and r.responded_at > pg_catalog.now() - interval '30 days'
  ) then
    raise exception using errcode = '53400', message = 'ABR_REQUEST_COOLDOWN';
  end if;

  if exists (
    select 1 from public.connections c
    where c.status = 'active' and c.project_id = p_project_id
      and c.user_a = least(v_user_id, v_owner.id) and c.user_b = greatest(v_user_id, v_owner.id)
  ) then
    raise exception using errcode = '23505', message = 'ABR_ALREADY_CONNECTED';
  end if;

  if (
    select pg_catalog.count(*) from public.requests r
    where r.sender_id = v_user_id and r.created_at > pg_catalog.now() - interval '1 day'
  ) >= 20 then
    raise exception using errcode = '53400', message = 'ABR_RATE_LIMITED';
  end if;

  insert into public.requests (type, sender_id, recipient_id, project_id, message)
  values ('org_project_request', v_user_id, v_owner.id, p_project_id, v_message)
  returning id into v_request_id;

  perform private.notify(
    v_owner.id, 'request_received', v_request_id,
    pg_catalog.jsonb_build_object(
      'project_id', p_project_id,
      'project_title', v_project.title,
      'counterpart_name', private.display_name(v_user_id)
    )
  );
  perform private.log_event(
    'request.sent', 'request', v_request_id,
    pg_catalog.jsonb_build_object('type', 'org_project_request', 'project_id', p_project_id)
  );

  return v_request_id;
end;
$$;

-- respond_to_request ------------------------------------------------------------------------------

-- Returns the new connection's id on accept, null on decline.
create function public.respond_to_request(p_request_id uuid, p_accept boolean, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_request public.requests;
  v_project_title text;
  v_connection_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;
  if p_accept is null then
    raise exception using errcode = '22023', message = 'ABR_INVALID_DECISION';
  end if;
  if v_reason is not null and (p_accept or pg_catalog.char_length(v_reason) > 300) then
    raise exception using errcode = '22023', message = 'ABR_INVALID_REASON';
  end if;
  if not public.is_verified() then
    raise exception using errcode = '42501', message = 'ABR_NOT_VERIFIED';
  end if;

  select * into v_request from public.requests r where r.id = p_request_id for update;
  -- Someone else's request looks exactly like a missing one.
  if not found or v_request.recipient_id <> v_user_id then
    raise exception using errcode = 'P0002', message = 'ABR_REQUEST_NOT_FOUND';
  end if;

  -- Expired but not yet marked: refused (the next send or list marks it).
  if v_request.status = 'pending' and v_request.expires_at <= pg_catalog.now() then
    raise exception using errcode = '55000', message = 'ABR_REQUEST_EXPIRED';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = '55000', message = 'ABR_REQUEST_NOT_PENDING';
  end if;

  select pr.title into v_project_title from public.projects pr where pr.id = v_request.project_id;

  if p_accept then
    update public.requests r set status = 'accepted', responded_at = pg_catalog.now()
    where r.id = v_request.id;
    insert into public.connections (request_id, user_a, user_b, connection_type, project_id)
    values (
      v_request.id,
      least(v_request.sender_id, v_request.recipient_id),
      greatest(v_request.sender_id, v_request.recipient_id),
      'organization_project',
      v_request.project_id
    )
    returning id into v_connection_id;
  else
    update public.requests r
    set status = 'declined', responded_at = pg_catalog.now(), decline_reason = v_reason
    where r.id = v_request.id;
  end if;

  perform private.notify(
    v_request.sender_id,
    case when p_accept then 'request_accepted' else 'request_declined' end,
    v_request.id,
    pg_catalog.jsonb_build_object(
      'project_id', v_request.project_id,
      'project_title', v_project_title,
      'counterpart_name', private.display_name(v_user_id)
    )
  );
  perform private.log_event(
    case when p_accept then 'request.accepted' else 'request.declined' end,
    'request', v_request.id,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('connection_id', v_connection_id))
  );

  return v_connection_id;
end;
$$;

-- withdraw_request --------------------------------------------------------------------------------

create function public.withdraw_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.requests;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  select * into v_request from public.requests r where r.id = p_request_id for update;
  if not found or v_request.sender_id <> v_user_id then
    raise exception using errcode = 'P0002', message = 'ABR_REQUEST_NOT_FOUND';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = '55000', message = 'ABR_REQUEST_NOT_PENDING';
  end if;

  update public.requests r set status = 'withdrawn', responded_at = pg_catalog.now()
  where r.id = v_request.id;
  perform private.log_event('request.withdrawn', 'request', v_request.id);
end;
$$;

-- get_connection_contact --------------------------------------------------------------------------

-- The only way to read another user's contact details. Never raises for a refusal: it logs the
-- denial and returns no rows (a raise would roll back the audit insert).
create function public.get_connection_contact(p_connection_id uuid)
returns table (
  user_id uuid,
  display_name text,
  contact_email text,
  phone text,
  linkedin_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_connection public.connections;
  v_other uuid;
  v_reason text;
begin
  select * into v_connection from public.connections c where c.id = p_connection_id;

  if v_user_id is null then
    v_reason := 'not_authenticated';
  elsif not found then
    v_reason := 'not_found';
  elsif v_user_id not in (v_connection.user_a, v_connection.user_b) then
    v_reason := 'not_a_party';
  elsif v_connection.status <> 'active' then
    v_reason := 'not_active';
  else
    v_other := case when v_connection.user_a = v_user_id then v_connection.user_b
                    else v_connection.user_a end;
    if exists (
      select 1 from public.profiles p
      where p.id in (v_user_id, v_other) and p.verification_status <> 'verified'
    ) then
      v_reason := 'party_not_verified';
    end if;
  end if;

  if v_reason is not null then
    perform private.log_event(
      'connection.contact_denied', 'connection', p_connection_id,
      pg_catalog.jsonb_build_object('reason', v_reason)
    );
    return;
  end if;

  perform private.log_event('connection.contact_viewed', 'connection', v_connection.id,
    pg_catalog.jsonb_build_object('subject_id', v_other));

  return query
    select v_other,
           private.display_name(v_other),
           c.contact_email,
           case when c.share_phone then c.phone end,
           case when c.share_linkedin then c.linkedin_url end
    from private.contact_details c
    where c.user_id = v_other;
end;
$$;

-- Notifications -----------------------------------------------------------------------------------

-- Marks the caller's notifications read: the given ids, or all of them when p_ids is null.
create function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  update public.notifications n
  set read_at = pg_catalog.now()
  where n.recipient_id = v_user_id
    and n.read_at is null
    and (p_ids is null or n.id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- System cancellation -----------------------------------------------------------------------------

-- Pending requests close as cancelled when their project leaves published, or when either party
-- is suspended. The sender is told; nothing is revealed.
create function private.cancel_requests(p_where_project uuid, p_where_user uuid, p_cause text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
begin
  for v_request in
    update public.requests r
    set status = 'cancelled', responded_at = pg_catalog.now()
    where r.status = 'pending'
      and (p_where_project is null or r.project_id = p_where_project)
      and (p_where_user is null or p_where_user in (r.sender_id, r.recipient_id))
    returning r.id, r.sender_id, r.recipient_id, r.project_id
  loop
    if v_request.sender_id is distinct from p_where_user then
      perform private.notify(
        v_request.sender_id, 'request_cancelled', v_request.id,
        pg_catalog.jsonb_build_object(
          'project_id', v_request.project_id,
          'project_title', (select pr.title from public.projects pr where pr.id = v_request.project_id)
        )
      );
    end if;
    perform private.log_event(
      'request.cancelled', 'request', v_request.id,
      pg_catalog.jsonb_build_object('cause', p_cause)
    );
  end loop;
end;
$$;
revoke all on function private.cancel_requests(uuid, uuid, text) from public, anon, authenticated;

create function private.cancel_requests_on_unpublish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.cancel_requests(new.id, null, 'project_not_published');
  return null;
end;
$$;
revoke all on function private.cancel_requests_on_unpublish() from public, anon, authenticated;

create trigger projects_cancel_requests
  after update of status on public.projects
  for each row
  when (old.status = 'published' and new.status <> 'published')
  execute function private.cancel_requests_on_unpublish();

create function private.cancel_requests_on_suspend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.cancel_requests(null, new.id, 'party_suspended');
  return null;
end;
$$;
revoke all on function private.cancel_requests_on_suspend() from public, anon, authenticated;

create trigger profiles_cancel_requests
  after update of verification_status on public.profiles
  for each row
  when (new.verification_status = 'suspended' and old.verification_status <> 'suspended')
  execute function private.cancel_requests_on_suspend();

-- Grants ------------------------------------------------------------------------------------------

revoke all on function public.send_org_project_request(uuid, text) from public, anon, authenticated;
revoke all on function public.respond_to_request(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.withdraw_request(uuid) from public, anon, authenticated;
revoke all on function public.get_connection_contact(uuid) from public, anon, authenticated;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon, authenticated;
grant execute on function public.send_org_project_request(uuid, text) to authenticated;
grant execute on function public.respond_to_request(uuid, boolean, text) to authenticated;
grant execute on function public.withdraw_request(uuid) to authenticated;
grant execute on function public.get_connection_contact(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
