alter table public.risk_assessments
  add column if not exists employer_representative_signed_at timestamptz,
  add column if not exists employer_representative_approval_status text,
  add column if not exists occupational_safety_specialist_signed_at timestamptz,
  add column if not exists occupational_safety_specialist_approval_status text,
  add column if not exists workplace_doctor_signed_at timestamptz,
  add column if not exists workplace_doctor_approval_status text,
  add column if not exists employee_representative_signed_at timestamptz,
  add column if not exists employee_representative_approval_status text,
  add column if not exists support_personnel_signed_at timestamptz,
  add column if not exists support_personnel_approval_status text;

update public.risk_assessments
set
  employer_representative_approval_status = coalesce(employer_representative_approval_status, case when employer_representative_signature_url is not null then 'Hazır' else 'Bekliyor' end),
  occupational_safety_specialist_approval_status = coalesce(occupational_safety_specialist_approval_status, case when occupational_safety_specialist_signature_url is not null then 'Hazır' else 'Bekliyor' end),
  workplace_doctor_approval_status = coalesce(workplace_doctor_approval_status, case when workplace_doctor_signature_url is not null then 'Hazır' else 'Bekliyor' end),
  employee_representative_approval_status = coalesce(employee_representative_approval_status, case when employee_representative_signature_url is not null then 'Hazır' else 'Bekliyor' end),
  support_personnel_approval_status = coalesce(support_personnel_approval_status, case when support_personnel_signature_url is not null then 'Hazır' else 'Bekliyor' end),
  employer_representative_signed_at = coalesce(employer_representative_signed_at, case when employer_representative_signature_url is not null then updated_at else null end),
  occupational_safety_specialist_signed_at = coalesce(occupational_safety_specialist_signed_at, case when occupational_safety_specialist_signature_url is not null then updated_at else null end),
  workplace_doctor_signed_at = coalesce(workplace_doctor_signed_at, case when workplace_doctor_signature_url is not null then updated_at else null end),
  employee_representative_signed_at = coalesce(employee_representative_signed_at, case when employee_representative_signature_url is not null then updated_at else null end),
  support_personnel_signed_at = coalesce(support_personnel_signed_at, case when support_personnel_signature_url is not null then updated_at else null end);
