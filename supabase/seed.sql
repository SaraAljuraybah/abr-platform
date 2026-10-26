-- ABR local/development seed data.
-- Synthetic data only. NEVER real personal data (Plan v2.0 §17). No users are seeded.

-- PLACEHOLDER universities and student email domains, pending decision D-05 (which universities
-- and which domains the pilot accepts). Matching is exact: subdomains are listed one by one.
-- Do not copy these rows into a shared environment as if they were approved.
insert into public.universities (id, name_ar, name_en) values
  ('0a7f7f0e-5d2c-4c8e-9b1a-000000000001', 'جامعة الملك سعود', 'King Saud University'),
  ('0a7f7f0e-5d2c-4c8e-9b1a-000000000002', 'جامعة الملك فهد للبترول والمعادن',
    'King Fahd University of Petroleum and Minerals'),
  ('0a7f7f0e-5d2c-4c8e-9b1a-000000000003', 'جامعة الأميرة نورة بنت عبدالرحمن',
    'Princess Nourah bint Abdulrahman University');

insert into public.university_email_domains (university_id, domain) values
  ('0a7f7f0e-5d2c-4c8e-9b1a-000000000001', 'ksu.edu.sa'),          -- PLACEHOLDER (D-05)
  ('0a7f7f0e-5d2c-4c8e-9b1a-000000000001', 'student.ksu.edu.sa'),  -- PLACEHOLDER (D-05)
  ('0a7f7f0e-5d2c-4c8e-9b1a-000000000002', 'kfupm.edu.sa'),        -- PLACEHOLDER (D-05)
  ('0a7f7f0e-5d2c-4c8e-9b1a-000000000003', 'pnu.edu.sa');          -- PLACEHOLDER (D-05)
