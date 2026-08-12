-- Manual Havale / EFT payment flow with admin approval.
-- Designed as a provider layer so card payments can be added later without changing history screens.

insert into public.billing_provider_settings (
  provider_code,
  provider_name,
  is_enabled,
  mode,
  public_config
)
values (
  'bank_transfer',
  'Havale / EFT',
  true,
  'test',
  jsonb_build_object(
    'paymentType', 'manual',
    'accountHolder', '',
    'iban', '',
    'bankName', '',
    'instructions', 'Ödeme onayı 1 iş günü içinde yapılır.',
    'approvalSlaBusinessDays', 1
  )
)
on conflict (provider_code) do update
set provider_name = excluded.provider_name,
    is_enabled = true,
    mode = excluded.mode,
    public_config = coalesce(public.billing_provider_settings.public_config, '{}'::jsonb) || excluded.public_config,
    updated_at = now();

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  plan_code text not null references public.subscription_plans(plan_code),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  amount numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  status text not null default 'awaiting_receipt' check (status in ('awaiting_receipt', 'pending', 'approved', 'rejected', 'cancelled')),
  payment_provider text not null default 'bank_transfer',
  bank_account_snapshot jsonb not null default '{}'::jsonb,
  invoice_info jsonb not null default '{}'::jsonb,
  receipt_file_path text,
  receipt_file_name text,
  receipt_uploaded_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,
  subscription_period_start timestamptz,
  subscription_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manual_payment_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.manual_payment_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null default 'user' check (actor_role in ('user', 'platform_admin', 'system')),
  action text not null,
  from_status text,
  to_status text,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_manual_payment_requests_user on public.manual_payment_requests(user_id, created_at desc);
create index if not exists idx_manual_payment_requests_org on public.manual_payment_requests(organization_id, created_at desc);
create index if not exists idx_manual_payment_requests_status on public.manual_payment_requests(status, created_at desc);
create index if not exists idx_manual_payment_events_request on public.manual_payment_request_events(request_id, created_at desc);

alter table public.manual_payment_requests enable row level security;
alter table public.manual_payment_request_events enable row level security;

drop policy if exists "Users can read own manual payments" on public.manual_payment_requests;
create policy "Users can read own manual payments"
on public.manual_payment_requests
for select
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Users can create own manual payments" on public.manual_payment_requests;
drop policy if exists "Users can update own receipt while pending" on public.manual_payment_requests;

drop policy if exists "Users can read own manual payment events" on public.manual_payment_request_events;
create policy "Users can read own manual payment events"
on public.manual_payment_request_events
for select
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.manual_payment_requests r
    where r.id = manual_payment_request_events.request_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists "Platform admins can manage manual payments" on public.manual_payment_requests;
create policy "Platform admins can manage manual payments"
on public.manual_payment_requests
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Platform admins can manage manual payment events" on public.manual_payment_request_events;
create policy "Platform admins can manage manual payment events"
on public.manual_payment_request_events
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'manual-payment-receipts',
  'manual-payment-receipts',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own manual payment receipts" on storage.objects;
create policy "Users can upload own manual payment receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'manual-payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own manual payment receipts" on storage.objects;
create policy "Users can read own manual payment receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'manual-payment-receipts'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_platform_admin())
);

create or replace function public.generate_manual_payment_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;
begin
  loop
    v_reference := 'ISGV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1 from public.manual_payment_requests where reference_code = v_reference
    );
  end loop;

  return v_reference;
end;
$$;

create or replace function public.get_public_bank_transfer_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'providerCode', provider_code,
        'providerName', provider_name,
        'isEnabled', is_enabled,
    'mode', mode,
    'paymentType', public_config ->> 'paymentType',
        'accountHolder', public_config ->> 'accountHolder',
        'iban', public_config ->> 'iban',
        'bankName', public_config ->> 'bankName',
        'instructions', coalesce(public_config ->> 'instructions', 'Ödeme onayı 1 iş günü içinde yapılır.'),
        'approvalSlaBusinessDays', coalesce((public_config ->> 'approvalSlaBusinessDays')::int, 1)
      )
      from public.billing_provider_settings
      where provider_code = 'bank_transfer'
        and is_enabled = true
      limit 1
    ),
    jsonb_build_object(
      'providerCode', 'bank_transfer',
      'providerName', 'Havale / EFT',
      'isEnabled', false,
      'mode', 'test',
      'paymentType', 'manual',
      'instructions', 'Ödeme onayı 1 iş günü içinde yapılır.',
      'approvalSlaBusinessDays', 1
    )
  )
