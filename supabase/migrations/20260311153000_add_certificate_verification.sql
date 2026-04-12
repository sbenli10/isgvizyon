alter table public.certificate_participants
  add column if not exists verification_code uuid default gen_random_uuid();

update public.certificate_participants
set verification_code = gen_random_uuid()
where verification_code is null;

alter table public.certificate_participants
  alter column verification_code set not null;

create unique index if not exists certificate_participants_verification_code_idx
  on public.certificate_participants(verification_code);
