-- SCRUM-19 follow-up: admins provisioned with scripts/provision-admin.mjs have no full name, so the
-- review history named nobody. reviewer_name now falls back to the reviewer's contact email. The
-- function stays admin-only (ABR_NOT_ADMIN), so the email is shown to admins only; students keep
-- reading their reviews without any reviewer at all. Same as 20261107112729_project_review.sql
-- otherwise.

create or replace function public.admin_project_reviews(p_project_id uuid)
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
    select r.id, r.decision, r.notes, r.created_at, coalesce(p.full_name, c.contact_email)
    from public.project_reviews r
    left join public.profiles p on p.id = r.reviewer_id
    left join private.contact_details c on c.user_id = r.reviewer_id
    where r.project_id = p_project_id
    order by r.created_at desc, r.id;
end;
$$;

revoke all on function public.admin_project_reviews(uuid) from public, anon, authenticated;
grant execute on function public.admin_project_reviews(uuid) to authenticated;
