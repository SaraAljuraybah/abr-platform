# CLAUDE.md — ABR platform

Rules and conventions every session in this repository must follow. The source of truth for
product scope is the ABR Product & Technology Plan v2.0 (internal, never committed). This file
condenses what is needed to work safely in the code.

**Threat model (Plan §15).** Assume an authenticated user with the public key, our full frontend
source code and a REST client, calling every endpoint directly with crafted inputs. Every control
must hold under that assumption.

## Non-negotiable rules

1. **The server is the boundary.** Authorization lives in PostgreSQL (RLS, `SECURITY DEFINER` RPCs
   with `search_path = ''`), never in the UI. Route guards are UX only.
2. **Every new table** enables RLS **and** runs `revoke all on <table> from anon, authenticated` in
   the same migration, then grants only the needed privileges and editable columns. A column-level
   `REVOKE` alone does nothing while a table-level grant exists. Read
   [docs/decisions/0011-column-grants.md](docs/decisions/0011-column-grants.md) before writing any migration.
3. **Status, role, verification, ownership and recipient fields are never written from the client.**
   Recipients are derived server-side from the referenced project, position or profile.
4. **Every RPC gets negative pgTAP tests before its UI is built.**
5. **Logical CSS only:** `ms-* me-* ps-* pe-* start-* end-* rounded-s/e border-s/e text-start/end`.
   Never `ml- mr- pl- pr- left- right-` (lint rule `abr/no-physical-direction-classes`).
6. **All user-facing text lives in `src/locales/{en,ar}.json`.** No hard-coded copy. Keys must match
   in both files (a unit test fails otherwise).
7. **Schema changes only via migrations** (`supabase migration new <name>`). Never edit a shared
   environment from the dashboard. Never edit an applied migration; migrations are forward-only.
8. **Never put a secret or service-role key** in any `VITE_*` variable, in the repository, or in the
   browser. `npm run check:secrets` and CI enforce this.
9. **A story is done only when the [Definition of Done](docs/definition-of-done.md) is met**, not when
   the screen renders.

## Database rules

- **Migration template** (one table):

  ```sql
  create table public.example (...);
  alter table public.example enable row level security;
  revoke all on public.example from anon, authenticated;
  grant select on public.example to authenticated;
  grant update (title, summary) on public.example to authenticated;   -- editable columns only
  create policy example_select on public.example for select to authenticated using (...);
  create policy example_update on public.example for update to authenticated using (...) with check (...);
  -- Sensitive columns also get a BEFORE UPDATE guard trigger (belt and braces).
  ```

- **Every function:** `set search_path = ''`, fully qualified names (`public.projects`,
  `pg_catalog.now()`), and `revoke all on function … from public, anon, authenticated` before granting
  `execute` to exactly the roles that need it. Explicit `auth.uid()` and role checks at the top;
  `select … for update` for state transitions.
- **Internal and trigger functions live in schema `private`**, which is never exposed through the
  Data API (do not add it to `[api] schemas` in `supabase/config.toml`). anon/authenticated never get
  `USAGE` on it.
- Name the role helper **`current_app_role()`**, never `current_role()` (`CURRENT_ROLE` is a reserved
  SQL keyword). Other helpers: `is_admin()`, `is_verified()` (`stable security definer`, fixed search_path).
- **Sign-up trigger** (`handle_new_user()`): takes `student` / `organization` / `mentor` from user
  metadata only. **Admin comes only from `raw_app_meta_data.abr_role`**, which only a secret key can
  set. Never trust user metadata for admin.
- **`get_connection_contact()`** must log denied attempts and **return an empty result instead of
  raising**, because a raised exception rolls back the audit insert.
- Row creation goes through triggers or `SECURITY DEFINER` RPCs; `authenticated` never gets table
  `INSERT`, `DELETE` or `TRUNCATE`.
- The schema guard `supabase/tests/database/000_schema_guard.test.sql` must keep passing. It checks RLS,
  `search_path`, `private` usage, anon/authenticated write privileges and definer `EXECUTE` grants.
- Seed data is synthetic, local/dev only. Never real personal data.

### Which mechanism (Plan §13)

| Mechanism                 | Use for                                                                  | Do not use for                                                      |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Direct table access + RLS | Lists, details, editing own profile fields or own draft                  | Anything changing status, role, verification or another user's data |
| RPC (Postgres function)   | Atomic multi-row changes: submit, review, request, respond, read contact | External services, long-running work                                |
| Edge Function             | Email, public endpoints needing abuse controls, service-role operations  | CRUD that RLS already covers                                        |

## Stack

React 19 · TypeScript (strict, `noUncheckedIndexedAccess`) · Vite 7 · Tailwind CSS 4 · shadcn/ui
(Radix) · Lucide icons (1.75 stroke) · React Router 7 · TanStack Query 5 · React Hook Form + Zod 4 ·
i18next · Supabase (Auth, Postgres, RLS, Storage, Edge Functions) · Vitest · pgTAP · Node 22 · npm.

## Commands

