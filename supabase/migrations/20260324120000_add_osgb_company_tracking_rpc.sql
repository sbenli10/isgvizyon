create or replace function public.get_osgb_company_tracking_page(
  p_org_id uuid,
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_assignment_status text default null
)
returns table (
  company_id uuid,
  company_name text,
  hazard_class text,
  employee_count integer,
  contract_end date,
  required_minutes integer,
  assigned_minutes integer,
  assignment_status text,
  active_assignment jsonb,
  document_summary jsonb,
  finance_summary jsonb,
  open_task_count integer,
  note_count integer,
  total_count bigint
)
language sql
security invoker
set search_path = public
as $$
with base as (
  select
    c.id as company_id,
    c.company_name,
    coalesce(c.hazard_class, 'Bilinmiyor') as hazard_class,
    coalesce(c.employee_count, 0) as employee_count,
    c.contract_end,
    coalesce(c.required_minutes, 0) as required_minutes
  from public.isgkatip_companies c
  where c.org_id = p_org_id
    and coalesce(c.is_deleted, false) = false
    and (
      p_search is null
      or c.company_name ilike '%' || p_search || '%'
      or coalesce(c.hazard_class, '') ilike '%' || p_search || '%'
    )
),
enriched as (
  select
    b.company_id,
    b.company_name,
    b.hazard_class,
    b.employee_count,
    b.contract_end,
    b.required_minutes,
    coalesce(active_assignment.assigned_minutes, 0) as assigned_minutes,
    case
      when active_assignment.assignment_id is null then 'atanmamis'
      when coalesce(active_assignment.assigned_minutes, 0) < b.required_minutes then 'eksik'
      else 'atandi'
    end as assignment_status,
    case
      when active_assignment.assignment_id is null then null
      else jsonb_build_object(
        'assignmentId', active_assignment.assignment_id,
        'personnelName', coalesce(active_assignment.personnel_name, 'Atanan personel'),
        'role', active_assignment.assigned_role,
        'assignedMinutes', coalesce(active_assignment.assigned_minutes, 0),
        'startDate', active_assignment.start_date,
        'endDate', active_assignment.end_date
      )
    end as active_assignment,
    jsonb_build_object(
      'active', coalesce(docs.active_count, 0),
      'warning', coalesce(docs.warning_count, 0),
      'expired', coalesce(docs.expired_count, 0)
    ) as document_summary,
    jsonb_build_object(
      'pendingAmount', coalesce(fin.pending_amount, 0),
      'overdueAmount', coalesce(fin.overdue_amount, 0)
    ) as finance_summary,
    coalesce(tasks.open_task_count, 0) as open_task_count,
    coalesce(notes.note_count, 0) as note_count
  from base b
  left join lateral (
    select
      a.id as assignment_id,
      a.assigned_role,
      a.assigned_minutes,
      a.start_date,
      a.end_date,
      p.full_name as personnel_name
    from public.osgb_assignments a
    left join public.osgb_personnel p on p.id = a.personnel_id
    where a.company_id = b.company_id
      and a.status = 'active'
    order by a.created_at desc
    limit 1
  ) active_assignment on true
  left join lateral (
    select
      count(*) filter (where d.status = 'active') as active_count,
      count(*) filter (where d.status = 'warning') as warning_count,
      count(*) filter (where d.status = 'expired') as expired_count
    from public.osgb_document_tracking d
    where d.company_id = b.company_id
  ) docs on true
  left join lateral (
    select
      coalesce(sum(case when f.status = 'pending' then f.amount else 0 end), 0) as pending_amount,
      coalesce(sum(case when f.status = 'overdue' then f.amount else 0 end), 0) as overdue_amount
    from public.osgb_finance f
    where f.company_id = b.company_id
  ) fin on true
  left join lateral (
    select count(*) as open_task_count
    from public.osgb_tasks t
    where t.company_id = b.company_id
      and t.status not in ('completed', 'cancelled')
  ) tasks on true
  left join lateral (
    select count(*) as note_count
    from public.osgb_notes n
    where n.company_id = b.company_id
  ) notes on true
),
filtered as (
  select *
  from enriched
  where p_assignment_status is null or assignment_status = p_assignment_status
)
select
  f.company_id,
  f.company_name,
  f.hazard_class,
  f.employee_count,
  f.contract_end,
  f.required_minutes,
  f.assigned_minutes,
  f.assignment_status,
  f.active_assignment,
  f.document_summary,
  f.finance_summary,
  f.open_task_count,
  f.note_count,
  count(*) over () as total_count
from filtered f
order by f.company_name asc
offset greatest(p_page - 1, 0) * p_page_size
limit greatest(p_page_size, 1);
$$;

grant execute on function public.get_osgb_company_tracking_page(uuid, integer, integer, text, text) to authenticated;
