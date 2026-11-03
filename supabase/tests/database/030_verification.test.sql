-- SCRUM-12: organization and mentor verification (review_verification, resubmit_verification)
-- and the append-only history.

begin;

select plan(30);

-- The sign-up trigger is deferred to COMMIT, which a rolled-back test never reaches: fire it
-- at the end of each statement instead.
set constraints all immediate;

-- Fixtures ------------------------------------------------------------------

insert into public.universities (id, name_ar, name_en) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'جامعة الاختبار الأولى', 'Test University One');
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'uni-one.test');

create function pg_temp.new_user(
  p_id uuid, p_email text, p_user_meta jsonb, p_app_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '',
    now(), p_app_meta, p_user_meta, now(), now()
  );
  return p_id;
end;
$$;

create function pg_temp.act_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- O, O2: pending organizations with onboarding complete. M: pending mentor, onboarding not
-- complete. S: verified student. X: admin.
select pg_temp.new_user('dddddddd-0000-4000-8000-000000000001', 'o@company.test', '{"role": "organization"}');
select pg_temp.new_user('dddddddd-0000-4000-8000-000000000002', 'o2@company.test', '{"role": "organization"}');
select pg_temp.new_user('dddddddd-0000-4000-8000-000000000003', 'm@example.test', '{"role": "mentor"}');
select pg_temp.new_user('dddddddd-0000-4000-8000-000000000004', 's@uni-one.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000001"}');
select pg_temp.new_user('dddddddd-0000-4000-8000-000000000005', 'x@abr.test', '{}', '{"abr_role": "admin"}');

update public.profiles set onboarding_completed = true
where id in ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002');
update public.organization_profiles set organization_name = 'Clinic Co', website = 'https://clinic.test'
where user_id = 'dddddddd-0000-4000-8000-000000000001';

-- Non-admins cannot verify -------------------------------------------------------------

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000001', 'approved') $$,
  '42501', 'ABR_NOT_ADMIN',
  'an organization cannot verify itself through the RPC'
);
select throws_ok(
  $$ update public.profiles set verification_status = 'verified'
     where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '42501', 'permission denied for table profiles',
  'an organization cannot verify itself directly'
);
reset role;

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000001', 'approved') $$,
  '42501', 'ABR_NOT_ADMIN',
  'a non-admin cannot review'
);
reset role;

-- Admin decisions -------------------------------------------------------------------------

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000005');

select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000001', 'rejected') $$,
  '22023', 'ABR_REASON_REQUIRED',
  'a rejection needs a reason'
);
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000001', 'rejected', '   ') $$,
  '22023', 'ABR_REASON_REQUIRED',
  'a blank reason does not count'
);
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000001', 'changes_requested', 'x') $$,
  '22023', 'ABR_INVALID_DECISION',
  'verification is approve or reject only'
);
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000004', 'approved') $$,
  '22023', 'ABR_NOT_REVIEWABLE',
  'students are not reviewable'
);
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000005', 'approved') $$,
  '22023', 'ABR_NOT_REVIEWABLE',
  'admins are not reviewable'
);
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000003', 'approved') $$,
  '55000', 'ABR_ONBOARDING_INCOMPLETE',
  'a profile with incomplete onboarding cannot be reviewed'
);

select lives_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000001', 'approved') $$,
  'an admin approves a pending organization'
);
select throws_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000001', 'approved') $$,
  '55000', 'ABR_NOT_PENDING',
  'the same profile cannot be reviewed twice'
);
select lives_ok(
  $$ select public.review_verification('dddddddd-0000-4000-8000-000000000002', 'rejected',
       'Please add your commercial registration number.') $$,
  'an admin rejects a pending organization with a reason'
);

reset role;

select is(
  (select verification_status::text from public.profiles where id = 'dddddddd-0000-4000-8000-000000000001'),
  'verified',
  'approval sets the status to verified'
);
select results_eq(
  $$ select decision::text, reviewer_id, submitted_snapshot -> 'role_profile' ->> 'organization_name'
     from public.verification_reviews where subject_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  $$ values ('approved'::text, 'dddddddd-0000-4000-8000-000000000005'::uuid, 'Clinic Co'::text) $$,
  'approval writes a review row with the reviewer and a snapshot of the role profile'
);
select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.approved' and entity_id = 'dddddddd-0000-4000-8000-000000000001'
     and actor_id = 'dddddddd-0000-4000-8000-000000000005'),
  1,
  'approval is audited with the admin as actor'
);
select is(
  (select verification_status::text from public.profiles where id = 'dddddddd-0000-4000-8000-000000000002'),
  'rejected',
  'rejection sets the status to rejected'
);

-- The subject sees the decision and reason, never the reviewer --------------------------

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000002');
select results_eq(
  $$ select decision::text, reason from public.verification_reviews $$,
  $$ values ('rejected'::text, 'Please add your commercial registration number.'::text) $$,
  'the subject can read their own decision and reason'
);
select throws_ok(
  $$ select reviewer_id from public.verification_reviews $$,
  '42501', 'permission denied for table verification_reviews',
  'the subject cannot read reviewer_id'
);
reset role;

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.verification_reviews
   where subject_id = 'dddddddd-0000-4000-8000-000000000002'),
  0,
  'another user cannot see someone else''s review'
);
reset role;

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000004');
select is(
  (select count(*)::int from public.profiles where id = 'dddddddd-0000-4000-8000-000000000001'),
  1,
  'a verified organization becomes visible to other users'
);
select is(
  (select count(*)::int from public.profiles where id = 'dddddddd-0000-4000-8000-000000000002'),
  0,
  'a rejected organization stays invisible'
);
select throws_ok(
  $$ select public.resubmit_verification() $$,
  '55000', 'ABR_NOT_RESUBMITTABLE',
  'a student cannot resubmit'
);
reset role;

-- Resubmission -----------------------------------------------------------------------------

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000002');
select lives_ok($$ select public.resubmit_verification() $$, 'a rejected organization resubmits');
select throws_ok(
  $$ select public.resubmit_verification() $$,
  '55000', 'ABR_NOT_RESUBMITTABLE',
  'resubmission works once (the profile is pending again)'
);
reset role;

select is(
  (select verification_status::text from public.profiles where id = 'dddddddd-0000-4000-8000-000000000002'),
  'pending',
  'resubmission sets the status back to pending'
);

-- Append-only, even for the owner ------------------------------------------------------------

select throws_ok(
  $$ update public.verification_reviews set reason = 'edited' $$,
  '42501', 'ABR_APPEND_ONLY',
  'review rows cannot be updated, even by the owner'
);
select throws_ok(
  $$ delete from public.verification_reviews $$,
  '42501', 'ABR_APPEND_ONLY',
  'review rows cannot be deleted, even by the owner'
);
select throws_ok(
  $$ update public.audit_events set action = 'edited' $$,
  '42501', 'ABR_APPEND_ONLY',
  'audit events cannot be updated, even by the owner'
);
select throws_ok(
  $$ delete from public.audit_events $$,
  '42501', 'ABR_APPEND_ONLY',
  'audit events cannot be deleted, even by the owner'
);
select throws_ok(
  $$ truncate public.audit_events $$,
  '42501', 'ABR_APPEND_ONLY',
  'the audit log cannot be truncated, even by the owner'
);

select * from finish();

rollback;
