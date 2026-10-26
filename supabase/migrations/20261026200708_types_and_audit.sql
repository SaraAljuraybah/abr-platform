-- SCRUM-12 (1/7): shared enums, the private schema, the updated_at trigger function and the
-- append-only audit log. ADR 0011: every table enables RLS and revokes all from anon and
-- authenticated in the same migration, then grants only what is needed.

-- Private schema: internal and trigger functions, never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Shared enums (Plan v2.0 §14).
create type public.user_role as enum ('student', 'organization', 'mentor', 'admin');
create type public.verification_status as enum (
  'unverified', 'pending', 'verified', 'rejected', 'suspended'
);
create type public.project_status as enum (
  'draft', 'pending_review', 'changes_requested', 'published', 'rejected', 'unpublished'
);
create type public.request_type as enum (
  'team_invitation', 'join_request', 'position_application',
  'org_project_request', 'mentor_invitation', 'mentorship_request'
);
create type public.request_status as enum (
  'pending', 'accepted', 'declined', 'withdrawn', 'cancelled', 'expired'
);
create type public.review_decision as enum ('approved', 'changes_requested', 'rejected');

-- updated_at maintenance for every table that has the column.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

-- Append-only guard shared by audit_events and verification_reviews. Raises for everyone,
-- the table owner included; TRUNCATE skips row triggers, so it gets a statement trigger too.
create function private.reject_append_only_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'ABR_APPEND_ONLY',
    detail = pg_catalog.format('%s on %I.%I is not allowed', tg_op, tg_table_schema, tg_table_name);
end;
$$;
revoke all on function private.reject_append_only_change() from public, anon, authenticated;

-- Audit log. actor_id and entity_id are plain uuids without foreign keys: history must survive
-- account deletion (PDPL erasure is a planned admin procedure, not a cascade).
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (pg_catalog.char_length(action) between 1 and 100),
  entity_type text not null check (pg_catalog.char_length(entity_type) between 1 and 100),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default pg_catalog.now()
);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at);

alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
-- The admin-only select policy is added in the profiles migration (it needs public.is_admin()).

create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function private.reject_append_only_change();
create trigger audit_events_no_truncate
  before truncate on public.audit_events
  for each statement execute function private.reject_append_only_change();

-- The only writer of audit_events. Called from trusted SECURITY DEFINER code; never by clients.
create function private.log_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default auth.uid()
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function private.log_event(text, text, uuid, jsonb, uuid) from public, anon, authenticated;
