alter table public.companies
  add column if not exists hazard_class text,
  add column if not exists workplace_registration_number text,
  add column if not exists sgk_workplace_number text,
  add column if not exists visit_frequency text default 'Ayda 1 Defa',
  add column if not exists employer_representative_name text,
  add column if not exists occupational_safety_specialist_name text,
  add column if not exists workplace_doctor_name text,
  add column if not exists employee_representative_name text,
  add column if not exists knowledgeable_employee_name text,
  add column if not exists fire_support_person_name text,
  add column if not exists first_aid_support_person_name text,
  add column if not exists evacuation_support_person_name text;

update public.companies
set sgk_workplace_number = coalesce(sgk_workplace_number, workplace_registration_number)
where workplace_registration_number is not null
  and sgk_workplace_number is null;

update public.companies
set workplace_registration_number = coalesce(workplace_registration_number, sgk_workplace_number)
where sgk_workplace_number is not null
  and workplace_registration_number is null;

update public.companies
set visit_frequency = coalesce(visit_frequency, 'Ayda 1 Defa')
where visit_frequency is null;
