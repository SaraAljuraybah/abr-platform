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
