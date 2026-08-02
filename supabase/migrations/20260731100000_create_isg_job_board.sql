create table if not exists public.isg_job_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  source_type text not null default 'user' check (source_type in ('user', 'external', 'admin')),
  source_name text not null default 'İSGVizyon',
  source_url text null,
  title text not null,
  content text not null,
  city text not null default 'Tüm Türkiye',
  contact_phone text null,
  contact_email text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  view_count integer not null default 0,
  approved_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete set null,
  published_at timestamptz null,
  expires_at timestamptz null,
  external_hash text null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.isg_job_comments (
  id uuid primary key default gen_random_uuid(),
  job_post_id uuid not null references public.isg_job_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'Anonim',
  is_anonymous boolean not null default false,
  comment text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.isg_job_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  action_url text null,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  expires_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.isg_job_announcement_reads (
  announcement_id uuid not null references public.isg_job_announcements(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_isg_job_posts_public_feed
  on public.isg_job_posts(status, published_at desc, created_at desc);

create index if not exists idx_isg_job_posts_city
  on public.isg_job_posts(city, status, published_at desc);

create index if not exists idx_isg_job_comments_post_status
  on public.isg_job_comments(job_post_id, status, created_at);

create index if not exists idx_isg_job_announcements_active
  on public.isg_job_announcements(is_active, published_at desc);

create or replace function public.set_isg_job_board_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_isg_job_posts_updated_at on public.isg_job_posts;
create trigger trg_isg_job_posts_updated_at
before update on public.isg_job_posts
for each row
execute function public.set_isg_job_board_updated_at();

drop trigger if exists trg_isg_job_comments_updated_at on public.isg_job_comments;
create trigger trg_isg_job_comments_updated_at
before update on public.isg_job_comments
for each row
execute function public.set_isg_job_board_updated_at();

alter table public.isg_job_posts enable row level security;
alter table public.isg_job_comments enable row level security;
alter table public.isg_job_announcements enable row level security;
alter table public.isg_job_announcement_reads enable row level security;

drop policy if exists "Anyone can view approved ISG job posts" on public.isg_job_posts;
create policy "Anyone can view approved ISG job posts"
on public.isg_job_posts
for select
using (status = 'approved' and (expires_at is null or expires_at > now()));

drop policy if exists "Users can view own ISG job posts" on public.isg_job_posts;
create policy "Users can view own ISG job posts"
on public.isg_job_posts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can submit ISG job posts" on public.isg_job_posts;
create policy "Users can submit ISG job posts"
on public.isg_job_posts
for insert
to authenticated
with check (user_id = auth.uid() and source_type = 'user' and status = 'pending');

drop policy if exists "Users can view approved ISG job comments" on public.isg_job_comments;
create policy "Users can view approved ISG job comments"
on public.isg_job_comments
for select
using (status = 'approved');

drop policy if exists "Users can view own ISG job comments" on public.isg_job_comments;
create policy "Users can view own ISG job comments"
on public.isg_job_comments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can submit ISG job comments" on public.isg_job_comments;
create policy "Users can submit ISG job comments"
on public.isg_job_comments
for insert
to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Anyone can view active ISG job announcements" on public.isg_job_announcements;
create policy "Anyone can view active ISG job announcements"
on public.isg_job_announcements
for select
using (is_active = true and (expires_at is null or expires_at > now()));

drop policy if exists "Users can view own ISG job announcement reads" on public.isg_job_announcement_reads;
create policy "Users can view own ISG job announcement reads"
on public.isg_job_announcement_reads
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can mark ISG job announcements read" on public.isg_job_announcement_reads;
create policy "Users can mark ISG job announcements read"
on public.isg_job_announcement_reads
for insert
to authenticated
with check (user_id = auth.uid());

insert into public.isg_job_announcements (title, message, type)
values
  ('İş ilanları yayında', 'İSG sektörüne özel ilanları filtreleyebilir, ücretsiz ilan gönderebilir ve duyuruları buradan takip edebilirsiniz.', 'success')
on conflict do nothing;
