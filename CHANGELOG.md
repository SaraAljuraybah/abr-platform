# Changelog

All notable changes to the ABR platform. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Entries are grouped per checkpoint (Plan v2.0 §17).

## [Unreleased] — Sprint 1, checkpoint 24 Oct 2026

### Added

- Repository foundation (SCRUM-11): Vite 7, React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui setup,
  React Router 7, TanStack Query 5, React Hook Form + Zod 4, i18next, Supabase JS 2.
- App shell: header with logo and language switch, home page, 404 page, placeholder routes
  `/sign-in`, `/sign-up`, `/onboarding`, `/app`, `/admin` behind UX-only guards
  (`RequireAuth`, `RequireOnboarding`, `RequireRole`).
- Bilingual foundation: English (default) and Arabic with RTL, persisted choice, key-parity test.
  i18next chosen as the i18n library (ADR-0012, to write).
- Brand tokens from the Brand Identity Guidelines v1.0 as CSS variables in the Tailwind theme;
  Inter and Tajawal self-hosted; visible focus ring; reduced-motion support.
- Brand assets: approved raster logo, A symbol (SVG favicon) and PNG favicons.
  **Vector logo is a redraw pending approval (D-13).**
- Zod environment validation at build time and runtime (publishable key only).
- Supabase project config: email confirmations, secure password change, 10-character passwords
  with lower/upper/digits; `private` schema never exposed. Empty seed; no migrations yet.
- pgTAP schema guard: RLS, `search_path`, `private` usage, anon/authenticated write privileges,
  definer `EXECUTE`.
- Quality tooling: ESLint 9 with an RTL physical-class rule, Prettier, Vitest + Testing Library,
  Node secret scanner, `npm run ci`.
- GitHub Actions CI (web and database jobs, including type drift), Dependabot, PR template.
- Docs: CLAUDE.md, Definition of Done, permissions matrix template, ADR index, ADR-0011.
- Landing page at `/` (SCRUM-31), English and Arabic: hero with an example project card, how it
  works, who it's for, trust & privacy, FAQ, final call to action. Signed-in visitors see
  "Go to dashboard" instead of the sign-in and create-account actions.
- Site header: sticky; section links on `/` (inline from `xl`, otherwise in an accessible mobile
  menu); compact header on other routes. Site footer with logo, links, language switch, © 2026 ABR.
- Per-language document title and meta description; static Open Graph tags; `robots.txt`.
- axe-core accessibility tests in both languages.
- Vector logo `public/brand/abr-logo.svg` in the header and footer (a redraw pending approval, D-13).
- `vercel.json` with an SPA rewrite to `/index.html`; static files are served first (SCRUM-31).
- Sign in at `/sign-in` (SCRUM-13), English and Arabic: email and password with Supabase Auth;
  one generic message for a wrong email or password; unconfirmed email with "Resend link";
  rate-limit and network messages; returns to a safe in-app `next` path, otherwise `/app`.
  Already signed-in visitors are redirected. `/forgot-password` placeholder.
- First shared UI-kit pieces, grown page by page (SCRUM-33): `TextField`, `PasswordField`,
  `Callout`, `Button` loading state, `AuthLayout`.
- One localized Zod error map (`src/lib/zod-i18n.ts`): schemas return i18n keys, fields translate
  them, so messages follow a language switch.
- Create an account at `/sign-up` (SCRUM-13), English and Arabic: role cards (Student,
  Organization, Mentor; pre-selected from `?role=`, anything else falls back to Student), numbered
  fields per role (01, 02, … badges), character counters on the name fields,
  a live password checklist matching the Supabase password policy, and the consent line with the
  privacy notice. Students pick an active university and are pre-checked with
  `check_student_email()` on blur and on submit; no sign-up request is sent for a mismatched
  email. Sign-up metadata matches the trigger exactly per role. Success, an existing email and a
  filled spam-trap field (labelled "Leave this field empty") all land on `/check-email` (email in
  router state only). Length errors name the limit ("Minimum length: 2 characters."). Rate-limit,
  network, weak-password and the trigger's generic refusal have their own messages. Landing
  audience cards link with `?role=`. Placeholders: `/request-access`, `/check-email`,
  `/auth/confirmed`.
