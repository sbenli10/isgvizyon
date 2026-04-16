update public.isgkatip_companies c
set org_id = p.organization_id
from public.profiles p
where c.org_id = p.id
  and p.organization_id is not null
  and c.org_id <> p.organization_id;

update public.isgkatip_compliance_flags f
set org_id = p.organization_id
from public.profiles p
where f.org_id = p.id
  and p.organization_id is not null
  and f.org_id <> p.organization_id;

update public.isgkatip_sync_logs l
set org_id = p.organization_id
from public.profiles p
where l.org_id = p.id
  and p.organization_id is not null
  and l.org_id <> p.organization_id;

update public.isgkatip_assignments a
set org_id = p.organization_id
from public.profiles p
where a.org_id = p.id
  and p.organization_id is not null
  and a.org_id <> p.organization_id;

update public.isgkatip_expert_capacity ec
set org_id = p.organization_id
from public.profiles p
where ec.org_id = p.id
  and p.organization_id is not null
  and ec.org_id <> p.organization_id;

update public.isgkatip_predictive_alerts pa
set org_id = p.organization_id
from public.profiles p
where pa.org_id = p.id
  and p.organization_id is not null
  and pa.org_id <> p.organization_id;
