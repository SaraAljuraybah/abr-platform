-- All Saudi public and private universities in sign-up (CTO decision, 27 Nov 2026), with
-- stable codes (the same codes as the interest form) and a public/private kind for grouping.
-- Student email domains: each university's official domain, plus the student subdomains a
-- published university source confirmed (stu.kau.edu.sa, st.uqu.edu.sa, student.ksu.edu.sa,
-- student.kfu.edu.sa; Arab Open University students use aou.edu.sa). Matching stays exact (D-05):
-- admins add any further student subdomain with admin_add_university_domain(), audited, without
-- a migration. Existing rows (the placeholder seed on abr-dev) are matched by English name and
-- keep their ids, so nothing that references them changes.

alter table public.universities
  add column code text unique check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  add column kind text check (kind in ('public', 'private'));

-- Clients may read the new columns; they stay unwritable (no client grants on this table).
grant select (code, kind) on public.universities to anon, authenticated;

create temporary table ksa_universities (code text primary key, kind text, name_ar text, name_en text);
 ;
insert into ksa_universities (code, kind, name_ar, name_en) values
  ('king_saud', 'public', 'جامعة الملك سعود', 'King Saud University'),
  ('kau', 'public', 'جامعة الملك عبدالعزيز', 'King Abdulaziz University'),
  ('kfupm', 'public', 'جامعة الملك فهد للبترول والمعادن', 'King Fahd University of Petroleum and Minerals'),
  ('imam', 'public', 'جامعة الإمام محمد بن سعود الإسلامية', 'Imam Mohammad Ibn Saud Islamic University'),
  ('uqu', 'public', 'جامعة أم القرى', 'Umm Al-Qura University'),
  ('iu', 'public', 'الجامعة الإسلامية بالمدينة المنورة', 'Islamic University of Madinah'),
  ('kfu', 'public', 'جامعة الملك فيصل', 'King Faisal University'),
  ('kku', 'public', 'جامعة الملك خالد', 'King Khalid University'),
  ('qu', 'public', 'جامعة القصيم', 'Qassim University'),
  ('taibah', 'public', 'جامعة طيبة', 'Taibah University'),
  ('tu', 'public', 'جامعة الطائف', 'Taif University'),
  ('uoh', 'public', 'جامعة حائل', 'University of Ha''il'),
  ('jazan', 'public', 'جامعة جازان', 'Jazan University'),
  ('ju', 'public', 'جامعة الجوف', 'Jouf University'),
  ('ut', 'public', 'جامعة تبوك', 'University of Tabuk'),
  ('bu', 'public', 'جامعة الباحة', 'Al-Baha University'),
  ('nu', 'public', 'جامعة نجران', 'Najran University'),
  ('nbu', 'public', 'جامعة الحدود الشمالية', 'Northern Border University'),
  ('pnu', 'public', 'جامعة الأميرة نورة بنت عبدالرحمن', 'Princess Nourah bint Abdulrahman University'),
  ('iau', 'public', 'جامعة الإمام عبدالرحمن بن فيصل', 'Imam Abdulrahman Bin Faisal University'),
  ('psau', 'public', 'جامعة الأمير سطام بن عبدالعزيز', 'Prince Sattam bin Abdulaziz University'),
  ('su', 'public', 'جامعة شقراء', 'Shaqra University'),
  ('mu', 'public', 'جامعة المجمعة', 'Majmaah University'),
  ('seu', 'public', 'الجامعة السعودية الإلكترونية', 'Saudi Electronic University'),
  ('ksau_hs', 'public', 'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية', 'King Saud bin Abdulaziz University for Health Sciences'),
  ('uj', 'public', 'جامعة جدة', 'University of Jeddah'),
  ('ub', 'public', 'جامعة بيشة', 'University of Bisha'),
  ('uhb', 'public', 'جامعة حفر الباطن', 'University of Hafr Al Batin'),
  ('kaust', 'public', 'جامعة الملك عبدالله للعلوم والتقنية (كاوست)', 'King Abdullah University of Science and Technology (KAUST)'),
  ('psu', 'private', 'جامعة الأمير سلطان', 'Prince Sultan University'),
  ('alfaisal', 'private', 'جامعة الفيصل', 'Alfaisal University'),
  ('yamamah', 'private', 'جامعة اليمامة', 'Al Yamamah University'),
  ('dau', 'private', 'جامعة دار العلوم', 'Dar Al Uloom University'),
  ('reu', 'private', 'جامعة رياض العلم', 'Riyadh Elm University'),
  ('maarefa', 'private', 'جامعة المعرفة', 'AlMaarefa University'),
  ('aou', 'private', 'الجامعة العربية المفتوحة', 'Arab Open University'),
  ('effat', 'private', 'جامعة عفت', 'Effat University'),
  ('dah', 'private', 'جامعة دار الحكمة', 'Dar Al-Hekma University'),
  ('ubt', 'private', 'جامعة الأعمال والتكنولوجيا', 'University of Business and Technology'),
  ('pmu', 'private', 'جامعة الأمير محمد بن فهد', 'Prince Mohammad bin Fahd University'),
  ('pmu_madinah', 'private', 'جامعة الأمير مقرن بن عبدالعزيز', 'Prince Mugrin University'),
  ('fbsu', 'private', 'جامعة فهد بن سلطان', 'Fahad Bin Sultan University'),
  ('mustaqbal', 'private', 'جامعة المستقبل', 'Mustaqbal University');

