alter table if exists public.profiles
  add column if not exists is_platform_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_platform_admin, false) = true
      and coalesce(p.is_active, true) = true
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'isg_job_posts'
      and policyname = 'Platform admins can manage job posts'
  ) then
    create policy "Platform admins can manage job posts"
      on public.isg_job_posts
      for all
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'isg_job_comments'
      and policyname = 'Platform admins can manage job comments'
  ) then
    create policy "Platform admins can manage job comments"
      on public.isg_job_comments
      for all
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'isg_job_announcements'
      and policyname = 'Platform admins can manage job announcements'
  ) then
    create policy "Platform admins can manage job announcements"
      on public.isg_job_announcements
      for all
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;
end $$;
