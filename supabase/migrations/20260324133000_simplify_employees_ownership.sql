begin;

alter table public.employees
  add column if not exists user_id uuid;

update public.employees e
set user_id = c.user_id
from public.companies c
where c.id = e.company_id
  and (e.user_id is null or e.user_id <> c.user_id);

alter table public.employees
  alter column user_id set default auth.uid();

create index if not exists idx_employees_user_active_first_name
  on public.employees(user_id, is_active, first_name, id);

create index if not exists idx_employees_user_company_active_first_name
  on public.employees(user_id, company_id, is_active, first_name, id);

create or replace function public.sync_employee_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null then
    new.user_id := auth.uid();
    return new;
  end if;

  select c.user_id
    into new.user_id
  from public.companies c
  where c.id = new.company_id;

  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_employee_user_id on public.employees;

create trigger trg_sync_employee_user_id
before insert or update of company_id
on public.employees
for each row
execute function public.sync_employee_user_id();

drop policy if exists "Users can delete company employees" on public.employees;
drop policy if exists "Users can insert company employees" on public.employees;
drop policy if exists "Users can view company employees" on public.employees;
drop policy if exists "Users can update company employees" on public.employees;

create policy "Users can delete own employees"
on public.employees
for delete
using (auth.uid() = user_id);

create policy "Users can insert own employees"
on public.employees
for insert
with check (auth.uid() = user_id);

create policy "Users can view own employees"
on public.employees
for select
using (auth.uid() = user_id);

create policy "Users can update own employees"
on public.employees
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.employees
  alter column user_id set not null;

commit;