| Command                                                           | What it does                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                                                     | Dev server at http://127.0.0.1:5173 (needs `.env.local`)                     |
| `npm run ci`                                                      | Whole web pipeline: typecheck, lint, format check, tests, build, secret scan |
| `npm run typecheck` / `lint` / `format` / `format:check` / `test` | Individual steps                                                             |
| `npm run check:secrets`                                           | Scan `dist/` and the repo for secrets                                        |
| `npm run db:start` / `db:stop` / `db:reset`                       | Local Supabase stack (Docker)                                                |
| `npm run db:lint` / `db:test`                                     | `supabase db lint --level error` / pgTAP tests                               |
| `npm run db:types`                                                | Regenerate `src/types/database.ts`                                           |
| `supabase migration new <name>`                                   | New forward-only migration                                                   |

**Generated types:** commit `src/types/database.ts` after every schema change. CI regenerates it and
fails on drift. If Windows and Linux CLI output ever differ, **the CI-generated version wins**: copy it
from the failed job and commit it.

## Folder conventions

```
src/app/          providers and root component
src/components/   shared UI; components/ui = shadcn primitives; components/layout = shell
src/features/<f>/ a feature owns its components/, api.ts (typed query hooks), schemas.ts (Zod), types.ts
src/hooks/        cross-cutting hooks (useSession, useDirection)
src/lib/          supabase client, query client, i18n, env, utils (cn)
src/locales/      en.json, ar.json
src/pages/        route-level screens
src/routes/       router config and guards (UX only)
src/types/        generated database types, i18n typing
supabase/         config.toml, migrations/, functions/, tests/database/, seed.sql
docs/             definition-of-done.md, permissions.md, decisions/ (ADRs)
```

- Import with `@/…`. Components never call Supabase directly; go through typed query hooks.
- No `any` (lint error). Errors shown to users in plain language; technical detail logged, not shown.
- Every screen: loading, empty and error states; English LTR and Arabic RTL; keyboard accessible;
  360 px mobile to desktop.

## Brand and UI (Brand Guidelines v1.0, Plan §16)

- Primary buttons use **#7C3AED** (`bg-primary`), never Pink. Pink `#EC4899` is for gradients and large
  display only (under 5% of a layout); pink text uses `text-pink-text` (#BE185D).
- Inter (English) and Tajawal (Arabic), self-hosted. Arabic: one step larger, looser leading, no
  letter-spacing, italics or all-caps. Tajawal has no 600: semibold maps to 500 (UI) or 700 (headings).
- Never mirror, recolour or stretch the logo, including in RTL. Use files from `public/brand/` only.
- Visible 2px accent focus ring; respect `prefers-reduced-motion`; status never by colour alone.

## Git and workflow

- Jira project key: **SCRUM**.
- Two long-lived branches only. **`dev`**: all work is committed here directly. **`main`**:
  production. No feature, fix or db branches.
- Conventional Commits with the key: `feat(auth): student sign-up with university email (SCRUM-13)`.
  Small logical commits.
- Flow: commit to `dev` → the CTO reviews the running site → the CTO merges `dev` → `main` through a
  pull request (PR template, including its **Authorization impact** section) with **Create a merge
  commit**, never rebase or squash, so the two branches stay in sync. Claude never merges into `main`
  and never pushes to it.
- CI runs on push to `dev`, on pull requests to `main` and on push to `main`.
- Never force-push `dev` or `main`.
- Never run `git checkout`, `git restore` or `git stash` on a file with uncommitted work. Never
  discard uncommitted changes.
- Never commit `.env.local` or anything under `_context/` (confidential source documents).

## Tools

- Any tool needed more than once goes in `devDependencies` (pinned exact version) or is installed
  globally. Never install it into a scratchpad, so it never re-downloads each session.
- No Playwright or screenshot tooling. Lighthouse only when the CTO explicitly asks.
- Accessibility checks use `axe-core` through the Vitest suite (jsdom), in English and Arabic.

## Verification levels

Pick the level from the change, and state it in every report. **Never skip FULL for database, auth or
security work**, however small the change.

| Level        | Use for                                               | Required                                                                                     |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **QUICK**    | Copy, spacing, colours, small UI tweaks               | `npm run typecheck` + `npm run lint` + the related tests                                     |
| **STANDARD** | A new page or component                               | `npm run ci` + axe for that page in EN and AR                                                |
| **FULL**     | Migrations, RLS, RPCs, Edge Functions, auth, security | `npm run ci` + `supabase test db` + mutation check + live smoke test against the local stack |

- **Mutation check:** commit the work first (a WIP commit is fine), then temporarily break the
  control under test (for example, drop a policy condition or skip a role check), confirm the
  matching negative test fails, then restore it by re-applying the committed version (or with
  `git revert` if the mutant was committed) and confirm it passes again. Never push a mutant, and
  never discard uncommitted changes to restore.
- **Live smoke test:** exercise the change end to end against `npm run db:start` + `npm run dev`
  (or the Edge Function served locally) with real requests, including at least one request that
  must be refused.

## Reports

No screenshots in reports. Each report states:

1. The verification level used.
2. What changed (files and behaviour), and any deviation from the agreed plan with the reason.
3. Which pages to look at on the running site (routes, in EN and AR).
4. The `npm run ci` result.
5. For database, auth or security work: the `supabase test db` result (files and test count) and
   the mutation check (what was mutated, which test failed, and that it passes again).
