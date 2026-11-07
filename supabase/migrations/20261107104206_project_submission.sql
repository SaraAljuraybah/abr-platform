-- SCRUM-18 (page 8): submit a project for review, withdraw it, and the review record.
-- * project_reviews: append-only (like verification_reviews). The project's owner and admins read
--   it, without reviewer_id; nobody writes it from a client. The admin review RPC (next story) is
--   its only writer.
-- * submit_project() / withdraw_submission(): the only way a student changes a project's status.
--   status stays out of client reach (no column grant, guard_project_update). Editing and uploads
--   are already limited to draft / changes_requested (projects_update_own, storage policies).
-- * The completeness rule mirrors REQUIRED_FOR_SUBMIT and DESCRIPTION_MIN in
--   src/features/projects/options.ts (a Vitest test compares them with this file).

-- project_reviews --------------------------------------------------------------------------------

create table public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- A plain uuid without a foreign key, like audit_events: history outlives the account.
  reviewer_id uuid not null,
  decision public.review_decision not null,
  notes text constraint project_reviews_notes_length check (
    pg_catalog.char_length(notes) between 1 and 2000 and notes = pg_catalog.btrim(notes)
  ),
  created_at timestamptz not null default pg_catalog.now(),
  constraint project_reviews_notes_required check (decision = 'approved' or notes is not null)
);
create index project_reviews_project_idx on public.project_reviews (project_id, created_at desc);

alter table public.project_reviews enable row level security;
revoke all on public.project_reviews from anon, authenticated;
-- Every column except reviewer_id: students never learn which admin reviewed them.
grant select (id, project_id, decision, notes, created_at) on public.project_reviews to authenticated;

create trigger project_reviews_append_only
  before update or delete on public.project_reviews
  for each row execute function private.reject_append_only_change();
create trigger project_reviews_no_truncate
  before truncate on public.project_reviews
  for each statement execute function private.reject_append_only_change();

create policy project_reviews_select on public.project_reviews
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.owner_id = (select auth.uid())
    )
  );

-- submit_project ---------------------------------------------------------------------------------

-- The verified owner submits a draft (or a project with changes requested) once it is complete.
-- Missing fields are listed in the message, in form order: "ABR_PROJECT_INCOMPLETE: summary,stage".
create function public.submit_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects;
  v_missing text[] := '{}';
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  select * into v_project from public.projects pr where pr.id = p_project_id for update;
  if not found or v_project.owner_id <> v_user_id then
    raise exception using errcode = 'P0002', message = 'ABR_PROJECT_NOT_FOUND';
  end if;
  if not public.is_verified() then
    raise exception using errcode = '42501', message = 'ABR_NOT_VERIFIED';
  end if;
  if v_project.status not in ('draft', 'changes_requested') then
    raise exception using errcode = '55000', message = 'ABR_NOT_SUBMITTABLE';
  end if;

  if nullif(pg_catalog.btrim(v_project.title), '') is null then
    v_missing := pg_catalog.array_append(v_missing, 'title');
  end if;
  if nullif(pg_catalog.btrim(v_project.summary), '') is null then
    v_missing := pg_catalog.array_append(v_missing, 'summary');
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(v_project.description, ''))) < 100 then
    v_missing := pg_catalog.array_append(v_missing, 'description');
  end if;
  if v_project.track is null then
    v_missing := pg_catalog.array_append(v_missing, 'track');
  end if;
  if v_project.academic_year is null then
    v_missing := pg_catalog.array_append(v_missing, 'academic_year');
  end if;
  if v_project.stage is null then
    v_missing := pg_catalog.array_append(v_missing, 'stage');
  end if;
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception using
      errcode = '22023',
      message = 'ABR_PROJECT_INCOMPLETE: ' || pg_catalog.array_to_string(v_missing, ',');
  end if;

  update public.projects pr
  set status = 'pending_review', submitted_at = pg_catalog.now()
  where pr.id = p_project_id;

  perform private.log_event(
    'project.submitted', 'project', p_project_id,
    pg_catalog.jsonb_build_object('from', v_project.status)
  );
end;
$$;

-- withdraw_submission ----------------------------------------------------------------------------

-- The verified owner takes a pending submission back to a draft. The admin review RPC (next story)
-- locks the row and re-checks pending_review, so a withdraw racing a decision can never publish a
-- draft.
create function public.withdraw_submission(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'ABR_NOT_AUTHENTICATED';
  end if;

  select * into v_project from public.projects pr where pr.id = p_project_id for update;
  if not found or v_project.owner_id <> v_user_id then
    raise exception using errcode = 'P0002', message = 'ABR_PROJECT_NOT_FOUND';
  end if;
  if not public.is_verified() then
    raise exception using errcode = '42501', message = 'ABR_NOT_VERIFIED';
  end if;
  if v_project.status <> 'pending_review' then
    raise exception using errcode = '55000', message = 'ABR_NOT_PENDING';
  end if;

  update public.projects pr
  set status = 'draft', submitted_at = null
  where pr.id = p_project_id;

  perform private.log_event(
    'project.withdrawn', 'project', p_project_id,
    pg_catalog.jsonb_build_object('from', 'pending_review', 'to', 'draft')
  );
end;
$$;

revoke all on function public.submit_project(uuid) from public, anon, authenticated;
revoke all on function public.withdraw_submission(uuid) from public, anon, authenticated;
grant execute on function public.submit_project(uuid) to authenticated;
grant execute on function public.withdraw_submission(uuid) to authenticated;