- UI kit (SCRUM-33): `RadioCardGroup`/`RadioCard` (Radix), `SelectField`, `NumberedLabel`,
  `CharacterCount`; `TextField` and `SelectField` have a `details` slot below the field (used for
  "Can't find your university?").
- Identity schema (SCRUM-12), seven migrations:
  - shared enums (Plan §14), schema `private`, `updated_at` trigger, append-only `audit_events`
    (update, delete and truncate refused even for the owner) written only by `private.log_event()`;
  - `profiles` with a role/status CHECK, column grants for name, bio, avatar and onboarding only,
    and a guard trigger (`ABR_PROTECTED_COLUMN`) behind the grants; helpers `current_app_role()`,
    `is_admin()`, `is_verified()`; admin profiles are never visible to non-admins;
  - `universities`, `university_email_domains` (exact matching, D-05), `university_requests`, and
    `check_student_email()`, the only function anon can execute;
  - `student_profiles` (university never client-writable), `organization_profiles`,
    `mentor_profiles` with length, list and https-URL checks;
  - `private.contact_details` behind `get_my_contact()` / `update_my_contact()` (audited by field
    name, never value);
  - `verification_reviews` (append-only; subjects never see `reviewer_id`) with
    `review_verification()` and `resubmit_verification()`;
  - sign-up trigger: admin only from `app_metadata.abr_role`; students need an allowlisted domain
    of their university; organizations and mentors start pending. It is deferred to COMMIT
    because Supabase Auth sets `app_metadata` and confirms the email after inserting the user.
  - an eighth migration (SCRUM-13) saves a trimmed `organization_name` from sign-up metadata for
    organizations only; empty means NULL, and a name outside the column CHECK (2-150) refuses
    the sign-up instead of being truncated.
- pgTAP: sign-up (37), organization name (12), permissions (44) and verification (30) suites; the schema guard gains an
  anon allowlist (`check_student_email`) and a check that anon can execute nothing else in `public`.
- `scripts/provision-admin.mjs`: creates an admin with the secret key (from the environment only),
  verifies the profile and prints one single-use recovery link.
- Seed: three PLACEHOLDER universities and four domains pending D-05. No users.
- Docs: permissions matrix for every table and function; ADR-0011 note on default privileges.

- Forms system (SCRUM-34, epic SCRUM-30): every form lives at `/forms/<slug>`, lazy-loaded, in
  the shared `FormLayout` (the split layout, renamed from `AuthLayout`) with brand panel content
  per form. Shared pieces in `src/features/forms/`: `FormShell` (title, intro, fields, spam trap,
  focused error message, submit, consent line), `RoleCards`, `PrivacyLink`, `SpamTrap`,
  `SuccessScreen`, option helpers and Edge Function error mapping. Sign-up now uses them too.
  New UI pieces: `ChoiceGroup` (radio pills or a vertical list), `CheckboxGroup`, `CheckboxField`. An unknown slug
  is a 404.
- Interest form at `/forms/interest` (SCRUM-34), English and Arabic: role cards (pre-selected
  from `?role=`), numbered fields per role that renumber when the role or an "Other" choice
  changes, consent checkbox, success screen. No phone, student ID, national ID or region.
  Students choose from the form's own university list (public and private groups, a stable code,
  not `public.universities`, which stays sign-up's verified email-domain list), a tech-only field
  of study, a graduation year from "2027 or later" down to 2000 and one of five project stages
  (a vertical radio list). "Other" on university, field of study and "How did you hear about
  us?" reveals a required text field (follow-up migration `20261103165341_interest_form_options`:
  `university_code` replaces `university_id` and its foreign key, `region` is dropped, `channel`
  is renamed `heard_from`, and `field_of_study_other` and `heard_from_other` are added).
