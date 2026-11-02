-- SCRUM-12 (6/7): organization and mentor verification. Admins approve or reject pending
-- profiles through review_verification(); every decision is an append-only review row plus an
-- audit event, written in the same transaction as the status change.

create table public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  -- Plain uuids without foreign keys: the history must survive account deletion.
  subject_id uuid not null,
  subject_role public.user_role not null check (subject_role in ('organization', 'mentor')),
  reviewer_id uuid not null,
  -- changes_requested belongs to project reviews; verification is approve or reject.
  decision public.review_decision not null check (decision in ('approved', 'rejected')),
  reason text check (pg_catalog.char_length(reason) between 1 and 1000),
  submitted_snapshot jsonb not null default '{}'::jsonb check (
    pg_catalog.jsonb_typeof(submitted_snapshot) = 'object'
  ),
  created_at timestamptz not null default pg_catalog.now(),
  constraint verification_reviews_reason_on_reject check (decision <> 'rejected' or reason is not null)
);
create index verification_reviews_subject_idx
  on public.verification_reviews (subject_id, created_at desc);

alter table public.verification_reviews enable row level security;
revoke all on public.verification_reviews from anon, authenticated;
-- Every column except reviewer_id: subjects never learn which admin reviewed them.
-- Admins will read reviewer_id through an admin RPC (later story).
grant select (id, subject_id, subject_role, decision, reason, submitted_snapshot, created_at)
  on public.verification_reviews to authenticated;

create trigger verification_reviews_append_only
  before update or delete on public.verification_reviews
  for each row execute function private.reject_append_only_change();
create trigger verification_reviews_no_truncate
  before truncate on public.verification_reviews
  for each statement execute function private.reject_append_only_change();

create policy verification_reviews_select on public.verification_reviews
  for select to authenticated
  using (subject_id = (select auth.uid()) or (select public.is_admin()));

-- Approve or reject a pending organization or mentor. Admin only.
create function public.review_verification(
  p_subject_id uuid,
  p_decision public.review_decision,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_subject public.profiles;
  v_role_profile jsonb;
  v_new_status public.verification_status;
  v_review_id uuid;
begin
  if v_reviewer_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'ABR_NOT_ADMIN';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'ABR_INVALID_DECISION';
  end if;

  select * into v_subject from public.profiles p where p.id = p_subject_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ABR_SUBJECT_NOT_FOUND';
  end if;
  if v_subject.role not in ('organization', 'mentor') then
    raise exception using errcode = '22023', message = 'ABR_NOT_REVIEWABLE';
  end if;
  if v_subject.verification_status <> 'pending' then
    raise exception using errcode = '55000', message = 'ABR_NOT_PENDING';
  end if;
  if not v_subject.onboarding_completed then
    raise exception using errcode = '55000', message = 'ABR_ONBOARDING_INCOMPLETE';
  end if;
  if p_decision = 'rejected' and v_reason is null then
    raise exception using errcode = '22023', message = 'ABR_REASON_REQUIRED';
  end if;
  if pg_catalog.char_length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'ABR_REASON_TOO_LONG';
  end if;

  if v_subject.role = 'organization' then
    select pg_catalog.to_jsonb(o) into v_role_profile
    from public.organization_profiles o where o.user_id = p_subject_id;
  else
    select pg_catalog.to_jsonb(m) into v_role_profile
    from public.mentor_profiles m where m.user_id = p_subject_id;
  end if;

  v_new_status := case p_decision when 'approved' then 'verified' else 'rejected' end;

  update public.profiles p set verification_status = v_new_status where p.id = p_subject_id;

  insert into public.verification_reviews (
    subject_id, subject_role, reviewer_id, decision, reason, submitted_snapshot
  )
  values (
    p_subject_id,
    v_subject.role,
    v_reviewer_id,
    p_decision,
    v_reason,
    pg_catalog.jsonb_build_object(
      'profile', pg_catalog.jsonb_build_object('full_name', v_subject.full_name, 'bio', v_subject.bio),
      'role_profile', coalesce(v_role_profile, '{}'::jsonb)
    )
  )
  returning id into v_review_id;

  perform private.log_event(
    'verification.' || p_decision::text,
    'profile',
    p_subject_id,
    pg_catalog.jsonb_build_object('review_id', v_review_id, 'from', 'pending', 'to', v_new_status)
  );

  return v_review_id;
end;
$$;

-- A rejected organization or mentor asks for another review.
create function public.resubmit_verification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles p where p.id = v_user_id for update;
  if not found
    or v_profile.role not in ('organization', 'mentor')
    or v_profile.verification_status <> 'rejected' then
    raise exception using errcode = '55000', message = 'ABR_NOT_RESUBMITTABLE';
  end if;

  update public.profiles p set verification_status = 'pending' where p.id = v_user_id;

  perform private.log_event(
    'verification.resubmitted',
    'profile',
    v_user_id,
    pg_catalog.jsonb_build_object('from', 'rejected', 'to', 'pending')
  );
end;
$$;

revoke all on function public.review_verification(uuid, public.review_decision, text)
  from public, anon, authenticated;
revoke all on function public.resubmit_verification() from public, anon, authenticated;
grant execute on function public.review_verification(uuid, public.review_decision, text)
  to authenticated;
grant execute on function public.resubmit_verification() to authenticated;
