alter table public.companies
  add column if not exists employer_representative_tc_no text,
  add column if not exists employer_representative_phone text,
  add column if not exists occupational_safety_specialist_tc_no text,
  add column if not exists occupational_safety_specialist_phone text,
  add column if not exists occupational_safety_specialist_certificate_no text,
  add column if not exists workplace_doctor_tc_no text,
  add column if not exists workplace_doctor_phone text,
  add column if not exists workplace_doctor_certificate_no text,
  add column if not exists employee_representative_tc_no text,
  add column if not exists employee_representative_phone text;
