-- SCRUM-21: organization → project requests, connections, the contact door and notifications.
-- Negative paths first: who may send, respond, withdraw and read contact, and that no client role
-- writes any of the three tables directly. Acting as real users through request.jwt.claims.

begin;

select plan(62);

set constraints all immediate;

insert into public.universities (id, name_ar, name_en, active) values
  ('aaaaaaaa-0000-4000-8000-000000000151', 'جامعة الطلبات', 'Requests University', true);
insert into public.university_email_domains (university_id, domain) values
  ('aaaaaaaa-0000-4000-8000-000000000151', 'uni-req.test');

create function pg_temp.new_user(p_id uuid, p_email text, p_user_meta jsonb,
  p_app_meta jsonb default '{}'::jsonb)
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
    now(), p_app_meta, p_user_meta || (
      select jsonb_build_object('terms_version', v.terms_version, 'privacy_version', v.privacy_version)
      from private.current_legal_versions() v
    ), now(), now()
  );
  return p_id;
end;
$$;

create function pg_temp.act_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.project(p_id uuid, p_owner uuid, p_title text, p_status public.project_status)
returns uuid
language plpgsql
as $$
begin
  with new_project as (
    insert into public.projects (id, owner_id, title, status, university_id, published_at)
    values (p_id, p_owner, p_title, p_status, 'aaaaaaaa-0000-4000-8000-000000000151',
            case when p_status = 'published' then now() end)
    returning id
  )
  insert into public.project_members (project_id, user_id, member_role)
  select np.id, p_owner, 'owner' from new_project np;
  return p_id;
end;
$$;

-- S1, S2 verified students (owners); O1, O3 verified organizations; O2 pending organization;
-- M1 verified mentor.
select pg_temp.new_user('ffffffff-0000-4000-8000-000000000151', 's1@uni-req.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000151", "full_name": "Student One"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-000000000152', 's2@uni-req.test',
  '{"role": "student", "university_id": "aaaaaaaa-0000-4000-8000-000000000151", "full_name": "Student Two"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-000000000153', 'o1@org-req.test',
  '{"role": "organization", "full_name": "Org Person One", "organization_name": "Org One"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-000000000154', 'o2@org-req.test',
  '{"role": "organization", "full_name": "Org Person Two", "organization_name": "Org Two"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-000000000155', 'o3@org-req.test',
  '{"role": "organization", "full_name": "Org Person Three", "organization_name": "Org Three"}');
select pg_temp.new_user('ffffffff-0000-4000-8000-000000000156', 'm1@mentor-req.test',
  '{"role": "mentor", "full_name": "Mentor One"}');
update public.profiles set verification_status = 'verified'
  where id in ('ffffffff-0000-4000-8000-000000000153', 'ffffffff-0000-4000-8000-000000000155',
               'ffffffff-0000-4000-8000-000000000156');
update public.profiles set verification_status = 'pending'
  where id = 'ffffffff-0000-4000-8000-000000000154';

-- S1 shares the phone, not LinkedIn; O1 shares nothing.
update private.contact_details
  set phone = '+966500000151', share_phone = true,
      linkedin_url = 'https://linkedin.com/in/student-one', share_linkedin = false
  where user_id = 'ffffffff-0000-4000-8000-000000000151';
update private.contact_details set phone = '+966500000153', share_phone = false
  where user_id = 'ffffffff-0000-4000-8000-000000000153';

-- P1 published (S1), P2 draft (S1), P3 published (S2), P4 published (S2), P5 published (S2).
select pg_temp.project('dddddddd-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000151',
  'Published One', 'published');
select pg_temp.project('dddddddd-0000-4000-8000-000000000002', 'ffffffff-0000-4000-8000-000000000151',
  'Draft Two', 'draft');
select pg_temp.project('dddddddd-0000-4000-8000-000000000003', 'ffffffff-0000-4000-8000-000000000152',
  'Published Three', 'published');
select pg_temp.project('dddddddd-0000-4000-8000-000000000004', 'ffffffff-0000-4000-8000-000000000152',
  'Published Four', 'published');
select pg_temp.project('dddddddd-0000-4000-8000-000000000005', 'ffffffff-0000-4000-8000-000000000152',
  'Published Five', 'published');

-- Who may send ------------------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'Hello there team') $$,
  '42501', null, 'anon cannot call send_org_project_request');
