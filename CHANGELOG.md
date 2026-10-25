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

- Landing polish (SCRUM-31): build notice moved to a slim bar above the header on every route; tighter
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

- The account action is called "Create an account" everywhere (was "Sign up") (SCRUM-31).
- Error and info status colours are one shade darker (#B91C1C, #1D4ED8) to meet WCAG AA; the
  guidelines' values measure 3.95:1 and 4.24:1. Pending brand sign-off (D-14) (SCRUM-31).
- The Supabase client and env validation load on demand, off the critical path (SCRUM-31).

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
