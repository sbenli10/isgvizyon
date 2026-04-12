begin;

create index if not exists idx_companies_active_name
  on public.companies(is_active, name);

create index if not exists idx_companies_active_updated_at
  on public.companies(is_active, updated_at desc);

create index if not exists idx_employees_active_company_first_name
  on public.employees(is_active, company_id, first_name, id);

create index if not exists idx_employees_active_first_name
  on public.employees(is_active, first_name, id);

create index if not exists idx_employees_updated_at
  on public.employees(updated_at desc);

create index if not exists idx_profiles_id_org_role
  on public.profiles(id, organization_id, role);

create index if not exists idx_ppe_inventory_user_updated_at
  on public.ppe_inventory(user_id, updated_at desc);

create index if not exists idx_ppe_inventory_user_item_name
  on public.ppe_inventory(user_id, item_name);

create index if not exists idx_ppe_assignments_user_due_date
  on public.ppe_assignments(user_id, due_date, id);

create index if not exists idx_ppe_assignments_user_employee_due_date
  on public.ppe_assignments(user_id, employee_id, due_date, id);

create index if not exists idx_periodic_controls_user_status_next_date
  on public.periodic_controls(user_id, status, next_control_date, id);

create index if not exists idx_periodic_controls_user_company_next_date
  on public.periodic_controls(user_id, company_id, next_control_date, id);

create index if not exists idx_periodic_control_reports_user_report_date
  on public.periodic_control_reports(user_id, report_date desc, id);

create index if not exists idx_health_surveillance_records_user_status_next_exam
  on public.health_surveillance_records(user_id, status, next_exam_date, id);

create index if not exists idx_health_surveillance_records_user_employee_next_exam
  on public.health_surveillance_records(user_id, employee_id, next_exam_date, id);

create index if not exists idx_osgb_tasks_user_status_created_at
  on public.osgb_tasks(user_id, status, created_at desc, id);

create index if not exists idx_osgb_tasks_user_created_at
  on public.osgb_tasks(user_id, created_at desc, id);

create index if not exists idx_osgb_personnel_user_active_full_name
  on public.osgb_personnel(user_id, is_active, full_name, id);

create index if not exists idx_osgb_assignments_user_created_at
  on public.osgb_assignments(user_id, created_at desc, id);

create index if not exists idx_osgb_assignments_company_status_created_at
  on public.osgb_assignments(company_id, status, created_at desc, id);

create index if not exists idx_isgkatip_companies_org_deleted_name
  on public.isgkatip_companies(org_id, is_deleted, company_name, id);

create index if not exists idx_isgkatip_companies_org_deleted_updated_at
  on public.isgkatip_companies(org_id, is_deleted, updated_at desc, id);

create index if not exists idx_incident_reports_user_updated_at
  on public.incident_reports(user_id, updated_at desc, id);

create index if not exists idx_notifications_user_created_at
  on public.notifications(user_id, created_at desc, id);

commit;
