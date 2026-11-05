# ADR-0013: Profiles are visible only between verified users

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** CTO (decision D-15)
- **Related:** [ADR-0011](0011-column-grants.md); Plan v2.0 §15 (threat model);
  migration `20261105101620_profiles_visible_between_verified.sql`; pgTAP
  `060_profile_visibility.test.sql`; [permissions.md](../permissions.md)

## Context

The SCRUM-12 select policies on `profiles`, `student_profiles`, `organization_profiles` and
`mentor_profiles` checked only the **owner**: any signed-in user could read every profile whose
owner was verified and not an admin. A user with a REST client could sign up as an organization or
mentor (pending review), or as a student without confirming their email, and read every verified
student's profile, skills and GitHub link. That was found in the SCRUM-16 live smoke test.

## Decision

A profile row is visible when:

1. it is your own, or
2. you are an admin (`public.is_admin()`), or
3. **you** are verified (`public.is_verified()`) **and** the row's owner is verified and not an
   admin.

The same rule applies to all four tables. Pending, rejected and suspended organizations and
mentors, and unconfirmed or suspended students, see only their own profile. Verified students can
see each other (needed later for teams). Admin profiles stay invisible to non-admins. Contact
details in schema `private` are unchanged: unreachable from the Data API.

## Consequences

- Discovery features (search, teams, project pages that show people) work only for verified users;
  screens for unverified users must not expect other profiles.
- A suspended user loses visibility of others immediately, because `is_verified()` reads the
  current status on every query.
- Each policy calls `is_verified()` once per statement (wrapped in `select`, so Postgres evaluates
  it as an init plan, not per row).
- The policies were replaced in one forward-only migration (one transaction), so no environment had
  a moment without a select policy.