$$;

create or replace function public.create_manual_bank_transfer_payment_request(
  p_plan_code text,
  p_billing_period text default 'monthly',
  p_invoice_info jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_plan record;
  v_period text := case when p_billing_period = 'yearly' then 'yearly' else 'monthly' end;
  v_amount numeric(12,2);
  v_reference text;
  v_bank jsonb;
  v_request public.manual_payment_requests;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı.' using errcode = 'P0001';
  end if;

  if p_plan_code not in ('premium', 'osgb') then
    raise exception 'Geçersiz paket seçimi.' using errcode = '22023';
  end if;

  select organization_id into v_org_id
  from public.profiles
  where id = v_user_id;

  if p_plan_code = 'osgb' and v_org_id is null then
    raise exception 'OSGB paketi için önce organizasyon oluşturmanız gerekir.' using errcode = 'P0001';
  end if;

  select plan_code, plan_name, price, currency, billing_period
    into v_plan
  from public.subscription_plans
  where plan_code = p_plan_code
    and is_active = true
  limit 1;

  if v_plan.plan_code is null then
    raise exception 'Seçilen paket aktif değil.' using errcode = 'P0001';
  end if;

  v_amount := coalesce(v_plan.price, 0);
  if v_period = 'yearly' then
    v_amount := v_amount * 10;
  end if;

  v_bank := public.get_public_bank_transfer_settings();
  if coalesce((v_bank ->> 'isEnabled')::boolean, false) is not true then
    raise exception 'Havale / EFT ödeme yöntemi şu anda aktif değil.' using errcode = 'P0001';
  end if;

  v_reference := public.generate_manual_payment_reference();

  insert into public.manual_payment_requests (
    reference_code,
    user_id,
    organization_id,
    plan_code,
    billing_period,
    amount,
    currency,
    status,
    bank_account_snapshot,
    invoice_info,
    submitted_at
  )
  values (
    v_reference,
    v_user_id,
    v_org_id,
    p_plan_code,
    v_period,
    v_amount,
    coalesce(v_plan.currency, 'TRY'),
    'awaiting_receipt',
    v_bank,
    coalesce(p_invoice_info, '{}'::jsonb),
    null
  )
  returning * into v_request;

  insert into public.manual_payment_request_events (
    request_id,
    actor_id,
    actor_role,
    action,
    to_status,
    payload
  )
  values (
    v_request.id,
    v_user_id,
    'user',
    'created',
    v_request.status,
    jsonb_build_object('planCode', p_plan_code, 'billingPeriod', v_period, 'amount', v_amount)
  );

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'bank', v_bank,
    'message', 'Ödeme onayı 1 iş günü içinde yapılır. Admin onayı olmadan üyelik açılmaz.'
  );
end;
$$;

create or replace function public.attach_manual_payment_receipt(
  p_request_id uuid,
  p_receipt_file_path text,
  p_receipt_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.manual_payment_requests;
  v_from_status text;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı.' using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_receipt_file_path, '')), '') is null then
    raise exception 'Dekont yüklemek zorunludur.' using errcode = '22023';
  end if;

  select * into v_request
  from public.manual_payment_requests
  where id = p_request_id
    and user_id = v_user_id
  for update;

  if v_request.id is null then
    raise exception 'Ödeme talebi bulunamadı.' using errcode = 'P0001';
  end if;

  if v_request.status not in ('awaiting_receipt', 'pending') then
    raise exception 'Bu ödeme talebi artık dekont güncellemesine kapalıdır.' using errcode = 'P0001';
  end if;

  v_from_status := v_request.status;

  update public.manual_payment_requests
  set receipt_file_path = p_receipt_file_path,
      receipt_file_name = nullif(trim(coalesce(p_receipt_file_name, '')), ''),
      receipt_uploaded_at = now(),
      submitted_at = coalesce(submitted_at, now()),
      status = 'pending',
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.manual_payment_request_events (
    request_id,
    actor_id,
    actor_role,
    action,
    from_status,
    to_status,
    payload
  )
  values (
    v_request.id,
    v_user_id,
    'user',
    'receipt_uploaded',
    v_from_status,
    v_request.status,
    jsonb_build_object('filePath', p_receipt_file_path, 'fileName', p_receipt_file_name)
  );

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'message', 'Dekont alındı. Ödeme onayı 1 iş günü içinde yapılır.'
  );
end;
$$;

