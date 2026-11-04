-- SCRUM-34 (follow-up): universities across Saudi Arabia on the interest form. Existing codes are
-- unchanged, so no row needs updating. Every option list below must match
-- supabase/functions/_shared/interest-options.ts (a Vitest test compares them with the latest CHECK
-- of each column).

alter table public.interest_signups
  drop constraint interest_signups_university_code_values,
  add constraint interest_signups_university_code_values check (
    university_code in (
      'king_saud', 'kau', 'kfupm', 'imam', 'uqu', 'iu', 'kfu', 'kku', 'qu', 'taibah', 'tu', 'uoh',
      'jazan', 'ju', 'ut', 'bu', 'nu', 'nbu', 'pnu', 'iau', 'psau', 'su', 'mu', 'seu', 'ksau_hs',
      'uj', 'ub', 'uhb', 'kaust',
      'psu', 'alfaisal', 'yamamah', 'dau', 'reu', 'maarefa', 'aou', 'effat', 'dah', 'ubt', 'pmu',
      'pmu_madinah', 'fbsu', 'mustaqbal',
      'other'
    )
  );