- `public.interest_signups` (no client access), `private.rate_limits`, and the RPCs
  `submit_interest()` and `consume_rate_limit()` (service role only) and `get_interest_stats()`
  (admin only) (SCRUM-34).
- Edge Function `submit-interest` (SCRUM-34): validation with the option lists shared with the
  frontend and the CHECK constraints (`supabase/functions/_shared/`), spam trap, 5 submissions per
  10 minutes per client address (HMAC, never stored raw), upsert by email with the same answer
  for new and repeat emails, CORS allowlist. Secrets: `INTEREST_IP_HASH_SECRET`,
  `ALLOWED_ORIGINS` (`supabase/functions/.env.example`).
- Request access (SCRUM-14) moves to `/forms/request-access` on the forms system; the sign-up
  "Can't find your university?" and "Request an exception" links point there (placeholder until
  SCRUM-14), and `/request-access` redirects to it (SCRUM-34).
- Interest form consent (SCRUM-34): the text now covers ABR's launch, news and updates and says
  the person can unsubscribe at any time. `interest_signups.consent_version` (not null, format
  `YYYY-MM-vN`, migration `20261103201124_interest_consent_version`) records which text was
  accepted; the current one is `2026-11-v2` (`INTEREST_CONSENT_VERSION` in
  `supabase/functions/_shared/interest-options.ts`), earlier rows are `2026-11-v1`. The function
  accepts only the current version; a resubmission refreshes `consent_at` and `consent_version`.
