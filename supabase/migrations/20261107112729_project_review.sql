-- SCRUM-19: admins review submitted projects.
-- * review_project(): approve and publish, request changes, or reject. Locks the project and
--   re-checks pending_review, so a student's withdraw racing a decision can never publish a draft.
--   Status, the review row and the audit event change in one transaction.
-- * admin_project_reviews(): the review history with reviewer names. reviewer_id stays ungranted
--   on project_reviews (students must never learn who reviewed them), so admins read it here.
-- * admin_project_counts(): projects per status for the admin overview.
-- Admins already read every project, member, review row and file through the existing policies
-- (is_admin()); nothing else changes for anyone.

create function public.review_project(
  p_project_id uuid,
  p_decision public.review_decision,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_notes text := nullif(pg_catalog.btrim(p_notes), '');
  v_project public.projects;
  v_status public.project_status;
  v_review_id uuid;
begin
  if v_reviewer_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'ABR_NOT_ADMIN';
  end if;
  if p_decision is null then
    raise exception using errcode = '22023', message = 'ABR_INVALID_DECISION';
  end if;
  if p_decision in ('changes_requested', 'rejected') and v_notes is null then
    raise exception using errcode = '22023', message = 'ABR_NOTES_REQUIRED';
  end if;
  if pg_catalog.char_length(v_notes) > 2000 then
    raise exception using errcode = '22023', message = 'ABR_NOTES_TOO_LONG';
  end if;

  select * into v_project from public.projects pr where pr.id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ABR_PROJECT_NOT_FOUND';
  end if;
  -- Re-checked under the row lock: a withdraw that won the race leaves a draft, never published.
  if v_project.status <> 'pending_review' then
    raise exception using errcode = '55000', message = 'ABR_NOT_PENDING';
  end if;

  v_status := case p_decision
    when 'approved' then 'published'
    when 'changes_requested' then 'changes_requested'
    else 'rejected'
  end::public.project_status;

  update public.projects pr
  set status = v_status,
      published_at = case when v_status = 'published' then pg_catalog.now() else pr.published_at end
  where pr.id = p_project_id;

  -- clock_timestamp(), not now(): two reviews in one transaction still get distinct, ordered times.
  insert into public.project_reviews (project_id, reviewer_id, decision, notes, created_at)
  values (p_project_id, v_reviewer_id, p_decision, v_notes, pg_catalog.clock_timestamp())
  returning id into v_review_id;

  perform private.log_event(
    'project.reviewed', 'project', p_project_id,
    pg_catalog.jsonb_build_object(
      'decision', p_decision, 'from', 'pending_review', 'to', v_status, 'review_id', v_review_id
    )
  );

  return v_review_id;
end;
$$;

create function public.admin_project_reviews(p_project_id uuid)
returns table (
  id uuid,
  decision public.review_decision,
  notes text,
  created_at timestamptz,
  reviewer_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'ABR_NOT_ADMIN';
  end if;
  return query
    select r.id, r.decision, r.notes, r.created_at, p.full_name
    from public.project_reviews r
    left join public.profiles p on p.id = r.reviewer_id
    where r.project_id = p_project_id
    order by r.created_at desc, r.id;
end;
$$;

create function public.admin_project_counts()
returns table (status public.project_status, count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'ABR_NOT_ADMIN';
  end if;
  return query
    select s.status, pg_catalog.count(pr.id)
    from pg_catalog.unnest(pg_catalog.enum_range(null::public.project_status)) as s (status)
    left join public.projects pr on pr.status = s.status
    group by s.status
    order by s.status;
end;
$$;

revoke all on function public.review_project(uuid, public.review_decision, text)
  from public, anon, authenticated;
revoke all on function public.admin_project_reviews(uuid) from public, anon, authenticated;
revoke all on function public.admin_project_counts() from public, anon, authenticated;
grant execute on function public.review_project(uuid, public.review_decision, text) to authenticated;
grant execute on function public.admin_project_reviews(uuid) to authenticated;
grant execute on function public.admin_project_counts() to authenticated;
