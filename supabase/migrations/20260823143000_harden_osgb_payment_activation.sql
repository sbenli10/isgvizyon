-- OSGB satin alma akisini organizasyon sahipligi ve gercek odeme onayina baglar.

create or replace function public.guard_osgb_manual_payment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_org_id uuid;
  v_is_org_admin boolean := false;
begin
  if new.plan_code <> 'osgb' then
    return new;
  end if;

  if new.organization_id is null then
    raise exception 'OSGB paketi için önce organizasyon oluşturmanız gerekir.' using errcode = 'P0001';
  end if;

  select p.organization_id
    into v_profile_org_id
  from public.profiles p
  where p.id = new.user_id;

  if v_profile_org_id is distinct from new.organization_id then
    raise exception 'Ödeme talebindeki organizasyon kullanıcı hesabıyla eşleşmiyor.' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.user_id
      and om.status = 'active'
      and om.role in ('owner', 'admin')
  ) into v_is_org_admin;

  if not v_is_org_admin then
    raise exception 'OSGB paketi ödemesini yalnızca organizasyon sahibi veya yöneticisi başlatabilir.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_osgb_manual_payment_request on public.manual_payment_requests;
create trigger trg_guard_osgb_manual_payment_request
before insert or update of organization_id, plan_code, user_id
on public.manual_payment_requests
for each row
execute function public.guard_osgb_manual_payment_request();

create or replace function public.guard_osgb_subscription_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_user_id uuid;
  v_request_org_id uuid;
  v_request_status text;
  v_receipt_path text;
  v_valid_owner boolean := false;
begin
  if new.plan_code <> 'osgb' or new.status <> 'active' or new.billing_provider <> 'bank_transfer' then
    return new;
  end if;

  select r.user_id, r.organization_id, r.status, r.receipt_file_path
    into v_request_user_id, v_request_org_id, v_request_status, v_receipt_path
  from public.manual_payment_requests r
  where r.id = nullif(new.metadata ->> 'manualPaymentRequestId', '')::uuid;

  if v_request_user_id is null
     or v_request_org_id is distinct from new.org_id
     or v_request_status not in ('pending', 'approved')
     or nullif(trim(coalesce(v_receipt_path, '')), '') is null then
    raise exception 'Doğrulanmış dekont ve ödeme talebi olmadan OSGB üyeliği etkinleştirilemez.' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = v_request_org_id
      and om.user_id = v_request_user_id
      and om.status = 'active'
      and om.role in ('owner', 'admin')
  ) into v_valid_owner;

  if not v_valid_owner then
    raise exception 'OSGB üyeliği yalnızca organizasyon sahibi veya yöneticisi adına etkinleştirilebilir.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_osgb_subscription_activation on public.organization_subscriptions;
create trigger trg_guard_osgb_subscription_activation
before insert or update of plan_code, status, billing_provider, metadata
on public.organization_subscriptions
for each row
execute function public.guard_osgb_subscription_activation();