select throws_ok($$ select count(*) from public.requests $$, '42501', null,
  'anon cannot read requests');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000152');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'Hello there team') $$,
  '42501', 'ABR_NOT_ORGANIZATION', 'a student cannot send an organization request');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000156');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'Hello there team') $$,
  '42501', 'ABR_NOT_ORGANIZATION', 'a mentor cannot send an organization request');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000154');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'Hello there team') $$,
  '42501', 'ABR_NOT_VERIFIED', 'a pending organization cannot send');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000153');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000002', 'Hello there team') $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'a draft project cannot receive requests');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-0000000000ff', 'Hello there team') $$,
  'P0002', 'ABR_PROJECT_NOT_FOUND', 'a missing project cannot receive requests');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', '  short  ') $$,
  '22023', 'ABR_INVALID_MESSAGE', 'a message under 10 characters is refused');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', repeat('x', 1001)) $$,
  '22023', 'ABR_INVALID_MESSAGE', 'a message over 1000 characters is refused');

-- Direct writes are impossible.
select throws_ok(
  $$ insert into public.requests (type, sender_id, recipient_id, project_id, message)
     values ('org_project_request', 'ffffffff-0000-4000-8000-000000000153',
             'ffffffff-0000-4000-8000-000000000151', 'dddddddd-0000-4000-8000-000000000001',
             'Direct insert attempt') $$,
  '42501', null, 'an organization cannot insert a request directly');

select lives_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001',
       '  We would love to support your project.  ') $$,
  'a verified organization sends a request for a published project');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'A second one please') $$,
  '23505', 'ABR_REQUEST_PENDING', 'a second pending request for the same project is refused');
select throws_ok(
  $$ update public.requests set status = 'accepted' $$,
  '42501', null, 'the sender cannot change a request status directly');
select is((select count(*)::int from public.requests), 1, 'the sender sees its request');
reset role;

select results_eq(
  $$ select recipient_id::text, status::text, message, expires_at > now() + interval '29 days'
     from public.requests where sender_id = 'ffffffff-0000-4000-8000-000000000153' $$,
  $$ values ('ffffffff-0000-4000-8000-000000000151', 'pending', 'We would love to support your project.', true) $$,
  'the recipient is the project owner, the message is trimmed and it expires in 30 days');
select results_eq(
  $$ select type, payload ->> 'project_title', payload ->> 'counterpart_name'
     from public.notifications where recipient_id = 'ffffffff-0000-4000-8000-000000000151' $$,
  $$ values ('request_received', 'Published One', 'Org One') $$,
  'the owner is notified with the project title and the organization name');

-- Visibility ---------------------------------------------------------------------------------------

select set_config('abr_test.req1',
  (select id::text from public.requests where sender_id = 'ffffffff-0000-4000-8000-000000000153'), false);

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000151');
select is((select count(*)::int from public.requests), 1, 'the recipient sees the request');
select throws_ok(
  $$ update public.notifications set read_at = now() $$, '42501', null,
  'the recipient cannot update notifications directly');
select throws_ok(
  $$ insert into public.connections (request_id, user_a, user_b, connection_type)
     select id, 'ffffffff-0000-4000-8000-000000000151', 'ffffffff-0000-4000-8000-000000000153',
            'organization_project' from public.requests $$,
  '42501', null, 'the recipient cannot create a connection directly');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000152');
select is((select count(*)::int from public.requests), 0, 'a third student sees no request');
select is((select count(*)::int from public.notifications), 0, 'a third student sees no notification');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000155');
select is((select count(*)::int from public.requests), 0, 'another organization sees no request');
reset role;

-- Who may respond ----------------------------------------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000152');
select throws_ok(
  format($$ select public.respond_to_request(%L, true) $$,
    current_setting('abr_test.req1')::uuid),
  'P0002', 'ABR_REQUEST_NOT_FOUND', 'a third party cannot respond');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000153');
select throws_ok(
  format($$ select public.respond_to_request(%L, true) $$,
    current_setting('abr_test.req1')::uuid),
  'P0002', 'ABR_REQUEST_NOT_FOUND', 'the sender cannot respond to its own request');
reset role;

-- Contact is closed while pending: there is no connection to read through.
select is((select count(*)::int from public.connections), 0, 'no connection while pending');

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000151');
select throws_ok(
  format($$ select public.respond_to_request(%L, true, 'Thanks') $$,
    current_setting('abr_test.req1')::uuid),
  '22023', 'ABR_INVALID_REASON', 'a reason is only for a decline');
select isnt(
  public.respond_to_request(
    current_setting('abr_test.req1')::uuid, true),
  null, 'the owner accepts and gets the connection id');
