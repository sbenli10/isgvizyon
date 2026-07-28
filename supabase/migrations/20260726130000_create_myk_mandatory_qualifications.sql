create table if not exists public.myk_mandatory_qualifications (
  id uuid primary key default gen_random_uuid(),
  profession_name text not null,
  normalized_profession_name text not null,
  qualification_codes text[] not null default '{}'::text[],
  obligation_date text not null default '',
  source_url text not null default 'https://portal.myk.gov.tr/index.php?option=com_yeterlilik&view=arama&belge_zorunlu=1',
  source_hash text not null default '',
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint myk_mandatory_qualifications_profession_unique unique (normalized_profession_name)
);

create index if not exists idx_myk_mandatory_qualifications_active_name
  on public.myk_mandatory_qualifications(is_active, normalized_profession_name);

create index if not exists idx_myk_mandatory_qualifications_codes
  on public.myk_mandatory_qualifications using gin (qualification_codes);

create table if not exists public.myk_sync_logs (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  status text not null default 'pending',
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_myk_sync_logs_started_at
  on public.myk_sync_logs(started_at desc);

create or replace function public.set_myk_mandatory_qualifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_myk_mandatory_qualifications_updated_at on public.myk_mandatory_qualifications;
create trigger trg_myk_mandatory_qualifications_updated_at
before update on public.myk_mandatory_qualifications
for each row
execute function public.set_myk_mandatory_qualifications_updated_at();

alter table public.myk_mandatory_qualifications enable row level security;
alter table public.myk_sync_logs enable row level security;

drop policy if exists "Authenticated users can read MYK qualifications" on public.myk_mandatory_qualifications;
create policy "Authenticated users can read MYK qualifications"
on public.myk_mandatory_qualifications
for select
to authenticated
using (true);

drop policy if exists "Service role can manage MYK qualifications" on public.myk_mandatory_qualifications;
create policy "Service role can manage MYK qualifications"
on public.myk_mandatory_qualifications
for all
to service_role
using (true)
with check (true);

drop policy if exists "Authenticated users can read MYK sync logs" on public.myk_sync_logs;
create policy "Authenticated users can read MYK sync logs"
on public.myk_sync_logs
for select
to authenticated
using (true);

drop policy if exists "Service role can manage MYK sync logs" on public.myk_sync_logs;
create policy "Service role can manage MYK sync logs"
on public.myk_sync_logs
for all
to service_role
using (true)
with check (true);

insert into public.myk_mandatory_qualifications (
  profession_name,
  normalized_profession_name,
  qualification_codes,
  obligation_date,
  source_hash
)
values
  ('Ağır Vasıta Tecrübe Sürücüsü', lower('ağır vasıta tecrübe sürücüsü'), array['11UY0004-5'], '02 Ekim 2020', md5('Ağır Vasıta Tecrübe Sürücüsü|11UY0004-5|02 Ekim 2020')),
  ('Ahşap Kalıpçı', lower('ahşap kalıpçı'), array['11UY0011-3'], '26 Mayıs 2016', md5('Ahşap Kalıpçı|11UY0011-3|26 Mayıs 2016')),
  ('Ahşap Mobilya İmalatçısı', lower('ahşap mobilya imalatçısı'), array['17UY0301-3', '17UY0301-4', '17UY0301-5'], '30 Aralık 2022', md5('Ahşap Mobilya İmalatçısı|17UY0301-3,17UY0301-4,17UY0301-5|30 Aralık 2022')),
  ('Alçı Levha Uygulayıcısı', lower('alçı levha uygulayıcısı'), array['12UY0054-3'], '26 Mayıs 2016', md5('Alçı Levha Uygulayıcısı|12UY0054-3|26 Mayıs 2016')),
  ('Alçı Sıva Uygulayıcısı', lower('alçı sıva uygulayıcısı'), array['12UY0055-3'], '26 Mayıs 2016', md5('Alçı Sıva Uygulayıcısı|12UY0055-3|26 Mayıs 2016'))
on conflict (normalized_profession_name)
do update set
  profession_name = excluded.profession_name,
  qualification_codes = excluded.qualification_codes,
  obligation_date = excluded.obligation_date,
  source_hash = excluded.source_hash,
  is_active = true,
  last_seen_at = now();
