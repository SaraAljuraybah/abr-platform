-- SCRUM-34 (follow-up): Naif Arab University for Security Sciences leaves the interest form's
-- university list. Every option list below must match supabase/functions/_shared/interest-options.ts
-- (a Vitest test compares them with the latest CHECK of each column).

-- Keep any earlier answer as a typed name rather than dropping it.
update public.interest_signups
set university_code = 'other',
    university_other = 'Naif Arab University for Security Sciences'
where university_code = 'naif';

alter table public.interest_signups
  drop constraint interest_signups_university_code_values,
  add constraint interest_signups_university_code_values check (
    university_code in (
      'king_saud', 'imam', 'pnu', 'ksau_hs', 'seu',
      'psu', 'alfaisal', 'yamamah', 'dau', 'reu', 'maarefa', 'aou',
      'other'
    )
  );