select throws_ok(
  format($$ select public.respond_to_request(%L, false) $$,
    current_setting('abr_test.req1')::uuid),
  '55000', 'ABR_REQUEST_NOT_PENDING', 'an answered request cannot be answered again');
reset role;

select set_config('abr_test.conn1', (select id::text from public.connections), false);
select results_eq(
  $$ select c.user_a::text, c.user_b::text, c.status, c.connection_type, c.project_id::text, r.status::text
     from public.connections c join public.requests r on r.id = c.request_id $$,
  $$ values ('ffffffff-0000-4000-8000-000000000151', 'ffffffff-0000-4000-8000-000000000153', 'active',
             'organization_project', 'dddddddd-0000-4000-8000-000000000001', 'accepted') $$,
  'one active connection in canonical order, and the request is accepted');
select is(
  (select type from public.notifications where recipient_id = 'ffffffff-0000-4000-8000-000000000153'),
  'request_accepted', 'the organization is notified of the acceptance');
select is(
  (select count(*)::int from public.audit_events where action = 'request.accepted'), 1,
  'the acceptance is audited');

-- The contact door ----------------------------------------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000153');
select results_eq(
  $$ select display_name, contact_email, phone, linkedin_url
     from public.get_connection_contact(current_setting('abr_test.conn1')::uuid) $$,
  $$ values ('Student One', 's1@uni-req.test', '+966500000151', null::text) $$,
  'the organization reads the student''s email and shared phone, not the unshared LinkedIn');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'Hello once more team') $$,
  '23505', 'ABR_ALREADY_CONNECTED', 'an organization already connected to the project cannot ask again');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000151');
select results_eq(
  $$ select display_name, contact_email, phone
     from public.get_connection_contact(current_setting('abr_test.conn1')::uuid) $$,
  $$ values ('Org One', 'o1@org-req.test', null::text) $$,
  'the student reads the organization''s email; its phone is not shared');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000152');
select is_empty(
  format($$ select * from public.get_connection_contact(%L) $$, current_setting('abr_test.conn1')::uuid),
  'a third party gets nothing from the contact door (and no error)');
select is_empty(
  $$ select * from public.get_connection_contact('eeeeeeee-0000-4000-8000-000000000000') $$,
  'a missing connection gives nothing');
reset role;

select is(
  (select count(*)::int from public.audit_events where action = 'connection.contact_viewed'), 2,
  'each contact retrieval is audited');
select results_eq(
  $$ select metadata ->> 'reason' from public.audit_events
     where action = 'connection.contact_denied' order by id $$,
  array['not_a_party', 'not_found'],
  'each refusal is audited with its reason (kept, because the door does not raise)');

-- Decline and cool-down ------------------------------------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000155');
select lives_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'Org Three would like to help') $$,
  'a second organization sends to the same project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000151');
select is(
  public.respond_to_request(
    (select id from public.requests where sender_id = 'ffffffff-0000-4000-8000-000000000155'),
    false, '  Not looking for sponsors right now  '),
  null, 'the owner declines with a reason; no connection id');
reset role;

select results_eq(
  $$ select status::text, decline_reason from public.requests
     where sender_id = 'ffffffff-0000-4000-8000-000000000155' $$,
  $$ values ('declined', 'Not looking for sponsors right now') $$,
  'the request is declined and the trimmed reason is kept for the sender');
select is((select count(*)::int from public.connections), 1, 'a decline creates no connection');
select is(
  (select type from public.notifications where recipient_id = 'ffffffff-0000-4000-8000-000000000155'),
  'request_declined', 'the organization is notified of the decline');

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000155');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000001', 'Please reconsider us') $$,
  '53400', 'ABR_REQUEST_COOLDOWN', 'after a decline the same organization waits 30 days');

-- Withdraw -----------------------------------------------------------------------------------------

select lives_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000003', 'Org Three for project three') $$,
  'the organization sends to another project');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000152');
select throws_ok(
  format($$ select public.withdraw_request(%L) $$,
    (select id from public.requests where project_id = 'dddddddd-0000-4000-8000-000000000003')),
  'P0002', 'ABR_REQUEST_NOT_FOUND', 'the recipient cannot withdraw');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000155');
select lives_ok(
  format($$ select public.withdraw_request(%L) $$,
    (select id from public.requests where project_id = 'dddddddd-0000-4000-8000-000000000003')),
  'the sender withdraws a pending request');
