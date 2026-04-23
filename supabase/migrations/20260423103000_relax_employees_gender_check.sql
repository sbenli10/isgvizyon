alter table public.employees
  drop constraint if exists employees_gender_check;

update public.employees
set gender = null
where gender is not null
  and btrim(gender) = '';

alter table public.employees
  add constraint employees_gender_check
  check (
    gender is null
    or lower(btrim(gender)) in (
      'erkek',
      U&'kad\0131n',
      'kadin',
      U&'di\011Fer',
      'diger',
      'male',
      'female',
      'other',
      'm',
      'f',
      'e',
      'k'
    )
  );
