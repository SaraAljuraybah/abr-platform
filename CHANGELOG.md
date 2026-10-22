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
- Site header: sticky; section links on `/` (inline from `lg`, otherwise in an accessible mobile
  menu); compact header on other routes. Site footer with logo, links, language switch, © 2026 ABR.
- Per-language document title and meta description; static Open Graph tags; `robots.txt`.
- axe-core accessibility tests in both languages.

### Changed

- The account action is called "Create an account" everywhere (was "Sign up") (SCRUM-31).
- Error and info status colours are one shade darker (#B91C1C, #1D4ED8) to meet WCAG AA; the
  guidelines' values measure 3.95:1 and 4.24:1. Pending brand sign-off (D-14) (SCRUM-31).
- The Supabase client and env validation load on demand, off the critical path (SCRUM-31).

### Planned

- Branch protection on `main` (set manually in GitHub).
- Stylelint rule for physical CSS properties in stylesheets.
- i18next lint plugin to catch literal UI strings.
- `vercel.json` (SPA rewrites) and Vercel preview deployments.
- Playwright end-to-end tests (from Week 2).
- Dark mode (tokens proposed in Plan §16).
- Header logo switches to `abr-logo.svg` once the vector is supplied.
- SHA-pinned GitHub Actions (pre-pilot hardening).
- ESLint 10 upgrade (ESLint 9 is now end-of-life upstream).
- Review robots/indexing at public launch.
- Mobile Lighthouse Performance ≥ 90 (currently about 71 on the production build): prerender the
  public pages or reduce initial style and script work.