- Interest form university list (SCRUM-34): Naif Arab University for Security Sciences is removed
  (migration `20261103203037_interest_remove_naif`; any earlier answer becomes "Other" with the
  university's name).
- Privacy notice at `/privacy` (SCRUM-36), English and Arabic, in the site layout: what accounts,
  the interest form, contact details and security records store, why, who sees it, processors and
  location (Supabase in Frankfurt, Vercel; processing outside Saudi Arabia), retention, PDPL rights
  and the temporary contact try0abr@gmail.com. "Last updated" comes from one constant
  (`PRIVACY_LAST_UPDATED`); open points show only in development builds (see "Before public
  launch"). The footer and every form link to it; consent links now open `/privacy` in the same tab
  (was https://tryabr.com/privacy in a new tab). `/register` redirects to `/forms/interest`
  (`vercel.json` and the client router).
- Interest form universities across Saudi Arabia (SCRUM-34): 29 public and 14 private universities
  (migration `20261104121025_interest_universities_ksa`), existing codes unchanged. The form sorts
  each group alphabetically in the reader's language; the two groups and "Other (write it)" last
  stay.
- Phase 1 launch mode: build-time flag `VITE_AUTH_ENABLED` (`true` by default; `false` for
  production at tryabr.com, `true` for the dev preview). With `false`, `/sign-in`, `/sign-up` and
  `/forms/request-access` show a "Coming soon" page in the form layout (with links to the interest
  form and home), `/app`, `/onboarding` and `/admin` redirect to it, and the landing page has no
  account links: the header and mobile menu show "Register your interest", the hero and final
  band show "Register your interest" and "How it works", the audience cards link to
  `/forms/interest?role=…`, and the FAQ on unlisted universities points to "Other" in the interest
  form. UX only, not access control. Tests cover both values. `/forgot-password`, `/check-email`
  and `/auth/confirmed` also show "Coming soon" in this mode (SCRUM-36).
- Projects (SCRUM-18, migration `20261105223146_projects`): tables `projects` and
  `project_members` (one owner per project). Clients read with RLS and update only `title`,
  `summary`, `description`, `track`, `sectors` and `academic_year`; `status`, `owner_id`,
  `university_id`, `submitted_at` and `published_at` have no grant and a guard trigger. The owner
  edits only while verified and while the project is `draft` or `changes_requested`. Published
  projects are visible to verified users while the owner is verified (D-15). RPCs
  `create_project(title)` (verified, onboarded students; one project per student in V1,
  `ABR_PROJECT_LIMIT`; university set server-side) and `delete_project(id)` (owner, draft only),
  both audited. pgTAP `070_projects`.
- Project pages (SCRUM-18), English and Arabic, students only: `/app/projects/new` (a title, then
  "Create draft"; a student who has a project goes straight to it) and `/app/projects/:id/edit`
  (title, summary and description with counters, track, up to 5 sectors, academic year; explicit
  Save with a "Saved" indicator; unsaved-changes warning on leave; "Delete draft" behind a
  confirmation dialog; read-only outside draft and changes requested). The dashboard's "What's
  next" continues the draft and "Your projects" lists it with its status. New shared `Dialog`
  component (Radix).

- Sign-up consents (SCRUM-38, migration `20261106080425_signup_consent_and_phone`): `/sign-up`
  has two required checkboxes, "I agree to the Terms and Conditions." and "I agree to the Privacy
  Policy.", whose links open `/terms` and `/privacy` in a new tab. The form sends
  `terms_version` and `privacy_version` (`src/features/legal/versions.ts`), and the sign-up
  trigger refuses a student, organization or mentor account unless both equal
  `private.current_legal_versions()` (`ABR_CONSENT_REQUIRED`). The versions and acceptance times
  are stored on `profiles` (never client-writable) and audited as `user.consented`. Admins,
  provisioned with the secret key, are exempt. Current versions: `2026-11-v1` for both.
- Terms and Conditions at `/terms` (SCRUM-38), English and Arabic, in the site layout and public
  in both launch modes; footer link "Terms". Draft pending legal review (see "Before public
  launch").
- Student mobile number (SCRUM-38): onboarding step 1 asks for a Saudi mobile number (05XXXXXXXX
  or +9665XXXXXXXX, saved as +9665XXXXXXXX) and whether to share it with organizations after
  accepting their request (off by default). It is saved through `update_my_contact` into
  `private.contact_details`, and completing student onboarding requires it
  (`ABR_ONBOARDING_INCOMPLETE`). A student who passed step 1 before this resumes there.

- Project details, team, needs, image, document and links (SCRUM-27 with SCRUM-18, migration
  `20261106090424_project_details_and_media`): new owner-editable columns `stage`, `team_size`
  (1–10), `looking_for_members`, `wanted_specializations` (only while looking for members),
  `needs`, `image_path`, `document_path` (inside the project's own folder), `video_url`
  (YouTube, Vimeo, Loom), `repo_url` (GitHub, GitLab) and `demo_url` (https). Private buckets
  `project-images` (JPG/PNG/WebP, 2 MB) and `project-documents` (PDF, 10 MB), created by the
  migration. `storage.objects` policies: read follows `projects_select` (owner, admin, or
  published with a verified viewer and a verified owner, D-15); write needs the project's
  verified owner, an editable status and a well-formed name in the project's folder. Files are
  served through 5-minute signed URLs. pgTAP `090_project_details_and_media`.
- The project edit page in five sections (Basics, Stage & team, Needs, Media, Links) with one
  Save; uploads save at once, with progress and clear errors. Images are re-encoded in the
  browser (WebP, or JPEG), which removes EXIF data such as GPS location, and scaled to at most
  1600 px; documents keep their original name as object metadata. Replacing a file removes the
  old one; deleting a draft clears the paths, removes the folder's files, then deletes the
  project. A branded default image (gradient, track icon, first letter) when none is uploaded;
  the dashboard shows it next to the title. The privacy policy lists project data.

- Submit a project for review (SCRUM-18, page 8, migration `20261107104206_project_submission`):
  `submit_project(id)` for the verified owner, from draft or changes requested, once title,
  summary, a description of at least 100 characters, track, academic year and stage are set
  (`ABR_PROJECT_INCOMPLETE: <fields>` otherwise); it sets `pending_review` and `submitted_at`.
  `withdraw_submission(id)` takes a pending project back to a draft. Both lock the row, are
  audited, and give other users the same not-found answer. Append-only `project_reviews`
  (owner and admins read it, without `reviewer_id`; no client writes). pgTAP
  `100_project_submission`.
- The edit page ends with "Submit for review": a checklist of what is still missing (each item
  focuses its field), then a confirmation; open changes are saved first. Status banners: under
  review (read-only, "Withdraw submission"), changes requested (the latest notes, editable,
  "Resubmit for review"), rejected (the reason), published and unpublished (read-only). The
  dashboard's "What's next" has its own message and action for every status.

- Admin review of projects (SCRUM-19, migrations `20261107112729_project_review` and
  `20261107115036_admin_reviewer_fallback`): `review_project(id, decision, notes)` for admins
  only; notes required to request changes or reject. It locks the project and re-checks
  `pending_review`, so a withdraw racing a decision can never publish a draft (`ABR_NOT_PENDING`).
  Approving publishes (`published_at`); the review row and a `project.reviewed` audit event are
  written in the same transaction. `admin_project_reviews(id)` gives admins the history with the
  reviewer's name (or contact email); `admin_project_counts()` the projects per status. pgTAP
  `110_project_review`.
- Admin area at `/admin` (admins only; `/app` sends admins there, and the shell shows "Admin"):
  Overview (projects per status, pending highlighted; total interest sign-ups), Project reviews
  (the pending queue, oldest first, with image, student, university, track and date; a filter
  for the other outcomes), the review page (everything the student entered, the review history,
  and Approve and publish / Request changes / Reject behind confirmations), and Interest (the
  interest-form counts per dimension as tables with bars; counts only).

### Handoff to SCRUM-13 (sign-up UI)

- The client must call `check_student_email(university_id, email)` before signing a student up.
  When the sign-up trigger refuses, Supabase Auth returns only a generic "Database error saving new
  user" (HTTP 500), so the `ABR_*` reason never reaches the client.
- A sign-up Edge Function that returns specific errors is a possible later improvement.
- Sign-up metadata: `role` (`student` | `organization` | `mentor`), `university_id` (students),
  `organization_name` (organizations, SCRUM-13) and optional `full_name`.
- `[auth.sms] enable_confirmations` must stay `true` (SCRUM-13): with SMS or email autoconfirm on,
  Supabase Auth answers a sign-up for an existing confirmed email with `422 user_already_exists`
  instead of the obfuscated success, which enumerates accounts. The hosted project needs the same
  setting.

- Landing polish (SCRUM-31): tighter
  hero with a richer example card (summary, team row, avatars, an "accepted" toast over the card's
  bottom edge at the end side); eyebrow and one-line intro on every section with a lighter rhythm and
  alternating backgrounds; step icons and "Contact private" / "Contact shared" badges; role-specific
  join links (`/sign-up?role=student|organization|mentor`); trust items as cards; two-column FAQ with
  a sticky intro; deep-gradient final call to action; footer descriptor.
- Landing layout (SCRUM-31):
  - Three-part header from 1280 px (`xl`): logo at the start, section links truly centred
    (`grid-cols-[1fr_auto_1fr]`, the nav as a subgrid), actions at the end; menu below `xl`. From
    `xl` the header row is 1280 px wide, wider than the content, because the widest action group
    (Arabic, signed out: 313 px) needs 1136 px for true centring and the 1120 px content leaves
    1040 px. Measured centring offset: 0 px in EN/AR, signed out and in, at 1280 and 1920 px.
  - Hero and final band as inset panels (16 / 24 / 32 px from the viewport, 28 px corners).
  - Shared page container: 1120 px max, 24 px gutters (40 px from `lg`); 40 px below section headers.
  - Centred section headers for How it works and Trust; Who it's for and FAQ stay start-aligned.
  - Quieter eyebrows: 14 px, uppercase with +0.08em tracking in English; normal case, no tracking in
    Arabic.
  - Hero title about 10% smaller (27 / 36 px; Arabic 36 px); English h1–h3 at −0.02em tracking,
    Arabic at 0.

### Changed

- Arabic copy names the platform «عَبْر» instead of "ABR" in all 11 strings (app name, home link,
  page title and description, copyright, hero subtitle, audience and trust cards, FAQ, sign-in).
  English keeps "ABR"; the logo is unchanged (SCRUM-36).
- The account action is called "Create an account" everywhere (was "Sign up") (SCRUM-31).
- Error and info status colours are one shade darker (#B91C1C, #1D4ED8) to meet WCAG AA; the
  guidelines' values measure 3.95:1 and 4.24:1. Pending brand sign-off (D-14) (SCRUM-31).
- The Supabase client and env validation load on demand, off the critical path (SCRUM-31).
- `[auth.sms] enable_confirmations = true` (was `false`; SMS sign-up stays disabled) (SCRUM-13).
- Tests wait up to 5 s for lazy routes (`asyncUtilTimeout`); jsdom gets a `ResizeObserver` stub
  for Radix (SCRUM-13).
- Sign-in shows "Something went wrong" for a server error (any 5xx), not "We couldn't reach the
  server". supabase-js raises both as `AuthRetryableFetchError`; only status 0 is a network failure
  (SCRUM-13).
- Auth pages (sign-in, sign-up) use a split layout from 1024 px: an inset hero-gradient brand panel
  at the start (45%, sticky at full height, 24 px from the viewport, 28 px corners) with the reverse
  logo, the hero statement, three trust points and a faint "A" watermark; the form column at the
  end (55%, form 480 px, vertically centred, no card) with "Back to home" and the language switch.
  Mirrors in RTL. Panel text measures at least 7.14:1 on the rendered gradient. Below 1024 px: logo,
  then the form in a card (560 px max, full width with 16 px margins, 24 / 40 px padding). The auth
  title is smaller than the landing h1 (30 px EN / 32 px AR desktop, 26 / 28 px mobile) so it fits
  on one line (SCRUM-13).
- `public/brand/abr-logo-reverse.svg`: the logo with a white "BR" and a brighter "A" for dark
  backgrounds (SCRUM-13).
- Dependabot (npm) no longer opens semver-major updates; majors are a separate maintenance story
  after Sprint 1. `@types/node` majors stay ignored permanently to match the Node 22 runtime.
  Weekly grouped minor/patch updates and GitHub Actions updates are unchanged (SCRUM-11).
- CI Database job no longer pulls Supabase images anonymously from `public.ecr.aws`, whose shared
  rate limit ("toomanyrequests") failed runs unrelated to our code (SCRUM-11). It logs in to GHCR
  with `GITHUB_TOKEN` (`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`), caches the images listed in
  `.github/supabase-images.txt` (key: runner OS, CLI version, list hash; saved on a miss from pushes
  to `dev` and `main`), fails if Docker has a Supabase image the list lacks, retries
  `db start`, `test db` and `gen types` up to 3 times (`scripts/ci/retry.sh`, waits 30 s then
  90 s, a rate limit is reported as not a code problem) and ends with a
  `registry pulls this run: N (cache hit|miss)` notice. Both jobs run on `ubuntu-24.04` (pinned
  before `ubuntu-latest` moves to Ubuntu 26 on 19 Oct 2026); the Database job timeout is 30 min.

- `/privacy` is titled "Privacy Policy" / «سياسة الخصوصية» (heading, browser tab and footer link),
  matching the sign-up checkbox, and states the consent records and the students' mobile number.
  `PRIVACY_LAST_UPDATED` is `2026-11-06` (SCRUM-38).

### Removed

- The "Internal build. Only the platform foundation is available." notice, from every route
  (landing, auth pages, app shell), with its component and locale key (SCRUM-13).
- The "01—04" progress label above the sign-up fields and its screen-reader text; the per-field
  number badges stay (SCRUM-13).

### Hosted settings to verify

Hosted development project **abr-dev** linked on 2026-11-03: all ten migrations pushed
(`supabase migration list`: local and remote match), auth settings pushed with `supabase config
push` (`[remotes.abr-dev]` in `config.toml`), `submit-interest` deployed (`verify_jwt = false`),
placeholder universities seeded (no users).

- Done: auth settings on abr-dev. Email confirmations on, phone sign-up off with SMS confirmations
  on, secure password change on, passwords of 10+ characters with lower, upper and digits, site URL
  `https://abr-platform.vercel.app`, redirect URLs for production, the `dev` preview and local
  (`127.0.0.1` and `localhost` on 5173). Hosted email OTP length (8), email send interval (1 min),
  TOTP MFA (on) and storage vector (off) keep their previous hosted values.
- Done: default privileges (ADR-0011 note). Hosted grants ALL by default; the migrations' explicit
  revokes hold (client roles have `SELECT` only, `anon` executes only `check_student_email`).
- Open: second sign-up without enumeration (SCRUM-13). Settings are in place (email and SMS
  confirmations on, so no autoconfirm). Behaviour check: sign up twice with a confirmed email; the
  second answer must be HTTP 200 with no identities. Needs a real, confirmed account, so it is left
  to the CTO.
- Verified 2026-11-03: `submit-interest` client address on abr-dev (SCRUM-34). A request that sends
  its own `cf-connecting-ip` is refused by Cloudflare at the edge (HTTP 403, "error code: 1000")
  and never reaches the function, so that header cannot be spoofed. Six requests with a different
  spoofed `x-forwarded-for` and `x-real-ip` each: 400, 400, 400, 400, 400, then 429;
  `private.rate_limits` held one key (64-hex HMAC) with five attempts. No change to
  `client-ip.ts` needed.
- Verified 2026-11-03: `submit-interest` secrets set by the CTO (SCRUM-34); the function refuses to
  run with a missing, blank or under-32-character `INTEREST_IP_HASH_SECRET` (generic 500, logged
  as `misconfigured: IP hash secret`). A valid submission from the production origin returned 200
  and saved one row. All test rows (`interest_signups`, `private.rate_limits`) were deleted
  afterwards; both tables are empty.
- Open: Vercel environment variable `VITE_AUTH_ENABLED`: `false` for Production (tryabr.com),
  `true` for Preview (the `dev` preview). Build-time, so a change needs a redeploy.
- abr-prod (`atckrssxksvurzlxxnhj`, Frankfurt), 2026-11-04: all 12 migrations pushed by the CTO
  (local and remote match); `submit-interest` deployed with its own secrets
  (`INTEREST_IP_HASH_SECRET` differs from dev; `ALLOWED_ORIGINS` = tryabr.com and the Vercel
  production URL). Spoof check over HTTPS verified: one valid submission (200), then four more
  with different spoofed `x-forwarded-for` (400 ×4) and a sixth refused (429); a spoofed
  `cf-connecting-ip` is refused by Cloudflare (403, error 1000); another origin gets 403. No
  universities seeded (sign-up is off). Open on abr-prod: delete the test rows, default-privilege
  query and auth settings in the dashboard (CTO).
- abr-dev, 2026-11-04: migrations `20261103201124` and `20261103203037` pushed (12 = 12) and
  `submit-interest` redeployed; a valid submission stores `consent_version` `2026-11-v2`; test row
  deleted.

### Before public launch

Open points in the privacy notice (`/privacy`). Development builds show them on the page; production
builds hide them, so they are tracked here:

- Legal review of the whole notice.
- The company's legal name as the responsible party.
- Legal review: the "18 or over" statement and minors.
- Legal review: the reply time for privacy requests ("as soon as we can, within the time the PDPL
  requires").
- Legal review: retention of the security log and review records.
- Set `PRIVACY_LAST_UPDATED` (`src/features/privacy/notice.ts`) to the launch date; it is
  `2026-11-06` (the SCRUM-38 commit date) until the CTO gives the date.

Open points in the Terms and Conditions (`/terms`), shown only in development builds:

- Legal review of the whole text.
- The company's legal name and commercial registration number.
- Legal review: the 18+ rule and students under 18.
- Legal review: university rules on ownership of graduation projects.
- Legal review: the scope of the display licence.
- Legal review: limitation of liability and any cap.
- Legal review: notice period before changes apply.
- Legal review: governing law and competent courts (city).
- Set `TERMS_LAST_UPDATED` (`src/features/terms/terms.ts`) and `PRIVACY_LAST_UPDATED` to the
  launch date; both are `2026-11-06` for now. A text change that needs new consent also bumps
  the version in `src/features/legal/versions.ts` and in a new migration replacing
  `private.current_legal_versions()`.

### CTO decisions (2026-11-03)

- Interest consent text v2 (launch, news and updates; unsubscribe at any time), stored per row as
  `consent_version` `2026-11-v2`; earlier rows are `2026-11-v1` (SCRUM-34).
- Arabic copy names the platform «عَبْر»; English keeps "ABR"; the logo is unchanged (SCRUM-36).
- Naif Arab University for Security Sciences is removed from the interest form (SCRUM-34).
- Production data is hosted by Supabase in Central EU (Frankfurt, `eu-central-1`), project
  abr-prod (SCRUM-36).
- Interest-form data is kept while consent is active and deleted when the person unsubscribes or
  asks; this replaces the open retention decision (SCRUM-34).
- Temporary privacy contact: try0abr@gmail.com, until a company address exists (SCRUM-36).
- In production the landing page links to `/forms/interest` (phase 1 launch mode, SCRUM-36).
- Phase 1: the interest form does not confirm email addresses (no double opt-in); revisit once
  SMTP is set up (SCRUM-37). Every marketing email must include an unsubscribe link and a "not
  you?" line (SCRUM-37).

### Pending brand sign-off

- Hero and final-band gradient: the approved Deep stops with the pink pushed from 108% to 160%, so
  the panels read purple with only a faint warm hint in the far corner (D-14). Worst-case text
  contrast on both panels, sampled from the rendered background at 360 / 768 / 1280 px in EN and AR:
  5.26:1 (hero subtitle); every other text run is higher.
- Error and info status colours one shade darker for WCAG AA (see Changed) (D-14).
- Second gradient surface (final call to action): a deliberate exception to "one gradient per view".
  The guideline forbids two gradients competing on one screen; on this page the hero and the band
  are never on screen together. Measured on the production build (gap = band top − hero bottom):
  1280 px wide: page 3093 / 3084 px, gap 2060 px (EN) / 2091 px (AR); 768 px: gap 2586 / 2601 px;
  360 px: gap 4088 / 4159 px. Both are visible at once only in a viewport taller than the gap
  (about 2060 px at desktop width).

### Planned

- Branch protection on `main` (set manually in GitHub).
- Stylelint rule for physical CSS properties in stylesheets.
- i18next lint plugin to catch literal UI strings.
- Vercel preview deployments.
- Playwright end-to-end tests (from Week 2).
- Dark mode (tokens proposed in Plan §16).
- SHA-pinned GitHub Actions (pre-pilot hardening).
- ESLint 10 upgrade (ESLint 9 is now end-of-life upstream).
- Review robots/indexing at public launch.
- Scroll to the hash after the first render when the page is opened directly at `/#section` (native
  anchors already work for in-page links).
- Mobile Lighthouse Performance ≥ 90 (currently about 71 on the production build): prerender the
  public pages or reduce initial style and script work.
- PDPL erasure process for append-only history (admin procedure). `audit_events` and
  `verification_reviews` keep plain user ids without foreign keys, so deleting an account does not
  delete or block on its history.
- Block or re-validate a student's auth email change to a domain that is not allowlisted.
- Admin RPCs: manage universities and domains, read `reviewer_id`.
- Unsubscribe link and mechanism required in every marketing email (SCRUM-37).
- Organization and mentor onboarding (later) must also require a phone number.
- Email the student when their project is approved, needs changes or is rejected (depends on
  SCRUM-37 SMTP).
- Clean up orphaned project files: an old file whose removal failed after a replace, and the
  folders of deleted accounts (scheduled job with the secret key; files are private and
  unreachable meanwhile).