update public.universities u
set code = k.code, kind = k.kind
from ksa_universities k
where u.code is null and pg_catalog.lower(u.name_en) = pg_catalog.lower(k.name_en);

insert into public.universities (code, kind, name_ar, name_en)
select k.code, k.kind, k.name_ar, k.name_en
from ksa_universities k
where not exists (select 1 from public.universities u where u.code = k.code);

create temporary table ksa_domains (code text, domain text);
insert into ksa_domains (code, domain) values
  ('king_saud', 'ksu.edu.sa'),
  ('king_saud', 'student.ksu.edu.sa'),
  ('kau', 'kau.edu.sa'),
  ('kau', 'stu.kau.edu.sa'),
  ('kfupm', 'kfupm.edu.sa'),
  ('imam', 'imamu.edu.sa'),
  ('uqu', 'uqu.edu.sa'),
  ('uqu', 'st.uqu.edu.sa'),
  ('iu', 'iu.edu.sa'),
  ('kfu', 'kfu.edu.sa'),
  ('kfu', 'student.kfu.edu.sa'),
  ('kku', 'kku.edu.sa'),
  ('qu', 'qu.edu.sa'),
  ('taibah', 'taibahu.edu.sa'),
  ('tu', 'tu.edu.sa'),
  ('uoh', 'uoh.edu.sa'),
  ('jazan', 'jazanu.edu.sa'),
  ('ju', 'ju.edu.sa'),
  ('ut', 'ut.edu.sa'),
  ('bu', 'bu.edu.sa'),
  ('nu', 'nu.edu.sa'),
  ('nbu', 'nbu.edu.sa'),
  ('pnu', 'pnu.edu.sa'),
  ('iau', 'iau.edu.sa'),
  ('psau', 'psau.edu.sa'),
  ('su', 'su.edu.sa'),
  ('mu', 'mu.edu.sa'),
  ('seu', 'seu.edu.sa'),
  ('ksau_hs', 'ksau-hs.edu.sa'),
  ('uj', 'uj.edu.sa'),
  ('ub', 'ub.edu.sa'),
  ('uhb', 'uhb.edu.sa'),
  ('kaust', 'kaust.edu.sa'),
  ('psu', 'psu.edu.sa'),
  ('alfaisal', 'alfaisal.edu'),
  ('yamamah', 'yu.edu.sa'),
  ('dau', 'dau.edu.sa'),
  ('reu', 'riyadh.edu.sa'),
  ('maarefa', 'um.edu.sa'),
  ('aou', 'aou.edu.sa'),
  ('aou', 'arabou.edu.sa'),
  ('effat', 'effatuniversity.edu.sa'),
  ('effat', 'effat.edu.sa'),
  ('dah', 'dah.edu.sa'),
  ('ubt', 'ubt.edu.sa'),
  ('pmu', 'pmu.edu.sa'),
  ('pmu_madinah', 'upm.edu.sa'),
  ('fbsu', 'fbsu.edu.sa'),
  ('mustaqbal', 'uom.edu.sa');

insert into public.university_email_domains (university_id, domain)
select u.id, d.domain
from ksa_domains d
join public.universities u on u.code = d.code
on conflict (domain) do nothing;

drop table ksa_domains;
drop table ksa_universities;

-- Admin management of student email domains (closes the D-05 gap for subdomains we did not
-- list). Admin only; every change is audited. Never raises on another user's behalf.
create function public.admin_add_university_domain(p_university_id uuid, p_domain text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text := pg_catalog.lower(pg_catalog.btrim(p_domain));
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ABR_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.universities where id = p_university_id) then
    raise exception 'ABR_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_domain is null
    or pg_catalog.char_length(v_domain) > 253
    or v_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then
    raise exception 'ABR_INVALID_DOMAIN' using errcode = '22023';
  end if;
  if exists (select 1 from public.university_email_domains where domain = v_domain) then
    raise exception 'ABR_DOMAIN_TAKEN' using errcode = '23505';
  end if;
  insert into public.university_email_domains (university_id, domain)
  values (p_university_id, v_domain)
  returning id into v_id;
  perform private.log_event('university_domain.added', 'university_email_domain', v_id,
    pg_catalog.jsonb_build_object('university_id', p_university_id, 'domain', v_domain));
  return v_id;
end;
$$;
revoke all on function public.admin_add_university_domain(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_add_university_domain(uuid, text) to authenticated;

create function public.admin_set_university_domain_active(p_domain_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain public.university_email_domains;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ABR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_active is null then
    raise exception 'ABR_INVALID' using errcode = '22023';
  end if;
  select * into v_domain from public.university_email_domains where id = p_domain_id for update;
  if not found then
    raise exception 'ABR_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.university_email_domains set active = p_active where id = p_domain_id;
  perform private.log_event('university_domain.' || case when p_active then 'enabled' else 'disabled' end,
    'university_email_domain', p_domain_id,
    pg_catalog.jsonb_build_object('university_id', v_domain.university_id, 'domain', v_domain.domain));
end;
$$;
revoke all on function public.admin_set_university_domain_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_university_domain_active(uuid, boolean) to authenticated;