create or replace function public.get_my_manual_payment_requests()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'referenceCode', r.reference_code,
        'planCode', r.plan_code,
        'billingPeriod', r.billing_period,
        'amount', r.amount,
        'currency', r.currency,
        'status', r.status,
        'receiptFileName', r.receipt_file_name,
        'submittedAt', r.submitted_at,
        'reviewedAt', r.reviewed_at,
        'reviewNote', r.review_note,
        'createdAt', r.created_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  from public.manual_payment_requests r
  where r.user_id = auth.uid()
$$;

create or replace function public.get_platform_admin_manual_payment_requests(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_platform_admin() then
      jsonb_build_object('error', 'Platform yönetim yetkisi gerekli.')
    else
      jsonb_build_object(
        'payments',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'referenceCode', r.reference_code,
              'userId', r.user_id,
              'userEmail', p.email,
              'userName', p.full_name,
              'organizationId', r.organization_id,
              'planCode', r.plan_code,
              'billingPeriod', r.billing_period,
              'amount', r.amount,
              'currency', r.currency,
              'status', r.status,
              'bankAccountSnapshot', r.bank_account_snapshot,
              'invoiceInfo', r.invoice_info,
              'receiptFilePath', r.receipt_file_path,
              'receiptFileName', r.receipt_file_name,
              'receiptUploadedAt', r.receipt_uploaded_at,
              'submittedAt', r.submitted_at,
              'reviewedAt', r.reviewed_at,
              'reviewNote', r.review_note,
              'createdAt', r.created_at,
              'events', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', e.id,
                    'action', e.action,
                    'fromStatus', e.from_status,
                    'toStatus', e.to_status,
                    'note', e.note,
                    'actorRole', e.actor_role,
                    'createdAt', e.created_at
                  )
                  order by e.created_at desc
                )
                from public.manual_payment_request_events e
                where e.request_id = r.id
              ), '[]'::jsonb)
            )
            order by r.created_at desc
          ),
          '[]'::jsonb
        )
      )
  end
  from (
    select *
    from public.manual_payment_requests
    where p_status is null or p_status = 'all' or status = p_status
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 250))
  ) r
  left join public.profiles p on p.id = r.user_id
$$;

create or replace function public.update_platform_admin_bank_transfer_settings(
  p_account_holder text,
  p_iban text,
  p_bank_name text default '',
  p_instructions text default 'Ödeme onayı 1 iş günü içinde yapılır.'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform yönetim yetkisi gerekli.' using errcode = 'P0001';
  end if;

  v_config := jsonb_build_object(
    'accountHolder', trim(coalesce(p_account_holder, '')),
    'iban', upper(regexp_replace(coalesce(p_iban, ''), '\s+', '', 'g')),
    'bankName', trim(coalesce(p_bank_name, '')),
    'instructions', coalesce(nullif(trim(coalesce(p_instructions, '')), ''), 'Ödeme onayı 1 iş günü içinde yapılır.'),
    'approvalSlaBusinessDays', 1
  );

  insert into public.billing_provider_settings (
    provider_code,
    provider_name,
    is_enabled,
    mode,
    public_config
  )
  values ('bank_transfer', 'Havale / EFT', true, 'test', v_config)
  on conflict (provider_code) do update
  set is_enabled = true,
      mode = 'test',
      public_config = excluded.public_config,
      updated_at = now();

  insert into public.platform_admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'bank_transfer_settings_updated', 'billing_provider_settings', 'bank_transfer', v_config);

  return public.get_public_bank_transfer_settings();
end;
$$;