select throws_ok(
  format($$ select public.withdraw_request(%L) $$,
    (select id from public.requests where project_id = 'dddddddd-0000-4000-8000-000000000003')),
  '55000', 'ABR_REQUEST_NOT_PENDING', 'a withdrawn request cannot be withdrawn again');
select lives_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000003', 'Org Three, second try') $$,
  'after a withdrawal the organization may send again');
reset role;

-- System cancellation: unpublish -----------------------------------------------------------------

update public.projects set status = 'unpublished' where id = 'dddddddd-0000-4000-8000-000000000003';
select results_eq(
  $$ select status::text from public.requests
     where project_id = 'dddddddd-0000-4000-8000-000000000003' order by created_at, status $$,
  $$ values ('cancelled'), ('withdrawn') $$,
  'unpublishing a project cancels its pending request');
select is(
  (select count(*)::int from public.notifications
   where recipient_id = 'ffffffff-0000-4000-8000-000000000155' and type = 'request_cancelled'),
  1, 'the sender is told the request was cancelled');

-- Expiry ---------------------------------------------------------------------------------------------

insert into public.requests (id, type, sender_id, recipient_id, project_id, message, created_at, expires_at)
values ('eeeeeeee-0000-4000-8000-000000000151', 'org_project_request',
        'ffffffff-0000-4000-8000-000000000153', 'ffffffff-0000-4000-8000-000000000152',
        'dddddddd-0000-4000-8000-000000000004', 'An old request here',
        now() - interval '31 days', now() - interval '1 day');

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000152');
select throws_ok(
  $$ select public.respond_to_request('eeeeeeee-0000-4000-8000-000000000151', true) $$,
  '55000', 'ABR_REQUEST_EXPIRED', 'an expired request cannot be accepted');
reset role;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000153');
select lives_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000004', 'A fresh request now') $$,
  'once the old one expired the organization may send again');
reset role;
select is(
  (select status::text from public.requests where id = 'eeeeeeee-0000-4000-8000-000000000151'),
  'expired', 'the old pending request is marked expired');

-- Rate limit -------------------------------------------------------------------------------------

insert into public.requests (type, sender_id, recipient_id, project_id, message, status, responded_at)
select 'org_project_request', 'ffffffff-0000-4000-8000-000000000155',
       'ffffffff-0000-4000-8000-000000000152', 'dddddddd-0000-4000-8000-000000000004',
       'Filler request ' || g, 'withdrawn', now()
from generate_series(1, 17) g;
select pg_temp.act_as('ffffffff-0000-4000-8000-000000000155');
select throws_ok(
  $$ select public.send_org_project_request('dddddddd-0000-4000-8000-000000000005', 'Twenty first today') $$,
  '53400', 'ABR_RATE_LIMITED', 'an organization sends at most 20 requests a day');
reset role;

-- Notifications: read ---------------------------------------------------------------------------

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000152');
select is(
  public.mark_notifications_read(
    array(select n.id from public.notifications n)
    || array['00000000-0000-4000-8000-000000000000'::uuid]),
  3, 'a student marks only their own notifications read');
reset role;
select pg_temp.act_as('ffffffff-0000-4000-8000-000000000151');
select is(public.mark_notifications_read(), 2, 'mark all read covers the caller''s unread ones');
select is((select count(*)::int from public.notifications where read_at is null), 0,
  'nothing unread is left for the caller');
reset role;
select ok(
  (select count(*) from public.notifications where read_at is null) > 0,
  'other users'' notifications stay unread');
select is_empty(
  $$ select id from public.notifications
     where payload::text ~ '@|\+966|linkedin'
        or exists (select 1 from jsonb_object_keys(payload) k
                   where k not in ('project_id', 'project_title', 'counterpart_name')) $$,
  'no notification payload holds contact data');

-- Suspension ---------------------------------------------------------------------------------------

update public.profiles set verification_status = 'suspended'
  where id = 'ffffffff-0000-4000-8000-000000000153';
select is(
  (select status::text from public.requests
   where sender_id = 'ffffffff-0000-4000-8000-000000000153'
     and project_id = 'dddddddd-0000-4000-8000-000000000004' and id <> 'eeeeeeee-0000-4000-8000-000000000151'),
  'cancelled', 'suspending an organization cancels its pending requests');

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000151');
select is_empty(
  format($$ select * from public.get_connection_contact(%L) $$, current_setting('abr_test.conn1')::uuid),
  'contact closes while the counterpart is suspended');
reset role;

select * from finish();
rollback;