create or replace function public.review_manual_payment_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_request public.manual_payment_requests;
  v_from_status text;
  v_period_start timestamptz := now();
  v_period_end timestamptz;
  v_trigger record;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform yönetim yetkisi gerekli.' using errcode = 'P0001';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Karar onay veya red olmalıdır.' using errcode = '22023';
  end if;

  select * into v_request
  from public.manual_payment_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Ödeme talebi bulunamadı.' using errcode = 'P0001';
  end if;

  if v_request.status not in ('pending', 'awaiting_receipt') then
    raise exception 'Bu ödeme talebi daha önce sonuçlandırılmış.' using errcode = 'P0001';
  end if;

  if p_decision = 'approved' and nullif(trim(coalesce(v_request.receipt_file_path, '')), '') is null then
    raise exception 'Dekont yüklenmeden ödeme onaylanamaz.' using errcode = 'P0001';
  end if;

  v_from_status := v_request.status;
  v_period_end := case
    when v_request.billing_period = 'yearly' then v_period_start + interval '1 year'
    else v_period_start + interval '1 month'
  end;

  if p_decision = 'approved' then
    if v_request.organization_id is not null then
      insert into public.organization_subscriptions (
        org_id,
        plan_code,
        status,
        billing_provider,
        starts_at,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at,
        metadata
      )
      values (
        v_request.organization_id,
        v_request.plan_code,
        'active',
        'bank_transfer',
        v_period_start,
        v_period_start,
        v_period_end,
        false,
        null,
        jsonb_build_object('manualPaymentRequestId', v_request.id, 'referenceCode', v_request.reference_code)
      )
      on conflict (org_id) do update
      set plan_code = excluded.plan_code,
          status = 'active',
          billing_provider = 'bank_transfer',
          starts_at = coalesce(public.organization_subscriptions.starts_at, excluded.starts_at),
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = false,
          canceled_at = null,
          metadata = coalesce(public.organization_subscriptions.metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = now();
    end if;

    for v_trigger in
      select tgname
      from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and not tgisinternal
    loop
      execute format('alter table public.profiles disable trigger %I', v_trigger.tgname);
    end loop;

    begin
      update public.profiles
      set subscription_plan = v_request.plan_code,
          subscription_status = 'active',
          plan_type = v_request.plan_code::public.subscription_plan_type,
          subscription_started_at = coalesce(subscription_started_at, v_period_start),
          trial_ends_at = null,
          updated_at = now()
      where id = v_request.user_id;
    exception when others then
      for v_trigger in
        select tgname
        from pg_trigger
        where tgrelid = 'public.profiles'::regclass
          and not tgisinternal
      loop
        execute format('alter table public.profiles enable trigger %I', v_trigger.tgname);
      end loop;
      raise;
    end;

    for v_trigger in
      select tgname
      from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and not tgisinternal
    loop
      execute format('alter table public.profiles enable trigger %I', v_trigger.tgname);
    end loop;

    insert into public.billing_history (
      user_id,
      organization_id,
      plan_name,
      amount,
      currency,
      status,
      billing_date,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_reference,
      invoice_url,
      metadata
    )
    values (
      v_request.user_id,
      v_request.organization_id,
      upper(v_request.plan_code) || ' Havale / EFT',
      v_request.amount,
      v_request.currency,
      'paid',
      now(),
      v_period_start,
      v_period_end,
      'Havale / EFT',
      'bank_transfer',
      v_request.reference_code,
      v_request.receipt_file_path,
      jsonb_build_object('manualPaymentRequestId', v_request.id, 'invoiceInfo', v_request.invoice_info)
    );

    insert into public.payment_events (
      provider_code,
      event_type,
      provider_event_id,
      status,
      payload
    )
    values (
      'bank_transfer',
      'manual_payment.approved',
      v_request.reference_code,
      'processed',
      to_jsonb(v_request) || jsonb_build_object('amount', v_request.amount, 'currency', v_request.currency)
    )
    on conflict (provider_code, provider_event_id) do nothing;
  end if;

  update public.manual_payment_requests
  set status = p_decision,
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      subscription_period_start = case when p_decision = 'approved' then v_period_start else subscription_period_start end,
      subscription_period_end = case when p_decision = 'approved' then v_period_end else subscription_period_end end,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.manual_payment_request_events (
    request_id,
    actor_id,
    actor_role,
    action,
    from_status,
    to_status,
    note,
    payload
  )
  values (
    v_request.id,
    v_admin_id,
    'platform_admin',
    case when p_decision = 'approved' then 'approved' else 'rejected' end,
    v_from_status,
    v_request.status,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('periodStart', v_request.subscription_period_start, 'periodEnd', v_request.subscription_period_end)
  );

  insert into public.platform_admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  values (
    v_admin_id,
    'manual_payment_' || p_decision,
    'manual_payment_requests',
    v_request.id::text,
    jsonb_build_object('referenceCode', v_request.reference_code, 'planCode', v_request.plan_code, 'amount', v_request.amount, 'note', p_note)
  );

  return jsonb_build_object('request', to_jsonb(v_request));
end;
$$;

grant execute on function public.generate_manual_payment_reference() to authenticated;
grant execute on function public.get_public_bank_transfer_settings() to anon, authenticated;
grant execute on function public.create_manual_bank_transfer_payment_request(text, text, jsonb) to authenticated;
grant execute on function public.attach_manual_payment_receipt(uuid, text, text) to authenticated;
grant execute on function public.get_my_manual_payment_requests() to authenticated;
grant execute on function public.get_platform_admin_manual_payment_requests(text, integer) to authenticated;
grant execute on function public.update_platform_admin_bank_transfer_settings(text, text, text, text) to authenticated;
grant execute on function public.review_manual_payment_request(uuid, text, text) to authenticated;
